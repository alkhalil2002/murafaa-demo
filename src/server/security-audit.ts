import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { effectiveRole } from "@/lib/permissions/engine";

/**
 * Security-scoped audit view (docs/04 §6, الصلاحيات → سجل التدقيق) — a
 * NARROWER lens over the same AuditLog table as the site-wide activity feed
 * (src/server/activity.ts): logins, permission/role changes, and security
 * toggles only. Partner-only, mirroring the rest of this admin section.
 */

const SECURITY_ACTION_PREFIXES = ["auth.", "portal.login", "portal.otp", "security.", "permission.", "access."];

export type SecurityAuditRow = {
  id: string;
  action: string;
  detail: string | null;
  actorName: string | null;
  createdAt: Date;
};

export async function listSecurityAudit(session: AppSession, take = 100): Promise<SecurityAuditRow[]> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");

  const rows = await prisma.auditLog.findMany({
    where: { officeId: session.officeId },
    orderBy: { createdAt: "desc" },
    take: take * 3,
    include: { actor: { select: { name: true } } },
  });

  return rows
    .filter((r) => SECURITY_ACTION_PREFIXES.some((p) => r.action.startsWith(p)))
    .slice(0, take)
    .map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      actorName: r.actor?.name ?? null,
      createdAt: r.createdAt,
    }));
}
