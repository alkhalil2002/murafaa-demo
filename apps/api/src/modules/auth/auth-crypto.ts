import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { OTP_POLICY } from "@murafaa/auth";

/** A cryptographically random numeric login code, zero-padded. */
export function randomOtpCode(): string {
  return randomInt(0, 10 ** OTP_POLICY.digits)
    .toString()
    .padStart(OTP_POLICY.digits, "0");
}

/** HMAC of a login code bound to its phone, so a stored hash is useless for another number. */
export function hashOtpCode(secret: string, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AES-256-GCM, encoded as base64(iv | tag | ciphertext). */
export function encryptSecret(keyB64: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(keyB64: string, encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyB64, "base64"),
    raw.subarray(0, 12),
  );
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TOKEN_RE = new RegExp(`^(${UUID})\\.(${UUID})\\.([A-Za-z0-9_-]{43})$`, "i");

/**
 * Session tokens are `<officeId>.<sessionId>.<secret>`. The office id lets the
 * API look the session up inside that office's RLS scope; only a SHA-256 of
 * the secret is stored.
 */
export function newSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function formatSessionToken(officeId: string, sessionId: string, secret: string): string {
  return `${officeId}.${sessionId}.${secret}`;
}

export function parseSessionToken(
  token: string,
): { officeId: string; sessionId: string; secret: string } | null {
  const m = TOKEN_RE.exec(token);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { officeId: m[1].toLowerCase(), sessionId: m[2].toLowerCase(), secret: m[3] };
}
