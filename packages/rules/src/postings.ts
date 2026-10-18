import { isBalanced } from "./finance.js";
import type { AccountType } from "./ledger.js";
import type { TrustTxnType } from "./enums.js";

/**
 * Double-entry posting rules: which accounts each business event debits and
 * credits. In legacy these were spread across invoices.ts, trust.ts,
 * expenses.ts, hr/advances.ts and hr/payroll.ts; here every builder is pure
 * and returns balanced lines (amounts in halalas). The finance module posts
 * them in the same transaction as the event.
 */

/** Standard chart-of-accounts codes, seeded per office. */
export const ACC = {
  CASH_BANK: "1000",
  RECEIVABLES: "1100",
  TRUST_ASSET: "1200", // client-trust bank (asset)
  EMPLOYEE_ADVANCES: "1300", // salary advances owed by employees (asset)
  FIXED_ASSETS: "1500",
  PAYABLES: "2000",
  TRUST_LIABILITY: "2100", // client trust owed (liability)
  VAT_PAYABLE: "2200",
  GOSI_PAYABLE: "2300", // GOSI withheld, owed to the authority (liability)
  CAPITAL: "3000",
  FEE_REVENUE: "4000",
  DIRECT_COST: "5000",
  OPERATING_EXPENSE: "5100",
  SALARIES_EXPENSE: "5200", // gross salaries & wages (expense)
} as const;
export type AccountCode = (typeof ACC)[keyof typeof ACC];

/** Default chart of accounts for a new office. Names are office data (editable), not UI text. */
export const COA_SEED: ReadonlyArray<{ code: AccountCode; name: string; type: AccountType }> = [
  { code: "1000", name: "النقد والبنك", type: "ASSET" },
  { code: "1100", name: "الذمم المدينة", type: "ASSET" },
  { code: "1200", name: "حسابات عهدة العملاء", type: "ASSET" },
  { code: "1300", name: "سُلف الموظفين", type: "ASSET" },
  { code: "1500", name: "الأصول الثابتة", type: "ASSET" },
  { code: "2000", name: "الذمم الدائنة", type: "LIABILITY" },
  { code: "2100", name: "أمانات العملاء (عهدة)", type: "LIABILITY" },
  { code: "2200", name: "ضريبة القيمة المضافة المستحقة", type: "LIABILITY" },
  { code: "2300", name: "التأمينات الاجتماعية المستحقة (GOSI)", type: "LIABILITY" },
  { code: "3000", name: "رأس المال", type: "EQUITY" },
  { code: "4000", name: "إيرادات الأتعاب", type: "REVENUE" },
  { code: "5000", name: "تكلفة الخدمات المباشرة", type: "EXPENSE" },
  { code: "5100", name: "المصروفات التشغيلية", type: "EXPENSE" },
  { code: "5200", name: "الرواتب والأجور", type: "EXPENSE" },
];

export type PostingLine = { code: AccountCode; debit: number; credit: number };

const dr = (code: AccountCode, amount: number): PostingLine => ({ code, debit: amount, credit: 0 });
const cr = (code: AccountCode, amount: number): PostingLine => ({ code, debit: 0, credit: amount });

/** Drop zero-amount lines (legacy omitted them, e.g. no GOSI or no VAT). */
function nonZero(lines: PostingLine[]): PostingLine[] {
  return lines.filter((l) => l.debit > 0 || l.credit > 0);
}

/** Issue invoice: Dr receivables (total) / Cr fee revenue (net) + VAT payable (vat). */
export function invoicePosting(a: { net: number; vat: number; total: number }): PostingLine[] {
  return nonZero([
    dr(ACC.RECEIVABLES, a.total),
    cr(ACC.FEE_REVENUE, a.net),
    cr(ACC.VAT_PAYABLE, a.vat),
  ]);
}

/** Receive payment: Dr cash/bank / Cr receivables. */
export function paymentPosting(amount: number): PostingLine[] {
  return [dr(ACC.CASH_BANK, amount), cr(ACC.RECEIVABLES, amount)];
}

/** Credit note (cancels the invoice): Dr fee revenue (net) + VAT payable (vat) / Cr receivables (total). */
export function creditNotePosting(a: { net: number; vat: number; total: number }): PostingLine[] {
  return nonZero([
    dr(ACC.FEE_REVENUE, a.net),
    dr(ACC.VAT_PAYABLE, a.vat),
    cr(ACC.RECEIVABLES, a.total),
  ]);
}

/** Write off the unpaid remainder as bad debt: Dr operating expense / Cr receivables. */
export function badDebtPosting(remaining: number): PostingLine[] {
  return [dr(ACC.OPERATING_EXPENSE, remaining), cr(ACC.RECEIVABLES, remaining)];
}

/** Paid expense: Dr operating expense (net) + VAT payable (input VAT) / Cr cash/bank (gross). */
export function expensePosting(a: { net: number; vat: number; gross: number }): PostingLine[] {
  return nonZero([
    dr(ACC.OPERATING_EXPENSE, a.net),
    dr(ACC.VAT_PAYABLE, a.vat),
    cr(ACC.CASH_BANK, a.gross),
  ]);
}

/** Pay a salary advance: Dr employee advances / Cr cash/bank. */
export function advancePosting(amount: number): PostingLine[] {
  return [dr(ACC.EMPLOYEE_ADVANCES, amount), cr(ACC.CASH_BANK, amount)];
}

/**
 * Payroll run: Dr salaries (gross) / Cr GOSI payable + employee advances
 * (recovered) + cash/bank (net pay). Balances because net = gross − gosi − advances.
 */
export function payrollPosting(a: {
  gross: number;
  gosi: number;
  advances: number;
  net: number;
}): PostingLine[] {
  return nonZero([
    dr(ACC.SALARIES_EXPENSE, a.gross),
    cr(ACC.GOSI_PAYABLE, a.gosi),
    cr(ACC.EMPLOYEE_ADVANCES, a.advances),
    cr(ACC.CASH_BANK, a.net),
  ]);
}

/**
 * Client trust (أمانات), kept apart from office revenue (CLAUDE.md guardrail 5):
 *   deposit    Dr trust asset / Cr trust liability
 *   withdrawal Dr trust liability / Cr trust asset
 *   transfer to fees: Dr trust liability / Cr receivables when settling an
 *   invoice, else Cr fee revenue.
 */
export function trustPosting(
  type: TrustTxnType,
  amount: number,
  settlesInvoice: boolean,
): PostingLine[] {
  if (type === "DEPOSIT") return [dr(ACC.TRUST_ASSET, amount), cr(ACC.TRUST_LIABILITY, amount)];
  if (type === "WITHDRAWAL") return [dr(ACC.TRUST_LIABILITY, amount), cr(ACC.TRUST_ASSET, amount)];
  return [
    dr(ACC.TRUST_LIABILITY, amount),
    cr(settlesInvoice ? ACC.RECEIVABLES : ACC.FEE_REVENUE, amount),
  ];
}

/** Withdrawals and transfers may never take a client's trust balance below zero. */
export function canDebitTrust(balance: number, amount: number): boolean {
  return amount > 0 && balance >= amount;
}

/** Guard used by the finance module before posting. */
export function assertBalanced(lines: readonly PostingLine[]): void {
  if (!isBalanced(lines)) throw new Error("UNBALANCED_JOURNAL");
}

// ── Per-office document numbering ──

export type DocPrefix = "INV" | "REC" | "CN" | "JV";

/** Numbering starts after these bases (legacy NUMBER_BASE), e.g. the first invoice is INV-1043. */
export const NUMBER_BASE: Record<DocPrefix, number> = { INV: 1042, REC: 1000, CN: 2000, JV: 200 };

/**
 * The next number after the office's existing ones: max(base, highest) + 1.
 * The (office_id, number) unique index is the backstop for concurrent
 * creators; retry on conflict.
 */
export function nextDocNumber(prefix: DocPrefix, existing: readonly string[]): string {
  let max = NUMBER_BASE[prefix];
  for (const n of existing) {
    const m = /(\d+)/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}
