import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { generateTotpSecret, totpUri, verifyTotpCode } from "@/lib/auth/totp";
import { effectiveRole } from "@/lib/permissions/engine";

/**
 * Personal account security (٢FA enrollment). Every staff user manages their
 * own — this is deliberately NOT an admin action over other users' accounts,
 * so it only ever reads/writes `session.userId`'s own row.
 */

export async function getSecurityStatus(session: AppSession) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { totpEnabled: true, phone: true },
  });
  return user;
}

/** Generate a new (not-yet-persisted) secret for the user to scan/enter, then confirm with one code. */
export async function beginTotpEnroll(session: AppSession) {
  const secret = generateTotpSecret();
  return { secret, uri: totpUri(secret, session.phone) };
}

const confirmSchema = z.object({ secret: z.string().min(1), code: z.string().min(1) });

export async function confirmTotpEnroll(session: AppSession, raw: z.infer<typeof confirmSchema>) {
  const input = confirmSchema.parse(raw);
  if (!verifyTotpCode(input.secret, input.code)) throw new Error("TOTP_CODE_INVALID");
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: input.secret, totpEnabled: true },
  });
  await logAudit({ session, action: "security.totp.enable", resource: "users", targetId: session.userId });
}

export async function disableTotp(session: AppSession) {
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: null, totpEnabled: false },
  });
  await logAudit({ session, action: "security.totp.disable", resource: "users", targetId: session.userId });
}

/** Office-wide IP allowlist — partner-only (Role check, not module-level:
 * this gates the login surface itself, above the module permission matrix). */
export async function getOfficeIpAllowlist(session: AppSession) {
  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { ipAllowlist: true },
  });
  return office.ipAllowlist;
}

export async function setOfficeIpAllowlist(session: AppSession, entries: string[]) {
  if (effectiveRole(session) !== "PARTNER") throw new Error("PARTNER_ONLY");
  const cleaned = entries.map((e) => e.trim()).filter(Boolean);
  await prisma.office.update({ where: { id: session.officeId }, data: { ipAllowlist: cleaned } });
  await logAudit({ session, action: "security.ipAllowlist.update", resource: "offices", targetId: session.officeId, detail: `${cleaned.length} entries` });
}
