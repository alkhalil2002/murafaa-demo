import { ExpensePaymentMethod, PaymentMethod, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * البنوك والصندوق (docs/05 finBank) — where the money actually sits, derived
 * from the same Payment/Expense method fields the invoices/expenses pages
 * already record (no new BankAccount model): bank transfer + مدى settle to
 * the current account, cash to the till, cheques tracked separately, and
 * client trust stays in its own ledger (src/server/trust.ts).
 */

export type BankSummary = {
  currentAccount: { inflowMinor: number; outflowMinor: number };
  cash: { inflowMinor: number; outflowMinor: number };
  cheques: { inflowMinor: number; outflowMinor: number };
  trustBalanceMinor: number;
};

export async function getBankSummary(session: AppSession): Promise<BankSummary> {
  await requireModule(session, PermModule.FINANCE, "view");
  const officeId = session.officeId;

  const [payments, expenses, trustAccounts] = await Promise.all([
    prisma.payment.findMany({
      where: { officeId, invoice: { deletedAt: null } },
      select: { method: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { officeId, deletedAt: null },
      select: { method: true, netAmount: true, inputVat: true },
    }),
    prisma.trustAccount.findMany({ where: { officeId, deletedAt: null }, select: { balanceMinor: true } }),
  ]);

  const summary: BankSummary = {
    currentAccount: { inflowMinor: 0, outflowMinor: 0 },
    cash: { inflowMinor: 0, outflowMinor: 0 },
    cheques: { inflowMinor: 0, outflowMinor: 0 },
    trustBalanceMinor: trustAccounts.reduce((s, a) => s + a.balanceMinor, 0),
  };

  for (const p of payments) {
    if (p.method === PaymentMethod.BANK_TRANSFER || p.method === PaymentMethod.MADA) {
      summary.currentAccount.inflowMinor += p.amount;
    } else if (p.method === PaymentMethod.CASH) {
      summary.cash.inflowMinor += p.amount;
    } else if (p.method === PaymentMethod.CHEQUE) {
      summary.cheques.inflowMinor += p.amount;
    }
  }
  for (const e of expenses) {
    const total = e.netAmount + e.inputVat;
    if (e.method === ExpensePaymentMethod.BANK_TRANSFER || e.method === ExpensePaymentMethod.MADA) {
      summary.currentAccount.outflowMinor += total;
    } else if (e.method === ExpensePaymentMethod.CASH) {
      summary.cash.outflowMinor += total;
    } else if (e.method === ExpensePaymentMethod.CHEQUE) {
      summary.cheques.outflowMinor += total;
    }
  }

  return summary;
}
