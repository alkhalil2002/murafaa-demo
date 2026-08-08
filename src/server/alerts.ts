import { CaseStatus, ConflictSeverity, InvoiceBaseStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule, canAction } from "@/lib/permissions/guard";
import { getDeadlines } from "@/server/deadlines";
import { urgencyOf } from "@/lib/dates";
import { t } from "@/lib/i18n";

/**
 * التنبيهات الذكية (docs/05) — a proactive, 3-tier (حرج/مهم/معلوماتي) read
 * of real signals already computed elsewhere: overdue/critical deadlines
 * (src/server/deadlines.ts), conflict-of-interest flags (docs/06 §4,
 * Case.conflictSeverity), overdue invoices, and cases with no hearing yet.
 * No stored Alert table — like /notifications, this is a live view, not an
 * independent source of truth.
 */

export type AlertTier = "critical" | "important" | "info";

export type AlertItem = {
  id: string;
  tier: AlertTier;
  text: string;
  href: string;
};

export async function getSmartAlerts(session: AppSession): Promise<AlertItem[]> {
  await requireModule(session, PermModule.ALERTS, "view");

  const [canAppointments, canCases, canFinance] = await Promise.all([
    canAction(session, PermModule.APPOINTMENTS, "view"),
    canAction(session, PermModule.CASES, "view"),
    canAction(session, PermModule.FINANCE, "view"),
  ]);

  const items: AlertItem[] = [];

  if (canAppointments) {
    const deadlines = await getDeadlines(session);
    for (const d of deadlines) {
      const u = urgencyOf(d.date);
      if (u === "overdue") {
        items.push({
          id: `deadline:${d.caseId}:${d.date}`,
          tier: "critical",
          text: t("alerts.deadlineOverdue", { title: d.caseTitle }),
          href: `/cases/${d.caseId}`,
        });
      } else if (u === "critical") {
        items.push({
          id: `deadline:${d.caseId}:${d.date}`,
          tier: "important",
          text: t("alerts.deadlineSoon", { title: d.caseTitle }),
          href: `/cases/${d.caseId}`,
        });
      }
    }
  }

  if (canCases) {
    const conflicted = await prisma.case.findMany({
      where: { officeId: session.officeId, deletedAt: null, conflictSeverity: { not: null } },
      select: { id: true, title: true, conflictSeverity: true },
    });
    for (const c of conflicted) {
      items.push({
        id: `conflict:${c.id}`,
        tier: c.conflictSeverity === ConflictSeverity.HIGH ? "critical" : "important",
        text: t("alerts.conflict", { title: c.title }),
        href: `/cases/${c.id}`,
      });
    }

    const emptyCases = await prisma.case.findMany({
      where: { officeId: session.officeId, deletedAt: null, status: CaseStatus.ACTIVE, hearings: { none: {} } },
      select: { id: true, title: true },
    });
    for (const c of emptyCases) {
      items.push({
        id: `empty:${c.id}`,
        tier: "info",
        text: t("alerts.emptyFile", { title: c.title }),
        href: `/cases/${c.id}`,
      });
    }
  }

  if (canFinance) {
    const overdue = await prisma.invoice.findMany({
      where: { officeId: session.officeId, deletedAt: null, baseStatus: InvoiceBaseStatus.OVERDUE },
      select: { id: true, number: true, caseId: true },
    });
    for (const inv of overdue) {
      items.push({
        id: `invoice:${inv.id}`,
        tier: "important",
        text: t("alerts.invoiceOverdue", { number: inv.number }),
        href: `/finance/${inv.id}`,
      });
    }
  }

  const rank: Record<AlertTier, number> = { critical: 0, important: 1, info: 2 };
  return items.sort((a, b) => rank[a.tier] - rank[b.tier]);
}
