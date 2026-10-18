import { JournalSourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isBalanced } from "./core";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Ledger primitives shared by every finance service: per-office document
 * numbering, accounting-period locks, and balanced double-entry journal
 * posting. All amounts are integer halalas.
 */

/** Standard chart-of-accounts codes (seeded per office). */
export const ACC = {
  CASH_BANK: "1000",
  RECEIVABLES: "1100",
  TRUST_ASSET: "1200", // client-trust bank (asset)
  EMPLOYEE_ADVANCES: "1300", // salary advances owed by employees (asset)
  FIXED_ASSETS: "1500",
  PAYABLES: "2000",
  TRUST_LIABILITY: "2100", // client trust owed (liability)
  VAT_PAYABLE: "2200",
  GOSI_PAYABLE: "2300", // GOSI withheld, owed to the authority (liability)
  CAPITAL: "3000",
  FEE_REVENUE: "4000",
  DIRECT_COST: "5000",
  OPERATING_EXPENSE: "5100",
  SALARIES_EXPENSE: "5200", // gross salaries & wages (expense)
} as const;

export type DocPrefix = "INV" | "REC" | "CN" | "JV";
const NUMBER_BASE: Record<DocPrefix, number> = { INV: 1042, REC: 1000, CN: 2000, JV: 200 };

/** YYYY-MM period key for a date (UTC calendar month). */
export function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Reject a posting whose period is locked (docs FIN-PERIOD-LOCK). */
export async function assertPeriodOpen(db: Db, officeId: string, date: Date): Promise<void> {
  const period = await db.accountingPeriod.findUnique({
    where: { officeId_periodKey: { officeId, periodKey: periodKeyOf(date) } },
    select: { locked: true },
  });
  if (period?.locked) throw new Error("PERIOD_LOCKED");
}

/**
 * Retry a document-creating transaction when a concurrent same-office write
 * grabs the same sequential number (unique-constraint P2002). The scan-based
 * numbering is not atomic, so this bounded retry makes the unique constraint an
 * actual backstop rather than a hard failure. Wrap every numbered creator.
 */
export async function withNumberRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Next per-office sequential document number. Computed as max(base, existing)+1
 * inside the caller's transaction; the (officeId, number) unique constraint is
 * the backstop against a concurrent race — wrap the creator in withNumberRetry.
 */
export async function nextNumber(db: Db, officeId: string, prefix: DocPrefix): Promise<string> {
  const rows: Array<{ number?: string; entryNo?: string }> =
    prefix === "INV"
      ? await db.invoice.findMany({ where: { officeId }, select: { number: true } })
      : prefix === "REC"
        ? await db.payment.findMany({ where: { officeId }, select: { number: true } })
        : prefix === "CN"
          ? await db.creditNote.findMany({ where: { officeId }, select: { number: true } })
          : await db.journalEntry.findMany({ where: { officeId }, select: { entryNo: true } });
  let max = NUMBER_BASE[prefix];
  for (const r of rows) {
    const m = /(\d+)/.exec(r.number ?? r.entryNo ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}

/** Resolve a COA account id by code within the office. */
export async function accountId(db: Db, officeId: string, code: string): Promise<string> {
  const acc = await db.chartOfAccount.findUnique({
    where: { officeId_code: { officeId, code } },
    select: { id: true },
  });
  if (!acc) throw new Error(`ACCOUNT_NOT_FOUND: ${code}`);
  return acc.id;
}

export type JournalLineInput = { code: string; debit?: number; credit?: number; memo?: string };

/**
 * Post a balanced journal entry (docs BR-LED-1/2). Validates the entry balances,
 * checks the period lock, resolves account codes to ids, and inserts the entry
 * + lines. MUST run inside the caller's transaction so the posting commits with
 * the source write.
 */
export async function postJournal(
  db: Db,
  officeId: string,
  params: {
    entryDate: Date;
    description: string;
    sourceType: JournalSourceType;
    sourceId?: string;
    postedById?: string;
    lines: JournalLineInput[];
  },
): Promise<{ id: string; entryNo: string }> {
  const lines = params.lines.map((l) => ({ debit: l.debit ?? 0, credit: l.credit ?? 0, ...l }));
  if (!isBalanced(lines.map((l) => ({ debit: l.debit, credit: l.credit })))) {
    throw new Error("JOURNAL_UNBALANCED");
  }
  await assertPeriodOpen(db, officeId, params.entryDate);
  const entryNo = await nextNumber(db, officeId, "JV");

  const resolved = await Promise.all(
    lines.map(async (l, i) => ({
      accountId: await accountId(db, officeId, l.code),
      debit: l.debit,
      credit: l.credit,
      lineNo: i + 1,
      memo: l.memo,
    })),
  );

  const entry = await db.journalEntry.create({
    data: {
      officeId,
      entryNo,
      entryDate: params.entryDate,
      description: params.description,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      periodKey: periodKeyOf(params.entryDate),
      postedById: params.postedById,
      lines: { create: resolved },
    },
    select: { id: true, entryNo: true },
  });
  return entry;
}
