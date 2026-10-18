import { InvoiceBaseStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * لوحة مالية (docs/05 finDash) — office-wide finance overview. Every figure
 * is a live read from Invoice/Payment/Expense, matching the same tables the
 * invoices/expenses/ledger pages already read from.
 */

export type MonthlyRevenue = { month: string; totalMinor: number };

export type RecentTransaction = {
  id: string;
  kind: "invoice" | "payment" | "expense";
  label: string;
  amountMinor: number;
  at: Date;
};

export type FinanceDashboard = {
  outstandingMinor: number;
  overdueCount: number;
  monthRevenueMinor: number;
  monthExpenseMinor: number;
  revenueByMonth: MonthlyRevenue[];
  recent: RecentTransaction[];
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getFinanceDashboard(session: AppSession): Promise<FinanceDashboard> {
  await requireModule(session, PermModule.FINANCE, "view");
  const officeId = session.officeId;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [invoices, payments, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { officeId, deletedAt: null },
      select: { id: true, number: true, issueDate: true, totalAmount: true, baseStatus: true, payments: { select: { amount: true } } },
    }),
    prisma.payment.findMany({
      where: { officeId, invoice: { deletedAt: null } },
      select: { id: true, number: true, paymentDate: true, amount: true },
      orderBy: { paymentDate: "desc" },
      take: 10,
    }),
    prisma.expense.findMany({
      where: { officeId, deletedAt: null },
      select: { id: true, vendor: true, expenseDate: true, netAmount: true, inputVat: true },
      orderBy: { expenseDate: "desc" },
      take: 10,
    }),
  ]);

  const now = new Date();
  const thisMonth = monthKey(now);
  const revenueBuckets = new Map<string, number>();
  let monthRevenueMinor = 0;
  let outstandingMinor = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    outstandingMinor += Math.max(0, inv.totalAmount - paid);
    if (inv.baseStatus === InvoiceBaseStatus.OVERDUE) overdueCount++;
    if (inv.issueDate >= sixMonthsAgo) {
      const k = monthKey(inv.issueDate);
      revenueBuckets.set(k, (revenueBuckets.get(k) ?? 0) + inv.totalAmount);
    }
    if (monthKey(inv.issueDate) === thisMonth) monthRevenueMinor += inv.totalAmount;
  }

  const monthExpenseMinor = expenses
    .filter((e) => monthKey(e.expenseDate) === thisMonth)
    .reduce((s, e) => s + e.netAmount + e.inputVat, 0);

  const revenueByMonth: MonthlyRevenue[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    revenueByMonth.push({ month: k, totalMinor: revenueBuckets.get(k) ?? 0 });
  }

  const recent: RecentTransaction[] = [
    ...payments.map((p): RecentTransaction => ({
      id: p.id,
      kind: "payment",
      label: p.number,
      amountMinor: p.amount,
      at: p.paymentDate,
    })),
    ...expenses.map((e): RecentTransaction => ({
      id: e.id,
      kind: "expense",
      label: e.vendor ?? "—",
      amountMinor: e.netAmount + e.inputVat,
      at: e.expenseDate,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  return { outstandingMinor, overdueCount, monthRevenueMinor, monthExpenseMinor, revenueByMonth, recent };
}
