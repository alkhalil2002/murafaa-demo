/**
 * PII minimization helpers (PDPL). Use these whenever personal identifiers are
 * shown, logged or sent to an AI prompt.
 */

/** Mask a bank IBAN for display, keeping only the country code and last 4 characters. */
export function maskIban(iban: string): string {
  const trimmed = iban.trim();
  if (trimmed.length <= 4) return trimmed;
  const prefix = trimmed.slice(0, 2); // country code, e.g. "SA"
  const last4 = trimmed.slice(-4);
  return `${prefix}••••${last4}`;
}
