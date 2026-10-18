import { PermModule, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import { effectiveRole } from "@/lib/permissions/engine";
import { periodKeyOf } from "@/lib/finance/ledger";

/**
 * الحوكمة والإقفال (docs/05 finGov). Period locking already has real
 * server-side enforcement (assertPeriodOpen, checked by every posting
 * path) — this just adds the missing UI to toggle it, plus the existing
 * Office.requireApproval switch and a finance-scoped audit view.
 */

export type PeriodRow = { periodKey: string; locked: boolean };

/** Last 12 calendar months, each resolved against any existing AccountingPeriod row. */
export async function listRecentPeriods(session: AppSession): Promise<PeriodRow[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const now = new Date();
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    keys.push(periodKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  const rows = await prisma.accountingPeriod.findMany({
    where: { officeId: session.officeId, periodKey: { in: keys } },
  });
  const byKey = new Map(rows.map((r) => [r.periodKey, r]));
  return keys.map((k) => ({ periodKey: k, locked: byKey.get(k)?.locked ?? false }));
}

const toggleSchema = z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}$/), locked: z.boolean() });

export async function setPeriodLock(session: AppSession, raw: z.infer<typeof toggleSchema>): Promise<void> {
  await requireModule(session, PermModule.FINANCE, "delete");
  const input = toggleSchema.parse(raw);
  await prisma.accountingPeriod.upsert({
    where: { officeId_periodKey: { officeId: session.officeId, periodKey: input.periodKey } },
    create: { officeId: session.officeId, periodKey: input.periodKey, locked: input.locked, lockedById: input.locked ? session.userId : null, lockedAt: input.locked ? new Date() : null },
    update: { locked: input.locked, lockedById: input.locked ? session.userId : null, lockedAt: input.locked ? new Date() : null },
  });
  await logAudit({ session, action: input.locked ? "period.lock" : "period.unlock", resource: "finance", detail: input.periodKey });
}

export async function getRequireApproval(session: AppSession): Promise<boolean> {
  await requireModule(session, PermModule.FINANCE, "view");
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { requireApproval: true } });
  return office.requireApproval;
}

export async function setRequireApproval(session: AppSession, value: boolean): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  await prisma.office.update({ where: { id: session.officeId }, data: { requireApproval: value } });
  await logAudit({ session, action: "finance.requireApproval.set", resource: "finance", detail: String(value) });
}

export type FinanceAuditRow = { id: string; action: string; detail: string | null; actorName: string | null; createdAt: Date };

export async function listFinanceAudit(session: AppSession, take = 100): Promise<FinanceAuditRow[]> {
  await requireModule(session, PermModule.FINANCE, "view");
  const rows = await prisma.auditLog.findMany({
    where: { officeId: session.officeId, resource: "finance" },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, action: r.action, detail: r.detail, actorName: r.actor?.name ?? null, createdAt: r.createdAt }));
}
