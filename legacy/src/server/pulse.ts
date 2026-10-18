import { PerformanceEventKind, PermModule, Role, TaskColumn } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { canAction, requireModule } from "@/lib/permissions/guard";
import { PERFORMANCE_POINTS } from "@/lib/performance";
import { now } from "@/lib/dates";
import { logAudit } from "@/lib/audit";

/**
 * Pulse (نبض الفريق) ranking, computed from the real PerformanceEvent ledger
 * (src/lib/performance.ts) — no fabricated points. Supports the prototype's
 * time-window toggle, team totals, per-person drill-down, and editable point
 * weights, plus a self-service fallback card for roles without PULSE view
 * (docs/05: every logged-in user sees their own card even if they can't see
 * the team leaderboard).
 */

export const PULSE_WINDOWS = ["today", "week", "month"] as const;
export type PulseWindow = (typeof PULSE_WINDOWS)[number];

function sinceFor(window: PulseWindow): Date {
  const n = now();
  if (window === "today") return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (window === "month") return new Date(n.getFullYear(), n.getMonth(), 1);
  return new Date(n.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export type PulseRankRow = {
  userId: string;
  name: string;
  role: Role | null;
  points: number;
};

async function rankingSince(officeId: string, since: Date): Promise<PulseRankRow[]> {
  const rows = await prisma.performanceEvent.groupBy({
    by: ["userId"],
    where: { officeId, occurredAt: { gte: since } },
    _sum: { points: true },
  });
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, role: true },
  });
  const userOf = new Map(users.map((u) => [u.id, u]));

  return rows
    .map((r) => {
      const u = userOf.get(r.userId);
      return { userId: r.userId, name: u?.name ?? "—", role: u?.role ?? null, points: r._sum.points ?? 0 };
    })
    .sort((a, b) => b.points - a.points);
}

export async function getPulseRanking(session: AppSession, window: PulseWindow = "week"): Promise<PulseRankRow[]> {
  await requireModule(session, PermModule.PULSE, "view");
  return rankingSince(session.officeId, sinceFor(window));
}

/** Non-throwing: the Today card is shown to every role, so this must degrade
 * to "no leader yet" rather than deny access to a role without PULSE view. */
export async function getEmployeeOfWeek(officeId: string): Promise<PulseRankRow | null> {
  const ranking = await rankingSince(officeId, sinceFor("week"));
  return ranking[0] ?? null;
}

export type PulseTeamTotals = {
  totalPoints: number;
  tasksCompleted: number;
  hearingsLogged: number;
};

export async function getPulseTeamTotals(session: AppSession, window: PulseWindow = "week"): Promise<PulseTeamTotals> {
  await requireModule(session, PermModule.PULSE, "view");
  const since = sinceFor(window);
  const rows = await prisma.performanceEvent.groupBy({
    by: ["kind"],
    where: { officeId: session.officeId, occurredAt: { gte: since } },
    _sum: { points: true },
    _count: true,
  });
  let totalPoints = 0;
  let tasksCompleted = 0;
  let hearingsLogged = 0;
  for (const r of rows) {
    totalPoints += r._sum.points ?? 0;
    if (r.kind === PerformanceEventKind.TASK_COMPLETED) tasksCompleted = r._count;
    if (r.kind === PerformanceEventKind.HEARING_RECORDED) hearingsLogged = r._count;
  }
  return { totalPoints, tasksCompleted, hearingsLogged };
}

export type PulseSelfCard = {
  points: number;
  tasksDone: number;
  completionRatePct: number;
  events: { id: string; kind: PerformanceEventKind; points: number; occurredAt: Date }[];
};

/** Non-throwing self-service card — always available regardless of PULSE permission. */
export async function getPulseSelfCard(session: AppSession, window: PulseWindow = "week"): Promise<PulseSelfCard> {
  const since = sinceFor(window);
  const [events, assignedCount, doneCount] = await Promise.all([
    prisma.performanceEvent.findMany({
      where: { officeId: session.officeId, userId: session.userId, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: { id: true, kind: true, points: true, occurredAt: true },
    }),
    prisma.task.count({ where: { officeId: session.officeId, assigneeId: session.userId, deletedAt: null } }),
    prisma.task.count({
      where: { officeId: session.officeId, assigneeId: session.userId, deletedAt: null, status: TaskColumn.DONE },
    }),
  ]);
  const points = events.reduce((s, e) => s + e.points, 0);
  return {
    points,
    tasksDone: doneCount,
    completionRatePct: assignedCount > 0 ? Math.round((doneCount / assignedCount) * 100) : 0,
    events,
  };
}

/** Per-person drill-down (prototype pulseDrill) — requires PULSE view (manager/HR). */
export async function getPulseDrilldown(session: AppSession, userId: string, window: PulseWindow = "week") {
  await requireModule(session, PermModule.PULSE, "view");
  const since = sinceFor(window);
  const [user, events] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, officeId: session.officeId }, select: { id: true, name: true, role: true } }),
    prisma.performanceEvent.findMany({
      where: { officeId: session.officeId, userId, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      select: { id: true, kind: true, points: true, occurredAt: true },
    }),
  ]);
  return { user, events };
}

export type PulseWeightRow = { kind: PerformanceEventKind; points: number; isDefault: boolean };

export async function getPerformanceWeights(session: AppSession): Promise<PulseWeightRow[]> {
  await requireModule(session, PermModule.PULSE, "view");
  const overrides = await prisma.officePerformanceWeight.findMany({ where: { officeId: session.officeId } });
  const overrideOf = new Map(overrides.map((o) => [o.kind, o.points]));
  return Object.values(PerformanceEventKind).map((kind) => ({
    kind,
    points: overrideOf.get(kind) ?? PERFORMANCE_POINTS[kind],
    isDefault: !overrideOf.has(kind),
  }));
}

/** Editable point weights (prototype pulseSaveWeights) — manager/HR-tier only. */
export async function setPerformanceWeight(session: AppSession, kind: PerformanceEventKind, points: number) {
  await requireModule(session, PermModule.PULSE, "delete");
  if (!Number.isInteger(points) || points < 0) throw new Error("PULSE_WEIGHT_INVALID");
  await prisma.officePerformanceWeight.upsert({
    where: { officeId_kind: { officeId: session.officeId, kind } },
    create: { officeId: session.officeId, kind, points, updatedById: session.userId },
    update: { points, updatedById: session.userId },
  });
  await logAudit({ session, action: "pulse.setWeight", resource: "hr", targetId: kind, detail: String(points) });
}

/** Reset a kind back to the hardcoded default (prototype pulseResetWeights). */
export async function resetPerformanceWeight(session: AppSession, kind: PerformanceEventKind) {
  await requireModule(session, PermModule.PULSE, "delete");
  await prisma.officePerformanceWeight.deleteMany({ where: { officeId: session.officeId, kind } });
  await logAudit({ session, action: "pulse.resetWeight", resource: "hr", targetId: kind });
}

export async function canViewPulseTeam(session: AppSession): Promise<boolean> {
  return canAction(session, PermModule.PULSE, "view");
}
