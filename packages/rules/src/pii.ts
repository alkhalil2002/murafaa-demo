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

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const western = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/**
 * Remove direct identifiers from free text before it leaves for an AI model
 * (docs/02 §9, guardrail 3): IBANs, Saudi mobile numbers, national/iqama
 * IDs (10 digits starting 1 or 2) and e-mail addresses become placeholders.
 * Arabic-Indic digits are matched too. Names are not detectable reliably,
 * so prompts must not include party names in the first place.
 */
export function redactPii(text: string): string {
  return western(text)
    .replace(/\bSA\d{2}[\dA-Z ]{18,30}\b/gi, "[IBAN]")
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[EMAIL]")
    .replace(/(?:\+|00)?966[\s-]?5\d(?:[\s-]?\d){7}\b|\b05\d(?:[\s-]?\d){7}\b/g, "[PHONE]")
    .replace(/\b[12]\d{9}\b/g, "[ID]");
}
