import crypto from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import { normalizeSaudiPhone } from "./phone";
import { getOtpProvider, type OtpChannel } from "./otp-provider";

/**
 * OTP send/verify (docs/02 §8). Codes are stored HMAC-hashed (never plaintext),
 * time-boxed, attempt-limited, and rate-limited per phone. Verification returns
 * the resolved user so the auth layer can mint a session.
 */

const TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const RESEND_COOLDOWN_SECONDS = 30;

export type OtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; code: "PHONE_INVALID" | "USER_NOT_FOUND" | "RATE_LIMITED" };

export type OtpVerifyResult =
  | {
      ok: true;
      user: { id: string; officeId: string; name: string; phone: string; role: Role };
    }
  | { ok: false; code: "PHONE_INVALID" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS" };

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  // 6-digit, cryptographically random, zero-padded.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Look up the single active user for a phone. Multi-tenant-safe: if the same
 * phone somehow maps to more than one active user, treat as not-resolvable
 * (office selection is a later enhancement).
 */
async function resolveUser(phone: string) {
  const users = await prisma.user.findMany({
    where: { phone, isActive: true, deletedAt: null },
    take: 2,
  });
  return users.length === 1 ? users[0] : null;
}

export async function sendOtp(
  rawPhone: string,
  channel: OtpChannel = "whatsapp",
): Promise<OtpSendResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const user = await resolveUser(phone);
  // Do not reveal whether the number exists via timing/branching differences;
  // we still return a distinct code so the UI can show a helpful message, but
  // no OTP is created or sent when there is no user.
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  // Rate limit: reject a resend within the cooldown window.
  const recent = await prisma.otpChallenge.findFirst({
    where: { officeId: user.officeId, phone },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const ageMs = Date.now() - recent.createdAt.getTime();
    if (ageMs < RESEND_COOLDOWN_SECONDS * 1000) {
      return { ok: false, code: "RATE_LIMITED" };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await prisma.otpChallenge.create({
    data: {
      officeId: user.officeId,
      phone,
      codeHash: hashCode(phone, code),
      expiresAt,
    },
  });

  const provider = getOtpProvider();
  await provider.send(phone, code, channel);
  await logSystemAudit(user.officeId, "auth.otp.sent", `otp sent to ${phone}`);
  // Dev convenience only: the console provider doesn't actually deliver
  // anywhere, so surface the code in the response instead of requiring a
  // server-log lookup. Never happens with a real provider (unifonic etc).
  return provider.name === "console" ? { ok: true, devCode: code } : { ok: true };
}

export async function verifyOtp(
  rawPhone: string,
  code: string,
): Promise<OtpVerifyResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: "EXPIRED" };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(challenge.codeHash),
    Buffer.from(hashCode(phone, code)),
  );
  if (!matches) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, code: "INVALID" };
  }

  const user = await resolveUser(phone);
  if (!user) return { ok: false, code: "EXPIRED" };

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  await logSystemAudit(user.officeId, "auth.login", `login via otp: ${phone}`);

  return {
    ok: true,
    user: {
      id: user.id,
      officeId: user.officeId,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
}
