/**
 * Pure HR business rules (docs/06 §5 end-of-service, §6 Saudization/Nitaqat,
 * §8 advance deduction, + payroll composition per the data-model PAYROLL_RUNS).
 * No DB/IO — services call these. Money is INTEGER HALALAS throughout; day/year
 * counts are plain integers. Every function here is covered by core.test.ts.
 */

// ── §5 End-of-service gratuity (مكافأة نهاية الخدمة) ──

/** Monthly wage basis for EOS = basic + allowances (docs/06 §5). Halalas. */
export function eosWage(basicSalary: number, allowances: number): number {
  return basicSalary + allowances;
}

/**
 * Whole years of service = current year − join year (docs/06 §5 uses the
 * calendar-year difference, not elapsed days). Never negative.
 */
export function serviceYears(joinYear: number, currentYear: number): number {
  return Math.max(0, currentYear - joinYear);
}

/**
 * End-of-service award in halalas (docs/06 §5, Saudi Labor Law):
 *   wage = basic + allowances
 *   years ≤ 5 → 0.5 × wage × years
 *   years > 5 → 0.5 × wage × 5 + wage × (years − 5)
 * Rounded to the nearest halala (the ½-wage term can be fractional).
 */
export function endOfServiceAward(params: {
  basicSalary: number;
  allowances: number;
  years: number;
}): number {
  const wage = eosWage(params.basicSalary, params.allowances);
  const years = Math.max(0, params.years);
  const firstFive = Math.min(years, 5);
  const beyondFive = Math.max(0, years - 5);
  const award = 0.5 * wage * firstFive + wage * beyondFive;
  return Math.round(award);
}

// ── §6 Saudization / Nitaqat (السعودة / نطاقات) ──

export type NitaqatBandKey =
  | "PLATINUM"
  | "HIGH_GREEN"
  | "MID_GREEN"
  | "LOW_GREEN"
  | "YELLOW"
  | "RED";

/** Nitaqat bands by Saudization percentage, high→low (docs/06 §6). */
export const NITAQAT_BANDS: ReadonlyArray<{
  key: NitaqatBandKey;
  labelAr: string;
  minPct: number;
}> = [
  { key: "PLATINUM", labelAr: "بلاتيني", minPct: 90 },
  { key: "HIGH_GREEN", labelAr: "أخضر مرتفع", minPct: 80 },
  { key: "MID_GREEN", labelAr: "أخضر متوسط", minPct: 60 },
  { key: "LOW_GREEN", labelAr: "أخضر منخفض", minPct: 40 },
  { key: "YELLOW", labelAr: "أصفر", minPct: 20 },
  { key: "RED", labelAr: "أحمر", minPct: 0 },
];

/** The Nitaqat band for a Saudization percentage (docs/06 §6 nitaqatBand). */
export function nitaqatBand(pct: number): NitaqatBandKey {
  const band = NITAQAT_BANDS.find((b) => pct >= b.minPct);
  // minPct: 0 (RED) catches everything ≥ 0; negatives clamp to RED too.
  return band?.key ?? "RED";
}

/** Saudization percentage = saudis / total × 100 (0 when no employees). */
export function saudizationPct(saudiCount: number, total: number): number {
  if (total <= 0) return 0;
  return (saudiCount / total) * 100;
}

/**
 * Saudi hires needed to reach a target percentage T (docs/06 §6):
 *   needed = ceil( (T/100 × total − saudi) / (1 − T/100) ), min 0.
 * Model: each new hire is Saudi, growing both numerator and denominator. T is
 * clamped to [0,100). At T ≥ 100 the ratio is unreachable while any non-Saudi
 * remains, so we return the count of current non-Saudis (all would have to be
 * Saudi) — a defensive edge, not part of the documented formula.
 */
export function saudisNeeded(saudiCount: number, total: number, targetPct: number): number {
  const T = Math.min(Math.max(targetPct, 0), 100);
  if (T <= 0) return 0;
  if (T >= 100) return Math.max(0, total - saudiCount);
  const needed = ((T / 100) * total - saudiCount) / (1 - T / 100);
  // Nudge off floating-point noise before ceil: e.g. 0.8×6−4 over 0.2 computes
  // to 4.0000000000000003, whose naive ceil would overshoot to 5.
  return Math.max(0, Math.ceil(needed - 1e-9));
}

/** Whether a nationality counts as Saudi (docs/06 §6, default «سعودي»). */
export function isSaudi(nationality: string | null | undefined): boolean {
  return (nationality ?? "سعودي").trim() === "سعودي";
}

// ── §8 Advances (السُّلف) ──

export type AdvanceLike = {
  amount: number;
  monthlyInstallment: number | null;
  months: number;
  paid: number;
};

/** Monthly installment = explicit value, else round(amount / max(1, months)). */
export function advanceMonthly(a: Pick<AdvanceLike, "amount" | "monthlyInstallment" | "months">): number {
  if (a.monthlyInstallment != null) return a.monthlyInstallment;
  return Math.round(a.amount / Math.max(1, a.months));
}

/** Remaining balance of an advance = max(0, amount − paid) (docs/06 §8). */
export function advanceRemaining(a: Pick<AdvanceLike, "amount" | "paid">): number {
  return Math.max(0, a.amount - a.paid);
}

// ── Payroll composition (data-model PAYROLL_RUNS) ──

/**
 * Net pay = basic + allowances − GOSI − advance deduction (data-model
 * PAYROLL_RUNS). This is a pure arithmetic identity so the posted journal
 * balances exactly; the service caps the advance deduction (payrollAdvanceDeduction)
 * so net never goes negative.
 */
export function payrollNet(line: {
  basic: number;
  allowances: number;
  gosi: number;
  advanceDeduction: number;
}): number {
  return line.basic + line.allowances - line.gosi - line.advanceDeduction;
}

/**
 * GOSI actually withheld in a run, capped at the wage: you cannot deduct more
 * social-insurance than the employee earns. Guards a data-entry slip (gosi >
 * wage) from driving net negative and unbalancing the whole payroll journal.
 */
export function effectiveGosi(gosi: number, basic: number, allowances: number): number {
  return Math.max(0, Math.min(gosi, basic + allowances));
}

/** Pay available for advance repayment after GOSI = max(0, basic+allow−gosi). */
export function payAfterGosi(basic: number, allowances: number, gosi: number): number {
  return Math.max(0, basic + allowances - gosi);
}

/**
 * The advance deduction actually applied in a payroll run: the smallest of the
 * scheduled monthly installment, the outstanding remaining, and the pay left
 * after GOSI (so net stays ≥ 0). All halalas, never negative.
 */
export function payrollAdvanceDeduction(params: {
  installment: number;
  remaining: number;
  payAfterGosi: number;
}): number {
  return Math.max(0, Math.min(params.installment, params.remaining, params.payAfterGosi));
}
