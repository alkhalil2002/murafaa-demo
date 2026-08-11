import { CaseStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { canAction } from "@/lib/permissions/guard";
import { caseScopeWhere } from "@/lib/permissions/scope";
import { getDeadlines } from "@/server/deadlines";
import { RIYADH_TZ, urgencyOf, type Urgency } from "@/lib/dates";

/**
 * Time-series and distribution aggregates for the dashboard charts.
 *
 * Kept separate from `dashboard.ts` (the KPI summary) because these are the
 * expensive queries — a caller that only needs the counters shouldn't pay for
 * twelve months of invoice rows.
 *
 * Every section is gated by its own module permission and, for case-derived
 * series, the caller's row scope — same three-layer enforcement as every other
 * page. A role without FINANCE simply gets `revenue: null` and the chart is
 * omitted, rather than seeing an empty chart that implies "no revenue".
 *
 * Month buckets are computed in Asia/Riyadh, not UTC. Bucketing by
 * `toISOString().slice(0, 7)` would push anything from the first three hours of
 * a Riyadh month into the previous one.
 */

export const MONTHS_BACK = 12;

export type MonthPoint = { key: string; label: string; value: number };
export type SeriesPoint = { key: string; label: string; a: number; b: number };

export type DashboardCharts = {
  /** New cases opened per month. */
  caseIntake: MonthPoint[] | null;
  /** Invoiced (a) vs collected (b) per month, in halalas. */
  revenue: SeriesPoint[] | null;
  /** Case count per Najiz main classification, descending. */
  byClassification: { label: string; count: number }[] | null;
  /** Deadline count per urgency band. */
  deadlinesByUrgency: { urgency: Urgency; count: number }[] | null;
};

/** `YYYY-MM` for an instant, in Riyadh rather than UTC. */
function riyadhMonthKey(at: Date): string {
  // en-CA yields YYYY-MM-DD; slice to the month.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .slice(0, 7);
}

const MONTH_LABEL = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  timeZone: RIYADH_TZ,
  month: "short",
});

/** The last `MONTHS_BACK` month keys, oldest first, with Arabic short labels. */
function monthBuckets(now = new Date()): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    out.push({ key: riyadhMonthKey(d), label: MONTH_LABEL.format(d) });
  }
  return out;
}

/** Inclusive lower bound for the query window: start of the oldest bucket. */
function windowStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1), 1));
}

const URGENCY_ORDER: Urgency[] = ["overdue", "critical", "soon", "upcoming", "normal"];

export async function getDashboardCharts(session: AppSession): Promise<DashboardCharts> {
  const [canCases, canFinance, canAppointments] = await Promise.all([
    canAction(session, PermModule.CASES, "view"),
    canAction(session, PermModule.FINANCE, "view"),
    canAction(session, PermModule.APPOINTMENTS, "view"),
  ]);

  const buckets = monthBuckets();
  const since = windowStart();

  // ── case intake + classification (CASES, row-scoped) ──────────────────
  let caseIntake: MonthPoint[] | null = null;
  let byClassification: { label: string; count: number }[] | null = null;

  if (canCases) {
    const scope = await caseScopeWhere(session);
    const [opened, classes] = await Promise.all([
      prisma.case.findMany({
        where: { ...scope, deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.case.groupBy({
        by: ["najizMainClass"],
        where: { ...scope, deletedAt: null, status: CaseStatus.ACTIVE },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const c of opened) {
      const k = riyadhMonthKey(c.createdAt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    caseIntake = buckets.map((b) => ({ ...b, value: counts.get(b.key) ?? 0 }));

    byClassification = classes
      .filter((r) => r.najizMainClass)
      .map((r) => ({ label: r.najizMainClass as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  // ── invoiced vs collected (FINANCE) ───────────────────────────────────
  let revenue: SeriesPoint[] | null = null;

  if (canFinance) {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { officeId: session.officeId, deletedAt: null, issueDate: { gte: since } },
        select: { issueDate: true, totalAmount: true },
      }),
      prisma.payment.findMany({
        where: { officeId: session.officeId, deletedAt: null, paymentDate: { gte: since } },
        select: { paymentDate: true, amount: true },
      }),
    ]);

    const invoiced = new Map<string, number>();
    for (const i of invoices) {
      const k = riyadhMonthKey(i.issueDate);
      invoiced.set(k, (invoiced.get(k) ?? 0) + i.totalAmount);
    }
    const collected = new Map<string, number>();
    for (const p of payments) {
      const k = riyadhMonthKey(p.paymentDate);
      collected.set(k, (collected.get(k) ?? 0) + p.amount);
    }

    revenue = buckets.map((b) => ({
      ...b,
      a: invoiced.get(b.key) ?? 0,
      b: collected.get(b.key) ?? 0,
    }));
  }

  // ── deadlines by urgency (APPOINTMENTS) ───────────────────────────────
  let deadlinesByUrgency: { urgency: Urgency; count: number }[] | null = null;

  if (canAppointments) {
    const deadlines = await getDeadlines(session);
    const tally = new Map<Urgency, number>();
    for (const d of deadlines) {
      const u = urgencyOf(d.date);
      tally.set(u, (tally.get(u) ?? 0) + 1);
    }
    deadlinesByUrgency = URGENCY_ORDER.map((u) => ({ urgency: u, count: tally.get(u) ?? 0 }));
  }

  return { caseIntake, revenue, byClassification, deadlinesByUrgency };
}
