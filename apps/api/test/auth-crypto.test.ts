import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  formatSessionToken,
  hashOtpCode,
  parseSessionToken,
  randomOtpCode,
  sameDigest,
  sha256,
} from "../src/modules/auth/auth-crypto.js";
import { clearedSessionCookie, readCookie, sessionCookie } from "../src/modules/auth/cookies.js";

const KEY = Buffer.alloc(32, 7).toString("base64");
const OFFICE = "aaaaaaaa-0000-4000-8000-000000000001";
const SESSION = "bbbbbbbb-0000-4000-8000-000000000002";

describe("auth crypto", () => {
  it("generates 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(randomOtpCode()).toMatch(/^\d{6}$/);
  });

  it("binds OTP hashes to the phone and secret", () => {
    const h = hashOtpCode("s".repeat(32), "+966500000001", "123456");
    expect(sameDigest(h, hashOtpCode("s".repeat(32), "+966500000001", "123456"))).toBe(true);
    expect(sameDigest(h, hashOtpCode("s".repeat(32), "+966500000002", "123456"))).toBe(false);
    expect(sameDigest(h, hashOtpCode("t".repeat(32), "+966500000001", "123456"))).toBe(false);
  });

  it("encrypts TOTP secrets with authenticated encryption", () => {
    const enc = encryptSecret(KEY, "GEZDGNBVGY3TQOJQ");
    expect(enc).not.toContain("GEZDGNBVGY3TQOJQ");
    expect(decryptSecret(KEY, enc)).toBe("GEZDGNBVGY3TQOJQ");
    const tampered = Buffer.from(enc, "base64");
    tampered.writeUInt8(tampered.readUInt8(tampered.length - 1) ^ 1, tampered.length - 1);
    expect(() => decryptSecret(KEY, tampered.toString("base64"))).toThrow();
  });

  it("round-trips session tokens and rejects malformed ones", () => {
    const secret = "A".repeat(43);
    expect(parseSessionToken(formatSessionToken(OFFICE, SESSION, secret))).toEqual({
      officeId: OFFICE,
      sessionId: SESSION,
      secret,
    });
    expect(parseSessionToken("garbage")).toBeNull();
    expect(parseSessionToken(`${OFFICE}.${SESSION}.short`)).toBeNull();
    expect(sha256("x")).toHaveLength(64);
  });
});

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax and Secure only when asked", () => {
    const c = sessionCookie("tok", 60, true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    expect(sessionCookie("tok", 60, false)).not.toContain("Secure");
    expect(clearedSessionCookie(false)).toContain("Max-Age=0");
  });

  it("reads one cookie from a header", () => {
    expect(readCookie("a=1; murafaa_session=abc%2Edef; b=2", "murafaa_session")).toBe("abc.def");
    expect(readCookie(undefined, "murafaa_session")).toBeNull();
  });
});
