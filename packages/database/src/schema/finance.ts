import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { cases } from "./cases.js";
import { clients } from "./crm.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/**
 * Finance (docs/06 §2 VAT, §3 fees, §7 invoice status; legacy server/invoices,
 * fees, trust, expenses). Money is bigint halalas. Journal entries, journal
 * lines and trust movements are append-only: the app role may not update or
 * delete them (grants in the migration).
 */

const money = (name: string) => bigint(name, { mode: "number" });
const officeRef = () =>
  uuid("office_id")
    .notNull()
    .references(() => offices.id);

/** Values match @murafaa/rules. */
export const accountTypeEnum = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);
export const journalSourceEnum = pgEnum("journal_source", [
  "INVOICE",
  "PAYMENT",
  "CREDIT_NOTE",
  "BAD_DEBT",
  "EXPENSE",
  "TRUST_DEPOSIT",
  "TRUST_WITHDRAWAL",
  "TRUST_TRANSFER",
  "PAYROLL",
  "MANUAL",
]);
export const feeTypeEnum = pgEnum("fee_type", ["FLAT", "RETAINER", "HOURLY", "PERCENTAGE"]);
export const invoiceBaseStatusEnum = pgEnum("invoice_base_status", ["DUE", "PAID", "OVERDUE"]);
export const invoiceOriginEnum = pgEnum("invoice_origin", [
  "MANUAL",
  "FEE_AGREEMENT",
  "EXPENSE_REIMBURSEMENT",
  "TIME_ENTRY",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "BANK_TRANSFER",
  "MADA",
  "CASH",
  "CHEQUE",
  "FROM_TRUST",
]);
export const trustTxnTypeEnum = pgEnum("trust_txn_type", [
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER_TO_FEES",
]);
export const docPrefixEnum = pgEnum("doc_prefix", ["INV", "REC", "CN", "JV"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "SALARIES",
  "OFFICE_RENT",
  "MARKETING",
  "SUBSCRIPTIONS",
  "GOVERNMENT_FEES",
  "COURT_FEES",
  "EXPERT_FEES",
  "ADMIN_EXPENSES",
  "HOSPITALITY_TRANSPORT",
  "OTHER",
]);
export const expenseMethodEnum = pgEnum("expense_method", [
  "BANK_TRANSFER",
  "MADA",
  "CASH",
  "CHEQUE",
]);

export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id,
    officeId: officeRef(),
    code: text("code").notNull(),
    /** Office data (editable), not UI text. */
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...audit,
  },
  (t) => [uniqueIndex("chart_of_accounts_office_code_key").on(t.officeId, t.code), tenantPolicy()],
).enableRLS();

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id,
    officeId: officeRef(),
    /** YYYY-MM */
    periodKey: text("period_key").notNull(),
    locked: boolean("locked").notNull().default(false),
    lockedBy: uuid("locked_by").references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [uniqueIndex("accounting_periods_office_key").on(t.officeId, t.periodKey), tenantPolicy()],
).enableRLS();

/**
 * Per-office document counters. Incremented with one upsert inside the
 * document's own transaction, so numbers are unique and, because a rolled-back
 * document also rolls back its number, without gaps (sequential invoices).
 */
export const docCounters = pgTable(
  "doc_counters",
  {
    officeId: officeRef(),
    prefix: docPrefixEnum("prefix").notNull(),
    lastNo: integer("last_no").notNull(),
  },
  (t) => [primaryKey({ columns: [t.officeId, t.prefix] }), tenantPolicy()],
).enableRLS();

/** Balanced double-entry postings. The description is an i18n key + params. */
export const journalEntries = pgTable(
  "journal_entries",
  {
    id,
    officeId: officeRef(),
    entryNo: text("entry_no").notNull(),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    descriptionKey: text("description_key").notNull(),
    params: jsonb("params").$type<Record<string, string | number>>(),
    sourceType: journalSourceEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    periodKey: text("period_key").notNull(),
    postedBy: uuid("posted_by").references(() => users.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("journal_entries_office_no_key").on(t.officeId, t.entryNo),
    index("journal_entries_period_idx").on(t.officeId, t.periodKey),
    index("journal_entries_source_idx").on(t.officeId, t.sourceType, t.sourceId),
    tenantPolicy(),
  ],
).enableRLS();

export const journalLines = pgTable(
  "journal_lines",
  {
    id,
    officeId: officeRef(),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => chartOfAccounts.id),
    debit: money("debit").notNull().default(0),
    credit: money("credit").notNull().default(0),
    lineNo: integer("line_no").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("journal_lines_entry_idx").on(t.journalEntryId),
    index("journal_lines_account_idx").on(t.officeId, t.accountId),
    check(
      "journal_lines_one_side",
      sql`${t.debit} >= 0 and ${t.credit} >= 0 and (${t.debit} = 0) <> (${t.credit} = 0)`,
    ),
    tenantPolicy(),
  ],
).enableRLS();

/** One live fee agreement per case (docs/06 §3). */
export const caseFeeAgreements = pgTable(
  "case_fee_agreements",
  {
    id,
    officeId: officeRef(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    type: feeTypeEnum("type").notNull().default("FLAT"),
    feeValue: money("fee_value"),
    /** Basis points: 2500 = 25%. */
    percentageBps: integer("percentage_bps"),
    awarded: money("awarded"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("case_fee_agreements_case_key")
      .on(t.caseId)
      .where(sql`${t.deletedAt} is null`),
    tenantPolicy(),
  ],
).enableRLS();

export const invoices = pgTable(
  "invoices",
  {
    id,
    officeId: officeRef(),
    number: text("number").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    caseId: uuid("case_id").references(() => cases.id),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
    netAmount: money("net_amount").notNull(),
    vatAmount: money("vat_amount").notNull(),
    totalAmount: money("total_amount").notNull(),
    /** Stored part of the status; the effective one is derived (packages/rules invoiceStatus). */
    baseStatus: invoiceBaseStatusEnum("base_status").notNull().default("DUE"),
    origin: invoiceOriginEnum("origin").notNull().default("MANUAL"),
    basis: text("basis"),
    isBadDebt: boolean("is_bad_debt").notNull().default(false),
    isCredited: boolean("is_credited").notNull().default(false),
    fromExpenseId: uuid("from_expense_id"),
    fromTimeEntryId: uuid("from_time_entry_id"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("invoices_office_number_key").on(t.officeId, t.number),
    index("invoices_client_idx").on(t.officeId, t.clientId),
    index("invoices_case_idx").on(t.officeId, t.caseId),
    check(
      "invoices_amounts",
      sql`${t.netAmount} > 0 and ${t.vatAmount} >= 0 and ${t.totalAmount} = ${t.netAmount} + ${t.vatAmount}`,
    ),
    tenantPolicy(),
  ],
).enableRLS();

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id,
    officeId: officeRef(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull(),
    lineNet: money("line_net").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
    ...audit,
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId), tenantPolicy()],
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id,
    officeId: officeRef(),
    number: text("number").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    amount: money("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: text("reference"),
    /** Under the office's require-approval switch a partner approves it later (prototype approvePayment). */
    isApproved: boolean("is_approved").notNull().default(true),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Bank reconciliation. */
    cleared: boolean("cleared").notNull().default(false),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("payments_office_number_key").on(t.officeId, t.number),
    index("payments_invoice_idx").on(t.officeId, t.invoiceId),
    check("payments_amount_positive", sql`${t.amount} > 0`),
    tenantPolicy(),
  ],
).enableRLS();

export const creditNotes = pgTable(
  "credit_notes",
  {
    id,
    officeId: officeRef(),
    number: text("number").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
    amount: money("amount").notNull(),
    vatAmount: money("vat_amount").notNull(),
    reason: text("reason"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("credit_notes_office_number_key").on(t.officeId, t.number),
    uniqueIndex("credit_notes_invoice_key").on(t.invoiceId),
    tenantPolicy(),
  ],
).enableRLS();

export const timeEntries = pgTable(
  "time_entries",
  {
    id,
    officeId: officeRef(),
    lawyerId: uuid("lawyer_id")
      .notNull()
      .references(() => users.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    description: text("description"),
    minutes: integer("minutes").notNull(),
    /** Halalas per hour. */
    hourlyRate: money("hourly_rate").notNull(),
    workDate: timestamp("work_date", { withTimezone: true }).notNull(),
    billable: boolean("billable").notNull().default(true),
    invoiced: boolean("invoiced").notNull().default(false),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("time_entries_case_idx").on(t.officeId, t.caseId),
    check("time_entries_positive", sql`${t.minutes} > 0 and ${t.hourlyRate} > 0`),
    tenantPolicy(),
  ],
).enableRLS();

/**
 * Client trust (أمانات): ring-fenced from office revenue (guardrail 5). The
 * balance is a cache of the movements and can never go below zero.
 */
export const trustAccounts = pgTable(
  "trust_accounts",
  {
    id,
    officeId: officeRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    balance: money("balance").notNull().default(0),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("trust_accounts_client_key").on(t.clientId),
    check("trust_accounts_non_negative", sql`${t.balance} >= 0`),
    tenantPolicy(),
  ],
).enableRLS();

export const trustTransactions = pgTable(
  "trust_transactions",
  {
    id,
    officeId: officeRef(),
    trustAccountId: uuid("trust_account_id")
      .notNull()
      .references(() => trustAccounts.id),
    type: trustTxnTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    note: text("note"),
    relatedInvoiceId: uuid("related_invoice_id").references(() => invoices.id),
    relatedCaseId: uuid("related_case_id").references(() => cases.id),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("trust_transactions_account_idx").on(t.officeId, t.trustAccountId),
    check("trust_transactions_positive", sql`${t.amount} > 0`),
    tenantPolicy(),
  ],
).enableRLS();

export const expenses = pgTable(
  "expenses",
  {
    id,
    officeId: officeRef(),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
    category: expenseCategoryEnum("category").notNull().default("OTHER"),
    vendor: text("vendor"),
    netAmount: money("net_amount").notNull(),
    /** Recoverable input VAT. */
    inputVat: money("input_vat").notNull(),
    method: expenseMethodEnum("method").notNull().default("BANK_TRANSFER"),
    documentNo: text("document_no"),
    billable: boolean("billable").notNull().default(false),
    billed: boolean("billed").notNull().default(false),
    recurring: boolean("recurring").notNull().default(false),
    /** Unapproved expenses are not posted until a partner approves them. */
    approved: boolean("approved").notNull().default(true),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    clientId: uuid("client_id").references(() => clients.id),
    caseId: uuid("case_id").references(() => cases.id),
    reimbursementInvoiceId: uuid("reimbursement_invoice_id").references(() => invoices.id),
    cleared: boolean("cleared").notNull().default(false),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("expenses_category_idx").on(t.officeId, t.category),
    index("expenses_case_idx").on(t.officeId, t.caseId),
    check(
      "expenses_amounts",
      sql`${t.netAmount} >= 0 and ${t.inputVat} >= 0 and ${t.netAmount} + ${t.inputVat} > 0`,
    ),
    tenantPolicy(),
  ],
).enableRLS();
