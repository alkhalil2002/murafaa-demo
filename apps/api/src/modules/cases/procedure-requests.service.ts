import { Injectable } from "@nestjs/common";
import { ErrorCode, type procedureRequestBody } from "@murafaa/contracts";
import { hearings, procedureRequests } from "@murafaa/database";
import { cycleNext, PROCEDURE_REQUEST_STATUSES } from "@murafaa/rules";
import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { CaseAccess, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";

/** Procedural requests within a stage (legacy server/procedure-requests.ts), module CASES + row scope. */
@Injectable()
export class ProcedureRequestsService {
  constructor(private readonly access: CaseAccess) {}

  async add(p: Principal, caseId: string, input: z.infer<typeof procedureRequestBody>, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      if (input.hearingId) {
        const [h] = await tx
          .select({ id: hearings.id })
          .from(hearings)
          .where(and(eq(hearings.id, input.hearingId), eq(hearings.caseId, caseId)));
        if (!h)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "hearingId", message: "errors.NOT_FOUND" },
          ]);
      }
      const [created] = await tx
        .insert(procedureRequests)
        .values({
          officeId: p.officeId,
          caseId,
          ...input,
          type: input.type ?? null,
          hearingId: input.hearingId ?? null,
          createdBy: p.userId,
        })
        .returning({ id: procedureRequests.id });
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "REQUEST",
        actorUserId: p.userId,
        messageKey: "event.procedureRequestAdded",
        params: { text: input.type ?? input.text },
        procedureRequestId: created!.id,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "procedureRequest.add",
        entity: "cases",
        entityId: caseId,
        after: { requestId: created!.id },
        ...meta,
      });
    });
  }

  /** مُقدّم → قيد النظر → مقبول → مرفوض → مُقدّم (legacy STATUS_CYCLE). */
  async cycleStatus(p: Principal, caseId: string, requestId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const r = await this.own(tx, caseId, requestId);
      const next = cycleNext(PROCEDURE_REQUEST_STATUSES, r.status);
      await tx
        .update(procedureRequests)
        .set({ status: next, updatedBy: p.userId })
        .where(eq(procedureRequests.id, requestId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "REQUEST",
        actorUserId: p.userId,
        messageKey: "event.procedureRequestStatusChanged",
        params: { type: r.type ?? r.text, status: `@procedureRequestStatus.${next}` },
        procedureRequestId: requestId,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "procedureRequest.cycleStatus",
        entity: "cases",
        entityId: caseId,
        after: { requestId, to: next },
        ...meta,
      });
    });
  }

  async remove(p: Principal, caseId: string, requestId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const r = await this.own(tx, caseId, requestId);
      await tx
        .update(procedureRequests)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(procedureRequests.id, requestId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "REQUEST",
        actorUserId: p.userId,
        messageKey: "event.procedureRequestDeleted",
        params: { type: r.type ?? r.text },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "procedureRequest.delete",
        entity: "cases",
        entityId: caseId,
        after: { requestId },
        ...meta,
      });
    });
  }

  private async own(
    tx: Parameters<Parameters<CaseAccess["withCase"]>[3]>[0],
    caseId: string,
    requestId: string,
  ) {
    const [r] = await tx
      .select()
      .from(procedureRequests)
      .where(
        and(
          eq(procedureRequests.id, requestId),
          eq(procedureRequests.caseId, caseId),
          isNull(procedureRequests.deletedAt),
        ),
      );
    if (!r) throw new ApiException(ErrorCode.NOT_FOUND);
    return r;
  }
}
