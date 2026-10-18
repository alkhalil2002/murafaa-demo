import { FeeType, InvoiceBaseStatus, TrustTxnType } from "./enums.js";

/** Value lists for contracts and forms. Labels: feeType.*, payMethod.*, invoiceStatus.*, trust.type.*, expCat.* */
export const FEE_TYPES = Object.values(FeeType) as readonly FeeType[];
export const INVOICE_BASE_STATUSES = Object.values(
  InvoiceBaseStatus,
) as readonly InvoiceBaseStatus[];
export const TRUST_TXN_TYPES = Object.values(TrustTxnType) as readonly TrustTxnType[];
export const INVOICE_STATUSES = [
  "DUE",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "BAD_DEBT",
  "CANCELLED",
] as const;
export const INVOICE_ORIGINS = [
  "MANUAL",
  "FEE_AGREEMENT",
  "EXPENSE_REIMBURSEMENT",
  "TIME_ENTRY",
] as const;
export type InvoiceOrigin = (typeof INVOICE_ORIGINS)[number];
export const PAYMENT_METHODS = ["BANK_TRANSFER", "MADA", "CASH", "CHEQUE", "FROM_TRUST"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const JOURNAL_SOURCES = [
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
] as const;
export type JournalSource = (typeof JOURNAL_SOURCES)[number];
export const EXPENSE_CATEGORIES = [
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
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_PAYMENT_METHODS = ["BANK_TRANSFER", "MADA", "CASH", "CHEQUE"] as const;
