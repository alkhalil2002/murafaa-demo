import {
  ACCOUNT_TYPES,
  FEE_TYPES,
  INVOICE_ORIGINS,
  INVOICE_STATUSES,
  MAX_HALALAS,
  PAYMENT_METHODS,
  TRUST_TXN_TYPES,
} from "@murafaa/rules";
import { z } from "zod";
import { storedMessage } from "./cases.js";
import { dateOnly } from "./hearings.js";

const halalas = z.number().int().min(0).max(MAX_HALALAS);
const positive = z.number().int().min(1).max(MAX_HALALAS);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

// ── Invoices ──

export const invoiceRow = z
  .object({
    id: z.uuid(),
    number: z.string(),
    clientId: z.uuid(),
    clientName: z.string(),
    caseId: z.uuid().nullable(),
    caseTitle: z.string().nullable(),
    issueDate: z.iso.date(),
    net: z.number().int(),
    vat: z.number().int(),
    total: z.number().int(),
    paid: z.number().int(),
    remaining: z.number().int(),
    status: z.enum(INVOICE_STATUSES),
    origin: z.enum(INVOICE_ORIGINS),
  })
  .meta({ id: "InvoiceRow" });
export const invoiceList = z.array(invoiceRow).meta({ id: "InvoiceList" });
export const invoiceListQuery = z.object({
  caseId: z.uuid().optional(),
  clientId: z.uuid().optional(),
});

export const invoiceDetail = invoiceRow
  .extend({
    basis: z.string().nullable(),
    items: z.array(
      z.object({
        id: z.uuid(),
        description: z.string(),
        quantity: z.number().int(),
        unitPrice: z.number().int(),
        lineNet: z.number().int(),
      }),
    ),
    payments: z.array(
      z.object({
        id: z.uuid(),
        number: z.string(),
        date: z.iso.date(),
        amount: z.number().int(),
        method: z.enum(PAYMENT_METHODS),
        reference: z.string().nullable(),
        isApproved: z.boolean(),
      }),
    ),
    creditNote: z
      .object({
        number: z.string(),
        date: z.iso.date(),
        amount: z.number().int(),
        reason: z.string().nullable(),
      })
      .nullable(),
  })
  .meta({ id: "InvoiceDetail" });

export const createInvoiceBody = z
  .object({
    clientId: z.uuid(),
    caseId: z.uuid().nullish(),
    issueDate: dateOnly.optional(),
    basis: optional(300),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(500),
          quantity: z.number().int().min(1).max(10_000).default(1),
          unitPrice: positive,
        }),
      )
      .min(1)
      .max(50),
  })
  .meta({ id: "CreateInvoiceBody" });

export const paymentBody = z
  .object({
    amount: positive,
    method: z.enum(PAYMENT_METHODS),
    reference: optional(100),
    date: dateOnly.optional(),
  })
  .meta({ id: "PaymentBody" });
export const creditNoteBody = z.object({ reason: optional(500) }).meta({ id: "CreditNoteBody" });
export const createdNumber = z
  .object({ id: z.uuid(), number: z.string() })
  .meta({ id: "CreatedNumber" });

// ── Fee agreement and time (case finance tab) ──

export const feeAgreement = z
  .object({
    type: z.enum(FEE_TYPES),
    feeValue: z.number().int().nullable(),
    percentageBps: z.number().int().nullable(),
    awarded: z.number().int().nullable(),
  })
  .meta({ id: "FeeAgreement" });
export const feeAgreementView = z
  .object({
    agreement: feeAgreement.nullable(),
    /** What generating the fee invoice now would bill (net), including unbilled time for hourly fees. */
    previewNet: z.number().int(),
    agreed: z.number().int().nullable(),
    collected: z.number().int(),
  })
  .meta({ id: "FeeAgreementView" });
export const feeAgreementBody = z
  .object({
    type: z.enum(FEE_TYPES),
    feeValue: halalas.nullish(),
    percentageBps: z.number().int().min(0).max(10_000).nullish(),
    awarded: halalas.nullish(),
  })
  .meta({ id: "FeeAgreementBody" });

export const timeEntry = z
  .object({
    id: z.uuid(),
    caseId: z.uuid(),
    caseTitle: z.string(),
    lawyerId: z.uuid(),
    lawyerName: z.string(),
    description: z.string().nullable(),
    minutes: z.number().int(),
    hourlyRate: z.number().int(),
    value: z.number().int(),
    workDate: z.iso.date(),
    billable: z.boolean(),
    invoiced: z.boolean(),
  })
  .meta({ id: "TimeEntry" });
export const timeEntryList = z.array(timeEntry).meta({ id: "TimeEntryList" });
export const timeEntryQuery = z.object({ caseId: z.uuid().optional() });
export const timeEntryBody = z
  .object({
    caseId: z.uuid(),
    lawyerId: z.uuid(),
    description: optional(500),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
    hourlyRate: positive,
    workDate: dateOnly.optional(),
    billable: z.boolean().default(true),
  })
  .meta({ id: "TimeEntryBody" });

// ── Trust (أمانات) ──

export const trustAccountRow = z
  .object({ clientId: z.uuid(), clientName: z.string(), balance: z.number().int() })
  .meta({ id: "TrustAccountRow" });
export const trustAccountList = z
  .object({ accounts: z.array(trustAccountRow), total: z.number().int() })
  .meta({ id: "TrustAccountList" });
export const trustLedger = z
  .object({
    clientId: z.uuid(),
    clientName: z.string(),
    balance: z.number().int(),
    movements: z.array(
      z.object({
        id: z.uuid(),
        type: z.enum(TRUST_TXN_TYPES),
        amount: z.number().int(),
        date: z.iso.date(),
        note: z.string().nullable(),
        runningBalance: z.number().int(),
      }),
    ),
  })
  .meta({ id: "TrustLedger" });
export const trustMoveBody = z
  .object({
    type: z.enum(TRUST_TXN_TYPES),
    amount: positive,
    date: dateOnly.optional(),
    note: optional(500),
    caseId: z.uuid().nullish(),
  })
  .meta({ id: "TrustMoveBody" });
export const clientParams = z.object({ clientId: z.uuid() });
export const trustBalance = z.object({ balance: z.number().int() }).meta({ id: "TrustBalance" });

// ── Ledger ──

export const accountRow = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    type: z.enum(ACCOUNT_TYPES),
    isActive: z.boolean(),
  })
  .meta({ id: "AccountRow" });
export const accountList = z.array(accountRow).meta({ id: "AccountList" });
export const journalEntryRow = z
  .object({
    id: z.uuid(),
    entryNo: z.string(),
    date: z.iso.date(),
    description: storedMessage,
    sourceType: z.string(),
    lines: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        debit: z.number().int(),
        credit: z.number().int(),
      }),
    ),
  })
  .meta({ id: "JournalEntryRow" });
export const journalList = z.array(journalEntryRow).meta({ id: "JournalList" });
export const periodRow = z
  .object({ periodKey: z.string(), locked: z.boolean() })
  .meta({ id: "PeriodRow" });
export const periodList = z.array(periodRow).meta({ id: "PeriodList" });
export const periodParams = z.object({ periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
export const periodLockBody = z.object({ locked: z.boolean() }).meta({ id: "PeriodLockBody" });

/** Who and what can be billed: pickers for finance forms, without needing the clients/cases modules. */
export const billingParties = z
  .object({
    clients: z.array(z.object({ id: z.uuid(), name: z.string() })),
    cases: z.array(z.object({ id: z.uuid(), title: z.string(), clientId: z.uuid().nullable() })),
  })
  .meta({ id: "BillingParties" });
