import { Injectable } from "@nestjs/common";
import {
  ErrorCode,
  type executionProcedureBody,
  type openExecutionBody,
  type updateExecutionBody,
  type updateExecutionProcedureBody,
} from "@murafaa/contracts";
import {
  caseExecutions,
  caseReminders,
  executionProcedures,
  tasks,
  type Tx,
  users,
} from "@murafaa/database";
import { t } from "@murafaa/i18n";
import {
  cycleNext,
  EXEC_PROC_STATUSES,
  type ExecFileStatus,
  statusAfterCollection,
} from "@murafaa/rules";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { assertOfficeUser, CaseAccess, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";

const alreadyOpen = () =>
  new ApiException(ErrorCode.CONFLICT, undefined, "errors.EXECUTION_ALREADY_OPEN");

/**
 * Post-judgment execution file (تنفيذ, legacy server/execution.ts): one live
 * file per case with its enforcement procedures. Collections lock the file
 * row, so two concurrent collections cannot both read the old total.
 */
@Injectable()
export class ExecutionService {
  constructor(private readonly access: CaseAccess) {}

  get(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const ex = await this.file(tx, caseId);
      if (!ex) return { execution: null };
      const procs = await tx
        .select({
          id: executionProcedures.id,
          type: executionProcedures.type,
          status: executionProcedures.status,
          note: executionProcedures.note,
          party: executionProcedures.party,
          date: executionProcedures.date,
          followUpDate: executionProcedures.followUpDate,
          followUpAssigneeName: users.name,
        })
        .from(executionProcedures)
        .leftJoin(users, eq(users.id, executionProcedures.followUpAssigneeId))
        .where(
          and(
            eq(executionProcedures.caseExecutionId, ex.id),
            isNull(executionProcedures.deletedAt),
          ),
        )
        .orderBy(desc(executionProcedures.createdAt));
      return {
        execution: {
          id: ex.id,
          court: ex.court,
          requestNo: ex.requestNo,
          amount: ex.amount,
          collected: ex.collected,
          debtor: ex.debtor,
          basis: ex.basis,
          openedAt: ex.openedAt?.toISOString() ?? null,
          status: ex.status,
          procedures: procs.map((r) => ({
            ...r,
            date: r.date?.toISOString() ?? null,
            followUpDate: r.followUpDate?.toISOString() ?? null,
          })),
        },
      };
    });
  }

  private async file(tx: Tx, caseId: string, lock = false) {
    const q = tx
      .select()
      .from(caseExecutions)
      .where(and(eq(caseExecutions.caseId, caseId), isNull(caseExecutions.deletedAt)));
    const [ex] = lock ? await q.for("update") : await q;
    return ex;
  }

  private async mustFile(tx: Tx, caseId: string, lock = false) {
    const ex = await this.file(tx, caseId, lock);
    if (!ex) throw new ApiException(ErrorCode.NOT_FOUND, undefined, "errors.EXECUTION_NOT_OPEN");
    return ex;
  }

  async open(p: Principal, caseId: string, input: z.infer<typeof openExecutionBody>, meta: Meta) {
    try {
      return await this.access.withCase(p, caseId, meta, async (tx) => {
        if (await this.file(tx, caseId)) throw alreadyOpen();
        const [created] = await tx
          .insert(caseExecutions)
          .values({
            officeId: p.officeId,
            caseId,
            court: input.court,
            requestNo: input.requestNo,
            amount: input.amount ?? null,
            debtor: input.debtor,
            basis: input.basis,
            openedAt: input.openedAt ?? new Date(),
            createdBy: p.userId,
          })
          .returning({ id: caseExecutions.id });
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId,
          type: "SYSTEM",
          actorUserId: p.userId,
          messageKey: "event.executionOpened",
        });
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "execution.open",
          entity: "cases",
          entityId: caseId,
          ...meta,
        });
        return { id: created!.id };
      });
    } catch (e) {
      if (isUniqueViolation(e, "case_executions_one_per_case_key")) throw alreadyOpen();
      throw e;
    }
  }

  async update(
    p: Principal,
    caseId: string,
    input: z.infer<typeof updateExecutionBody>,
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const ex = await this.mustFile(tx, caseId);
      await tx
        .update(caseExecutions)
        .set({ ...input, amount: input.amount ?? null, updatedBy: p.userId })
        .where(eq(caseExecutions.id, ex.id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.update",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  async setStatus(p: Principal, caseId: string, status: ExecFileStatus, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const ex = await this.mustFile(tx, caseId);
      await tx
        .update(caseExecutions)
        .set({ status, updatedBy: p.userId })
        .where(eq(caseExecutions.id, ex.id));
      if (status === "CLOSED" && ex.status !== "CLOSED") {
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId,
          type: "SYSTEM",
          actorUserId: p.userId,
          messageKey: "event.executionClosed",
        });
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: status === "CLOSED" ? "execution.close" : "execution.status",
        entity: "cases",
        entityId: caseId,
        after: { status },
        ...meta,
      });
    });
  }

  /** Add a collected amount; the file status follows (docs rule statusAfterCollection). */
  async collect(p: Principal, caseId: string, amount: number, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const ex = await this.mustFile(tx, caseId, true);
      const collected = ex.collected + amount;
      await tx
        .update(caseExecutions)
        .set({
          collected,
          status: statusAfterCollection(ex.status, ex.amount, collected),
          updatedBy: p.userId,
        })
        .where(eq(caseExecutions.id, ex.id));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.executionCollected",
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.collect",
        entity: "cases",
        entityId: caseId,
        after: { amount },
        ...meta,
      });
    });
  }

  /**
   * A follow-up date adds a linked reminder, plus a task when someone is
   * named (prototype execSyncFollowReminder/Task). The assignee must belong to
   * this office (legacy did not check).
   */
  async addProcedure(
    p: Principal,
    caseId: string,
    input: z.infer<typeof executionProcedureBody>,
    meta: Meta,
  ) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const ex = await this.mustFile(tx, caseId);
      await assertOfficeUser(tx, input.followUpAssigneeId, "followUpAssigneeId");
      let reminderId: string | null = null;
      if (input.followUpDate) {
        const label = t("cases.execution.followUpReminderText", { type: input.type });
        const [r] = await tx
          .insert(caseReminders)
          .values({
            officeId: p.officeId,
            caseId,
            text: label,
            dueOn: input.followUpDate,
            source: "EXECUTION_FOLLOWUP",
            createdBy: p.userId,
          })
          .returning({ id: caseReminders.id });
        reminderId = r!.id;
        if (input.followUpAssigneeId) {
          await tx.insert(tasks).values({
            officeId: p.officeId,
            caseId,
            title: label,
            assigneeId: input.followUpAssigneeId,
            dueAt: input.followUpDate,
            category: "PROCEDURAL_FOLLOWUP",
            origin: "AUTO_EXECUTION_FOLLOWUP",
            createdBy: p.userId,
          });
        }
      }
      const [created] = await tx
        .insert(executionProcedures)
        .values({
          officeId: p.officeId,
          caseExecutionId: ex.id,
          type: input.type,
          note: input.note,
          party: input.party ?? null,
          date: input.date ?? null,
          followUpDate: input.followUpDate ?? null,
          followUpAssigneeId: input.followUpAssigneeId ?? null,
          reminderId,
          createdBy: p.userId,
        })
        .returning({ id: executionProcedures.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.procedure.add",
        entity: "cases",
        entityId: caseId,
        after: { procedureId: created!.id },
        ...meta,
      });
      return { id: created!.id };
    });
  }

  private async ownProcedure(tx: Tx, caseId: string, procedureId: string) {
    const ex = await this.mustFile(tx, caseId);
    const [proc] = await tx
      .select()
      .from(executionProcedures)
      .where(
        and(
          eq(executionProcedures.id, procedureId),
          eq(executionProcedures.caseExecutionId, ex.id),
          isNull(executionProcedures.deletedAt),
        ),
      );
    if (!proc) throw new ApiException(ErrorCode.NOT_FOUND);
    return proc;
  }

  async updateProcedure(
    p: Principal,
    caseId: string,
    procedureId: string,
    input: z.infer<typeof updateExecutionProcedureBody>,
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownProcedure(tx, caseId, procedureId);
      await tx
        .update(executionProcedures)
        .set({
          type: input.type,
          note: input.note,
          party: input.party ?? null,
          date: input.date ?? null,
          updatedBy: p.userId,
        })
        .where(eq(executionProcedures.id, procedureId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.procedure.update",
        entity: "cases",
        entityId: caseId,
        after: { procedureId },
        ...meta,
      });
    });
  }

  async cycleProcedure(p: Principal, caseId: string, procedureId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const proc = await this.ownProcedure(tx, caseId, procedureId);
      const next = cycleNext(EXEC_PROC_STATUSES, proc.status);
      await tx
        .update(executionProcedures)
        .set({ status: next, updatedBy: p.userId })
        .where(eq(executionProcedures.id, procedureId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.procedure.cycle",
        entity: "cases",
        entityId: caseId,
        after: { procedureId, to: next },
        ...meta,
      });
    });
  }

  /** Soft delete; its follow-up reminder goes with it so no orphan date stays on the calendar. */
  async removeProcedure(p: Principal, caseId: string, procedureId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const proc = await this.ownProcedure(tx, caseId, procedureId);
      const now = new Date();
      await tx
        .update(executionProcedures)
        .set({ deletedAt: now, updatedBy: p.userId })
        .where(eq(executionProcedures.id, procedureId));
      if (proc.reminderId) {
        await tx
          .update(caseReminders)
          .set({ deletedAt: now, updatedBy: p.userId })
          .where(eq(caseReminders.id, proc.reminderId));
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "execution.procedure.delete",
        entity: "cases",
        entityId: caseId,
        after: { procedureId },
        ...meta,
      });
    });
  }
}
