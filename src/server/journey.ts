import { AppointmentType, CaseStatus, InvoiceBaseStatus, LeadStage, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule, canAction } from "@/lib/permissions/guard";
import { getDeadlines } from "@/server/deadlines";
import { getNotifications } from "@/server/notifications";
import { listPendingApprovals } from "@/server/approvals";
import { remainingOf, paidOf } from "@/lib/finance/core";

/**
 * رحلة العميل — cross-module client-journey funnel (docs/05, prototype
 * `renderJourney()`). Purely aggregative and read-only: every number is a
 * live read from the module that owns it (leads, appointments, cases,
 * approvals, invoices, deadlines, notifications) — nothing here is its own
 * source of truth. WhatsApp-sourced counts (أول تواصل / محادثات واردة) stay
 * at 0 until the WhatsApp module lands (docs/02 Phase 7); no fabrication.
 */

export type JourneySummary = {
  firstContact: number;
  inboundChats: number;
  leadsByStage: Record<LeadStage, number>;
  inPipeline: number;
  appointments: number;
  followUps: number;
  contracted: number;
  activeCases: number;
  pendingApprovals: number;
  invoicesDue: number;
  uncollectedMinor: number;
  archivedCases: number;
  deadlinesWithin7: number;
  unreadNotifications: number;
  avgSatisfaction: number | null;
};

export async function getJourneySummary(session: AppSession): Promise<JourneySummary> {
  await requireModule(session, PermModule.REPORTS, "view");

  const [canClients, canAppointments, canCases, canFinance] = await Promise.all([
    canAction(session, PermModule.CLIENTS, "view"),
    canAction(session, PermModule.APPOINTMENTS, "view"),
    canAction(session, PermModule.CASES, "view"),
    canAction(session, PermModule.FINANCE, "view"),
  ]);

  const leadsByStage: Record<LeadStage, number> = {
    PROSPECT: 0,
    FIRST_CONSULTATION: 0,
    FEE_PROPOSAL_SENT: 0,
    CONTRACTED: 0,
  };
  let firstContact = 0;
  if (canClients) {
    const rows = await prisma.lead.groupBy({
      by: ["stage"],
      where: { officeId: session.officeId, deletedAt: null },
      _count: { _all: true },
    });
    for (const r of rows) leadsByStage[r.stage] = r._count._all;
    firstContact = Object.values(leadsByStage).reduce((a, b) => a + b, 0);
  }
  const inPipeline = firstContact - leadsByStage.CONTRACTED;

  let appointments = 0;
  let followUps = 0;
  if (canAppointments) {
    appointments = await prisma.appointment.count({ where: { officeId: session.officeId, deletedAt: null } });
    followUps = await prisma.appointment.count({
      where: { officeId: session.officeId, deletedAt: null, type: AppointmentType.FOLLOW_UP },
    });
  }

  let activeCases = 0;
  let archivedCases = 0;
  let avgSatisfaction: number | null = null;
  let pendingApprovals = 0;
  if (canCases) {
    [activeCases, archivedCases] = await Promise.all([
      prisma.case.count({ where: { officeId: session.officeId, deletedAt: null, status: CaseStatus.ACTIVE } }),
      prisma.case.count({ where: { officeId: session.officeId, deletedAt: null, isArchived: true } }),
    ]);
    const scored = await prisma.case.aggregate({
      where: { officeId: session.officeId, deletedAt: null, clientSatisfactionScore: { not: null } },
      _avg: { clientSatisfactionScore: true },
    });
    avgSatisfaction = scored._avg.clientSatisfactionScore;
    const pending = await listPendingApprovals(session);
    pendingApprovals = pending.length;
  }

  let invoicesDue = 0;
  let uncollectedMinor = 0;
  if (canFinance) {
    const invoices = await prisma.invoice.findMany({
      where: {
        officeId: session.officeId,
        deletedAt: null,
        baseStatus: { in: [InvoiceBaseStatus.DUE, InvoiceBaseStatus.OVERDUE] },
      },
      select: { totalAmount: true, payments: { where: { isApproved: true }, select: { amount: true } } },
    });
    invoicesDue = invoices.length;
    uncollectedMinor = invoices.reduce((sum, inv) => sum + remainingOf(inv.totalAmount, paidOf(inv.payments)), 0);
  }

  const [deadlines, notifications] = await Promise.all([
    canAppointments ? getDeadlines(session) : Promise.resolve([]),
    getNotifications(session),
  ]);

  return {
    firstContact,
    inboundChats: 0,
    leadsByStage,
    inPipeline,
    appointments,
    followUps,
    contracted: leadsByStage.CONTRACTED,
    activeCases,
    pendingApprovals,
    invoicesDue,
    uncollectedMinor,
    archivedCases,
    deadlinesWithin7: deadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7).length,
    unreadNotifications: notifications.length,
    avgSatisfaction,
  };
}
