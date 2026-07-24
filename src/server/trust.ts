import { PermModule, Prisma, TrustTxnType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { MAX_HALALAS } from "@/lib/finance/core";
import { ACC, assertPeriodOpen, postJournal, withNumberRetry } from "@/lib/finance/ledger";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Client trust (أمانات / عهدة) — a ring-fenced ledger SEPARATE from office
 * revenue (guardrail 5). Movements are immutable and posted double-entry;
 * balances never go negative. Only TRANSFER_TO_FEES touches revenue.
 */

const amount = z.number().int().positive().max(MAX_HALALAS);

async function ensureTrustAccount(db: Db, officeId: string, clientId: string) {
  const existing = await db.trustAccount.findUnique({ where: { clientId } });
  if (existing) return existing;
  return db.trustAccount.create({ data: { officeId, clientId } });
}

/**
 * Post a trust movement INSIDE the caller's transaction: guard, insert the
 * immutable transaction, update the cached balance, and post the paired
 * journal entry. Deposits add; withdrawals/transfers subtract and require
 * sufficient balance.
 */
export async function postTrustMovement(
  db: Db,
  session: AppSession,
  input: {
    clientId: string;
    type: TrustTxnType;
    amountMinor: number;
    date: Date;
    note?: string | null;
    relatedInvoiceId?: string | null;
    relatedCaseId?: string | null;
  },
): Promise<{ id: string; balanceMinor: number }> {
  amount.parse(input.amountMinor);
  await assertPeriodOpen(db, session.officeId, input.date);

  const account = await ensureTrustAccount(db, session.officeId, input.clientId);
  const isDeposit = input.type === TrustTxnType.DEPOSIT;

  // Atomic balance move — the guard lives in the WHERE clause so concurrent
  // debits cannot overdraw the trust (no read-then-write TOCTOU, guardrail 5).
  if (isDeposit) {
    await db.trustAccount.update({
      where: { id: account.id },
      data: { balanceMinor: { increment: input.amountMinor } },
    });
  } else {
    const claimed = await db.trustAccount.updateMany({
      where: { id: account.id, balanceMinor: { gte: input.amountMinor } },
      data: { balanceMinor: { decrement: input.amountMinor } },
    });
    if (claimed.count !== 1) throw new Error("TRUST_INSUFFICIENT_BALANCE");
  }
  const after = await db.trustAccount.findUniqueOrThrow({
    where: { id: account.id },
    select: { balanceMinor: true },
  });

  // Double-entry postings (docs TR-3/TR-4). Trust never posts to revenue except
  // a TRANSFER_TO_FEES (Cr receivables when applied to an invoice, else revenue).
  const lines =
    input.type === TrustTxnType.DEPOSIT
      ? [
          { code: ACC.TRUST_ASSET, debit: input.amountMinor },
          { code: ACC.TRUST_LIABILITY, credit: input.amountMinor },
        ]
      : input.type === TrustTxnType.WITHDRAWAL
        ? [
            { code: ACC.TRUST_LIABILITY, debit: input.amountMinor },
            { code: ACC.TRUST_ASSET, credit: input.amountMinor },
          ]
        : [
            { code: ACC.TRUST_LIABILITY, debit: input.amountMinor },
            {
              code: input.relatedInvoiceId ? ACC.RECEIVABLES : ACC.FEE_REVENUE,
              credit: input.amountMinor,
            },
          ];

  const journal = await postJournal(db, session.officeId, {
    entryDate: input.date,
    description:
      input.type === TrustTxnType.DEPOSIT
        ? "إيداع في عهدة العميل"
        : input.type === TrustTxnType.WITHDRAWAL
          ? "سحب من عهدة العميل"
          : "تحويل من العهدة لسداد أتعاب",
    sourceType:
      input.type === TrustTxnType.DEPOSIT
        ? "TRUST_DEPOSIT"
        : input.type === TrustTxnType.WITHDRAWAL
          ? "TRUST_WITHDRAWAL"
          : "TRUST_TRANSFER",
    postedById: session.userId,
    lines,
  });

  const txn = await db.trustTransaction.create({
    data: {
      officeId: session.officeId,
      trustAccountId: account.id,
      type: input.type,
      amountMinor: input.amountMinor,
      date: input.date,
      note: input.note ?? null,
      relatedInvoiceId: input.relatedInvoiceId ?? null,
      relatedCaseId: input.relatedCaseId ?? null,
      journalEntryId: journal.id,
      createdById: session.userId,
    },
  });

  return { id: txn.id, balanceMinor: after.balanceMinor };
}

const moveSchema = z.object({
  clientId: z.string().uuid(),
  amountMinor: amount,
  note: z.string().nullish(),
  date: z.coerce.date().optional(),
  relatedCaseId: z.string().uuid().nullish(),
});

async function assertClientInOffice(session: AppSession, clientId: string) {
  const c = await prisma.client.findFirst({
    where: { id: clientId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!c) throw new PermissionError("scope");
}

export async function trustDeposit(session: AppSession, raw: z.infer<typeof moveSchema>) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = moveSchema.parse(raw);
  await assertClientInOffice(session, input.clientId);
  const result = await withNumberRetry(() =>
    prisma.$transaction((tx) =>
      postTrustMovement(tx, session, {
        clientId: input.clientId,
        type: TrustTxnType.DEPOSIT,
        amountMinor: input.amountMinor,
        date: input.date ?? new Date(),
        note: input.note,
        relatedCaseId: input.relatedCaseId,
      }),
    ),
  );
  await logAudit({ session, action: "trust.deposit", resource: "finance", targetId: input.clientId, detail: String(input.amountMinor) });
  return result;
}

export async function trustWithdraw(session: AppSession, raw: z.infer<typeof moveSchema>) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = moveSchema.parse(raw);
  await assertClientInOffice(session, input.clientId);
  const result = await withNumberRetry(() =>
    prisma.$transaction((tx) =>
      postTrustMovement(tx, session, {
        clientId: input.clientId,
        type: TrustTxnType.WITHDRAWAL,
        amountMinor: input.amountMinor,
        date: input.date ?? new Date(),
        note: input.note,
        relatedCaseId: input.relatedCaseId,
      }),
    ),
  );
  await logAudit({ session, action: "trust.withdraw", resource: "finance", targetId: input.clientId, detail: String(input.amountMinor) });
  return result;
}

export async function listTrustAccounts(session: AppSession) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.trustAccount.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
  });
}

export async function getTrustLedger(session: AppSession, clientId: string) {
  await requireModule(session, PermModule.FINANCE, "view");
  const account = await prisma.trustAccount.findFirst({
    where: { clientId, officeId: session.officeId, deletedAt: null },
    include: {
      client: { select: { name: true } },
      transactions: { orderBy: { date: "asc" } },
    },
  });
  return account;
}
