import type { OfficePolicy } from "./engine.js";
import type { CaseScope, PermLevel, PermModule, Role } from "./enums.js";
import { ALL_MODULES, ALL_ROLES, SEED_CASE_SCOPE, SEED_FIELD_DENY, seedLevel } from "./matrix.js";

/**
 * The default policy built from the seed matrix (docs/04). New offices start
 * from this; once editable permission rows exist in the database, the API
 * builds the OfficePolicy from those rows instead.
 */
export function seedPolicy(): OfficePolicy {
  const modules = Object.fromEntries(
    ALL_ROLES.map((role) => [
      role,
      Object.fromEntries(ALL_MODULES.map((m) => [m, seedLevel(role, m)])),
    ]),
  ) as OfficePolicy["modules"];

  const fieldDeny: OfficePolicy["fieldDeny"] = {};
  for (const f of SEED_FIELD_DENY) {
    (fieldDeny[`${f.role}:${f.resource}`] ??= new Set<string>()).add(f.field);
  }

  return { modules, fieldDeny, caseScope: { ...SEED_CASE_SCOPE } };
}

/**
 * Build an office's policy from its permission rows (legacy loadOfficePolicy).
 * Anything without a row is NONE / ASSIGNED, so missing data fails closed.
 */
export function policyFromRows(
  modules: ReadonlyArray<{ role: Role; module: PermModule; level: PermLevel }>,
  fieldDenies: ReadonlyArray<{ role: Role; resource: string; field: string }>,
  scopes: ReadonlyArray<{ role: Role; scope: CaseScope }>,
): OfficePolicy {
  const policy: OfficePolicy = {
    modules: Object.fromEntries(ALL_ROLES.map((r) => [r, {}])) as OfficePolicy["modules"],
    fieldDeny: {},
    caseScope: {},
  };
  for (const m of modules) policy.modules[m.role][m.module] = m.level;
  for (const f of fieldDenies)
    (policy.fieldDeny[`${f.role}:${f.resource}`] ??= new Set<string>()).add(f.field);
  for (const s of scopes) policy.caseScope[s.role] = s.scope;
  return policy;
}
