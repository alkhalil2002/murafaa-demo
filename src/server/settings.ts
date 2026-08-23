import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { logAudit } from "@/lib/audit";
import { effectiveRole } from "@/lib/permissions/engine";
import { t } from "@/lib/i18n";

/**
 * الإعدادات — recycle bin (docs/05) over the soft-delete convention every
 * table follows (CLAUDE.md: `deleted_at`). Covers the 4 entity types the
 * prototype names: قضايا، عملاء محتملون، مستندات، موظفون. Restore is
 * reversible (clears deletedAt); "إفراغ السلة" hard-deletes only rows
 * already soft-deleted, and is partner-only since it can't be undone.
 */

export type RecycleKind = "case" | "lead" | "document" | "employee" | "hearing";

export type RecycleItem = {
  kind: RecycleKind;
  id: string;
  label: string;
  deletedAt: Date;
};

export async function listRecycleBin(session: AppSession): Promise<RecycleItem[]> {
  const [cases, leads, documents, employees, hearings] = await Promise.all([
    prisma.case.findMany({
      where: { officeId: session.officeId, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.lead.findMany({
      where: { officeId: session.officeId, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
    }),
    prisma.document.findMany({
      where: { officeId: session.officeId, deletedAt: { not: null } },
      select: { id: true, fileName: true, deletedAt: true },
    }),
    prisma.employee.findMany({
      where: { officeId: session.officeId, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
    }),
    prisma.hearing.findMany({
      where: { officeId: session.officeId, deletedAt: { not: null } },
      select: { id: true, sequenceNo: true, hearingDate: true, deletedAt: true, case: { select: { title: true } } },
    }),
  ]);

  const items: RecycleItem[] = [
    ...cases.map((c) => ({ kind: "case" as const, id: c.id, label: c.title, deletedAt: c.deletedAt! })),
    ...leads.map((l) => ({ kind: "lead" as const, id: l.id, label: l.name, deletedAt: l.deletedAt! })),
    ...documents.map((d) => ({ kind: "document" as const, id: d.id, label: d.fileName, deletedAt: d.deletedAt! })),
    ...employees.map((e) => ({ kind: "employee" as const, id: e.id, label: e.name, deletedAt: e.deletedAt! })),
    ...hearings.map((h) => ({
      kind: "hearing" as const,
      id: h.id,
      label: `${t("cases.hearings.sessionNo", { no: (h.sequenceNo ?? 0).toLocaleString("ar-SA") })} — ${h.case.title}`,
      deletedAt: h.deletedAt!,
    })),
  ];
  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

const MODEL_BY_KIND = {
  case: prisma.case,
  lead: prisma.lead,
  document: prisma.document,
  employee: prisma.employee,
  hearing: prisma.hearing,
} as const;

export async function restoreRecycleItem(session: AppSession, kind: RecycleKind, id: string): Promise<void> {
  await (MODEL_BY_KIND[kind] as { updateMany: (args: unknown) => Promise<unknown> }).updateMany({
    where: { id, officeId: session.officeId },
    data: { deletedAt: null },
  });
  await logAudit({ session, action: "recycle.restore", resource: kind, targetId: id });
}

export async function purgeRecycleBin(session: AppSession): Promise<number> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const officeId = session.officeId;
  const [c, l, d, e, h] = await Promise.all([
    prisma.case.deleteMany({ where: { officeId, deletedAt: { not: null } } }),
    prisma.lead.deleteMany({ where: { officeId, deletedAt: { not: null } } }),
    prisma.document.deleteMany({ where: { officeId, deletedAt: { not: null } } }),
    prisma.employee.deleteMany({ where: { officeId, deletedAt: { not: null } } }),
    prisma.hearing.deleteMany({ where: { officeId, deletedAt: { not: null } } }),
  ]);
  const total = c.count + l.count + d.count + e.count + h.count;
  await logAudit({ session, action: "recycle.purge", resource: "settings", detail: `${total} rows` });
  return total;
}
