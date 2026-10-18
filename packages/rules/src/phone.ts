/**
 * Saudi phone normalization to E.164 (+9665XXXXXXXX). Pure and unit-tested.
 * Accepts: "05XXXXXXXX", "5XXXXXXXX", "9665XXXXXXXX", "+9665XXXXXXXX",
 * with spaces or dashes. Returns null when the input is not a valid Saudi
 * mobile number.
 */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local: string;

  if (digits.startsWith("+966")) {
    local = digits.slice(4);
  } else if (digits.startsWith("966")) {
    local = digits.slice(3);
  } else if (digits.startsWith("0")) {
    local = digits.slice(1);
  } else {
    local = digits;
  }

  // Saudi mobile numbers are 9 digits starting with 5.
  if (!/^5\d{8}$/.test(local)) return null;
  return `+966${local}`;
}
