import { describe, expect, it } from "vitest";
import { generateTotpSecret, totpCode, totpUri, verifyTotpCode } from "../src/modules/auth/totp.js";

// RFC 6238 Appendix B: SHA-1 key "12345678901234567890", base32-encoded.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC test vectors (last 6 digits)", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
  });

  it("accepts ±1 step of clock drift and nothing beyond", () => {
    const at = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, at);
    expect(verifyTotpCode(RFC_SECRET, code, at + 30_000)).toBe(true);
    expect(verifyTotpCode(RFC_SECRET, code, at - 30_000)).toBe(true);
    expect(verifyTotpCode(RFC_SECRET, code, at + 90_000)).toBe(false);
  });

  it("rejects malformed codes", () => {
    expect(verifyTotpCode(RFC_SECRET, "12345")).toBe(false);
    expect(verifyTotpCode(RFC_SECRET, "abcdef")).toBe(false);
  });

  it("generates 160-bit base32 secrets and an otpauth URI", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(totpUri(secret, "0500000001")).toMatch(
      /^otpauth:\/\/totp\/Murafaa%3A0500000001\?secret=/,
    );
  });
});
