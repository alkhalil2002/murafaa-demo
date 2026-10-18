import { CaseStatus, PermModule, TaskColumn } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule, canAction } from "@/lib/permissions/guard";
import { getDeadlines } from "@/server/deadlines";
import { computeWinRate } from "@/server/today";
import { urgencyOf } from "@/lib/dates";

/**
 * لوحة المعلومات — office-wide overview (docs/05, prototype `renderDashboard()`).
 * A read-only aggregation, composed from the same gated services as other
 * pages (deadlines for the alert count) rather than duplicating queries.
 */

export type DashboardSummary = {
  activeCases: number;
  winRatePct: number | null;
  criticalAlerts: number;
  clients: number;
  openTasks: number;
  byClassification: { label: string; count: number }[];
};

export async function getDashboardSummary(session: AppSession): Promise<DashboardSummary> {
  await requireModule(session, PermModule.REPORTS, "view");

  const [activeCases, clients, openTasks, canAppointments, canCases] = await Promise.all([
    prisma.case.count({ where: { officeId: session.officeId, deletedAt: null, status: CaseStatus.ACTIVE } }),
    prisma.client.count({ where: { officeId: session.officeId, deletedAt: null } }),
    prisma.task.count({
      where: {
        officeId: session.officeId,
        deletedAt: null,
        status: { in: [TaskColumn.NEW, TaskColumn.IN_PROGRESS] },
      },
    }),
    canAction(session, PermModule.APPOINTMENTS, "view"),
    canAction(session, PermModule.CASES, "view"),
  ]);

  let criticalAlerts = 0;
  if (canAppointments) {
    const deadlines = await getDeadlines(session);
    criticalAlerts = deadlines.filter((d) => {
      const u = urgencyOf(d.date);
      return u === "overdue" || u === "critical";
    }).length;
  }

  const winRatePct = canCases ? await computeWinRate(session.officeId) : null;

  let byClassification: { label: string; count: number }[] = [];
  if (canCases) {
    const rows = await prisma.case.groupBy({
      by: ["najizMainClass"],
      where: { officeId: session.officeId, deletedAt: null },
      _count: { _all: true },
    });
    byClassification = rows
      .filter((r) => r.najizMainClass)
      .map((r) => ({ label: r.najizMainClass as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  return { activeCases, winRatePct, criticalAlerts, clients, openTasks, byClassification };
}
