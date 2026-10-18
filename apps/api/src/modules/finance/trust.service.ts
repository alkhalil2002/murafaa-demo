import { Injectable } from "@nestjs/common";
import { ErrorCode, type trustMoveBody } from "@murafaa/contracts";
import { cases, clients, trustAccounts, trustTransactions, type Tx } from "@murafaa/database";
import { riyadhCalendarDate, type TrustTxnType, trustDelta, trustPosting } from "@murafaa/rules";
import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { postJournal } from "./ledger.js";

type Meta = { ip: string; requestId: string };

const JOURNAL = {
  DEPOSIT: { key: "journal.trustDeposit", source: "TRUST_DEPOSIT" },
  WITHDRAWAL: { key: "journal.trustWithdrawal", source: "TRUST_WITHDRAWAL" },
  TRANSFER_TO_FEES: { key: "journal.trustTransfer", source: "TRUST_TRANSFER" },
} as const;

/** A live client of this office (RLS read), or a field error. */
export async function assertClient(tx: Tx, clientId: string) {
  const [c] = await tx
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)));
  if (!c)
    throw new ApiException(ErrorCode.VALIDATION_FAILED, [
      { path: "clientId", message: "errors.NOT_FOUND" },
    ]);
  return c;
}

/**
 * Client trust (أمانات/عهدة, legacy server/trust.ts): a ledger kept apart
 * from office revenue (guardrail 5). Movements are append-only and posted
 * double-entry; the balance changes atomically with its guard in the WHERE
 * clause, and a database CHECK keeps it from ever going below zero.
 */
@Injectable()
export class TrustService {
  constructor(private readonly tenantDb: TenantDb) {}

  /** One movement inside the caller's transaction (also used by "pay from trust"). */
  async move(
    tx: Tx,
    p: Principal,
    m: {
      clientId: string;
      type: TrustTxnType;
      amount: number;
      date: Date;
      note?: string | null;
      invoiceId?: string | null;
      caseId?: string | null;
    },
  ) {
    await tx
      .insert(trustAccounts)
      .values({ officeId: p.officeId, clientId: m.clientId, createdBy: p.userId })
      .onConflictDoNothing();
    const delta = trustDelta(m.type, m.amount);
    const [account] = await tx
      .update(trustAccounts)
      .set({ balance: sql`${trustAccounts.balance} + ${delta}`, updatedBy: p.userId })
      .where(
        and(
          eq(trustAccounts.clientId, m.clientId),
          delta < 0 ? gte(trustAccounts.balance, -delta) : undefined,
        ),
      )
      .returning({ id: trustAccounts.id, balance: trustAccounts.balance });
    if (!account)
      throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.TRUST_INSUFFICIENT_BALANCE");

    const j = JOURNAL[m.type];
    const journal = await postJournal(tx, p.officeId, p.userId, {
      date: m.date,
      descriptionKey: j.key,
      sourceType: j.source,
      lines: trustPosting(m.type, m.amount, Boolean(m.invoiceId)),
    });
    const [txn] = await tx
      .insert(trustTransactions)
      .values({
        officeId: p.officeId,
        trustAccountId: account.id,
        type: m.type,
        amount: m.amount,
        date: m.date,
        note: m.note ?? null,
        relatedInvoiceId: m.invoiceId ?? null,
        relatedCaseId: m.caseId ?? null,
        journalEntryId: journal.id,
        createdBy: p.userId,
      })
      .returning({ id: trustTransactions.id });
    return { id: txn!.id, balance: account.balance };
  }

  /** Deposit, withdrawal or transfer to fees for one client (FINANCE edit). */
  record(p: Principal, clientId: string, input: z.infer<typeof trustMoveBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await assertClient(tx, clientId);
      if (input.caseId) {
        const [c] = await tx
          .select({ clientId: cases.clientId })
          .from(cases)
          .where(and(eq(cases.id, input.caseId), isNull(cases.deletedAt)));
        if (!c)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "caseId", message: "errors.NOT_FOUND" },
          ]);
        if (c.clientId !== clientId)
          throw new ApiException(
            ErrorCode.VALIDATION_FAILED,
            undefined,
            "errors.CASE_CLIENT_MISMATCH",
          );
      }
      const result = await this.move(tx, p, {
        clientId,
        type: input.type,
        amount: input.amount,
        date: input.date ?? riyadhCalendarDate(),
        note: input.note,
        caseId: input.caseId ?? null,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: `trust.${input.type.toLowerCase()}`,
        entity: "finance",
        entityId: clientId,
        after: { amount: input.amount },
        ...meta,
      });
      return { balance: result.balance };
    });
  }

  list() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          clientId: trustAccounts.clientId,
          clientName: clients.name,
          balance: trustAccounts.balance,
        })
        .from(trustAccounts)
        .innerJoin(clients, eq(clients.id, trustAccounts.clientId))
        .where(isNull(trustAccounts.deletedAt))
        .orderBy(desc(trustAccounts.balance));
      return { accounts: rows, total: rows.reduce((s, r) => s + r.balance, 0) };
    });
  }

  /** One client's movements oldest first, with the running balance. */
  ledger(clientId: string) {
    return this.tenantDb.run(async (tx) => {
      const client = await assertClient(tx, clientId);
      const [account] = await tx
        .select({ id: trustAccounts.id, balance: trustAccounts.balance })
        .from(trustAccounts)
        .where(eq(trustAccounts.clientId, clientId));
      const rows = account
        ? await tx
            .select()
            .from(trustTransactions)
            .where(eq(trustTransactions.trustAccountId, account.id))
            .orderBy(asc(trustTransactions.date), asc(trustTransactions.createdAt))
        : [];
      let running = 0;
      return {
        clientId,
        clientName: client.name,
        balance: account?.balance ?? 0,
        movements: rows.map((r) => {
          running += trustDelta(r.type, r.amount);
          return {
            id: r.id,
            type: r.type,
            amount: r.amount,
            date: r.date.toISOString().slice(0, 10),
            note: r.note,
            runningBalance: running,
          };
        }),
      };
    });
  }
}
