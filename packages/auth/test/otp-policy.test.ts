import { describe, expect, it } from "vitest";
import { canResendOtp, checkOtpChallenge, OTP_POLICY, otpExpiry } from "../src/otp-policy.js";

const t0 = new Date("2026-10-18T10:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

describe("OTP policy", () => {
  it("enforces the 30-second resend cooldown", () => {
    expect(canResendOtp(null, t0)).toBe(true);
    expect(canResendOtp(t0, at(29))).toBe(false);
    expect(canResendOtp(t0, at(30))).toBe(true);
  });

  it("expires codes after 5 minutes", () => {
    const expiresAt = otpExpiry(t0);
    expect(checkOtpChallenge({ expiresAt, attempts: 0 }, at(300))).toBe("COMPARE");
    expect(checkOtpChallenge({ expiresAt, attempts: 0 }, at(301))).toBe("EXPIRED");
    expect(checkOtpChallenge(null, t0)).toBe("EXPIRED");
  });

  it("locks the challenge after 5 failed attempts", () => {
    const expiresAt = otpExpiry(t0);
    expect(checkOtpChallenge({ expiresAt, attempts: OTP_POLICY.maxAttempts - 1 }, t0)).toBe(
      "COMPARE",
    );
    expect(checkOtpChallenge({ expiresAt, attempts: OTP_POLICY.maxAttempts }, t0)).toBe(
      "TOO_MANY_ATTEMPTS",
    );
  });
});
