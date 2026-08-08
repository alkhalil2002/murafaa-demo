import {
  CaseEventType,
  HearingKind,
  HearingStatus,
  PermModule,
  Prisma,
  TaskCategory,
  TaskColumn,
  TaskPriority,
  TaskSource,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { logPerformance } from "@/lib/performance";
import { t } from "@/lib/i18n";
import { dateInDays, minusDays, plusDays, riyadhCalendarDate } from "@/lib/dates";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";
import { createAutoTask } from "./tasks";
import { generateHearingReportPdf } from "./documents";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Hearings service (docs/06 §1, §11). Records court sessions and runs the
 * post-hearing automation: next-hearing prep task, judgment → objection
 * deadline + urgent task, and advisory calendar-clash detection. All gated by
 * the القضايا module + case row-scope.
 */

/** The two pending-item kinds from the prototype's wizard step 4 (docs BR-CASE-11). */
export const HEARING_PENDING_ITEMS = ["minutes", "nextHearing"] as const;
export type HearingPendingItem = (typeof HEARING_PENDING_ITEMS)[number];

const recordSchema = z.object({
  hearingDate: z.coerce.date(),
  kind: z.nativeEnum(HearingKind).optional(),
  // 0..4 = RECONCILIATION..EXECUTION (matches STAGE_BY_INDEX in cases.ts).
  stageIndex: z.number().int().min(0).max(4).nullish(),
  minutes: z.string().nullish(),
  result: z.string().nullish(),
  clientReport: z.string().nullish(),
  /** If set, schedule the (single) next upcoming hearing on this date. */
  nextHearingDate: z.coerce.date().nullish(),
  isPending: z.boolean().optional(),
  pendingItems: z.array(z.enum(HEARING_PENDING_ITEMS)).optional(),
  reminderRecurDays: z.number().int().positive().nullish(),
});
export type RecordHearingInput = z.infer<typeof recordSchema>;

// Judgment detection. The explicit JUDGMENT_PRONOUNCEMENT kind is the reliable
// signal; when a kind IS provided we decide solely on it (a preliminary hearing
// is never a judgment, even if its minutes mention the court). The text regex is
// only a fallback for when no kind was recorded, and is scoped to judgment
// phrases — NOT bare "حكم", which is a substring of "المحكمة" (the court) and
// would false-positive on ordinary hearings.
const JUDGMENT_TEXT = /بالحكم|صدر الحكم|صدور الحكم|نطقت/;
function isJudgment(kind: HearingKind | undefined | null, result?: string | null, minutes?: string | null) {
  if (kind != null) return kind === HearingKind.JUDGMENT_PRONOUNCEMENT;
  return JUDGMENT_TEXT.test(`${result ?? ""} ${minutes ?? ""}`);
}

async function loadVisibleCase(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true, user: { select: { name: true } } } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");
  return c;
}

/**
 * Record a held hearing and run automation. Optionally schedules the next
 * hearing. Runs inside one transaction so the hearing, deadline, tasks, and
 * timeline events all commit together.
 */
export async function recordHearing(session: AppSession, caseId: string, raw: RecordHearingInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = recordSchema.parse(raw);
  const c = await loadVisibleCase(session, caseId);

  const result = await prisma.$transaction(async (tx) => {
    const heldCount = await tx.hearing.count({
      where: { officeId: session.officeId, caseId, status: HearingStatus.HELD, deletedAt: null },
    });
    // The upcoming hearing has now occurred and is being recorded as held;
    // drop any pending upcoming row so it isn't left as a stale past-dated
    // "next hearing" (docs BR-CASE-04: at most one upcoming). If a next hearing
    // is scheduled below, scheduleNextHearing re-creates a fresh one.
    await tx.hearing.deleteMany({
      where: { officeId: session.officeId, caseId, status: HearingStatus.UPCOMING },
    });
    const hearing = await tx.hearing.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        caseId,
        sequenceNo: heldCount + 1,
        hearingDate: input.hearingDate,
        status: HearingStatus.HELD,
        stageIndex: input.stageIndex ?? null,
        kind: input.kind ?? null,
        minutes: input.minutes ?? null,
        result: input.result ?? null,
        clientReport: input.clientReport ?? null,
        isPending: input.isPending ?? false,
        pendingItems: input.isPending ? (input.pendingItems ?? []) : Prisma.JsonNull,
        reminderRecurDays: input.isPending ? (input.reminderRecurDays ?? null) : null,
      },
    });
    await logCaseEvent(tx, {
      officeId: session.officeId,
      caseId,
      type: CaseEventType.SYSTEM,
      description: t("event.hearingRecorded", {
        no: hearing.sequenceNo ?? 0,
        kind: input.kind ? t(`hearing.kind.${input.kind}`) : "—",
      }),
      actorUserId: session.userId,
    });

    // (a) Judgment → objection deadline + urgent task (docs/06 §1, BR-TASK-1).
    if (isJudgment(input.kind, input.result, input.minutes)) {
      const due = plusDays(input.hearingDate, 30);
      await tx.case.update({
        where: { id: caseId },
        data: { judgmentDate: input.hearingDate, objectionDueAt: due },
      });
      const dueIso = due.toISOString().slice(0, 10);
      await createAutoTask(tx, session, {
        caseId,
        autoSignature: `obj:${caseId}:${dueIso}`,
        title: t("task.autoObjectionTitle", { due: dueIso }),
        assigneeId: c.assignees[0]?.userId ?? null,
        priority: TaskPriority.URGENT,
        category: TaskCategory.MEMO_DRAFTING,
        dueAt: minusDays(due, 5),
        origin: TaskSource.AUTO_OBJECTION,
      });
      await logCaseEvent(tx, {
        officeId: session.officeId,
        caseId,
        type: CaseEventType.DEADLINE,
        description: t("event.objectionDeadline", { due: dueIso }),
        actorUserId: session.userId,
      });
    }

    // (b) Next hearing scheduled → single upcoming + prep task + clash check.
    if (input.nextHearingDate) {
      await scheduleNextHearing(tx, session, caseId, c.title, c.assignees, input.nextHearingDate);
    }

    await logPerformance(tx, {
      officeId: session.officeId,
      userId: session.userId,
      kind: "HEARING_RECORDED",
    });

    return hearing;
  });

  await logAudit({ session, action: "hearing.record", resource: "cases", targetId: caseId });
  return result;
}

/** Set the single upcoming hearing (docs BR-CASE-04) + prep task + clash. */
export async function setNextHearing(session: AppSession, caseId: string, date: Date) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await loadVisibleCase(session, caseId);
  await prisma.$transaction(async (tx) => {
    await scheduleNextHearing(tx, session, caseId, c.title, c.assignees, date);
  });
  await logAudit({ session, action: "hearing.setNext", resource: "cases", targetId: caseId });
}

async function scheduleNextHearing(
  tx: Db,
  session: AppSession,
  caseId: string,
  caseTitle: string,
  assignees: { userId: string; user: { name: string } }[],
  date: Date,
) {
  // At most one upcoming hearing (docs BR-CASE-04): drop prior upcoming first.
  await tx.hearing.deleteMany({
    where: { officeId: session.officeId, caseId, status: HearingStatus.UPCOMING },
  });
  await tx.hearing.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      hearingDate: date,
      status: HearingStatus.UPCOMING,
    },
  });
  await logCaseEvent(tx, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.DEADLINE,
    description: t("event.nextHearingSet", { date: date.toISOString().slice(0, 10) }),
    actorUserId: session.userId,
  });

  // Prep task (docs BR-TASK-2), idempotent.
  await createAutoTask(tx, session, {
    caseId,
    autoSignature: `prep:${caseId}:${date.toISOString().slice(0, 10)}`,
    title: t("task.autoPrepTitle", { case: caseTitle }),
    assigneeId: assignees[0]?.userId ?? null,
    priority: TaskPriority.NORMAL,
    category: TaskCategory.PROCEDURAL_FOLLOWUP,
    dueAt: date,
    origin: TaskSource.AUTO_HEARING_PREP,
  });

  // Advisory clash detection (docs/06 §11, BR-CASE-06): same assignee, same day.
  const myAssigneeIds = assignees.map((a) => a.userId);
  if (myAssigneeIds.length) {
    const dayStart = riyadhCalendarDate(date);
    const dayEnd = plusDays(dayStart, 1);
    const clashes = await tx.case.findMany({
      where: {
        officeId: session.officeId,
        deletedAt: null,
        id: { not: caseId },
        assignees: { some: { userId: { in: myAssigneeIds } } },
        hearings: { some: { deletedAt: null, hearingDate: { gte: dayStart, lt: dayEnd } } },
      },
      select: {
        assignees: {
          where: { userId: { in: myAssigneeIds } },
          select: { user: { select: { name: true } } },
        },
      },
    });
    if (clashes.length) {
      const who = clashes[0]?.assignees[0]?.user.name ?? "";
      // Persisted on the subject case's timeline (visible to co-assignees who
      // may not see the clashing cases) — so record a COUNT, not their titles,
      // to avoid leaking out-of-scope case names.
      await logCaseEvent(tx, {
        officeId: session.officeId,
        caseId,
        type: CaseEventType.SYSTEM,
        description: t("event.hearingClashGeneric", { name: who, count: clashes.length }),
        actorUserId: session.userId,
      });
    }
  }
}

async function loadOwnHearing(session: AppSession, caseId: string, hearingId: string) {
  await loadVisibleCase(session, caseId);
  const h = await prisma.hearing.findFirst({
    where: { id: hearingId, caseId, officeId: session.officeId, deletedAt: null },
  });
  if (!h) throw new PermissionError("scope");
  return h;
}

const updateSchema = z.object({
  hearingDate: z.coerce.date().optional(),
  kind: z.nativeEnum(HearingKind).nullish(),
  stageIndex: z.number().int().min(0).max(4).nullish(),
  minutes: z.string().nullish(),
  result: z.string().nullish(),
  clientReport: z.string().nullish(),
  isPending: z.boolean().optional(),
  pendingItems: z.array(z.enum(HEARING_PENDING_ITEMS)).optional(),
  reminderRecurDays: z.number().int().positive().nullish(),
});
export type UpdateHearingInput = z.infer<typeof updateSchema>;

/** Edit an already-recorded hearing (prototype hrEdit/hrSaveEdit). */
export async function updateHearing(
  session: AppSession,
  caseId: string,
  hearingId: string,
  raw: UpdateHearingInput,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = updateSchema.parse(raw);
  await loadOwnHearing(session, caseId, hearingId);

  const updated = await prisma.hearing.update({
    where: { id: hearingId },
    data: {
      hearingDate: input.hearingDate,
      kind: input.kind,
      stageIndex: input.stageIndex,
      minutes: input.minutes,
      result: input.result,
      clientReport: input.clientReport,
      isPending: input.isPending,
      pendingItems: input.isPending
        ? ((input.pendingItems ?? []) as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      reminderRecurDays: input.isPending ? input.reminderRecurDays : null,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.hearingUpdated", { no: updated.sequenceNo ?? 0 }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "hearing.update", resource: "cases", targetId: caseId, detail: hearingId });
  return updated;
}

export async function deleteHearing(session: AppSession, caseId: string, hearingId: string) {
  await requireModule(session, PermModule.CASES, "delete");
  await loadOwnHearing(session, caseId, hearingId);
  await prisma.hearing.update({ where: { id: hearingId }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "hearing.delete", resource: "cases", targetId: caseId, detail: hearingId });
}

const reminderSchema = z.object({
  text: z.string().trim().min(1),
  dueOn: z.coerce.date(),
  recurIntervalDays: z.number().int().positive().nullish(),
});

/** A hearing follow-up "reminder"-kind action (prototype hearing.actions[]
 * kind2="تذكير") — a real CaseReminder linked back to its hearing. */
export async function addHearingReminder(
  session: AppSession,
  caseId: string,
  hearingId: string,
  raw: z.infer<typeof reminderSchema>,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = reminderSchema.parse(raw);
  await loadOwnHearing(session, caseId, hearingId);
  const created = await prisma.caseReminder.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      hearingId,
      text: input.text,
      dueOn: input.dueOn,
      recurIntervalDays: input.recurIntervalDays ?? null,
    },
  });
  await logAudit({ session, action: "hearing.addReminder", resource: "cases", targetId: caseId, detail: hearingId });
  return created;
}

const hearingTaskSchema = z.object({
  title: z.string().trim().min(1),
  assigneeId: z.string().uuid().nullish(),
  dueAt: z.coerce.date().nullish(),
});

/** A hearing follow-up "task"-kind action (prototype hearing.actions[]
 * kind2="مهمة") — a real Task linked back to its hearing. */
export async function addHearingTask(
  session: AppSession,
  caseId: string,
  hearingId: string,
  raw: z.infer<typeof hearingTaskSchema>,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = hearingTaskSchema.parse(raw);
  await loadOwnHearing(session, caseId, hearingId);
  const created = await prisma.task.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      hearingId,
      title: input.title,
      assigneeId: input.assigneeId ?? null,
      dueAt: input.dueAt ?? null,
      category: TaskCategory.PROCEDURAL_FOLLOWUP,
      origin: TaskSource.HEARING_ACTION,
    },
  });
  await logAudit({ session, action: "hearing.addTask", resource: "cases", targetId: caseId, detail: hearingId });
  return created;
}

async function loadOwnHearingReminder(session: AppSession, caseId: string, hearingId: string, reminderId: string) {
  await loadOwnHearing(session, caseId, hearingId);
  const r = await prisma.caseReminder.findFirst({
    where: { id: reminderId, hearingId, officeId: session.officeId, deletedAt: null },
  });
  if (!r) throw new PermissionError("scope");
  return r;
}

async function loadOwnHearingTask(session: AppSession, caseId: string, hearingId: string, taskId: string) {
  await loadOwnHearing(session, caseId, hearingId);
  const tsk = await prisma.task.findFirst({
    where: { id: taskId, hearingId, officeId: session.officeId, deletedAt: null },
  });
  if (!tsk) throw new PermissionError("scope");
  return tsk;
}

/**
 * Client-report approval — a real request/decide workflow (prototype
 * hrRequestReportApproval → hrOwnerApprove/rejectReportApproval), not a
 * self-service toggle. Requesting is a normal case-edit action (any lawyer
 * finishing a hearing); deciding requires FULL-level access on القضايا
 * (the office's partner tier by default) — matching how other high-stakes
 * case actions (credit notes, write-offs) are gated one level above edit.
 */
export async function requestReportApproval(session: AppSession, caseId: string, hearingId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const h = await loadOwnHearing(session, caseId, hearingId);
  if (!h.clientReport) throw new Error("HEARING_HAS_NO_REPORT");
  if (h.reportSentToClient) throw new Error("REPORT_ALREADY_SENT");
  const updated = await prisma.hearing.update({
    where: { id: hearingId },
    data: { reportApprovalRequested: true },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.hearingReportApprovalRequested", { no: h.sequenceNo ?? 0 }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "hearing.report.requestApproval", resource: "cases", targetId: caseId, detail: hearingId });
  return updated;
}

export async function cancelReportApprovalRequest(session: AppSession, caseId: string, hearingId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnHearing(session, caseId, hearingId);
  const updated = await prisma.hearing.update({
    where: { id: hearingId },
    data: { reportApprovalRequested: false },
  });
  await logAudit({ session, action: "hearing.report.cancelApproval", resource: "cases", targetId: caseId, detail: hearingId });
  return updated;
}

/** Partner-tier decision. On approve: auto-generates the report PDF if needed and publishes it to the client portal. */
export async function decideReportApproval(
  session: AppSession,
  caseId: string,
  hearingId: string,
  approve: boolean,
) {
  await requireModule(session, PermModule.CASES, "delete");
  const h = await loadOwnHearing(session, caseId, hearingId);
  if (!h.reportApprovalRequested) throw new Error("REPORT_APPROVAL_NOT_REQUESTED");

  if (!approve) {
    const updated = await prisma.hearing.update({
      where: { id: hearingId },
      data: { reportApprovalRequested: false },
    });
    await logCaseEvent(prisma, {
      officeId: session.officeId,
      caseId,
      type: CaseEventType.SYSTEM,
      description: t("event.hearingReportRejected", { no: h.sequenceNo ?? 0 }),
      actorUserId: session.userId,
    });
    await logAudit({ session, action: "hearing.report.reject", resource: "cases", targetId: caseId, detail: hearingId });
    return updated;
  }

  let doc = await prisma.document.findFirst({
    where: { officeId: session.officeId, caseId, hearingId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) doc = await generateHearingReportPdf(session, caseId, hearingId);
  await prisma.document.update({ where: { id: doc.id }, data: { clientVisible: true } });

  const updated = await prisma.hearing.update({
    where: { id: hearingId },
    data: { reportApprovalRequested: false, reportApproved: true, reportSentToClient: true },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.hearingReportApproved", { no: h.sequenceNo ?? 0 }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "hearing.report.approve", resource: "cases", targetId: caseId, detail: hearingId });
  return updated;
}

/** Escalate a hearing reminder to a real Task for the responsible department (prototype "↗ أرسله لقسمه"). */
export async function escalateHearingReminder(
  session: AppSession,
  caseId: string,
  hearingId: string,
  reminderId: string,
  assigneeId: string | null,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const r = await loadOwnHearingReminder(session, caseId, hearingId, reminderId);
  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        caseId,
        hearingId,
        title: r.text,
        assigneeId,
        dueAt: r.dueOn,
        category: TaskCategory.PROCEDURAL_FOLLOWUP,
        origin: TaskSource.HEARING_ACTION,
      },
    });
    await tx.caseReminder.update({ where: { id: reminderId }, data: { isTaskLinked: true } });
    return task;
  });
  await logAudit({ session, action: "hearing.escalateReminder", resource: "cases", targetId: caseId, detail: reminderId });
  return created;
}

const updateHearingReminderSchema = z.object({
  text: z.string().trim().min(1),
  dueOn: z.coerce.date(),
});

/** Edit an existing hearing-linked reminder in place (prototype hrEditForm row). */
export async function updateHearingReminder(
  session: AppSession,
  caseId: string,
  hearingId: string,
  reminderId: string,
  raw: z.infer<typeof updateHearingReminderSchema>,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = updateHearingReminderSchema.parse(raw);
  await loadOwnHearingReminder(session, caseId, hearingId, reminderId);
  const updated = await prisma.caseReminder.update({
    where: { id: reminderId },
    data: { text: input.text, dueOn: input.dueOn },
  });
  await logAudit({ session, action: "hearing.updateReminder", resource: "cases", targetId: caseId, detail: reminderId });
  return updated;
}

export async function deleteHearingReminder(session: AppSession, caseId: string, hearingId: string, reminderId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnHearingReminder(session, caseId, hearingId, reminderId);
  await prisma.caseReminder.update({ where: { id: reminderId }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "hearing.deleteReminder", resource: "cases", targetId: caseId, detail: reminderId });
}

const updateHearingTaskSchema = z.object({
  title: z.string().trim().min(1),
  assigneeId: z.string().uuid().nullish(),
  dueAt: z.coerce.date().nullish(),
  done: z.boolean().optional(),
});

/** Edit an existing hearing-linked task in place (prototype hrEditForm row). */
export async function updateHearingTask(
  session: AppSession,
  caseId: string,
  hearingId: string,
  taskId: string,
  raw: z.infer<typeof updateHearingTaskSchema>,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = updateHearingTaskSchema.parse(raw);
  await loadOwnHearingTask(session, caseId, hearingId, taskId);
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      assigneeId: input.assigneeId ?? null,
      dueAt: input.dueAt ?? null,
      ...(input.done !== undefined
        ? { status: input.done ? TaskColumn.DONE : TaskColumn.NEW, completedAt: input.done ? new Date() : null }
        : {}),
    },
  });
  await logAudit({ session, action: "hearing.updateTask", resource: "cases", targetId: caseId, detail: taskId });
  return updated;
}

export async function deleteHearingTask(session: AppSession, caseId: string, hearingId: string, taskId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnHearingTask(session, caseId, hearingId, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "hearing.deleteTask", resource: "cases", targetId: caseId, detail: taskId });
}

/** Follow-up reminders + tasks recorded against a hearing (for its detail card). */
export async function getHearingActions(session: AppSession, caseId: string, hearingId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadOwnHearing(session, caseId, hearingId);
  const [reminders, tasks] = await Promise.all([
    prisma.caseReminder.findMany({
      where: { hearingId, officeId: session.officeId, deletedAt: null },
      orderBy: { dueOn: "asc" },
    }),
    prisma.task.findMany({
      where: { hearingId, officeId: session.officeId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { assignee: { select: { name: true } } },
    }),
  ]);
  return { reminders, tasks };
}

/** Convenience for jobs/seed: today + n days (Riyadh). Re-exported from dates. */
export { dateInDays };
