import {
  ExpenseCategory,
  ExpensePaymentMethod,
  InvoiceOrigin,
  PermModule,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { MAX_HALALAS, expenseSplit, timeEntryValue } from "@/lib/finance/core";
import { ACC, assertPeriodOpen, postJournal, withNumberRetry } from "@/lib/finance/ledger";
import { createInvoiceInTx } from "./invoices";

/**
 * Expenses + time entries (docs FIN-EXP and FIN-TIME rules). Finance-gated (المالية).
 * Expenses post Dr expense + Dr input-VAT / Cr cash. Billable expenses and
 * billable time convert to reimbursement/time invoices transactionally.
 */

const expenseSchema = z.object({
  grossAmount: z.number().int().positive().max(MAX_HALALAS),
  explicitVat: z.number().int().nonnegative().max(MAX_HALALAS).nullish(),
  category: z.nativeEnum(ExpenseCategory).default(ExpenseCategory.OTHER),
  vendor: z.string().nullish(),
  method: z.nativeEnum(ExpensePaymentMethod).default(ExpensePaymentMethod.BANK_TRANSFER),
  documentNo: z.string().nullish(),
  expenseDate: z.coerce.date().optional(),
  billable: z.boolean().default(false),
  recurring: z.boolean().default(false),
  clientId: z.string().uuid().nullish(),
  caseId: z.string().uuid().nullish(),
});
export type CreateExpenseInput = z.input<typeof expenseSchema>;

export async function createExpense(session: AppSession, raw: CreateExpenseInput) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = expenseSchema.parse(raw);
  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { requireApproval: true },
  });
  // Tenancy: a billable expense's client/case (used for reimbursement) must
  // belong to this office.
  if (input.billable) {
    if (input.clientId) {
      const c = await prisma.client.findFirst({
        where: { id: input.clientId, officeId: session.officeId, deletedAt: null },
        select: { id: true },
      });
      if (!c) throw new PermissionError("scope");
    }
    if (input.caseId) {
      const k = await prisma.case.findFirst({
        where: { id: input.caseId, officeId: session.officeId, deletedAt: null },
        select: { id: true },
      });
      if (!k) throw new PermissionError("scope");
    }
  }

  const { net, vat } = expenseSplit(input.grossAmount, input.explicitVat ?? undefined);
  const date = input.expenseDate ?? new Date();
  const gross = net + vat;
  const approved = !office.requireApproval;

  const expense = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tx, session.officeId, date);
    const row = await tx.expense.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        expenseDate: date,
        category: input.category,
        vendor: input.vendor ?? null,
        netAmount: net,
        inputVat: vat,
        method: input.method,
        documentNo: input.documentNo ?? null,
        billable: input.billable,
        recurring: input.recurring,
        approved,
        // billable expenses may target a client/case for reimbursement
        clientId: input.billable ? (input.clientId ?? null) : null,
        caseId: input.billable ? (input.caseId ?? null) : null,
      },
    });
    // Post only once approved (unapproved expenses await partner approval).
    if (approved) {
      await postJournal(tx, session.officeId, {
        entryDate: date,
        description: `مصروف — ${input.vendor ?? input.category}`,
        sourceType: "EXPENSE",
        sourceId: row.id,
        postedById: session.userId,
        lines: [
          { code: ACC.OPERATING_EXPENSE, debit: net },
          ...(vat > 0 ? [{ code: ACC.VAT_PAYABLE, debit: vat }] : []),
          { code: ACC.CASH_BANK, credit: gross },
        ],
      });
    }
    return row;
  }));
  await logAudit({ session, action: "expense.create", resource: "finance", targetId: expense.id });
  return expense;
}

export async function listExpenses(session: AppSession, caseId?: string) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.expense.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(caseId ? { caseId } : {}) },
    orderBy: { expenseDate: "desc" },
    include: { client: { select: { name: true } }, case: { select: { title: true } } },
  });
}

export async function reimburseExpense(session: AppSession, expenseId: string) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const invoice = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, officeId: session.officeId, deletedAt: null },
    });
    if (!expense) throw new PermissionError("scope");
    if (!expense.billable || expense.billed) throw new Error("EXPENSE_NOT_REIMBURSABLE");
    if (!expense.clientId) throw new Error("EXPENSE_NO_CLIENT");

    const inv = await createInvoiceInTx(tx, session, {
      clientId: expense.clientId,
      caseId: expense.caseId,
      issueDate: new Date(),
      items: [
        {
          description: `استرداد مصروف: ${expense.vendor ?? expense.category}`,
          quantity: 1,
          unitPrice: expense.netAmount,
        },
      ],
      basis: "استرداد مصروف",
      origin: InvoiceOrigin.EXPENSE_REIMBURSEMENT,
      fromExpenseId: expense.id,
    });
    await tx.expense.update({
      where: { id: expenseId },
      data: { billed: true, reimbursementInvoiceId: inv.id },
    });
    return inv;
  }));
  await logAudit({ session, action: "expense.reimburse", resource: "finance", targetId: expenseId, detail: invoice.number });
  return invoice;
}

// ── Time entries ──

const timeSchema = z.object({
  caseId: z.string().uuid(),
  lawyerId: z.string().uuid(),
  description: z.string().nullish(),
  minutes: z.number().int().positive(),
  hourlyRate: z.number().int().positive().max(MAX_HALALAS),
  workDate: z.coerce.date().optional(),
  billable: z.boolean().default(true),
});
export type CreateTimeInput = z.input<typeof timeSchema>;

export async function createTimeEntry(session: AppSession, raw: CreateTimeInput) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = timeSchema.parse(raw);
  const kase = await prisma.case.findFirst({
    where: { id: input.caseId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!kase) throw new PermissionError("scope");
  const lawyer = await prisma.user.findFirst({
    where: { id: input.lawyerId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!lawyer) throw new PermissionError("scope");
  const workDate = input.workDate ?? new Date();
  await assertPeriodOpen(prisma, session.officeId, workDate);

  const entry = await prisma.timeEntry.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId: input.caseId,
      lawyerId: input.lawyerId,
      description: input.description ?? null,
      minutes: input.minutes,
      hourlyRate: input.hourlyRate,
      workDate,
      billable: input.billable,
    },
  });
  await logAudit({ session, action: "time.create", resource: "finance", targetId: entry.id });
  return entry;
}

export async function listTimeEntries(session: AppSession, caseId?: string) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.timeEntry.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(caseId ? { caseId } : {}) },
    orderBy: { workDate: "desc" },
    include: { lawyer: { select: { name: true } }, case: { select: { title: true } } },
  });
}

export async function invoiceTimeEntry(session: AppSession, entryId: string) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const invoice = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: { id: entryId, officeId: session.officeId, deletedAt: null },
      include: { case: { select: { clientId: true, title: true } } },
    });
    if (!entry) throw new PermissionError("scope");
    if (!entry.billable || entry.invoiced) throw new Error("TIME_NOT_BILLABLE");
    if (!entry.case.clientId) throw new Error("TIME_NO_CLIENT");

    const net = timeEntryValue(entry.minutes, entry.hourlyRate);
    if (net <= 0) throw new Error("TIME_NET_NONPOSITIVE");
    const inv = await createInvoiceInTx(tx, session, {
      clientId: entry.case.clientId,
      caseId: entry.caseId,
      issueDate: new Date(),
      items: [
        {
          description: entry.description ?? `أتعاب بالساعة — ${entry.case.title}`,
          quantity: 1,
          unitPrice: net,
        },
      ],
      basis: "أتعاب بالساعة",
      origin: InvoiceOrigin.TIME_ENTRY,
      fromTimeEntryId: entry.id,
    });
    await tx.timeEntry.update({ where: { id: entryId }, data: { invoiced: true, invoiceId: inv.id } });
    return inv;
  }));
  await logAudit({ session, action: "time.invoice", resource: "finance", targetId: entryId, detail: invoice.number });
  return invoice;
}
