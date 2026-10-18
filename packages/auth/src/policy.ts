import type { OfficePolicy } from "./engine.js";
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
