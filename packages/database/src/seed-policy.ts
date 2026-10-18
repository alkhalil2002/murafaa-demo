import { ALL_MODULES, ALL_ROLES, SEED_CASE_SCOPE, SEED_FIELD_DENY, seedLevel } from "@murafaa/auth";
import type { Tx } from "./client.js";
import { fieldPermissions, permissions, roleCaseScopes } from "./schema/permissions.js";

/**
 * Give an office the docs/04 default policy. Idempotent: existing rows (an
 * office's own edits) are kept. Call inside withTenant(officeId).
 */
export async function seedOfficePolicy(tx: Tx, officeId: string): Promise<void> {
  await tx
    .insert(permissions)
    .values(
      ALL_ROLES.flatMap((role) =>
        ALL_MODULES.map((module) => ({ officeId, role, module, level: seedLevel(role, module) })),
      ),
    )
    .onConflictDoNothing();
  await tx
    .insert(fieldPermissions)
    .values(SEED_FIELD_DENY.map((f) => ({ officeId, ...f })))
    .onConflictDoNothing();
  await tx
    .insert(roleCaseScopes)
    .values(ALL_ROLES.map((role) => ({ officeId, role, scope: SEED_CASE_SCOPE[role] })))
    .onConflictDoNothing();
}
