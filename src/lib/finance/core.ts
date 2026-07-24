import {
  FeeType,
  InvoiceBaseStatus,
  TrustTxnType,
} from "@prisma/client";
import { vatOf } from "@/lib/money";

/**
 * Pure finance math (docs/06 §2 VAT, §3 fees, §7 invoice status). No DB/IO —
 * services call these. Money is INTEGER HALALAS throughout. VAT rounding lives
 * in @/lib/money (round-half-up on the halala integer).
 */

/** Largest amount an Int (int4) halala column holds (~21.47M SAR). */
export const MAX_HALALAS = 2_147_483_647;

/** Effective (derived) invoice status — never stored (docs/06 §7). */
export type EffectiveInvoiceStatus =
  | "DUE"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "BAD_DEBT"
  | "CANCELLED";

export type InvoiceForStatus = {
  totalAmount: number;
  baseStatus: InvoiceBaseStatus;
  isBadDebt: boolean;
  isCredited: boolean;
};

/** Sum of (approved) payments applied to an invoice, in halalas. */
export function paidOf(payments: readonly { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Remaining balance = max(0, total − paid). */
export function remainingOf(totalAmount: number, paid: number): number {
  return Math.max(0, totalAmount - paid);
}

/**
 * Derived invoice status in strict order (docs/06 §7 invStatusOf), with the
 * credit-note cancellation applied first (render-layer rule in the prototype,
 * folded in here so callers get one authoritative status).
 */
export function invoiceStatus(inv: InvoiceForStatus, paid: number): EffectiveInvoiceStatus {
  if (inv.isCredited) return "CANCELLED";
  if (inv.isBadDebt) return "BAD_DEBT";
  const remaining = remainingOf(inv.totalAmount, paid);
  if (remaining <= 0) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  // OVERDUE is driven by baseStatus. There is no due-date field yet, so nothing
  // flips it today; it becomes reachable once an Invoice.dueDate + a scheduled
  // job (Cloud Scheduler, per docs/02 build order) marks unpaid past-due
  // invoices OVERDUE. Kept faithful to docs/06 §7 for when that lands.
  if (inv.baseStatus === InvoiceBaseStatus.OVERDUE) return "OVERDUE";
  return "DUE";
}

/** A single invoice line net = quantity × unit price (halalas). */
export function lineNetOf(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

/** Invoice net = Σ line nets. */
export function invoiceNetOf(lines: readonly { quantity: number; unitPrice: number }[]): number {
  return lines.reduce((sum, l) => sum + lineNetOf(l.quantity, l.unitPrice), 0);
}

/** {net, vat, total} for a given net (docs/06 §2). */
export function amountsFromNet(net: number): { net: number; vat: number; total: number } {
  const vat = vatOf(net);
  return { net, vat, total: net + vat };
}

// ── Fee agreements (docs/06 §3) ──

export type FeeAgreementInput = {
  type: FeeType;
  feeValueMinor: number | null; // FLAT/RETAINER/HOURLY quoted (halalas)
  percentageBps: number | null; // PERCENTAGE (basis points, 10% = 1000)
  awardedMinor: number | null; // PERCENTAGE (halalas)
};

/** Billable, uninvoiced time for the hourly-fee basis. */
export type UnbilledTime = { minutes: number; hourlyRate: number };

/** The value of one time entry = round((minutes/60) × rate) (halalas). */
export function timeEntryValue(minutes: number, hourlyRate: number): number {
  return Math.round((minutes / 60) * hourlyRate);
}

/**
 * Net fee for an agreement (docs/06 §3 caseFeeNet). HOURLY sums the supplied
 * billable+uninvoiced time entries. Returns halalas (>= 0).
 */
export function feeNet(fee: FeeAgreementInput, unbilledTime: readonly UnbilledTime[] = []): number {
  switch (fee.type) {
    case FeeType.HOURLY:
      return unbilledTime.reduce((sum, t) => sum + timeEntryValue(t.minutes, t.hourlyRate), 0);
    case FeeType.PERCENTAGE: {
      const awarded = fee.awardedMinor ?? 0;
      const bps = fee.percentageBps ?? 0;
      return Math.round((awarded * bps) / 10_000); // bps/10000 = fraction
    }
    case FeeType.FLAT:
    case FeeType.RETAINER:
    default:
      return Math.max(0, fee.feeValueMinor ?? 0);
  }
}

// ── Expense VAT extraction (docs FIN-EXP-VAT-EXTRACT) ──

/**
 * Split a VAT-inclusive gross expense into {net, vat}. If an explicit VAT is
 * given use it (clamped), else extract 15/115 of the gross.
 */
export function expenseSplit(gross: number, explicitVat?: number | null): { net: number; vat: number } {
  let vat = explicitVat == null ? Math.round((gross * 15) / 115) : explicitVat;
  if (vat > gross || vat < 0) vat = 0;
  return { net: Math.max(0, gross - vat), vat };
}

// ── Trust (docs/06 trust rules) ──

/** Signed effect of a trust movement on the balance (deposits add). */
export function trustDelta(type: TrustTxnType, amount: number): number {
  return type === TrustTxnType.DEPOSIT ? amount : -amount;
}

/** Trust balance from movements (never assume non-negative — guard on write). */
export function trustBalanceOf(txns: readonly { type: TrustTxnType; amountMinor: number }[]): number {
  return txns.reduce((bal, t) => bal + trustDelta(t.type, t.amountMinor), 0);
}

// ── Aging (docs BR-LED-4) ──

export type AgingBucket = "b0_30" | "b31_60" | "b61_90" | "b90_plus";

/** Bucket an invoice by the age (calendar days) of its issue date. */
export function agingBucket(ageDays: number): AgingBucket {
  if (ageDays <= 30) return "b0_30";
  if (ageDays <= 60) return "b31_60";
  if (ageDays <= 90) return "b61_90";
  return "b90_plus";
}

// ── Journal balancing (docs BR-LED-1) ──

/** A balanced journal entry has ≥2 lines, each one-sided, Σdebit = Σcredit. */
export function isBalanced(lines: readonly { debit: number; credit: number }[]): boolean {
  if (lines.length < 2) return false;
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) return false;
    if ((l.debit > 0) === (l.credit > 0)) return false; // exactly one side > 0
    dr += l.debit;
    cr += l.credit;
  }
  return dr === cr && dr > 0;
}
