import { Injectable } from "@nestjs/common";
import { ErrorCode, type recordHearingBody, type updateHearingBody } from "@murafaa/contracts";
import {
  caseAssignees,
  caseReminders,
  cases,
  hearings,
  procedureRequests,
  type Tx,
  tasks,
  users,
} from "@murafaa/database";
import { type MessageKey, t } from "@murafaa/i18n";
import {
  autoTaskSignature,
  dateInDays,
  isJudgment,
  objectionDeadline,
  objectionReminderDue,
  plusDays,
  riyadhCalendarDate,
} from "@murafaa/rules";
import { and, asc, count, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TasksService } from "../tasks/tasks.service.js";
import { assertOfficeUser, CaseAccess, type CaseRow, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Hearings (legacy server/hearings.ts; docs/06 §1, §11). Recording a held
 * hearing runs the post-hearing automation in one transaction: judgment →
 * objection deadline (+30 days) and an urgent task due 5 days earlier; next
 * date → the single upcoming hearing, a prep task and an advisory clash
 * check. Module CASES and the case row scope apply throughout.
 */
@Injectable()
export class HearingsService {
  constructor(
    private readonly access: CaseAccess,
    private readonly tasksService: TasksService,
  ) {}

  private async assignees(tx: Tx, caseId: string) {
    return tx
      .select({ userId: caseAssignees.userId, name: users.name })
      .from(caseAssignees)
      .innerJoin(users, eq(users.id, caseAssignees.userId))
      .where(eq(caseAssignees.caseId, caseId))
      .orderBy(asc(caseAssignees.createdAt));
  }

  /**
   * A pending hearing keeps a recurring "complete hearing N" reminder
   * (prototype): any earlier one for the hearing is retired, and a new one is
   * due `every` days from today while the hearing stays pending.
   */
  private async syncPendingReminder(
    tx: Tx,
    p: Principal,
    caseId: string,
    h: { id: string; sequenceNo: number | null },
    pending: { items: readonly string[]; every: number | null } | null,
  ) {
    await tx
      .update(caseReminders)
      .set({ deletedAt: new Date(), updatedBy: p.userId })
      .where(
        and(
          eq(caseReminders.hearingId, h.id),
          eq(caseReminders.source, "PENDING_HEARING"),
          isNull(caseReminders.deletedAt),
        ),
      );
    if (!pending?.every) return;
    const no = h.sequenceNo ?? 0;
    const items = pending.items.length
      ? pending.items
          .map((k) => t(`cases.hearings.pendingItems.${k}` as MessageKey))
          .join(t("common.listSep"))
      : t("cases.hearings.pendingItems.minutes");
    await tx.insert(caseReminders).values({
      officeId: p.officeId,
      caseId,
      hearingId: h.id,
      text: t("reminder.pendingHearing", { no: no.toLocaleString("ar-SA"), items }),
      dueOn: dateInDays(pending.every),
      recurIntervalDays: pending.every,
      source: "PENDING_HEARING",
      createdBy: p.userId,
    });
    await logCaseEvent(tx, {
      officeId: p.officeId,
      caseId,
      type: "DEADLINE",
      actorUserId: p.userId,
      messageKey: "event.hearingSavedPending",
      params: { no, every: pending.every },
    });
  }

  async record(p: Principal, caseId: string, input: z.infer<typeof recordHearingBody>, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx, c) => {
      await assertOfficeUser(tx, input.actionTaskAssigneeId, "actionTaskAssigneeId");
      const [held] = await tx
        .select({ n: count() })
        .from(hearings)
        .where(
          and(eq(hearings.caseId, caseId), eq(hearings.status, "HELD"), isNull(hearings.deletedAt)),
        );
      // The upcoming hearing has now happened: retire it so no stale "next hearing" remains.
      await this.retireUpcoming(tx, caseId, p.userId);

      const [hearing] = await tx
        .insert(hearings)
        .values({
          officeId: p.officeId,
          caseId,
          sequenceNo: (held?.n ?? 0) + 1,
          hearingDate: input.hearingDate,
          status: "HELD",
          stageIndex: input.stageIndex ?? null,
          kind: input.kind ?? null,
          minutes: input.minutes,
          result: input.result,
          clientReport: input.clientReport,
          isPending: input.isPending,
          pendingItems: input.isPending ? input.pendingItems : null,
          reminderRecurDays: input.isPending ? (input.reminderRecurDays ?? null) : null,
          createdBy: p.userId,
        })
        .returning({ id: hearings.id, sequenceNo: hearings.sequenceNo });
      const hearingId = hearing!.id;
      if (input.isPending) {
        await this.syncPendingReminder(tx, p, caseId, hearing!, {
          items: input.pendingItems,
          every: input.reminderRecurDays ?? null,
        });
      }

      // Follow-up actions captured in the same wizard pass (docs BR-CASE-11).
      if (input.actionReminderText) {
        await tx.insert(caseReminders).values({
          officeId: p.officeId,
          caseId,
          hearingId,
          text: input.actionReminderText,
          dueOn: input.actionReminderDueOn ?? input.hearingDate,
          source: "HEARING_MINUTES",
          createdBy: p.userId,
        });
      }
      if (input.actionTaskTitle) {
        await tx.insert(tasks).values({
          officeId: p.officeId,
          caseId,
          hearingId,
          title: input.actionTaskTitle,
          assigneeId: input.actionTaskAssigneeId ?? null,
          dueAt: input.actionTaskDueAt ?? null,
          category: "PROCEDURAL_FOLLOWUP",
          origin: "HEARING_ACTION",
          createdBy: p.userId,
        });
      }
      if (input.actionRequestText) {
        const [req] = await tx
          .insert(procedureRequests)
          .values({
            officeId: p.officeId,
            caseId,
            hearingId,
            stageIndex: input.stageIndex ?? 0,
            party: input.actionRequestParty ?? "OURS",
            type: input.actionRequestType ?? null,
            text: input.actionRequestText,
            createdBy: p.userId,
          })
          .returning({ id: procedureRequests.id });
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId,
          type: "REQUEST",
          actorUserId: p.userId,
          messageKey: "event.procedureRequestAdded",
          params: { text: input.actionRequestType ?? input.actionRequestText },
          procedureRequestId: req!.id,
        });
      }

      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.hearingRecorded",
        params: {
          no: hearing!.sequenceNo ?? 0,
          kind: input.kind ? `@hearing.kind.${input.kind}` : "—",
        },
      });

      // (a) Judgment → objection deadline + urgent task (docs/06 §1).
      if (isJudgment(input.kind, input.result, input.minutes)) {
        const due = objectionDeadline(input.hearingDate);
        await tx
          .update(cases)
          .set({ judgmentDate: input.hearingDate, objectionDueAt: due, updatedBy: p.userId })
          .where(eq(cases.id, caseId));
        const [first] = await this.assignees(tx, caseId);
        await this.tasksService.createAuto(tx, p.officeId, p.userId, {
          caseId,
          autoSignature: autoTaskSignature.objection(caseId, iso(due)),
          title: t("task.autoObjectionTitle", { due: iso(due) }),
          assigneeId: first?.userId ?? null,
          priority: "URGENT",
          category: "MEMO_DRAFTING",
          dueAt: objectionReminderDue(due),
          origin: "AUTO_OBJECTION",
        });
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId,
          type: "DEADLINE",
          actorUserId: p.userId,
          messageKey: "event.objectionDeadline",
          params: { due: iso(due) },
        });
      }

      // (b) Next hearing → single upcoming + prep task + clash check.
      if (input.nextHearingDate) await this.scheduleNext(tx, p, c, input.nextHearingDate);

      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.record",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
      return { id: hearingId };
    });
  }

  async setNext(p: Principal, caseId: string, date: Date, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx, c) => {
      await this.scheduleNext(tx, p, c, date);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.setNext",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  /** At most one upcoming hearing per case (docs BR-CASE-04); the old one is soft-deleted. */
  private retireUpcoming(tx: Tx, caseId: string, by: string) {
    return tx
      .update(hearings)
      .set({ deletedAt: new Date(), updatedBy: by })
      .where(
        and(
          eq(hearings.caseId, caseId),
          eq(hearings.status, "UPCOMING"),
          isNull(hearings.deletedAt),
        ),
      );
  }

  private async scheduleNext(tx: Tx, p: Principal, c: CaseRow, date: Date) {
    await this.retireUpcoming(tx, c.id, p.userId);
    await tx.insert(hearings).values({
      officeId: p.officeId,
      caseId: c.id,
      hearingDate: date,
      status: "UPCOMING",
      createdBy: p.userId,
    });
    await logCaseEvent(tx, {
      officeId: p.officeId,
      caseId: c.id,
      type: "DEADLINE",
      actorUserId: p.userId,
      messageKey: "event.nextHearingSet",
      params: { date: iso(date) },
    });

    const team = await this.assignees(tx, c.id);
    await this.tasksService.createAuto(tx, p.officeId, p.userId, {
      caseId: c.id,
      autoSignature: autoTaskSignature.hearingPrep(c.id, iso(date)),
      title: t("task.autoPrepTitle", { case: c.title }),
      assigneeId: team[0]?.userId ?? null,
      priority: "NORMAL",
      category: "PROCEDURAL_FOLLOWUP",
      dueAt: date,
      origin: "AUTO_HEARING_PREP",
    });

    // Advisory clash (docs/06 §11): another case of the same assignee has a hearing that Riyadh day.
    // The event records a count, never the other cases' titles (they may be out of the viewer's scope).
    if (team.length) {
      const dayStart = riyadhCalendarDate(date);
      const clashes = await tx
        .selectDistinct({ caseId: hearings.caseId, userId: caseAssignees.userId })
        .from(hearings)
        .innerJoin(cases, eq(cases.id, hearings.caseId))
        .innerJoin(caseAssignees, eq(caseAssignees.caseId, hearings.caseId))
        .where(
          and(
            ne(hearings.caseId, c.id),
            isNull(hearings.deletedAt),
            isNull(cases.deletedAt),
            gte(hearings.hearingDate, dayStart),
            lt(hearings.hearingDate, plusDays(dayStart, 1)),
            inArray(
              caseAssignees.userId,
              team.map((a) => a.userId),
            ),
          ),
        );
      if (clashes.length) {
        const who = team.find((a) => a.userId === clashes[0]!.userId)?.name ?? "";
        const caseCount = new Set(clashes.map((x) => x.caseId)).size;
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId: c.id,
          type: "SYSTEM",
          actorUserId: p.userId,
          messageKey: "event.hearingClashGeneric",
          params: { name: who, count: caseCount },
        });
      }
    }
  }

  private async ownHearing(tx: Tx, caseId: string, hearingId: string) {
    const [h] = await tx
      .select()
      .from(hearings)
      .where(
        and(eq(hearings.id, hearingId), eq(hearings.caseId, caseId), isNull(hearings.deletedAt)),
      );
    if (!h) throw new ApiException(ErrorCode.NOT_FOUND);
    return h;
  }

  async update(
    p: Principal,
    caseId: string,
    hearingId: string,
    input: z.infer<typeof updateHearingBody>,
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const h = await this.ownHearing(tx, caseId, hearingId);
      const pending = input.isPending ?? h.isPending;
      const items = pending ? (input.pendingItems ?? h.pendingItems ?? []) : [];
      const every = pending ? (input.reminderRecurDays ?? h.reminderRecurDays) : null;
      if (
        input.isPending !== undefined ||
        input.pendingItems ||
        input.reminderRecurDays !== undefined
      ) {
        await this.syncPendingReminder(tx, p, caseId, h, pending ? { items, every } : null);
      }
      await tx
        .update(hearings)
        .set({
          ...input,
          pendingItems: pending ? (input.pendingItems ?? h.pendingItems ?? []) : null,
          reminderRecurDays: pending ? (input.reminderRecurDays ?? h.reminderRecurDays) : null,
          updatedBy: p.userId,
        })
        .where(eq(hearings.id, hearingId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.hearingUpdated",
        params: { no: h.sequenceNo ?? 0 },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.update",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  /** Soft delete (module CASES at FULL, checked by the controller). */
  async remove(p: Principal, caseId: string, hearingId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      await tx
        .update(hearings)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(hearings.id, hearingId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.delete",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  // ── Follow-up actions on a hearing (legacy hearing.actions[]) ──

  async addReminder(
    p: Principal,
    caseId: string,
    hearingId: string,
    r: { text: string; dueOn: Date; recurIntervalDays?: number | null },
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      await tx.insert(caseReminders).values({
        officeId: p.officeId,
        caseId,
        hearingId,
        text: r.text,
        dueOn: r.dueOn,
        recurIntervalDays: r.recurIntervalDays ?? null,
        createdBy: p.userId,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.addReminder",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  async updateReminder(
    p: Principal,
    caseId: string,
    hearingId: string,
    reminderId: string,
    r: { text: string; dueOn: Date },
    meta: Meta,
  ) {
    await this.reminderOp(p, caseId, hearingId, reminderId, meta, "hearing.updateReminder", (tx) =>
      tx
        .update(caseReminders)
        .set({ text: r.text, dueOn: r.dueOn, updatedBy: p.userId })
        .where(eq(caseReminders.id, reminderId)),
    );
  }

  async removeReminder(
    p: Principal,
    caseId: string,
    hearingId: string,
    reminderId: string,
    meta: Meta,
  ) {
    await this.reminderOp(p, caseId, hearingId, reminderId, meta, "hearing.deleteReminder", (tx) =>
      tx
        .update(caseReminders)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(caseReminders.id, reminderId)),
    );
  }

  /** Turn a reminder into a real task for the responsible person (legacy "↗ أرسله لقسمه"). */
  async escalateReminder(
    p: Principal,
    caseId: string,
    hearingId: string,
    reminderId: string,
    assigneeId: string | null,
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await assertOfficeUser(tx, assigneeId, "assigneeId");
      const r = await this.ownReminder(tx, hearingId, reminderId);
      await tx.insert(tasks).values({
        officeId: p.officeId,
        caseId,
        hearingId,
        title: r.text,
        assigneeId,
        dueAt: r.dueOn,
        category: "PROCEDURAL_FOLLOWUP",
        origin: "HEARING_ACTION",
        createdBy: p.userId,
      });
      await tx
        .update(caseReminders)
        .set({ isTaskLinked: true, updatedBy: p.userId })
        .where(eq(caseReminders.id, reminderId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.escalateReminder",
        entity: "cases",
        entityId: caseId,
        after: { reminderId },
        ...meta,
      });
    });
  }

  private async ownReminder(tx: Tx, hearingId: string, reminderId: string) {
    const [r] = await tx
      .select()
      .from(caseReminders)
      .where(
        and(
          eq(caseReminders.id, reminderId),
          eq(caseReminders.hearingId, hearingId),
          isNull(caseReminders.deletedAt),
        ),
      );
    if (!r) throw new ApiException(ErrorCode.NOT_FOUND);
    return r;
  }

  private async reminderOp(
    p: Principal,
    caseId: string,
    hearingId: string,
    reminderId: string,
    meta: Meta,
    action: string,
    op: (tx: Tx) => Promise<unknown>,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      await this.ownReminder(tx, hearingId, reminderId);
      await op(tx);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action,
        entity: "cases",
        entityId: caseId,
        after: { reminderId },
        ...meta,
      });
    });
  }

  async addTask(
    p: Principal,
    caseId: string,
    hearingId: string,
    task: { title: string; assigneeId?: string | null; dueAt?: Date | null },
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      await assertOfficeUser(tx, task.assigneeId, "assigneeId");
      await tx.insert(tasks).values({
        officeId: p.officeId,
        caseId,
        hearingId,
        title: task.title,
        assigneeId: task.assigneeId ?? null,
        dueAt: task.dueAt ?? null,
        category: "PROCEDURAL_FOLLOWUP",
        origin: "HEARING_ACTION",
        createdBy: p.userId,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.addTask",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  async updateTask(
    p: Principal,
    caseId: string,
    hearingId: string,
    taskId: string,
    task: { title: string; assigneeId?: string | null; dueAt?: Date | null; done?: boolean },
    meta: Meta,
  ) {
    await this.taskOp(p, caseId, hearingId, taskId, meta, "hearing.updateTask", async (tx) => {
      await assertOfficeUser(tx, task.assigneeId, "assigneeId");
      await tx
        .update(tasks)
        .set({
          title: task.title,
          assigneeId: task.assigneeId ?? null,
          dueAt: task.dueAt ?? null,
          ...(task.done === undefined
            ? {}
            : {
                status: task.done ? ("DONE" as const) : ("NEW" as const),
                completedAt: task.done ? new Date() : null,
              }),
          updatedBy: p.userId,
        })
        .where(eq(tasks.id, taskId));
    });
  }

  async removeTask(p: Principal, caseId: string, hearingId: string, taskId: string, meta: Meta) {
    await this.taskOp(p, caseId, hearingId, taskId, meta, "hearing.deleteTask", (tx) =>
      tx
        .update(tasks)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(tasks.id, taskId)),
    );
  }

  private async taskOp(
    p: Principal,
    caseId: string,
    hearingId: string,
    taskId: string,
    meta: Meta,
    action: string,
    op: (tx: Tx) => Promise<unknown>,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.hearingId, hearingId), isNull(tasks.deletedAt)));
      if (!task) throw new ApiException(ErrorCode.NOT_FOUND);
      await op(tx);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action,
        entity: "cases",
        entityId: caseId,
        after: { taskId },
        ...meta,
      });
    });
  }

  // ── Client report approval (legacy request → partner-tier decision) ──

  async requestReportApproval(p: Principal, caseId: string, hearingId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const h = await this.ownHearing(tx, caseId, hearingId);
      if (!h.clientReport)
        throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.HEARING_HAS_NO_REPORT");
      if (h.reportApproved)
        throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.REPORT_ALREADY_APPROVED");
      await tx
        .update(hearings)
        .set({ reportApprovalRequested: true, updatedBy: p.userId })
        .where(eq(hearings.id, hearingId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.hearingReportApprovalRequested",
        params: { no: h.sequenceNo ?? 0 },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.report.requestApproval",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  async cancelReportApproval(p: Principal, caseId: string, hearingId: string, meta: Meta) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      await this.ownHearing(tx, caseId, hearingId);
      await tx
        .update(hearings)
        .set({ reportApprovalRequested: false, updatedBy: p.userId })
        .where(eq(hearings.id, hearingId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "hearing.report.cancelApproval",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }

  /**
   * Partner-tier decision (CASES at FULL). Approval is recorded; sharing the
   * report PDF on the client portal comes with the documents module, so
   * reportSentToClient stays false until a PDF is actually shared.
   */
  async decideReport(
    p: Principal,
    caseId: string,
    hearingId: string,
    approve: boolean,
    meta: Meta,
  ) {
    await this.access.withCase(p, caseId, meta, async (tx) => {
      const h = await this.ownHearing(tx, caseId, hearingId);
      if (!h.reportApprovalRequested)
        throw new ApiException(
          ErrorCode.CONFLICT,
          undefined,
          "errors.REPORT_APPROVAL_NOT_REQUESTED",
        );
      await tx
        .update(hearings)
        .set({
          reportApprovalRequested: false,
          ...(approve ? { reportApproved: true } : {}),
          updatedBy: p.userId,
        })
        .where(eq(hearings.id, hearingId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: approve ? "event.hearingReportApproved" : "event.hearingReportRejected",
        params: { no: h.sequenceNo ?? 0 },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: approve ? "hearing.report.approve" : "hearing.report.reject",
        entity: "cases",
        entityId: caseId,
        after: { hearingId },
        ...meta,
      });
    });
  }
}
