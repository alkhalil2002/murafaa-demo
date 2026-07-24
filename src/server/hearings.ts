import {
  CaseEventType,
  HearingKind,
  HearingStatus,
  PermModule,
  Prisma,
  TaskCategory,
  TaskPriority,
  TaskSource,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import { dateInDays, minusDays, plusDays, riyadhCalendarDate } from "@/lib/dates";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";
import { createAutoTask } from "./tasks";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Hearings service (docs/06 §1, §11). Records court sessions and runs the
 * post-hearing automation: next-hearing prep task, judgment → objection
 * deadline + urgent task, and advisory calendar-clash detection. All gated by
 * the القضايا module + case row-scope.
 */

const recordSchema = z.object({
  hearingDate: z.coerce.date(),
  kind: z.nativeEnum(HearingKind).optional(),
  // 0..4 = RECONCILIATION..EXECUTION (matches STAGE_BY_INDEX in cases.ts).
  stageIndex: z.number().int().min(0).max(4).nullish(),
  minutes: z.string().nullish(),
  result: z.string().nullish(),
  /** If set, schedule the (single) next upcoming hearing on this date. */
  nextHearingDate: z.coerce.date().nullish(),
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

/** Convenience for jobs/seed: today + n days (Riyadh). Re-exported from dates. */
export { dateInDays };
