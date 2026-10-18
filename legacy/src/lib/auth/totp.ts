import crypto from "node:crypto";

/**
 * TOTP two-factor authentication (RFC 6238 / RFC 4226), hand-rolled with only
 * node:crypto — no new dependency for a single HMAC-based counter code. 30s
 * step, 6 digits, SHA-1 (the universal default every authenticator app —
 * Google Authenticator, Authy, 1Password — expects when no algorithm is
 * specified in the otpauth:// URI).
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const rem = bits.length % 5;
  if (rem > 0) {
    const last = bits.slice(bits.length - rem).padEnd(5, "0");
    out += BASE32_ALPHABET[parseInt(last, 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** A fresh random 160-bit secret, base32-encoded for manual entry / otpauth URIs. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secretBuf: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** The current 6-digit code for a base32 secret (for tests/manual checks). */
export function totpCode(base32Secret: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

/** Verify a user-entered code, tolerating ±1 step (30s) of clock drift. */
export function verifyTotpCode(base32Secret: string, code: string, at: number = Date.now()): boolean {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const secretBuf = base32Decode(base32Secret);
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    const expected = hotp(secretBuf, counter + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
}

/** otpauth:// URI for manual entry / QR-code generation in an authenticator app. */
export function totpUri(secret: string, accountLabel: string, issuer = "Murafaa"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
