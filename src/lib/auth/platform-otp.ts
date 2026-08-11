import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizeSaudiPhone } from "./phone";
import { getOtpProvider, type OtpChannel } from "./otp-provider";

/**
 * Platform-admin OTP. Mirrors src/lib/auth/otp.ts, resolving against
 * PlatformAdmin instead of User, and writing challenges with a NULL officeId
 * because a platform admin belongs to no tenant.
 *
 * The code hash is salted with "platform:" so a challenge issued for one
 * principal type can never be redeemed as another, even for the same phone.
 */

const TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const RESEND_COOLDOWN_SECONDS = 30;

export type PlatformOtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; code: "PHONE_INVALID" | "ADMIN_NOT_FOUND" | "RATE_LIMITED" };

export type PlatformOtpVerifyResult =
  | { ok: true; admin: { id: string; name: string; phone: string } }
  | { ok: false; code: "PHONE_INVALID" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS" };

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`platform:${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function resolveAdmin(phone: string) {
  const admins = await prisma.platformAdmin.findMany({
    where: { phone, isActive: true, deletedAt: null },
    take: 2,
    select: { id: true, name: true, phone: true },
  });
  return admins.length === 1 ? admins[0]! : null;
}

export async function sendPlatformOtp(
  rawPhone: string,
  channel: OtpChannel = "whatsapp",
): Promise<PlatformOtpSendResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const admin = await resolveAdmin(phone);
  if (!admin) return { ok: false, code: "ADMIN_NOT_FOUND" };

  const recent = await prisma.otpChallenge.findFirst({
    where: { officeId: null, phone },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const code = generateCode();
  await prisma.otpChallenge.create({
    data: {
      officeId: null,
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
    },
  });

  const provider = getOtpProvider();
  await provider.send(phone, code, channel);
  return provider.name === "console" ? { ok: true, devCode: code } : { ok: true };
}

export async function verifyPlatformOtp(
  rawPhone: string,
  code: string,
): Promise<PlatformOtpVerifyResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const challenge = await prisma.otpChallenge.findFirst({
    where: { officeId: null, phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, code: "EXPIRED" };
  if (challenge.expiresAt.getTime() < Date.now()) return { ok: false, code: "EXPIRED" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, code: "TOO_MANY_ATTEMPTS" };

  const expected = hashCode(phone, code);
  const a = Buffer.from(challenge.codeHash);
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, code: "INVALID" };
  }

  const admin = await resolveAdmin(phone);
  if (!admin) return { ok: false, code: "INVALID" };

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return { ok: true, admin };
}
