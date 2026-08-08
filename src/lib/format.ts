/** Mask a bank IBAN for display, keeping only the last 4 characters (PDPL PII minimization). */
export function maskIban(iban: string): string {
  const trimmed = iban.trim();
  if (trimmed.length <= 4) return trimmed;
  const prefix = trimmed.slice(0, 2); // country code, e.g. "SA"
  const last4 = trimmed.slice(-4);
  return `${prefix}••••${last4}`;
}
