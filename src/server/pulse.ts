import { PermModule, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import { now } from "@/lib/dates";

/**
 * Pulse (نبض الفريق) ranking, computed from the real PerformanceEvent ledger
 * (src/lib/performance.ts) — no fabricated points. "This week" is a rolling
 * 7-day window ending now, matching the prototype's weekly employee-of-week
 * card without needing a calendar-week cron job.
 */

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

export async function getPulseRanking(session: AppSession): Promise<PulseRankRow[]> {
  await requireModule(session, PermModule.PULSE, "view");
  const weekAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
  return rankingSince(session.officeId, weekAgo);
}

/** Non-throwing: the Today card is shown to every role, so this must degrade
 * to "no leader yet" rather than deny access to a role without PULSE view. */
export async function getEmployeeOfWeek(officeId: string): Promise<PulseRankRow | null> {
  const weekAgo = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
  const ranking = await rankingSince(officeId, weekAgo);
  return ranking[0] ?? null;
}
