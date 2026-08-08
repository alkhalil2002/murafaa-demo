import crypto from "node:crypto";
import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import { normalizeSaudiPhone } from "./phone";
import { getOtpProvider, type OtpChannel } from "./otp-provider";

/**
 * Employee-portal OTP send/verify — mirrors portal-otp.ts (client portal)
 * exactly, resolved against the Employee model instead of Client. Shares the
 * same OtpChallenge table (officeId + phone, no FK to a specific principal
 * type) as both the staff and client-portal OTP flows.
 */

const TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS ?? 300);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
const RESEND_COOLDOWN_SECONDS = 30;

export type EmpPortalOtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; code: "PHONE_INVALID" | "EMPLOYEE_NOT_FOUND" | "RATE_LIMITED" };

export type EmpPortalOtpVerifyResult =
  | { ok: true; employee: { id: string; officeId: string; name: string; phone: string } }
  | { ok: false; code: "PHONE_INVALID" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS" };

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`emp-portal:${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Single active employee for a phone (mirrors otp.ts's resolveUser). */
async function resolveEmployee(phone: string) {
  const employees = await prisma.employee.findMany({
    where: { phone, status: EmployeeStatus.ACTIVE, deletedAt: null },
    take: 2,
  });
  return employees.length === 1 ? employees[0] : null;
}

export async function sendEmpPortalOtp(rawPhone: string, channel: OtpChannel = "whatsapp"): Promise<EmpPortalOtpSendResult> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  const employee = await resolveEmployee(phone);
  if (!employee) return { ok: false, code: "EMPLOYEE_NOT_FOUND" };

  const recent = await prisma.otpChallenge.findFirst({
    where: { officeId: employee.officeId, phone },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const ageMs = Date.now() - recent.createdAt.getTime();
    if (ageMs < RESEND_COOLDOWN_SECONDS * 1000) return { ok: false, code: "RATE_LIMITED" };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  await prisma.otpChallenge.create({
    data: { officeId: employee.officeId, phone, codeHash: hashCode(phone, code), expiresAt },
  });

  const provider = getOtpProvider();
  await provider.send(phone, code, channel);
  await logSystemAudit(employee.officeId, "empPortal.otp.sent", `emp portal otp sent to ${phone}`);
  return provider.name === "console" ? { ok: true, devCode: code } : { ok: true };
}

export async function verifyEmpPortalOtp(rawPhone: string, code: string): Promise<EmpPortalOtpVerifyResult> {
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

  const employee = await resolveEmployee(phone);
  if (!employee) return { ok: false, code: "EXPIRED" };

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
  await logSystemAudit(employee.officeId, "empPortal.login", `emp portal login via otp: ${phone}`);

  return { ok: true, employee: { id: employee.id, officeId: employee.officeId, name: employee.name, phone: employee.phone ?? phone } };
}
