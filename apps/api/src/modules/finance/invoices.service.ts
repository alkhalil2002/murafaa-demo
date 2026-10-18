import { Injectable } from "@nestjs/common";
import { type createInvoiceBody, ErrorCode, type paymentBody } from "@murafaa/contracts";
import {
  cases,
  clients,
  creditNotes,
  invoiceItems,
  invoices,
  offices,
  payments,
  type Tx,
  users,
} from "@murafaa/database";
import { t } from "@murafaa/i18n";
import {
  amountsFromNet,
  badDebtPosting,
  creditNoteBlocker,
  creditNotePosting,
  type InvoiceOrigin,
  invoiceNetOf,
  invoicePosting,
  invoiceStatus,
  lineNetOf,
  paidOf,
  paymentPosting,
  remainingOf,
  riyadhCalendarDate,
} from "@murafaa/rules";
import { and, asc, desc, eq, ilike, inArray, isNull, type SQL } from "drizzle-orm";
import { containsPattern } from "../../common/db/like.js";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { caseVisibility } from "../cases/case-scope.js";
import { nextNumber, postJournal } from "./ledger.js";
import { assertClient, TrustService } from "./trust.service.js";
import { PerformanceService } from "../performance/performance.service.js";

type Meta = { ip: string; requestId: string };
const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);
const day = (d: Date) => d.toISOString().slice(0, 10);

export type NewInvoice = {
  clientId: string;
  caseId?: string | null;
  issueDate: Date;
  items: ReadonlyArray<{ description: string; quantity: number; unitPrice: number }>;
  basis?: string | null;
  origin: InvoiceOrigin;
  fromExpenseId?: string | null;
  fromTimeEntryId?: string | null;
};

/**
 * Invoices (docs/06 §2 VAT, §7 status; legacy server/invoices.ts). Every
 * write posts its balanced journal entry in the same transaction. Module
 * FINANCE; money in halalas.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly trust: TrustService,
    private readonly policies: PolicyService,
    private readonly performance: PerformanceService,
  ) {}

  /**
   * The one place an invoice is created (manual, fee, time, reimbursement):
   * the client must be this office's, and a linked case must be that
   * client's. VAT 15% on the invoice net (docs/06 §2).
   */
  async createInTx(tx: Tx, p: Principal, input: NewInvoice) {
    await assertClient(tx, input.clientId);
    if (input.caseId) {
      const [c] = await tx
        .select({ clientId: cases.clientId })
        .from(cases)
        .where(and(eq(cases.id, input.caseId), isNull(cases.deletedAt)));
      if (!c)
        throw new ApiException(ErrorCode.VALIDATION_FAILED, [
          { path: "caseId", message: "errors.NOT_FOUND" },
        ]);
      if (c.clientId && c.clientId !== input.clientId)
        throw new ApiException(
          ErrorCode.VALIDATION_FAILED,
          undefined,
          "errors.CASE_CLIENT_MISMATCH",
        );
    }
    const net = invoiceNetOf(input.items);
    if (net <= 0)
      throw new ApiException(ErrorCode.VALIDATION_FAILED, undefined, "errors.FEE_NET_NONPOSITIVE");
    const amounts = amountsFromNet(net);
    const number = await nextNumber(tx, p.officeId, "INV");
    const [inv] = await tx
      .insert(invoices)
      .values({
        officeId: p.officeId,
        number,
        clientId: input.clientId,
        caseId: input.caseId ?? null,
        issueDate: input.issueDate,
        netAmount: amounts.net,
        vatAmount: amounts.vat,
        totalAmount: amounts.total,
        origin: input.origin,
        basis: input.basis ?? null,
        fromExpenseId: input.fromExpenseId ?? null,
        fromTimeEntryId: input.fromTimeEntryId ?? null,
        createdBy: p.userId,
      })
      .returning({ id: invoices.id, number: invoices.number });
    await tx.insert(invoiceItems).values(
      input.items.map((it, i) => ({
        officeId: p.officeId,
        invoiceId: inv!.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineNet: lineNetOf(it.quantity, it.unitPrice),
        sortOrder: i,
        createdBy: p.userId,
      })),
    );
    await postJournal(tx, p.officeId, p.userId, {
      date: input.issueDate,
      descriptionKey: "journal.invoice",
      params: { number },
      sourceType: "INVOICE",
      sourceId: inv!.id,
      lines: invoicePosting(amounts),
    });
    await this.performance.award(tx, p.officeId, p.userId, "INVOICE_CREATED", inv!.id);
    return inv!;
  }

  create(p: Principal, input: z.infer<typeof createInvoiceBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const inv = await this.createInTx(tx, p, {
        clientId: input.clientId,
        caseId: input.caseId,
        issueDate: input.issueDate ?? riyadhCalendarDate(),
        items: input.items,
        basis: input.basis,
        origin: "MANUAL",
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "invoice.create",
        entity: "finance",
        entityId: inv.id,
        after: { number: inv.number },
        ...meta,
      });
      return inv;
    });
  }

  /** The invoice row locked for this transaction, with what has been paid on it. */
  private async locked(tx: Tx, id: string) {
    const [inv] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
      .for("update");
    if (!inv) throw new ApiException(ErrorCode.NOT_FOUND);
    const paid = paidOf(
      await tx
        .select({ amount: payments.amount })
        .from(payments)
        .where(and(eq(payments.invoiceId, id), isNull(payments.deletedAt))),
    );
    return { inv, paid };
  }

  /**
   * Record a receipt. The invoice row is locked first, so two receipts at
   * once cannot both pass the "not more than the remaining" check. Paying
   * from the client's trust posts one trust transfer that settles the
   * receivable instead of a cash receipt.
   */
  pay(p: Principal, invoiceId: string, input: z.infer<typeof paymentBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const { inv, paid } = await this.locked(tx, invoiceId);
      if (inv.isCredited || inv.isBadDebt) throw conflict("errors.INVOICE_NOT_PAYABLE");
      const remaining = remainingOf(inv.totalAmount, paid);
      if (input.amount > remaining) throw conflict("errors.PAYMENT_EXCEEDS_REMAINING");

      const [office] = await tx
        .select({ requireApproval: offices.requireApproval })
        .from(offices)
        .limit(1);
      const approved = !office?.requireApproval;
      const date = input.date ?? riyadhCalendarDate();
      const number = await nextNumber(tx, p.officeId, "REC");
      const [payment] = await tx
        .insert(payments)
        .values({
          officeId: p.officeId,
          number,
          invoiceId,
          paymentDate: date,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          isApproved: approved,
          approvedBy: approved ? p.userId : null,
          approvedAt: approved ? new Date() : null,
          createdBy: p.userId,
        })
        .returning({ id: payments.id, number: payments.number });

      if (input.method === "FROM_TRUST") {
        await this.trust.move(tx, p, {
          clientId: inv.clientId,
          type: "TRANSFER_TO_FEES",
          amount: input.amount,
          date,
          invoiceId,
          caseId: inv.caseId,
        });
      } else {
        await postJournal(tx, p.officeId, p.userId, {
          date,
          descriptionKey: "journal.payment",
          params: { number, invoice: inv.number },
          sourceType: "PAYMENT",
          sourceId: payment!.id,
          lines: paymentPosting(input.amount),
        });
      }
      if (remaining - input.amount <= 0) {
        await tx
          .update(invoices)
          .set({ baseStatus: "PAID", updatedBy: p.userId })
          .where(eq(invoices.id, invoiceId));
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "invoice.payment",
        entity: "finance",
        entityId: invoiceId,
        after: { number, amount: input.amount },
        ...meta,
      });
      return payment!;
    });
  }

  /** Cancel by a full credit note that reverses the issuance posting (FINANCE full). */
  creditNote(p: Principal, invoiceId: string, reason: string | null, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const { inv, paid } = await this.locked(tx, invoiceId);
      const blocker = creditNoteBlocker(inv, paid);
      if (blocker) throw conflict(`errors.${blocker}`);
      const date = riyadhCalendarDate();
      const number = await nextNumber(tx, p.officeId, "CN");
      const [cn] = await tx
        .insert(creditNotes)
        .values({
          officeId: p.officeId,
          number,
          invoiceId,
          clientId: inv.clientId,
          issueDate: date,
          amount: inv.totalAmount,
          vatAmount: inv.vatAmount,
          reason: reason ?? t("creditNote.defaultReason"),
          createdBy: p.userId,
        })
        .returning({ id: creditNotes.id, number: creditNotes.number });
      await tx
        .update(invoices)
        .set({ isCredited: true, updatedBy: p.userId })
        .where(eq(invoices.id, invoiceId));
      await postJournal(tx, p.officeId, p.userId, {
        date,
        descriptionKey: "journal.creditNote",
        params: { number, invoice: inv.number },
        sourceType: "CREDIT_NOTE",
        sourceId: cn!.id,
        lines: creditNotePosting({
          net: inv.netAmount,
          vat: inv.vatAmount,
          total: inv.totalAmount,
        }),
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "invoice.creditNote",
        entity: "finance",
        entityId: invoiceId,
        after: { number },
        ...meta,
      });
      return cn!;
    });
  }

  /** Write the remaining receivable off to expense (FINANCE full). Output VAT is not reversed (docs FIN-BAD-DEBT). */
  badDebt(p: Principal, invoiceId: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const { inv, paid } = await this.locked(tx, invoiceId);
      if (inv.isCredited) throw conflict("errors.INVOICE_CREDITED");
      if (inv.isBadDebt) return;
      const remaining = remainingOf(inv.totalAmount, paid);
      await tx
        .update(invoices)
        .set({ isBadDebt: true, updatedBy: p.userId })
        .where(eq(invoices.id, invoiceId));
      if (remaining > 0) {
        await postJournal(tx, p.officeId, p.userId, {
          date: riyadhCalendarDate(),
          descriptionKey: "journal.badDebt",
          params: { invoice: inv.number },
          sourceType: "BAD_DEBT",
          sourceId: invoiceId,
          lines: badDebtPosting(remaining),
        });
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "invoice.badDebt",
        entity: "finance",
        entityId: invoiceId,
        after: { amount: remaining },
        ...meta,
      });
    });
  }

  // ── Reads ──

  /** Invoice rows with derived paid/remaining/status, newest first. */
  async rows(tx: Tx, where?: SQL) {
    const list = await tx
      .select({ inv: invoices, clientName: clients.name, caseTitle: cases.title })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(cases, eq(cases.id, invoices.caseId))
      .where(and(isNull(invoices.deletedAt), where))
      .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
    const ids = list.map((r) => r.inv.id);
    const pays = ids.length
      ? await tx
          .select({ invoiceId: payments.invoiceId, amount: payments.amount })
          .from(payments)
          .where(and(inArray(payments.invoiceId, ids), isNull(payments.deletedAt)))
      : [];
    return list.map(({ inv, clientName, caseTitle }) => {
      const paid = paidOf(pays.filter((x) => x.invoiceId === inv.id));
      return {
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        clientName,
        caseId: inv.caseId,
        caseTitle,
        issueDate: day(inv.issueDate),
        net: inv.netAmount,
        vat: inv.vatAmount,
        total: inv.totalAmount,
        paid,
        remaining: remainingOf(inv.totalAmount, paid),
        status: invoiceStatus(inv, paid),
        origin: inv.origin,
      };
    });
  }

  /** Clients and their cases for finance pickers (names only); cases follow the caller's row scope. */
  async parties(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run(async (tx) => ({
      clients: await tx
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(asc(clients.name)),
      cases: await tx
        .select({ id: cases.id, title: cases.title, clientId: cases.clientId })
        .from(cases)
        .where(caseVisibility(tx, policy, p))
        .orderBy(desc(cases.createdAt)),
      staff: await tx
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
        .orderBy(asc(users.name)),
    }));
  }

  /** Open receivables: invoices still due (journey, alerts, notifications). */
  async open(tx: Tx) {
    return (await this.rows(tx)).filter(
      (r) => r.status === "DUE" || r.status === "PARTIALLY_PAID" || r.status === "OVERDUE",
    );
  }

  /** Invoice number contains `q` (topbar search). */
  search(tx: Tx, q: string, take: number) {
    return tx
      .select({ id: invoices.id, number: invoices.number, clientName: clients.name })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(isNull(invoices.deletedAt), ilike(invoices.number, containsPattern(q))))
      .limit(take);
  }

  /** بوابة العميل: the client's own invoices, totals and status only. */
  async clientInvoices(clientId: string) {
    const rows = await this.tenantDb.run((tx) => this.rows(tx, eq(invoices.clientId, clientId)));
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      caseTitle: r.caseTitle,
      issueDate: r.issueDate,
      total: r.total,
      paid: r.paid,
      remaining: r.remaining,
      status: r.status,
    }));
  }

  list(q: { caseId?: string; clientId?: string }) {
    return this.tenantDb.run((tx) =>
      this.rows(
        tx,
        and(
          q.caseId ? eq(invoices.caseId, q.caseId) : undefined,
          q.clientId ? eq(invoices.clientId, q.clientId) : undefined,
        ),
      ),
    );
  }

  detail(id: string) {
    return this.tenantDb.run(async (tx) => {
      const [row] = await this.rows(tx, eq(invoices.id, id));
      if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
      const [inv] = await tx
        .select({ basis: invoices.basis })
        .from(invoices)
        .where(eq(invoices.id, id));
      const items = await tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.sortOrder));
      const pays = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.invoiceId, id), isNull(payments.deletedAt)))
        .orderBy(asc(payments.paymentDate), asc(payments.createdAt));
      const [cn] = await tx.select().from(creditNotes).where(eq(creditNotes.invoiceId, id));
      return {
        ...row,
        basis: inv?.basis ?? null,
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineNet: i.lineNet,
        })),
        payments: pays.map((x) => ({
          id: x.id,
          number: x.number,
          date: day(x.paymentDate),
          amount: x.amount,
          method: x.method,
          reference: x.reference,
          isApproved: x.isApproved,
        })),
        creditNote: cn
          ? { number: cn.number, date: day(cn.issueDate), amount: cn.amount, reason: cn.reason }
          : null,
      };
    });
  }
}
