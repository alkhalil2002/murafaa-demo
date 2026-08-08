import { CaseScope, PermLevel, PermModule, Role } from "@prisma/client";
import { LEVEL_ORDER } from "./matrix";

/**
 * PURE permission-decision layer. No DB, no I/O — takes a loaded OfficePolicy
 * and answers yes/no. This is what the unit tests exercise directly, and what
 * the server guard calls after loading policy.
 */

/** An action requires a minimum level. */
export type PermAction = "view" | "edit" | "delete";

const REQUIRED_LEVEL: Record<PermAction, PermLevel> = {
  view: PermLevel.VIEW,
  edit: PermLevel.EDIT,
  delete: PermLevel.FULL,
};

/**
 * The full, resolved permission state for one office — loaded once per request
 * from the DB rows and passed into these functions.
 */
export type OfficePolicy = {
  /** role → module → level (every role×module resolved, no gaps). */
  modules: Record<Role, Partial<Record<PermModule, PermLevel>>>;
  /** Denied fields, keyed as `${role}:${resource}` → Set of field names. */
  fieldDeny: Record<string, Set<string>>;
  /** role → case row scope. */
  caseScope: Partial<Record<Role, CaseScope>>;
};

function levelFor(policy: OfficePolicy, role: Role, module: PermModule): PermLevel {
  return policy.modules[role]?.[module] ?? PermLevel.NONE;
}

/**
 * Layer 1 — module access. True if `role` may perform `action` on `module`.
 * There is NO god mode: an unknown/absent grant is NONE, not full access.
 */
export function canModule(
  policy: OfficePolicy,
  role: Role,
  module: PermModule,
  action: PermAction,
): boolean {
  const have = LEVEL_ORDER[levelFor(policy, role, module)];
  const need = LEVEL_ORDER[REQUIRED_LEVEL[action]];
  return have >= need;
}

/**
 * Layer 2 — field denial. True if `role` may see `field` on `resource`.
 * A denied field returns false even when the module itself is accessible.
 */
export function canField(
  policy: OfficePolicy,
  role: Role,
  resource: string,
  field: string,
): boolean {
  return !policy.fieldDeny[`${role}:${resource}`]?.has(field);
}

/** The row scope for a role's case visibility. Defaults to ASSIGNED (least). */
export function caseScopeOf(policy: OfficePolicy, role: Role): CaseScope {
  return policy.caseScope[role] ?? CaseScope.ASSIGNED;
}

/**
 * Layer 3 — row scope. True if a user may see a specific case.
 * ALL → any case in the office; ASSIGNED → only cases they're assigned to.
 */
export function canViewCase(
  policy: OfficePolicy,
  role: Role,
  userId: string,
  caseAssigneeIds: readonly string[],
): boolean {
  if (caseScopeOf(policy, role) === CaseScope.ALL) return true;
  return caseAssigneeIds.includes(userId);
}

/**
 * الصلاحيات guard: demoting a user away from PARTNER must never strand the
 * office with zero partners (no one left able to manage this very screen).
 * True means the demotion should be BLOCKED.
 */
export function wouldStrandLastPartner(
  currentRole: Role,
  nextRole: Role,
  partnerCountInOffice: number,
): boolean {
  if (currentRole !== Role.PARTNER || nextRole === Role.PARTNER) return false;
  return partnerCountInOffice <= 1;
}
