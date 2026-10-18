/**
 * ZATCA e-invoicing, phase 1 (generation): the QR code on every tax invoice
 * carries five TLV fields, base64-encoded (ZATCA "E-Invoicing Detailed
 * Guidelines", QR code): 1 seller name, 2 seller VAT number, 3 timestamp,
 * 4 invoice total with VAT, 5 VAT total. Phase 2 (signed XML, clearance)
 * comes with the Fatoora integration.
 */

/** A Saudi VAT registration number: 15 digits, first and last digit 3. */
export function isValidVatNumber(v: string): boolean {
  return /^3\d{13}3$/.test(v);
}

/** A commercial registration (السجل التجاري) number: 10 digits. */
export function isValidCrNumber(v: string): boolean {
  return /^\d{10}$/.test(v);
}

/** Halalas as the decimal amount ZATCA expects ("1150.00"). */
export function zatcaAmount(halalas: number): string {
  if (!Number.isInteger(halalas)) throw new Error("amount must be whole halalas");
  const sign = halalas < 0 ? "-" : "";
  const abs = Math.abs(halalas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** The invoice time as ISO 8601 UTC without milliseconds ("2022-04-25T15:30:00Z"). */
export function zatcaTimestamp(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export type ZatcaQrFields = {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  /** Invoice total including VAT, halalas. */
  total: number;
  /** VAT total, halalas. */
  vat: number;
};

/** The phase-1 QR payload: TLV (tag, byte length, UTF-8 value) for tags 1–5, base64. */
export function zatcaQrPayload(f: ZatcaQrFields): string {
  if (!isValidVatNumber(f.vatNumber)) throw new Error("invalid VAT number");
  const values = [
    f.sellerName.trim(),
    f.vatNumber,
    zatcaTimestamp(f.timestamp),
    zatcaAmount(f.total),
    zatcaAmount(f.vat),
  ];
  const enc = new TextEncoder();
  const bytes: number[] = [];
  values.forEach((value, i) => {
    const v = enc.encode(value);
    // One length byte per field: a longer seller name cannot be encoded.
    if (v.length > 255) throw new Error(`QR field ${i + 1} is longer than 255 bytes`);
    bytes.push(i + 1, v.length, ...v);
  });
  return btoa(String.fromCharCode(...bytes));
}

/** Decode a phase-1 payload back to its fields (for tests and checks). */
export function decodeZatcaQr(payload: string): string[] {
  const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const dec = new TextDecoder();
  const out: string[] = [];
  for (let i = 0; i < raw.length;) {
    const len = raw[i + 1]!;
    out[raw[i]! - 1] = dec.decode(raw.slice(i + 2, i + 2 + len));
    i += 2 + len;
  }
  return out;
}

// ── Government integrations (docs/02 §7) ──

/** Every platform the product will connect to, with the area it serves. Labels: integration.* */
export const INTEGRATIONS = [
  { key: "NAJIZ", group: "LEGAL" },
  { key: "NAFATH", group: "LEGAL" },
  { key: "ZATCA", group: "FINANCE" },
  { key: "MUDAD", group: "HR" },
  { key: "GOSI", group: "HR" },
  { key: "QIWA", group: "HR" },
  { key: "ABSHER", group: "HR" },
  { key: "MUQEEM", group: "HR" },
] as const;
export type IntegrationKey = (typeof INTEGRATIONS)[number]["key"];

/**
 * An integration is connected only with a signed API contract and working
 * credentials. Until then it is NOT_CONNECTED and nothing pretends otherwise
 * (owner decision). ZATCA phase 1 needs no connection, only the office's VAT
 * number, so it is reported apart from the phase-2 link.
 */
export const INTEGRATION_STATUSES = ["NOT_CONNECTED", "CONNECTED"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
