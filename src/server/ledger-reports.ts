import { AccountType, JournalSourceType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import { logAudit } from "@/lib/audit";
import { agingBucket, paidOf, remainingOf, type AgingBucket } from "@/lib/finance/core";
import { postJournal } from "@/lib/finance/ledger";

/**
 * Derived accounting reports (docs BR-LED-3/4, FIN-VAT-RETURN). All balances
 * are computed from posted journal lines / live invoices — never stored.
 * Finance-gated (المالية), office-scoped.
 */

const DAY_MS = 86_400_000;
const NORMAL_DEBIT = new Set<AccountType>([AccountType.ASSET, AccountType.EXPENSE]);

export type TrialRow = { code: string; name: string; type: AccountType; debit: number; credit: number };

/** Trial balance: net posted balance per account on its normal side. */
export async function trialBalance(session: AppSession): Promise<TrialRow[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const [accounts, lines] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { officeId: session.officeId, deletedAt: null },
      orderBy: { code: "asc" },
    }),
    prisma.journalLine.findMany({
      where: { journalEntry: { officeId: session.officeId } },
      select: { accountId: true, debit: true, credit: true },
    }),
  ]);
  const sums = new Map<string, { dr: number; cr: number }>();
  for (const l of lines) {
    const s = sums.get(l.accountId) ?? { dr: 0, cr: 0 };
    s.dr += l.debit;
    s.cr += l.credit;
    sums.set(l.accountId, s);
  }
  return accounts.map((a) => {
    const s = sums.get(a.id) ?? { dr: 0, cr: 0 };
    const net = NORMAL_DEBIT.has(a.type) ? s.dr - s.cr : s.cr - s.dr;
    const onDebit = NORMAL_DEBIT.has(a.type);
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      debit: onDebit ? Math.max(0, net) : Math.max(0, -net),
      credit: onDebit ? Math.max(0, -net) : Math.max(0, net),
    };
  });
}

export type AgingReport = {
  buckets: Record<AgingBucket, number>;
  total: number;
  rows: Array<{ number: string; clientName: string; remaining: number; ageDays: number; bucket: AgingBucket }>;
};

/** Aging of live receivables (docs BR-LED-4): exclude credited/bad-debt/settled. */
export async function agingReport(session: AppSession, now: Date = new Date()): Promise<AgingReport> {
  await requireModule(session, PermModule.FINANCE, "view");
  const invoices = await prisma.invoice.findMany({
    where: { officeId: session.officeId, deletedAt: null, isCredited: false, isBadDebt: false },
    include: { client: { select: { name: true } }, payments: { select: { amount: true } } },
  });
  const buckets: Record<AgingBucket, number> = { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
  const rows: AgingReport["rows"] = [];
  let total = 0;
  for (const inv of invoices) {
    const remaining = remainingOf(inv.totalAmount, paidOf(inv.payments));
    if (remaining <= 0) continue;
    const ageDays = Math.floor((now.getTime() - inv.issueDate.getTime()) / DAY_MS);
    const bucket = agingBucket(ageDays);
    buckets[bucket] += remaining;
    total += remaining;
    rows.push({ number: inv.number, clientName: inv.client.name, remaining, ageDays, bucket });
  }
  rows.sort((a, b) => b.ageDays - a.ageDays);
  return { buckets, total, rows };
}

export type VatReturn = { outputVat: number; inputVat: number; net: number; payable: boolean };

/** VAT return = output VAT (non-credited invoices, incl. bad-debt) − input VAT. */
export async function vatReturn(session: AppSession): Promise<VatReturn> {
  await requireModule(session, PermModule.FINANCE, "view");
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { officeId: session.officeId, deletedAt: null, isCredited: false },
      select: { vatAmount: true },
    }),
    prisma.expense.findMany({
      where: { officeId: session.officeId, deletedAt: null, approved: true },
      select: { inputVat: true },
    }),
  ]);
  const outputVat = invoices.reduce((s, i) => s + i.vatAmount, 0);
  const inputVat = expenses.reduce((s, e) => s + e.inputVat, 0);
  const net = outputVat - inputVat;
  return { outputVat, inputVat, net, payable: net >= 0 };
}

export async function listJournal(session: AppSession) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.journalEntry.findMany({
    where: { officeId: session.officeId },
    orderBy: { entryDate: "desc" },
    take: 100,
    include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineNo: "asc" } } },
  });
}

export type FinancialStatements = {
  revenueMinor: number;
  expensesMinor: number;
  netIncomeMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
  equityMinor: number;
};

/** Income statement + balance sheet, both derived live from postJournal-created lines. */
export async function getFinancialStatements(session: AppSession): Promise<FinancialStatements> {
  const rows = await trialBalance(session);
  const sumOf = (type: AccountType, side: "debit" | "credit") =>
    rows.filter((r) => r.type === type).reduce((s, r) => s + r[side], 0);

  const revenueMinor = sumOf(AccountType.REVENUE, "credit");
  const expensesMinor = sumOf(AccountType.EXPENSE, "debit");
  const assetsMinor = sumOf(AccountType.ASSET, "debit");
  const liabilitiesMinor = sumOf(AccountType.LIABILITY, "credit");
  const equityMinor = sumOf(AccountType.EQUITY, "credit");

  return {
    revenueMinor,
    expensesMinor,
    netIncomeMinor: revenueMinor - expensesMinor,
    assetsMinor,
    liabilitiesMinor,
    equityMinor,
  };
}

export async function listAccounts(session: AppSession) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.chartOfAccount.findMany({
    where: { officeId: session.officeId, deletedAt: null, isActive: true },
    orderBy: { code: "asc" },
  });
}

const manualEntrySchema = z.object({
  entryDate: z.coerce.date(),
  description: z.string().trim().min(1),
  lines: z
    .array(
      z.object({
        code: z.string().min(1),
        debit: z.number().int().min(0).default(0),
        credit: z.number().int().min(0).default(0),
      }),
    )
    .min(2),
});
export type CreateManualJournalEntryInput = z.input<typeof manualEntrySchema>;

/** "قيد يومية جديد" — a manual balanced entry, gated FULL (docs FIN-LED-1/2). */
export async function createManualJournalEntry(session: AppSession, raw: CreateManualJournalEntryInput) {
  await requireModule(session, PermModule.FINANCE, "delete");
  const input = manualEntrySchema.parse(raw);
  const entry = await prisma.$transaction((tx) =>
    postJournal(tx, session.officeId, {
      entryDate: input.entryDate,
      description: input.description,
      sourceType: JournalSourceType.MANUAL,
      postedById: session.userId,
      lines: input.lines,
    }),
  );
  await logAudit({ session, action: "journal.manualEntry", resource: "finance", targetId: entry.id, detail: entry.entryNo });
  return entry;
}
