import { CaseScope, PermLevel, PermModule, Role } from "@prisma/client";

/**
 * Default permission matrix (docs/04), lifted verbatim from the prototype's
 * PSEED / FIELD_DENY / CASE_SCOPE. This is the *seed* — once an office exists,
 * the editable rows in the DB are authoritative. Keep this pure and data-only.
 */

/** Level ordering for comparisons: NONE < VIEW < EDIT < FULL. */
export const LEVEL_ORDER: Record<PermLevel, number> = {
  [PermLevel.NONE]: 0,
  [PermLevel.VIEW]: 1,
  [PermLevel.EDIT]: 2,
  [PermLevel.FULL]: 3,
};

export const ALL_ROLES: Role[] = [
  Role.PARTNER,
  Role.LAWYER,
  Role.ASSISTANT,
  Role.ACCOUNTANT,
  Role.ADMIN,
  Role.RECEPTION,
];

export const ALL_MODULES: PermModule[] = [
  PermModule.CASES,
  PermModule.AI,
  PermModule.CLIENTS,
  PermModule.DOCUMENTS,
  PermModule.FINANCE,
  PermModule.HR,
  PermModule.REPORTS,
  PermModule.PERMISSIONS,
  PermModule.WHATSAPP,
  PermModule.APPOINTMENTS,
  PermModule.TASKS,
  PermModule.ALERTS,
  PermModule.PULSE,
];

type ModuleLevels = Partial<Record<PermModule, PermLevel>>;

/**
 * Explicit non-NONE grants per role. Anything omitted defaults to NONE —
 * PARTNER is the only role with a blanket FULL default (docs/04, PSEED `def`).
 */
const SEED_GRANTS: Record<Role, ModuleLevels> = {
  [Role.PARTNER]: {}, // handled by defaultLevelFor()

  [Role.LAWYER]: {
    [PermModule.CASES]: PermLevel.EDIT,
    [PermModule.AI]: PermLevel.EDIT,
    [PermModule.CLIENTS]: PermLevel.EDIT,
    [PermModule.DOCUMENTS]: PermLevel.EDIT,
    [PermModule.REPORTS]: PermLevel.VIEW,
    [PermModule.WHATSAPP]: PermLevel.VIEW,
    [PermModule.APPOINTMENTS]: PermLevel.EDIT,
    [PermModule.TASKS]: PermLevel.EDIT,
    [PermModule.ALERTS]: PermLevel.VIEW,
  },

  [Role.ASSISTANT]: {
    [PermModule.CASES]: PermLevel.EDIT,
    [PermModule.AI]: PermLevel.VIEW,
    [PermModule.DOCUMENTS]: PermLevel.EDIT,
    [PermModule.TASKS]: PermLevel.EDIT,
    [PermModule.APPOINTMENTS]: PermLevel.VIEW,
    [PermModule.WHATSAPP]: PermLevel.VIEW,
    [PermModule.ALERTS]: PermLevel.VIEW,
  },

  [Role.ACCOUNTANT]: {
    [PermModule.FINANCE]: PermLevel.FULL,
    [PermModule.REPORTS]: PermLevel.VIEW,
    [PermModule.ALERTS]: PermLevel.VIEW,
  },

  [Role.ADMIN]: {
    [PermModule.CLIENTS]: PermLevel.EDIT,
    [PermModule.HR]: PermLevel.EDIT,
    [PermModule.DOCUMENTS]: PermLevel.EDIT,
    [PermModule.WHATSAPP]: PermLevel.EDIT,
    [PermModule.APPOINTMENTS]: PermLevel.EDIT,
    [PermModule.TASKS]: PermLevel.EDIT,
    [PermModule.ALERTS]: PermLevel.VIEW,
    [PermModule.PULSE]: PermLevel.VIEW,
  },

  [Role.RECEPTION]: {
    [PermModule.WHATSAPP]: PermLevel.FULL,
    [PermModule.CLIENTS]: PermLevel.EDIT,
    [PermModule.APPOINTMENTS]: PermLevel.FULL,
    [PermModule.ALERTS]: PermLevel.VIEW,
  },
};

/** The per-role default for any module not explicitly granted. */
function defaultLevelFor(role: Role): PermLevel {
  return role === Role.PARTNER ? PermLevel.FULL : PermLevel.NONE;
}

/** Seed level for (role, module) — used only to populate a new office. */
export function seedLevel(role: Role, module: PermModule): PermLevel {
  return SEED_GRANTS[role][module] ?? defaultLevelFor(role);
}

/**
 * Field denials (docs/04 layer 2). Resource → role → denied fields.
 * Seed: ASSISTANT cannot see the "fees" field on cases.
 */
export const SEED_FIELD_DENY: Array<{ role: Role; resource: string; field: string }> = [
  { role: Role.ASSISTANT, resource: "cases", field: "fees" },
];

/** Case row-scope per role (docs/04 layer 3). */
export const SEED_CASE_SCOPE: Record<Role, CaseScope> = {
  [Role.PARTNER]: CaseScope.ALL,
  [Role.LAWYER]: CaseScope.ASSIGNED,
  [Role.ASSISTANT]: CaseScope.ASSIGNED,
  [Role.ACCOUNTANT]: CaseScope.ALL,
  [Role.ADMIN]: CaseScope.ALL,
  [Role.RECEPTION]: CaseScope.ALL,
};
