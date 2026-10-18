import { Injectable } from "@nestjs/common";
import { canModule, effectiveRole, type OfficePolicy, PermModule } from "@murafaa/auth";
import { type createApprovalBody, ErrorCode } from "@murafaa/contracts";
import { caseApprovals, caseEvents, cases, hearings, type Tx, users } from "@murafaa/database";
import { APPROVAL_STAGES, approvalStepNeedsPartner, stepStage } from "@murafaa/rules";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { CaseAccess, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";
import { caseVisibility } from "./case-scope.js";

const stageParam = (stage: string) => `@approvalStage.${stage}`;

/**
 * Internal review pipeline (الاعتمادات, legacy server/approvals.ts):
 * DRAFT → SENIOR_LAWYER → COUNSEL → PROOFREADING → PARTNER → APPROVED, one
 * step at a time; reject sends it back to DRAFT. Module CASES + row scope.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly access: CaseAccess,
    private readonly policies: PolicyService,
    private readonly tenantDb: TenantDb,
  ) {}

  private isFull(policy: OfficePolicy, p: Principal) {
    return canModule(policy, effectiveRole(p), PermModule.CASES, "delete");
  }

  list(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select()
        .from(caseApprovals)
        .where(and(eq(caseApprovals.caseId, caseId), isNull(caseApprovals.deletedAt)))
        .orderBy(desc(caseApprovals.createdAt));
      const ids = rows.map((a) => a.id);
      const logs = ids.length
        ? await tx
            .select({
              id: caseEvents.id,
              approvalId: caseEvents.approvalId,
              messageKey: caseEvents.messageKey,
              params: caseEvents.params,
              text: caseEvents.text,
              actorName: users.name,
              occurredAt: caseEvents.occurredAt,
            })
            .from(caseEvents)
            .leftJoin(users, eq(users.id, caseEvents.actorUserId))
            .where(inArray(caseEvents.approvalId, ids))
            .orderBy(desc(caseEvents.occurredAt))
        : [];
      return rows.map((a) => ({
        id: a.id,
        title: a.title,
        stage: a.stage,
        hearingId: a.hearingId,
        createdAt: a.createdAt.toISOString(),
        log: logs
          .filter((e) => e.approvalId === a.id)
          .map((e) => ({
            id: e.id,
            message: e.messageKey ? { messageKey: e.messageKey, params: e.params ?? {} } : null,
            text: e.text,
            actorName: e.actorName,
            occurredAt: e.occurredAt.toISOString(),
          })),
      }));
    });
  }

  create(p: Principal, caseId: string, input: z.infer<typeof createApprovalBody>, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      if (input.hearingId) {
        const [h] = await tx
          .select({ id: hearings.id })
          .from(hearings)
          .where(
            and(
              eq(hearings.id, input.hearingId),
              eq(hearings.caseId, caseId),
              isNull(hearings.deletedAt),
            ),
          );
        if (!h)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "hearingId", message: "errors.NOT_FOUND" },
          ]);
      }
      const [created] = await tx
        .insert(caseApprovals)
        .values({
          officeId: p.officeId,
          caseId,
          title: input.title,
          hearingId: input.hearingId ?? null,
          createdBy: p.userId,
        })
        .returning({ id: caseApprovals.id });
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "APPROVAL",
        actorUserId: p.userId,
        messageKey: "event.approvalCreated",
        params: { title: input.title },
        approvalId: created!.id,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "approval.create",
        entity: "cases",
        entityId: caseId,
        after: { approvalId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }

  private async own(tx: Tx, caseId: string, approvalId: string) {
    const [a] = await tx
      .select()
      .from(caseApprovals)
      .where(
        and(
          eq(caseApprovals.id, approvalId),
          eq(caseApprovals.caseId, caseId),
          isNull(caseApprovals.deletedAt),
        ),
      );
    if (!a) throw new ApiException(ErrorCode.NOT_FOUND);
    return a;
  }

  /**
   * One step forward. Leaving the PARTNER stage is the partner's approval and
   * needs CASES at FULL. Reaching APPROVED also approves the linked hearing's
   * client report when its approval was requested.
   */
  async advance(p: Principal, caseId: string, approvalId: string, meta: Meta) {
    const policy = await this.policies.forOffice(p.officeId);
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const a = await this.own(tx, caseId, approvalId);
      const next = stepStage(APPROVAL_STAGES, a.stage, 1);
      if (next === a.stage) return;
      if (approvalStepNeedsPartner(a.stage) && !this.isFull(policy, p))
        throw new ApiException(ErrorCode.FORBIDDEN, undefined, "errors.APPROVAL_NEEDS_PARTNER");
      await tx
        .update(caseApprovals)
        .set({ stage: next, updatedBy: p.userId })
        .where(eq(caseApprovals.id, approvalId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "APPROVAL",
        actorUserId: p.userId,
        messageKey: "event.approvalAdvanced",
        params: { title: a.title, stage: stageParam(next) },
        approvalId,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "approval.advance",
        entity: "cases",
        entityId: caseId,
        after: { approvalId, to: next },
        ...meta,
      });

      if (next === "APPROVED" && a.hearingId) {
        const [approved] = await tx
          .update(hearings)
          .set({ reportApprovalRequested: false, reportApproved: true, updatedBy: p.userId })
          .where(
            and(
              eq(hearings.id, a.hearingId),
              eq(hearings.reportApprovalRequested, true),
              isNull(hearings.deletedAt),
            ),
          )
          .returning({ no: hearings.sequenceNo });
        if (approved) {
          await logCaseEvent(tx, {
            officeId: p.officeId,
            caseId,
            type: "SYSTEM",
            actorUserId: p.userId,
            messageKey: "event.hearingReportApproved",
            params: { no: approved.no ?? 0 },
          });
        }
      }
    });
  }

  async reject(p: Principal, caseId: string, approvalId: string, note: string | null, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const a = await this.own(tx, caseId, approvalId);
      await tx
        .update(caseApprovals)
        .set({ stage: "DRAFT", updatedBy: p.userId })
        .where(eq(caseApprovals.id, approvalId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "APPROVAL",
        actorUserId: p.userId,
        ...(note
          ? { messageKey: "event.approvalRejectedWithNote", params: { title: a.title, note } }
          : { messageKey: "event.approvalRejected", params: { title: a.title } }),
        approvalId,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "approval.reject",
        entity: "cases",
        entityId: caseId,
        after: { approvalId },
        ...meta,
      });
    });
  }

  async remove(p: Principal, caseId: string, approvalId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.own(tx, caseId, approvalId);
      await tx
        .update(caseApprovals)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(caseApprovals.id, approvalId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "approval.delete",
        entity: "cases",
        entityId: caseId,
        after: { approvalId },
        ...meta,
      });
    });
  }

  /**
   * Items still in review on cases the caller may see (today, notifications,
   * journey). Legacy listed every case in the office.
   */
  async pending(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: caseApprovals.id,
          title: caseApprovals.title,
          stage: caseApprovals.stage,
          caseId: cases.id,
          caseTitle: cases.title,
          createdAt: caseApprovals.createdAt,
        })
        .from(caseApprovals)
        .innerJoin(cases, eq(cases.id, caseApprovals.caseId))
        .where(
          and(
            isNull(caseApprovals.deletedAt),
            ne(caseApprovals.stage, "APPROVED"),
            caseVisibility(tx, policy, p),
          ),
        )
        .orderBy(desc(caseApprovals.createdAt)),
    );
  }
}
