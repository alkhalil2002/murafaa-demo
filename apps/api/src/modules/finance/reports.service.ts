import { Injectable } from "@nestjs/common";
import { ErrorCode, type manualJournalBody } from "@murafaa/contracts";
import {
  cases,
  chartOfAccounts,
  expenses,
  invoices,
  journalLines,
  payments,
  trustTransactions,
  type Tx,
} from "@murafaa/database";
import {
  ACC,
  type AccountCode,
  accountBalance,
  type AgingBucket,
  agingBucket,
  COA_SEED,
  daysAgo,
  isNormalDebit,
  periodKeyFor,
  periodKeyOf,
  riyadhCalendarDate,
} from "@murafaa/rules";
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql, sum } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { InvoicesService } from "./invoices.service.js";
import { postJournal } from "./ledger.js";

type Meta = { ip: string; requestId: string };
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Derived reports (legacy ledger-reports, finance-dashboard,
 * case-profitability; docs BR-LED-3/4, FIN-VAT-RETURN). Nothing here is
 * stored: every figure is read from posted journal lines and live documents.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly invoices: InvoicesService,
  ) {}

  /** Net posted balance per account, on its normal side. */
  async trial(tx: Tx) {
    const accounts = await tx
      .select()
      .from(chartOfAccounts)
      .where(isNull(chartOfAccounts.deletedAt))
      .orderBy(chartOfAccounts.code);
    const sums = await tx
      .select({
        accountId: journalLines.accountId,
        dr: sum(journalLines.debit),
        cr: sum(journalLines.credit),
      })
      .from(journalLines)
      .groupBy(journalLines.accountId);
    const byId = new Map(
      sums.map((s) => [s.accountId, { dr: Number(s.dr ?? 0), cr: Number(s.cr ?? 0) }]),
    );
    const rows = accounts.length ? accounts : COA_SEED.map((a) => ({ id: "", ...a }));
    return rows.map((a) => {
      const s = byId.get(a.id) ?? { dr: 0, cr: 0 };
      const net = accountBalance(a.type, s.dr, s.cr);
      const debitSide = isNormalDebit(a.type);
      return {
        code: a.code,
        name: a.name,
        type: a.type,
        debit: debitSide ? Math.max(0, net) : Math.max(0, -net),
        credit: debitSide ? Math.max(0, -net) : Math.max(0, net),
      };
    });
  }

  /** Trial balance, VAT return and receivables aging (legacy ledger page). */
  ledger() {
    return this.tenantDb.run(async (tx) => {
      const trial = await this.trial(tx);
      // Output VAT of every invoice not cancelled by a credit note (bad debt keeps its VAT, docs FIN-BAD-DEBT);
      // input VAT of posted (approved) expenses only.
      const [out] = await tx
        .select({ v: sum(invoices.vatAmount) })
        .from(invoices)
        .where(and(isNull(invoices.deletedAt), eq(invoices.isCredited, false)));
      const [inp] = await tx
        .select({ v: sum(expenses.inputVat) })
        .from(expenses)
        .where(and(isNull(expenses.deletedAt), eq(expenses.approved, true)));
      const outputVat = Number(out?.v ?? 0);
      const inputVat = Number(inp?.v ?? 0);

      const buckets: Record<AgingBucket, number> = { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
      const rows = (await this.invoices.open(tx)).map((i) => {
        const ageDays = Math.max(0, daysAgo(i.issueDate));
        const bucket = agingBucket(ageDays);
        buckets[bucket] += i.remaining;
        return {
          invoiceId: i.id,
          number: i.number,
          clientName: i.clientName,
          remaining: i.remaining,
          ageDays,
          bucket,
        };
      });
      return {
        trial,
        vat: { outputVat, inputVat, net: outputVat - inputVat, payable: outputVat - inputVat >= 0 },
        aging: {
          buckets,
          total: rows.reduce((s, r) => s + r.remaining, 0),
          rows: rows.sort((a, b) => b.ageDays - a.ageDays),
        },
      };
    });
  }

  /**
   * Income statement, balance sheet and a direct-method cash flow. Trust
   * deposits/withdrawals are client money and stay out (guardrail 5); a
   * transfer from trust to fees is shown on its own line. Receipts paid from
   * trust are not counted again as collected cash (legacy counted them twice),
   * and only posted expenses count as paid.
   */
  statements() {
    return this.tenantDb.run(async (tx) => {
      const trial = await this.trial(tx);
      const total = (type: string, side: "debit" | "credit") =>
        trial.filter((r) => r.type === type).reduce((s, r) => s + r[side], 0);
      const revenue = total("REVENUE", "credit");
      const spent = total("EXPENSE", "debit");
      const [col] = await tx
        .select({ v: sum(payments.amount) })
        .from(payments)
        .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
        .where(
          and(
            isNull(payments.deletedAt),
            isNull(invoices.deletedAt),
            ne(payments.method, "FROM_TRUST"),
          ),
        );
      const [tr] = await tx
        .select({ v: sum(trustTransactions.amount) })
        .from(trustTransactions)
        .where(eq(trustTransactions.type, "TRANSFER_TO_FEES"));
      const [exp] = await tx
        .select({ v: sql<string>`coalesce(sum(${expenses.netAmount} + ${expenses.inputVat}), 0)` })
        .from(expenses)
        .where(and(isNull(expenses.deletedAt), eq(expenses.approved, true)));
      const collected = Number(col?.v ?? 0);
      const trustToFees = Number(tr?.v ?? 0);
      const expensePaid = Number(exp?.v ?? 0);
      const cash = trial.find((r) => r.code === ACC.CASH_BANK);
      return {
        revenue,
        expenses: spent,
        netIncome: revenue - spent,
        assets: total("ASSET", "debit") - total("ASSET", "credit"),
        liabilities: total("LIABILITY", "credit") - total("LIABILITY", "debit"),
        equity: total("EQUITY", "credit") - total("EQUITY", "debit"),
        cashFlow: {
          collected,
          trustToFees,
          expensePaid,
          operating: collected + trustToFees - expensePaid,
          cashBank: cash ? cash.debit - cash.credit : 0,
        },
      };
    });
  }

  /**
   * لوحة مالية. Outstanding counts open invoices only (legacy also counted
   * cancelled and written-off ones); revenue is the invoices' net, without
   * VAT, by Riyadh month.
   */
  dashboard() {
    return this.tenantDb.run(async (tx) => {
      const today = riyadhCalendarDate();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + i, 1));
        return periodKeyFor(d.getUTCFullYear(), d.getUTCMonth() + 1);
      });
      const thisMonth = months[5]!;
      const rows = await this.invoices.rows(tx);
      const open = rows.filter(
        (r) => r.status === "DUE" || r.status === "PARTIALLY_PAID" || r.status === "OVERDUE",
      );
      const revenueBy = new Map<string, number>();
      for (const r of rows) {
        if (r.status === "CANCELLED") continue;
        const k = r.issueDate.slice(0, 7);
        revenueBy.set(k, (revenueBy.get(k) ?? 0) + r.net);
      }
      const posted = await tx
        .select()
        .from(expenses)
        .where(and(isNull(expenses.deletedAt), eq(expenses.approved, true)))
        .orderBy(desc(expenses.expenseDate))
        .limit(200);
      const pays = await tx
        .select({
          id: payments.id,
          number: payments.number,
          amount: payments.amount,
          date: payments.paymentDate,
        })
        .from(payments)
        .where(isNull(payments.deletedAt))
        .orderBy(desc(payments.paymentDate))
        .limit(10);
      const recent = [
        ...pays.map((x) => ({
          kind: "payment" as const,
          id: x.id,
          label: x.number,
          category: null,
          amount: x.amount,
          date: day(x.date),
        })),
        ...posted
          .slice(0, 10)
          .map((e) => ({
            kind: "expense" as const,
            id: e.id,
            label: e.vendor,
            category: e.category,
            amount: e.netAmount + e.inputVat,
            date: day(e.expenseDate),
          })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);
      return {
        outstanding: open.reduce((s, r) => s + r.remaining, 0),
        overdueCount: open.filter((r) => r.status === "OVERDUE").length,
        monthRevenue: revenueBy.get(thisMonth) ?? 0,
        monthExpense: posted
          .filter((e) => periodKeyOf(e.expenseDate) === thisMonth)
          .reduce((s, e) => s + e.netAmount + e.inputVat, 0),
        revenueByMonth: months.map((m) => ({ month: m, total: revenueBy.get(m) ?? 0 })),
        recent,
      };
    });
  }

  /**
   * ربحية القضايا: invoiced fees (net, not cancelled) minus the case's
   * posted expenses at net cost (recoverable input VAT is not a cost; legacy
   * counted it, and counted unapproved expenses too).
   */
  profitability() {
    return this.tenantDb.run(async (tx) => {
      const fees = await tx
        .select({ caseId: invoices.caseId, v: sum(invoices.netAmount) })
        .from(invoices)
        .where(
          and(
            isNull(invoices.deletedAt),
            eq(invoices.isCredited, false),
            isNotNull(invoices.caseId),
          ),
        )
        .groupBy(invoices.caseId);
      const costs = await tx
        .select({ caseId: expenses.caseId, v: sum(expenses.netAmount) })
        .from(expenses)
        .where(
          and(isNull(expenses.deletedAt), eq(expenses.approved, true), isNotNull(expenses.caseId)),
        )
        .groupBy(expenses.caseId);
      const ids = [...new Set([...fees, ...costs].map((r) => r.caseId!))];
      const titles = ids.length
        ? await tx
            .select({ id: cases.id, title: cases.title })
            .from(cases)
            .where(inArray(cases.id, ids))
        : [];
      return ids
        .map((id) => {
          const f = Number(fees.find((r) => r.caseId === id)?.v ?? 0);
          const e = Number(costs.find((r) => r.caseId === id)?.v ?? 0);
          return {
            caseId: id,
            caseTitle: titles.find((x) => x.id === id)?.title ?? "—",
            fees: f,
            expenses: e,
            margin: f - e,
          };
        })
        .sort((a, b) => b.margin - a.margin);
    });
  }

  /** A manual balanced entry (FINANCE full, docs FIN-LED-1/2); the description is kept as written. */
  manualEntry(p: Principal, input: z.infer<typeof manualJournalBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const known = new Set(COA_SEED.map((a) => a.code as string));
      const accounts = await tx.select({ code: chartOfAccounts.code }).from(chartOfAccounts);
      for (const a of accounts) known.add(a.code);
      input.lines.forEach((l, i) => {
        if (!known.has(l.code))
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: `lines.${i}.code`, message: "errors.NOT_FOUND" },
          ]);
      });
      const lines = input.lines
        .filter((l) => l.debit > 0 || l.credit > 0)
        .map((l) => ({ code: l.code as AccountCode, debit: l.debit, credit: l.credit }));
      const balanced =
        lines.length >= 2 &&
        lines.every((l) => l.debit > 0 !== l.credit > 0) &&
        lines.reduce((s, l) => s + l.debit - l.credit, 0) === 0;
      if (!balanced)
        throw new ApiException(ErrorCode.VALIDATION_FAILED, undefined, "errors.JOURNAL_UNBALANCED");
      const entry = await postJournal(tx, p.officeId, p.userId, {
        date: input.date,
        descriptionKey: "journal.manual",
        params: { text: input.description },
        sourceType: "MANUAL",
        lines,
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "journal.manualEntry",
        entity: "finance",
        entityId: entry.id,
        after: { entryNo: entry.entryNo },
        ...meta,
      });
      return { id: entry.id, number: entry.entryNo };
    });
  }
}
