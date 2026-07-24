/**
 * Money is stored as integer minor units — halalas (1 SAR = 100 halalas).
 * Never use floats for money (CLAUDE.md §money integrity). All helpers here
 * take and return integer halalas.
 */

export const HALALAS_PER_RIYAL = 100;

/** VAT rate in the Kingdom (docs/06 §2). Kept as a fraction for exact math. */
export const VAT_RATE = 0.15;

/** Convert a riyal amount (possibly fractional) to integer halalas. */
export function riyalsToHalalas(riyals: number): number {
  return Math.round(riyals * HALALAS_PER_RIYAL);
}

/** Convert integer halalas back to a riyal number (for display only). */
export function halalasToRiyals(halalas: number): number {
  return halalas / HALALAS_PER_RIYAL;
}

/**
 * VAT on a net amount, in halalas, rounded to the nearest halala.
 * docs/06 §2: vat = round(net × 0.15).
 */
export function vatOf(netHalalas: number): number {
  return Math.round(netHalalas * VAT_RATE);
}

/** Gross = net + VAT (docs/06 §2). */
export function grossOf(netHalalas: number): number {
  return netHalalas + vatOf(netHalalas);
}

/** Format halalas as an Arabic-friendly SAR string, e.g. "6,900.00 ر.س". */
export function formatSar(halalas: number): string {
  const riyals = halalasToRiyals(halalas);
  return `${riyals.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
}
