import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * ربحية القضايا (docs/05 finProfit) — case profitability derived from real
 * invoiced fees minus direct case expenses, both already-existing tables
 * (Invoice.caseId, Expense.caseId). No new model needed.
 */

export type CaseProfitabilityRow = {
  caseId: string;
  caseTitle: string;
  feesMinor: number;
  expensesMinor: number;
  marginMinor: number;
};

export async function getCaseProfitability(session: AppSession): Promise<CaseProfitabilityRow[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { officeId: session.officeId, deletedAt: null, isCredited: false, caseId: { not: null } },
      select: { caseId: true, netAmount: true, case: { select: { title: true } } },
    }),
    prisma.expense.findMany({
      where: { officeId: session.officeId, deletedAt: null, caseId: { not: null } },
      select: { caseId: true, netAmount: true, inputVat: true },
    }),
  ]);

  const rows = new Map<string, CaseProfitabilityRow>();
  for (const inv of invoices) {
    if (!inv.caseId) continue;
    const r = rows.get(inv.caseId) ?? {
      caseId: inv.caseId,
      caseTitle: inv.case?.title ?? "—",
      feesMinor: 0,
      expensesMinor: 0,
      marginMinor: 0,
    };
    r.feesMinor += inv.netAmount;
    rows.set(inv.caseId, r);
  }
  for (const exp of expenses) {
    if (!exp.caseId) continue;
    const r = rows.get(exp.caseId) ?? {
      caseId: exp.caseId,
      caseTitle: "—",
      feesMinor: 0,
      expensesMinor: 0,
      marginMinor: 0,
    };
    r.expensesMinor += exp.netAmount + exp.inputVat;
    rows.set(exp.caseId, r);
  }

  return Array.from(rows.values())
    .map((r) => ({ ...r, marginMinor: r.feesMinor - r.expensesMinor }))
    .sort((a, b) => b.marginMinor - a.marginMinor);
}
