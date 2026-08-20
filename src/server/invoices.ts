import {
  InvoiceBaseStatus,
  InvoiceOrigin,
  PaymentMethod,
  PermModule,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logPerformance } from "@/lib/performance";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import {
  MAX_HALALAS,
  amountsFromNet,
  invoiceNetOf,
  invoiceStatus,
  lineNetOf,
  paidOf,
  remainingOf,
} from "@/lib/finance/core";
import { ACC, assertPeriodOpen, nextNumber, postJournal, withNumberRetry } from "@/lib/finance/ledger";
import { postTrustMovement } from "./trust";
import { TrustTxnType } from "@prisma/client";
import { formatDateAr } from "@/lib/dates";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Invoices (docs/06 §2 VAT, §7 status). Every mutation runs in a transaction
 * that posts a balanced journal entry (docs BR-LED-2). Gated by the المالية
 * module (partner/accountant only), office-scoped, audited. Money in halalas.
 */

const money = z.number().int().nonnegative().max(MAX_HALALAS);
const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: money,
});
const createSchema = z.object({
  clientId: z.string().uuid(),
  caseId: z.string().uuid().nullish(),
  issueDate: z.coerce.date().optional(),
  items: z.array(itemSchema).min(1),
  basis: z.string().nullish(),
});
export type CreateInvoiceInput = z.input<typeof createSchema>;

/**
 * Create an invoice + items + issuance journal inside an existing transaction.
 * Reused by manual creation and the fee/expense/time generators so the source
 * flags and invoice commit atomically. This is the single choke point where
 * the client + case tenancy is enforced for EVERY invoice-generating path.
 */
export async function createInvoiceInTx(
  tx: Db,
  session: AppSession,
  input: {
    clientId: string;
    caseId?: string | null;
    issueDate: Date;
    items: { description: string; quantity: number; unitPrice: number }[];
    basis?: string | null;
    origin: InvoiceOrigin;
    fromExpenseId?: string | null;
    fromTimeEntryId?: string | null;
  },
) {
  // Tenancy: the client and (if any) the case must belong to this office, and
  // the case must belong to the same client — no cross-office/cross-client link.
  const client = await tx.client.findFirst({
    where: { id: input.clientId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw new PermissionError("scope");
  if (input.caseId) {
    const kase = await tx.case.findFirst({
      where: { id: input.caseId, officeId: session.officeId, deletedAt: null },
      select: { clientId: true },
    });
    if (!kase) throw new PermissionError("scope");
    if (kase.clientId && kase.clientId !== input.clientId) throw new PermissionError("scope");
  }

  const net = invoiceNetOf(input.items);
  if (net <= 0) throw new Error("INVOICE_NET_NONPOSITIVE");
  const { vat, total } = amountsFromNet(net);
  await assertPeriodOpen(tx, session.officeId, input.issueDate);
  const number = await nextNumber(tx, session.officeId, "INV");

  const invoice = await tx.invoice.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      number,
      clientId: input.clientId,
      caseId: input.caseId ?? null,
      issueDate: input.issueDate,
      netAmount: net,
      vatAmount: vat,
      totalAmount: total,
      baseStatus: InvoiceBaseStatus.DUE,
      origin: input.origin,
      basis: input.basis ?? null,
      fromExpenseId: input.fromExpenseId ?? null,
      fromTimeEntryId: input.fromTimeEntryId ?? null,
      items: {
        create: input.items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineNet: lineNetOf(it.quantity, it.unitPrice),
          sortOrder: i,
        })),
      },
    },
  });

  // Issuance posting: Dr Receivables (total), Cr Fee Revenue (net), Cr VAT (vat).
  await postJournal(tx, session.officeId, {
    entryDate: input.issueDate,
    description: `إثبات فاتورة ${number}`,
    sourceType: "INVOICE",
    sourceId: invoice.id,
    postedById: session.userId,
    lines: [
      { code: ACC.RECEIVABLES, debit: total },
      { code: ACC.FEE_REVENUE, credit: net },
      { code: ACC.VAT_PAYABLE, credit: vat },
    ],
  });
  await logPerformance(tx, {
    officeId: session.officeId,
    userId: session.userId,
    kind: "INVOICE_CREATED",
  });
  return invoice;
}

export async function createInvoice(session: AppSession, raw: CreateInvoiceInput) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = createSchema.parse(raw);
  const invoice = await withNumberRetry(() =>
    prisma.$transaction((tx) =>
      createInvoiceInTx(tx, session, {
        clientId: input.clientId,
        caseId: input.caseId,
        issueDate: input.issueDate ?? new Date(),
        items: input.items,
        basis: input.basis,
        origin: InvoiceOrigin.MANUAL,
      }),
    ),
  );
  await logAudit({ session, action: "invoice.create", resource: "finance", targetId: invoice.id, detail: invoice.number });
  return invoice;
}

const paySchema = z.object({
  amountMinor: z.number().int().positive().max(MAX_HALALAS),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().nullish(),
  date: z.coerce.date().optional(),
});
export type RecordPaymentInput = z.infer<typeof paySchema>;

export async function recordPayment(session: AppSession, invoiceId: string, raw: RecordPaymentInput) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = paySchema.parse(raw);
  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { requireApproval: true },
  });

  const result = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, officeId: session.officeId, deletedAt: null },
      include: { payments: true },
    });
    if (!invoice) throw new PermissionError("scope");
    if (invoice.isCredited || invoice.isBadDebt) throw new Error("INVOICE_NOT_PAYABLE");

    const paid = paidOf(invoice.payments);
    const remaining = remainingOf(invoice.totalAmount, paid);
    if (input.amountMinor > remaining) throw new Error("PAYMENT_EXCEEDS_REMAINING");

    const date = input.date ?? new Date();
    await assertPeriodOpen(tx, session.officeId, date);
    const number = await nextNumber(tx, session.officeId, "REC");

    const payment = await tx.payment.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        number,
        invoiceId,
        paymentDate: date,
        amount: input.amountMinor,
        method: input.method,
        reference: input.reference ?? null,
        isApproved: !office.requireApproval,
        approvedById: office.requireApproval ? null : session.userId,
        approvedAt: office.requireApproval ? null : date,
      },
    });

    if (input.method === PaymentMethod.FROM_TRUST) {
      // Funds come from the client trust: a single Dr 2100 / Cr 1100 posting via
      // the trust movement settles the receivable — no separate cash posting.
      await postTrustMovement(tx, session, {
        clientId: invoice.clientId,
        type: TrustTxnType.TRANSFER_TO_FEES,
        amountMinor: input.amountMinor,
        date,
        note: `سداد الفاتورة ${invoice.number} من العهدة`,
        relatedInvoiceId: invoiceId,
        relatedCaseId: invoice.caseId,
      });
    } else {
      await postJournal(tx, session.officeId, {
        entryDate: date,
        description: `سند قبض ${number} للفاتورة ${invoice.number}`,
        sourceType: "PAYMENT",
        sourceId: payment.id,
        postedById: session.userId,
        lines: [
          { code: ACC.CASH_BANK, debit: input.amountMinor },
          { code: ACC.RECEIVABLES, credit: input.amountMinor },
        ],
      });
    }

    // Mark fully-settled invoices PAID (keeps the OVERDUE branch consistent).
    if (remaining - input.amountMinor <= 0) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { baseStatus: InvoiceBaseStatus.PAID } });
    }
    return payment;
  }));

  await logAudit({ session, action: "invoice.payment", resource: "finance", targetId: invoiceId, detail: result.number });
  return result;
}

export async function issueCreditNote(session: AppSession, invoiceId: string, reason: string) {
  // Cancelling an invoice is a FULL-level action.
  await requireModule(session, PermModule.FINANCE, "delete");
  const cn = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, officeId: session.officeId, deletedAt: null },
      include: { payments: true },
    });
    if (!invoice) throw new PermissionError("scope");
    if (invoice.isCredited) throw new Error("ALREADY_CREDITED");
    if (invoice.isBadDebt) throw new Error("INVOICE_BAD_DEBT");
    // A full credit note reverses the WHOLE receivable; if money was already
    // collected, crediting the full total would drive AR negative. Require the
    // payment be refunded/reversed first (a paid invoice isn't cancelled this way).
    if (paidOf(invoice.payments) > 0) throw new Error("INVOICE_HAS_PAYMENTS");

    const date = new Date();
    await assertPeriodOpen(tx, session.officeId, date);
    const number = await nextNumber(tx, session.officeId, "CN");
    const creditNote = await tx.creditNote.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        number,
        invoiceId,
        clientId: invoice.clientId,
        issueDate: date,
        amount: invoice.totalAmount,
        vatAmount: invoice.vatAmount,
        reason: reason || "إلغاء الفاتورة",
      },
    });
    await tx.invoice.update({ where: { id: invoiceId }, data: { isCredited: true } });
    // Reverse the issuance posting.
    await postJournal(tx, session.officeId, {
      entryDate: date,
      description: `إشعار دائن ${number} — إلغاء الفاتورة ${invoice.number}`,
      sourceType: "CREDIT_NOTE",
      sourceId: creditNote.id,
      postedById: session.userId,
      lines: [
        { code: ACC.FEE_REVENUE, debit: invoice.netAmount },
        { code: ACC.VAT_PAYABLE, debit: invoice.vatAmount },
        { code: ACC.RECEIVABLES, credit: invoice.totalAmount },
      ],
    });
    return creditNote;
  }));
  await logAudit({ session, action: "invoice.creditNote", resource: "finance", targetId: invoiceId, detail: cn.number });
  return cn;
}

export async function writeOffBadDebt(session: AppSession, invoiceId: string) {
  await requireModule(session, PermModule.FINANCE, "delete");
  await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, officeId: session.officeId, deletedAt: null },
      include: { payments: true },
    });
    if (!invoice) throw new PermissionError("scope");
    if (invoice.isCredited) throw new Error("INVOICE_CREDITED");
    if (invoice.isBadDebt) return;

    const remaining = remainingOf(invoice.totalAmount, paidOf(invoice.payments));
    const date = new Date();
    await assertPeriodOpen(tx, session.officeId, date);
    await tx.invoice.update({ where: { id: invoiceId }, data: { isBadDebt: true } });
    if (remaining > 0) {
      // Write off the remaining receivable to expense (VAT is NOT reversed —
      // only a credit note reverses output VAT, docs FIN-BAD-DEBT).
      await postJournal(tx, session.officeId, {
        entryDate: date,
        description: `إعدام دين — الفاتورة ${invoice.number}`,
        sourceType: "MANUAL",
        postedById: session.userId,
        lines: [
          { code: ACC.OPERATING_EXPENSE, debit: remaining },
          { code: ACC.RECEIVABLES, credit: remaining },
        ],
      });
    }
  }));
  await logAudit({ session, action: "invoice.badDebt", resource: "finance", targetId: invoiceId });
}

// ── Reads ──

export type InvoiceDTO = {
  id: string;
  number: string;
  clientName: string;
  caseTitle: string | null;
  issueDate: string;
  net: number;
  vat: number;
  total: number;
  paid: number;
  remaining: number;
  status: ReturnType<typeof invoiceStatus>;
};

function toDTO(inv: {
  id: string;
  number: string;
  issueDate: Date;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  baseStatus: InvoiceBaseStatus;
  isBadDebt: boolean;
  isCredited: boolean;
  client: { name: string };
  case: { title: string } | null;
  payments: { amount: number }[];
}): InvoiceDTO {
  const paid = paidOf(inv.payments);
  return {
    id: inv.id,
    number: inv.number,
    clientName: inv.client.name,
    caseTitle: inv.case?.title ?? null,
    // Stays ISO: a DATA field on the DTO, parsed downstream
    // (`new Date(inv.issueDate)` in src/server/notifications.ts). Display
    // formatting belongs at the render site, not here.
    issueDate: inv.issueDate.toISOString().slice(0, 10),
    net: inv.netAmount,
    vat: inv.vatAmount,
    total: inv.totalAmount,
    paid,
    remaining: remainingOf(inv.totalAmount, paid),
    status: invoiceStatus(inv, paid),
  };
}

export async function listInvoices(session: AppSession, caseId?: string): Promise<InvoiceDTO[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const rows = await prisma.invoice.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(caseId ? { caseId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, case: { select: { title: true } }, payments: { where: { isApproved: true }, select: { amount: true } } },
  });
  return rows.map(toDTO);
}

/** كشف حساب العميل (prototype finStmt/stmtRender) — every invoice for one client. */
export async function listInvoicesByClient(session: AppSession, clientId: string): Promise<InvoiceDTO[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const rows = await prisma.invoice.findMany({
    where: { officeId: session.officeId, clientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } }, case: { select: { title: true } }, payments: { where: { isApproved: true }, select: { amount: true } } },
  });
  return rows.map(toDTO);
}

export async function getInvoice(session: AppSession, id: string) {
  await requireModule(session, PermModule.FINANCE, "view");
  const inv = await prisma.invoice.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
    include: {
      client: { select: { name: true } },
      case: { select: { title: true } },
      items: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paymentDate: "asc" } },
      creditNote: true,
    },
  });
  if (!inv) throw new PermissionError("scope");
  return { ...inv, dto: toDTO({ ...inv, payments: inv.payments.filter((p) => p.isApproved) }) };
}
