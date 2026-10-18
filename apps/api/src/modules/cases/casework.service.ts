import { Injectable } from "@nestjs/common";
import { type clientApprovalBody, type communicationBody, ErrorCode } from "@murafaa/contracts";
import {
  caseMessages,
  clientApprovalRequests,
  clientCommunications,
  contracts,
  type Tx,
  users,
} from "@murafaa/database";
import { clientApprovalAmount } from "@murafaa/rules";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { CaseAccess, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";

/**
 * Smaller case sub-records (legacy contracts.ts, communications.ts,
 * messages.ts, client-approvals.ts): contracts with a signed toggle, the
 * client contact log, the case chat (staff side) and client approval
 * requests. Module CASES + row scope throughout; the client's side of the
 * chat and of approvals arrives with the client portal (M8).
 */
@Injectable()
export class CaseworkService {
  constructor(private readonly access: CaseAccess) {}

  // ── Contracts ──

  listContracts(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select()
        .from(contracts)
        .where(and(eq(contracts.caseId, caseId), isNull(contracts.deletedAt)))
        .orderBy(asc(contracts.createdAt));
      return rows.map((c) => ({
        id: c.id,
        title: c.title,
        isSigned: c.isSigned,
        signedAt: c.signedAt?.toISOString() ?? null,
      }));
    });
  }

  addContract(p: Principal, caseId: string, title: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const [created] = await tx
        .insert(contracts)
        .values({ officeId: p.officeId, caseId, title, createdBy: p.userId })
        .returning({ id: contracts.id });
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "DOC",
        actorUserId: p.userId,
        messageKey: "event.contractAdded",
        params: { title },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "contract.add",
        entity: "cases",
        entityId: caseId,
        after: { contractId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }

  async toggleContract(p: Principal, caseId: string, contractId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const c = await this.ownContract(tx, caseId, contractId);
      const signed = !c.isSigned;
      await tx
        .update(contracts)
        .set({ isSigned: signed, signedAt: signed ? new Date() : null, updatedBy: p.userId })
        .where(eq(contracts.id, contractId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "DOC",
        actorUserId: p.userId,
        messageKey: signed ? "event.contractSigned" : "event.contractUnsigned",
        params: { title: c.title },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "contract.toggleSigned",
        entity: "cases",
        entityId: caseId,
        after: { contractId, signed },
        ...meta,
      });
    });
  }

  async removeContract(p: Principal, caseId: string, contractId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const c = await this.ownContract(tx, caseId, contractId);
      await tx
        .update(contracts)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(contracts.id, contractId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "DOC",
        actorUserId: p.userId,
        messageKey: "event.contractDeleted",
        params: { title: c.title },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "contract.delete",
        entity: "cases",
        entityId: caseId,
        after: { contractId },
        ...meta,
      });
    });
  }

  private async ownContract(tx: Tx, caseId: string, contractId: string) {
    const [c] = await tx
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.id, contractId),
          eq(contracts.caseId, caseId),
          isNull(contracts.deletedAt),
        ),
      );
    if (!c) throw new ApiException(ErrorCode.NOT_FOUND);
    return c;
  }

  // ── Client contact log ──

  listCommunications(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select({
          id: clientCommunications.id,
          type: clientCommunications.type,
          note: clientCommunications.note,
          authorName: users.name,
          createdAt: clientCommunications.createdAt,
        })
        .from(clientCommunications)
        .leftJoin(users, eq(users.id, clientCommunications.createdBy))
        .where(and(eq(clientCommunications.caseId, caseId), isNull(clientCommunications.deletedAt)))
        .orderBy(desc(clientCommunications.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    });
  }

  addCommunication(
    p: Principal,
    caseId: string,
    input: z.infer<typeof communicationBody>,
    meta: Meta,
  ) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const [created] = await tx
        .insert(clientCommunications)
        .values({
          officeId: p.officeId,
          caseId,
          type: input.type,
          note: input.note,
          createdBy: p.userId,
        })
        .returning({ id: clientCommunications.id });
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "MESSAGE",
        actorUserId: p.userId,
        messageKey: "event.communicationAdded",
        params: { type: `@clientCommunicationType.${input.type}` },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "communication.add",
        entity: "cases",
        entityId: caseId,
        after: { communicationId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }

  async removeCommunication(p: Principal, caseId: string, communicationId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const [done] = await tx
        .update(clientCommunications)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(
          and(
            eq(clientCommunications.id, communicationId),
            eq(clientCommunications.caseId, caseId),
            isNull(clientCommunications.deletedAt),
          ),
        )
        .returning({ id: clientCommunications.id });
      if (!done) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "communication.delete",
        entity: "cases",
        entityId: caseId,
        after: { communicationId },
        ...meta,
      });
    });
  }

  // ── Case chat (staff side) ──

  listMessages(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select({
          id: caseMessages.id,
          senderType: caseMessages.senderType,
          senderName: users.name,
          body: caseMessages.body,
          createdAt: caseMessages.createdAt,
        })
        .from(caseMessages)
        .leftJoin(users, eq(users.id, caseMessages.senderUserId))
        .where(eq(caseMessages.caseId, caseId))
        .orderBy(asc(caseMessages.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    });
  }

  sendMessage(p: Principal, caseId: string, body: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const [created] = await tx
        .insert(caseMessages)
        .values({
          officeId: p.officeId,
          caseId,
          senderType: "STAFF",
          senderUserId: p.userId,
          body,
          createdBy: p.userId,
        })
        .returning({ id: caseMessages.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "message.send",
        entity: "cases",
        entityId: caseId,
        after: { messageId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }

  // ── Client approval requests ──

  listClientApprovals(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select()
        .from(clientApprovalRequests)
        .where(
          and(eq(clientApprovalRequests.caseId, caseId), isNull(clientApprovalRequests.deletedAt)),
        )
        .orderBy(desc(clientApprovalRequests.createdAt));
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
        amount: r.amount,
        note: r.note,
        status: r.status,
        decisionNote: r.decisionNote,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  requestClientApproval(
    p: Principal,
    caseId: string,
    input: z.infer<typeof clientApprovalBody>,
    meta: Meta,
  ) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const [created] = await tx
        .insert(clientApprovalRequests)
        .values({
          officeId: p.officeId,
          caseId,
          title: input.title,
          kind: input.kind,
          amount: clientApprovalAmount(input.kind, input.amount),
          note: input.note,
          createdBy: p.userId,
        })
        .returning({ id: clientApprovalRequests.id });
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "APPROVAL",
        actorUserId: p.userId,
        messageKey: "event.clientApprovalCreated",
        params: { title: input.title },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "clientApproval.create",
        entity: "cases",
        entityId: caseId,
        after: { requestId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }
}
