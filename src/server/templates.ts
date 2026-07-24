import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import type { TemplateField } from "@/lib/documents/template-defs";

/**
 * Document templates service (docs/05). Resolution unions the office's own
 * templates with the global system templates (officeId null, isSystem). Gated
 * by the المستندات module.
 */

const resolveWhere = (officeId: string) => ({
  isActive: true,
  deletedAt: null,
  OR: [{ officeId }, { officeId: null, isSystem: true }],
});

export async function listTemplates(session: AppSession) {
  await requireModule(session, PermModule.DOCUMENTS, "view");
  return prisma.documentTemplate.findMany({
    where: resolveWhere(session.officeId),
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { id: true, key: true, title: true, category: true },
  });
}

/** Resolve a template by key, preferring an office override over the global one. */
export async function getTemplateByKey(session: AppSession, key: string) {
  await requireModule(session, PermModule.DOCUMENTS, "view");
  const own = await prisma.documentTemplate.findFirst({
    where: { key, officeId: session.officeId, isActive: true, deletedAt: null },
  });
  if (own) return own;
  return prisma.documentTemplate.findFirst({
    where: { key, officeId: null, isSystem: true, isActive: true, deletedAt: null },
  });
}

/** Parse the stored JSON field descriptors into typed template fields. */
export function templateFields(fields: unknown): TemplateField[] {
  return Array.isArray(fields) ? (fields as TemplateField[]) : [];
}
