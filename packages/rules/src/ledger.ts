/**
 * Double-entry ledger rules from legacy ledger-reports.ts / finance ledger /
 * payroll. Labels: accType.*
 */

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Assets and expenses carry a normal debit balance; the rest a normal credit balance. */
export function isNormalDebit(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}

/** Account balance on its normal side (positive = normal). */
export function accountBalance(type: AccountType, debit: number, credit: number): number {
  return isNormalDebit(type) ? debit - credit : credit - debit;
}

/** Accounting period key "YYYY-MM" for a posting date (UTC), used by the period lock. */
export function periodKeyOf(date: Date): string {
  return periodKeyFor(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

/** Period key for a year and 1-based month, e.g. payroll runs. */
export function periodKeyFor(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
