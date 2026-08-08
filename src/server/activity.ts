import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * Site-wide activity feed (سجل النشاط), distinct from the security-scoped
 * audit view under الصلاحيات (docs/04 §6 — same AUDIT table, different lens:
 * this one is a general cross-module feed, that one filters to
 * security-sensitive actions only).
 */

export type ActivityCategory = "case" | "approval" | "client" | "finance" | "whatsapp" | "hr" | "other";

export type ActivityRow = {
  id: string;
  action: string;
  resource: string | null;
  targetId: string | null;
  detail: string | null;
  category: ActivityCategory;
  actorId: string | null;
  actorName: string | null;
  createdAt: Date;
};

function categorize(action: string, resource: string | null): ActivityCategory {
  if (action.startsWith("approval.")) return "approval";
  switch (resource) {
    case "cases":
      return "case";
    case "clients":
      return "client";
    case "finance":
      return "finance";
    case "whatsapp":
      return "whatsapp";
    case "hr":
      return "hr";
    default:
      return "other";
  }
}

export type ActivityFilter = {
  category?: ActivityCategory;
  actorId?: string;
};

export async function listActivity(
  session: AppSession,
  filter: ActivityFilter = {},
  take = 100,
): Promise<ActivityRow[]> {
  await requireModule(session, PermModule.REPORTS, "view");

  const rows = await prisma.auditLog.findMany({
    where: { officeId: session.officeId, ...(filter.actorId ? { actorId: filter.actorId } : {}) },
    orderBy: { createdAt: "desc" },
    take: filter.category ? take * 4 : take,
    include: { actor: { select: { id: true, name: true } } },
  });

  const mapped = rows.map((r) => ({
    id: r.id,
    action: r.action,
    resource: r.resource,
    targetId: r.targetId,
    detail: r.detail,
    category: categorize(r.action, r.resource),
    actorId: r.actorId,
    actorName: r.actor?.name ?? null,
    createdAt: r.createdAt,
  }));

  const filtered = filter.category ? mapped.filter((r) => r.category === filter.category) : mapped;
  return filtered.slice(0, take);
}

export async function listActivityActors(session: AppSession) {
  await requireModule(session, PermModule.REPORTS, "view");
  return prisma.user.findMany({
    where: { officeId: session.officeId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function countActivityByCategory(session: AppSession): Promise<Record<ActivityCategory, number>> {
  await requireModule(session, PermModule.REPORTS, "view");
  const rows = await prisma.auditLog.findMany({
    where: { officeId: session.officeId },
    select: { action: true, resource: true },
    take: 2000,
    orderBy: { createdAt: "desc" },
  });
  const counts: Record<ActivityCategory, number> = {
    case: 0,
    approval: 0,
    client: 0,
    finance: 0,
    whatsapp: 0,
    hr: 0,
    other: 0,
  };
  for (const r of rows) counts[categorize(r.action, r.resource)]++;
  return counts;
}
