/**
 * OTP login policy (legacy lib/auth/otp.ts, shared by staff, client-portal
 * and employee-portal login). The API generates the code with a CSPRNG and
 * stores only an HMAC of it; these pure rules decide what happens.
 */
export const OTP_POLICY = {
  digits: 6,
  ttlSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 30,
} as const;

/** A new code may be sent only after the cooldown since the last one. */
export function canResendOtp(lastSentAt: Date | null, now: Date): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= OTP_POLICY.resendCooldownSeconds * 1000;
}

export type OtpCheck = "EXPIRED" | "TOO_MANY_ATTEMPTS" | "COMPARE";

/**
 * What to do with the latest unconsumed challenge before comparing codes:
 * missing or past expiry → EXPIRED; attempts used up → TOO_MANY_ATTEMPTS;
 * otherwise COMPARE (and count a failed attempt on mismatch).
 */
export function checkOtpChallenge(
  challenge: { expiresAt: Date; attempts: number } | null,
  now: Date,
): OtpCheck {
  if (!challenge || challenge.expiresAt.getTime() < now.getTime()) return "EXPIRED";
  if (challenge.attempts >= OTP_POLICY.maxAttempts) return "TOO_MANY_ATTEMPTS";
  return "COMPARE";
}

export function otpExpiry(now: Date): Date {
  return new Date(now.getTime() + OTP_POLICY.ttlSeconds * 1000);
}
