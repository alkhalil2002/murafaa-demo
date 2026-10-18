import { Injectable } from "@nestjs/common";
import { ErrorCode, type portalDecideBody } from "@murafaa/contracts";
import { caseMessages, cases, clientApprovalRequests, hearings, type Tx } from "@murafaa/database";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { type PortalMeta, portalAudit } from "../../common/audit/portal-audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { PortalPrincipal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

/**
 * A case of this client, or 404. The client portal's only scope: a client
 * sees their own cases and nothing else (legacy loadOwnPortalCase).
 */
export async function clientCase(tx: Tx, clientId: string, caseId: string) {
  const [c] = await tx
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.clientId, clientId), isNull(cases.deletedAt)));
  if (!c) throw new ApiException(ErrorCode.NOT_FOUND);
  return c;
}

/**
 * The cases module's side of بوابة العميل (legacy server/portal.ts): the
 * client's cases with their next hearing, the case chat and the approvals
 * the office asked for. Only client-safe fields leave this service.
 */
@Injectable()
export class ClientCasesService {
  constructor(private readonly tenantDb: TenantDb) {}

  private async nextHearings(tx: Tx, caseIds: string[]) {
    if (caseIds.length === 0) return new Map<string, Date>();
    const rows = await tx
      .select({ caseId: hearings.caseId, at: hearings.hearingDate })
      .from(hearings)
      .where(
        and(
          inArray(hearings.caseId, caseIds),
          eq(hearings.status, "UPCOMING"),
          isNull(hearings.deletedAt),
        ),
      )
      .orderBy(asc(hearings.hearingDate));
    const map = new Map<string, Date>();
    for (const r of rows) if (!map.has(r.caseId)) map.set(r.caseId, r.at);
    return map;
  }

  list(clientId: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(cases)
        .where(and(eq(cases.clientId, clientId), isNull(cases.deletedAt)))
        .orderBy(desc(cases.createdAt));
      const next = await this.nextHearings(
        tx,
        rows.map((c) => c.id),
      );
      return rows.map((c) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        stage: c.stage,
        status: c.status,
        nextHearing: next.get(c.id)?.toISOString() ?? null,
      }));
    });
  }

  /** Case header, chat and approvals; documents come from the documents module. */
  detail(clientId: string, caseId: string) {
    return this.tenantDb.run(async (tx) => {
      const c = await clientCase(tx, clientId, caseId);
      const next = await this.nextHearings(tx, [caseId]);
      const messages = await tx
        .select()
        .from(caseMessages)
        .where(and(eq(caseMessages.caseId, caseId), isNull(caseMessages.deletedAt)))
        .orderBy(asc(caseMessages.createdAt));
      const approvals = await tx
        .select()
        .from(clientApprovalRequests)
        .where(
          and(eq(clientApprovalRequests.caseId, caseId), isNull(clientApprovalRequests.deletedAt)),
        )
        .orderBy(desc(clientApprovalRequests.createdAt));
      return {
        id: c.id,
        number: c.number,
        title: c.title,
        stage: c.stage,
        status: c.status,
        nextHearing: next.get(caseId)?.toISOString() ?? null,
        objectionDueAt: c.objectionDueAt?.toISOString() ?? null,
        messages: messages.map((m) => ({
          id: m.id,
          senderType: m.senderType,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
        approvals: approvals.map((a) => ({
          id: a.id,
          title: a.title,
          kind: a.kind,
          amount: a.amount,
          note: a.note,
          status: a.status,
          decisionNote: a.decisionNote,
        })),
      };
    });
  }

  sendMessage(who: PortalPrincipal, caseId: string, body: string, meta: PortalMeta) {
    return this.tenantDb.run(async (tx) => {
      await clientCase(tx, who.subjectId, caseId);
      const [m] = await tx
        .insert(caseMessages)
        .values({ officeId: who.officeId, caseId, senderType: "CLIENT", body })
        .returning({ id: caseMessages.id });
      await portalAudit(tx, who, meta, {
        action: "portal.message.send",
        entity: "case_messages",
        entityId: m!.id,
        after: { caseId },
      });
      return { id: m!.id };
    });
  }

  /** A pending approval is decided once, under a row lock. */
  decide(
    who: PortalPrincipal,
    caseId: string,
    approvalId: string,
    input: z.infer<typeof portalDecideBody>,
    meta: PortalMeta,
  ) {
    return this.tenantDb.run(async (tx) => {
      await clientCase(tx, who.subjectId, caseId);
      const [a] = await tx
        .select({ status: clientApprovalRequests.status })
        .from(clientApprovalRequests)
        .where(
          and(
            eq(clientApprovalRequests.id, approvalId),
            eq(clientApprovalRequests.caseId, caseId),
            isNull(clientApprovalRequests.deletedAt),
          ),
        )
        .for("update");
      if (!a) throw new ApiException(ErrorCode.NOT_FOUND);
      if (a.status !== "PENDING")
        throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.APPROVAL_ALREADY_DECIDED");
      const status = input.approve ? "APPROVED" : "REJECTED";
      await tx
        .update(clientApprovalRequests)
        .set({ status, decisionNote: input.note })
        .where(eq(clientApprovalRequests.id, approvalId));
      await portalAudit(tx, who, meta, {
        action: "portal.approval.decide",
        entity: "client_approval_requests",
        entityId: approvalId,
        after: { caseId, status },
      });
    });
  }
}
