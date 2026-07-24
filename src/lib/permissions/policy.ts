import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { OfficePolicy } from "./engine";

/**
 * Loads an office's editable permission rows from the DB into an OfficePolicy.
 * Cached per office for the lifetime of the request/module to avoid re-querying
 * on every guard call. `invalidateOfficePolicy` clears it after edits.
 */
const cache = new Map<string, OfficePolicy>();

export async function loadOfficePolicy(officeId: string): Promise<OfficePolicy> {
  const cached = cache.get(officeId);
  if (cached) return cached;

  const [permissions, fieldDenies, scopes] = await Promise.all([
    prisma.permission.findMany({ where: { officeId } }),
    prisma.fieldPermission.findMany({ where: { officeId } }),
    prisma.roleCaseScope.findMany({ where: { officeId } }),
  ]);

  const modules: OfficePolicy["modules"] = {
    PARTNER: {},
    LAWYER: {},
    ASSISTANT: {},
    ACCOUNTANT: {},
    ADMIN: {},
    RECEPTION: {},
  };
  for (const p of permissions) {
    modules[p.role][p.module] = p.level;
  }

  const fieldDeny: OfficePolicy["fieldDeny"] = {};
  for (const f of fieldDenies) {
    const key = `${f.role}:${f.resource}`;
    (fieldDeny[key] ??= new Set<string>()).add(f.field);
  }

  const caseScope: OfficePolicy["caseScope"] = {};
  for (const s of scopes) {
    caseScope[s.role as Role] = s.scope;
  }

  const policy: OfficePolicy = { modules, fieldDeny, caseScope };
  cache.set(officeId, policy);
  return policy;
}

export function invalidateOfficePolicy(officeId: string): void {
  cache.delete(officeId);
}
