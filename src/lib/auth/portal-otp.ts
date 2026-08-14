import crypto from "node:crypto";
import { ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import { normalizeSaudiPhone } from "./phone";
import { getOtpProvider, type OtpChannel } from "./otp-provider";
import { deliverOtp } from "./otp-deliver";

/**
 * Client-portal OTP send/verify — mirrors src/lib/auth/otp.ts exactly, but
 * resolves against the Client model (بوابة العميل) instead of User (staff).
 * Reuses the same OtpChallenge table (officeId + phone, no FK to a specific
 * principal type), so both flows share one rate-limit/attempt-tracking store.
 */

const TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const RESEND_COOLDOWN_SECONDS = 30;

export type PortalOtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; code: "PHONE_INVALID" | "CLIENT_NOT_FOUND" | "RATE_LIMITED" | "DELIVERY_FAILED" };

export type PortalOtpVerifyResult =
  | { ok: true; client: { id: string; officeId: string; name: string; phone: string } }
  | { ok: false; code: "PHONE_INVALID" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS" };

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`portal:${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Single active client for a phone (mirrors otp.ts's resolveUser). */
async function resolveClient(phone: string) {
  const clients = await prisma.client.findMany({
    where: { phone, status: ClientStatus.ACTIVE, deletedAt: null },
    take: 2,
  });
  return clients.length === 1 ? clients[0] : null;
}

export async function sendClientOtp(rawPhone: string, channel: OtpChannel = "whatsapp"): Promise<PortalOtpSendResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const client = await resolveClient(phone);
  if (!client) return { ok: false, code: "CLIENT_NOT_FOUND" };

  const recent = await prisma.otpChallenge.findFirst({
    where: { officeId: client.officeId, phone },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const ageMs = Date.now() - recent.createdAt.getTime();
    if (ageMs < RESEND_COOLDOWN_SECONDS * 1000) return { ok: false, code: "RATE_LIMITED" };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  const challenge = await prisma.otpChallenge.create({
    data: { officeId: client.officeId, phone, codeHash: hashCode(phone, code), expiresAt },
  });

  const provider = getOtpProvider();
  const delivered = await deliverOtp(provider, phone, code, channel, challenge.id);
  if (!delivered) return { ok: false, code: "DELIVERY_FAILED" };
  await logSystemAudit(client.officeId, "portal.otp.sent", `portal otp sent to ${phone}`);
  return provider.name === "console" ? { ok: true, devCode: code } : { ok: true };
}

export async function verifyClientOtp(rawPhone: string, code: string): Promise<PortalOtpVerifyResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) return { ok: false, code: "EXPIRED" };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, code: "TOO_MANY_ATTEMPTS" };

  const matches = crypto.timingSafeEqual(
    Buffer.from(challenge.codeHash),
    Buffer.from(hashCode(phone, code)),
  );
  if (!matches) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, code: "INVALID" };
  }

  const client = await resolveClient(phone);
  if (!client) return { ok: false, code: "EXPIRED" };

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  await logSystemAudit(client.officeId, "portal.login", `portal login via otp: ${phone}`);

  return { ok: true, client: { id: client.id, officeId: client.officeId, name: client.name, phone: client.phone ?? phone } };
}
