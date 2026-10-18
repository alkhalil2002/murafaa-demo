import { ErrorCode } from "@murafaa/contracts";
import {
  accountingPeriods,
  chartOfAccounts,
  docCounters,
  journalEntries,
  journalLines,
  type Tx,
} from "@murafaa/database";
import {
  assertBalanced,
  COA_SEED,
  type DocPrefix,
  type JournalSource,
  NUMBER_BASE,
  periodKeyOf,
  type PostingLine,
} from "@murafaa/rules";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ApiException } from "../../common/http/api.exception.js";

/**
 * Ledger primitives every finance write uses inside its own transaction
 * (legacy lib/finance/ledger.ts): period lock, document numbers, and
 * balanced double-entry postings. Amounts are integer halalas.
 */

/** Refuse a posting dated in a locked period (docs FIN-PERIOD-LOCK). */
export async function assertPeriodOpen(tx: Tx, date: Date): Promise<void> {
  const [period] = await tx
    .select({ locked: accountingPeriods.locked })
    .from(accountingPeriods)
    .where(eq(accountingPeriods.periodKey, periodKeyOf(date)));
  if (period?.locked) throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.PERIOD_LOCKED");
}

/**
 * Next number for a document type, e.g. INV-1043. One upsert on the office's
 * counter row: concurrent writers queue on that row, and a rolled-back
 * document rolls its number back too, so invoice numbers have no gaps.
 */
export async function nextNumber(tx: Tx, officeId: string, prefix: DocPrefix): Promise<string> {
  const [row] = await tx
    .insert(docCounters)
    .values({ officeId, prefix, lastNo: NUMBER_BASE[prefix] + 1 })
    .onConflictDoUpdate({
      target: [docCounters.officeId, docCounters.prefix],
      set: { lastNo: sql`${docCounters.lastNo} + 1` },
    })
    .returning({ lastNo: docCounters.lastNo });
  return `${prefix}-${row!.lastNo}`;
}

/** The office's chart of accounts, seeded with the defaults on first use. */
async function accountIds(tx: Tx, officeId: string, codes: string[]): Promise<Map<string, string>> {
  const find = () =>
    tx
      .select({ id: chartOfAccounts.id, code: chartOfAccounts.code })
      .from(chartOfAccounts)
      .where(inArray(chartOfAccounts.code, codes));
  let rows = await find();
  if (rows.length < new Set(codes).size) {
    await tx
      .insert(chartOfAccounts)
      .values(COA_SEED.map((a) => ({ officeId, code: a.code, name: a.name, type: a.type })))
      .onConflictDoNothing();
    rows = await find();
  }
  const map = new Map(rows.map((r) => [r.code, r.id]));
  for (const c of codes) if (!map.has(c)) throw new ApiException(ErrorCode.INTERNAL);
  return map;
}

export type Posting = {
  date: Date;
  descriptionKey: string;
  params?: Record<string, string | number>;
  sourceType: JournalSource;
  sourceId?: string | null;
  lines: readonly PostingLine[];
};

/** Post one balanced journal entry (docs BR-LED-1/2) in the caller's transaction. */
export async function postJournal(tx: Tx, officeId: string, userId: string, p: Posting) {
  const lines = p.lines.filter((l) => l.debit > 0 || l.credit > 0);
  assertBalanced(lines);
  await assertPeriodOpen(tx, p.date);
  const ids = await accountIds(
    tx,
    officeId,
    lines.map((l) => l.code),
  );
  const entryNo = await nextNumber(tx, officeId, "JV");
  const [entry] = await tx
    .insert(journalEntries)
    .values({
      officeId,
      entryNo,
      entryDate: p.date,
      descriptionKey: p.descriptionKey,
      params: p.params ?? null,
      sourceType: p.sourceType,
      sourceId: p.sourceId ?? null,
      periodKey: periodKeyOf(p.date),
      postedBy: userId,
      createdBy: userId,
    })
    .returning({ id: journalEntries.id, entryNo: journalEntries.entryNo });
  await tx.insert(journalLines).values(
    lines.map((l, i) => ({
      officeId,
      journalEntryId: entry!.id,
      accountId: ids.get(l.code)!,
      debit: l.debit,
      credit: l.credit,
      lineNo: i + 1,
      createdBy: userId,
    })),
  );
  return entry!;
}

/** Whether a journal already exists for a source (used to avoid double posting on approval). */
export async function hasPosting(tx: Tx, sourceType: JournalSource, sourceId: string) {
  const [r] = await tx
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)))
    .limit(1);
  return Boolean(r);
}
