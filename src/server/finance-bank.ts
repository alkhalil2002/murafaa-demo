import { ExpensePaymentMethod, PaymentMethod, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

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

export const BANK_ACCOUNTS = ["CURRENT", "CASH", "CHEQUE"] as const;
export type BankAccountKey = (typeof BANK_ACCOUNTS)[number];

export type BankLedgerRow = {
  id: string;
  kind: "PAYMENT" | "EXPENSE";
  date: Date;
  amountMinor: number; // signed: +inflow / -outflow
  description: string;
  cleared: boolean;
};

/**
 * Bank reconciliation ledger (docs/05 finBank bankLedger/bankToggleClear) —
 * every payment (inflow) and expense (outflow) settled through one method
 * group, in date order, so staff can mark each line as cleared against the
 * real bank/till statement. Book balance = sum of all lines; cleared balance
 * = sum of only the cleared ones — the gap is what hasn't hit the statement yet.
 */
export async function getBankLedger(session: AppSession, account: BankAccountKey): Promise<BankLedgerRow[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const officeId = session.officeId;
  const paymentMethods =
    account === "CURRENT"
      ? [PaymentMethod.BANK_TRANSFER, PaymentMethod.MADA]
      : account === "CASH"
        ? [PaymentMethod.CASH]
        : [PaymentMethod.CHEQUE];
  const expenseMethods =
    account === "CURRENT"
      ? [ExpensePaymentMethod.BANK_TRANSFER, ExpensePaymentMethod.MADA]
      : account === "CASH"
        ? [ExpensePaymentMethod.CASH]
        : [ExpensePaymentMethod.CHEQUE];

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { officeId, method: { in: paymentMethods }, invoice: { deletedAt: null } },
      include: { invoice: { select: { number: true, client: { select: { name: true } } } } },
    }),
    prisma.expense.findMany({
      where: { officeId, method: { in: expenseMethods }, deletedAt: null },
    }),
  ]);

  const rows: BankLedgerRow[] = [
    ...payments.map((p) => ({
      id: p.id,
      kind: "PAYMENT" as const,
      date: p.paymentDate,
      amountMinor: p.amount,
      description: `${p.invoice.number} — ${p.invoice.client.name}`,
      cleared: p.cleared,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      kind: "EXPENSE" as const,
      date: e.expenseDate,
      amountMinor: -(e.netAmount + e.inputVat),
      description: e.vendor ?? e.category,
      cleared: e.cleared,
    })),
  ];
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function toggleBankLineCleared(session: AppSession, kind: "PAYMENT" | "EXPENSE", id: string) {
  await requireModule(session, PermModule.FINANCE, "edit");
  if (kind === "PAYMENT") {
    const p = await prisma.payment.findFirst({ where: { id, officeId: session.officeId } });
    if (!p) throw new PermissionError("scope");
    await prisma.payment.update({ where: { id }, data: { cleared: !p.cleared, clearedAt: !p.cleared ? new Date() : null } });
    await logAudit({ session, action: "bank.toggleCleared", resource: "finance", targetId: id, detail: String(!p.cleared) });
  } else {
    const e = await prisma.expense.findFirst({ where: { id, officeId: session.officeId } });
    if (!e) throw new PermissionError("scope");
    await prisma.expense.update({ where: { id }, data: { cleared: !e.cleared, clearedAt: !e.cleared ? new Date() : null } });
    await logAudit({ session, action: "bank.toggleCleared", resource: "finance", targetId: id, detail: String(!e.cleared) });
  }
}
