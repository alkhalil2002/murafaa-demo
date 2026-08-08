import { describe, expect, it } from "vitest";
import { CaseScope, PermLevel, PermModule, Role } from "@prisma/client";
import {
  canField,
  canModule,
  canViewCase,
  caseScopeOf,
  wouldStrandLastPartner,
  type OfficePolicy,
} from "@/lib/permissions/engine";
import {
  ALL_MODULES,
  ALL_ROLES,
  SEED_CASE_SCOPE,
  SEED_FIELD_DENY,
  seedLevel,
} from "@/lib/permissions/matrix";

/** Build the default OfficePolicy from the seed matrix (docs/04). */
function seedPolicy(): OfficePolicy {
  const modules = {
    PARTNER: {},
    LAWYER: {},
    ASSISTANT: {},
    ACCOUNTANT: {},
    ADMIN: {},
    RECEPTION: {},
  } as OfficePolicy["modules"];
  for (const role of ALL_ROLES) {
    for (const module of ALL_MODULES) {
      modules[role][module] = seedLevel(role, module);
    }
  }
  const fieldDeny: OfficePolicy["fieldDeny"] = {};
  for (const f of SEED_FIELD_DENY) {
    (fieldDeny[`${f.role}:${f.resource}`] ??= new Set()).add(f.field);
  }
  return { modules, fieldDeny, caseScope: { ...SEED_CASE_SCOPE } };
}

describe("layer 1 — module access", () => {
  const policy = seedPolicy();

  it("partner has full access to every module", () => {
    for (const module of ALL_MODULES) {
      expect(canModule(policy, Role.PARTNER, module, "delete")).toBe(true);
    }
  });

  it("lawyer can edit cases but cannot access finance at all", () => {
    expect(canModule(policy, Role.LAWYER, PermModule.CASES, "edit")).toBe(true);
    expect(canModule(policy, Role.LAWYER, PermModule.FINANCE, "view")).toBe(false);
  });

  it("accountant owns finance but is locked out of cases", () => {
    expect(canModule(policy, Role.ACCOUNTANT, PermModule.FINANCE, "delete")).toBe(true);
    expect(canModule(policy, Role.ACCOUNTANT, PermModule.CASES, "view")).toBe(false);
  });

  it("view grant does not imply edit (assistant AI is view-only)", () => {
    expect(canModule(policy, Role.ASSISTANT, PermModule.AI, "view")).toBe(true);
    expect(canModule(policy, Role.ASSISTANT, PermModule.AI, "edit")).toBe(false);
  });

  it("only the partner may touch the permissions module", () => {
    for (const role of ALL_ROLES) {
      const expected = role === Role.PARTNER;
      expect(canModule(policy, role, PermModule.PERMISSIONS, "view")).toBe(expected);
    }
  });

  it("no god mode: an empty policy denies every action", () => {
    const empty: OfficePolicy = {
      modules: {
        PARTNER: {},
        LAWYER: {},
        ASSISTANT: {},
        ACCOUNTANT: {},
        ADMIN: {},
        RECEPTION: {},
      },
      fieldDeny: {},
      caseScope: {},
    };
    expect(canModule(empty, Role.PARTNER, PermModule.CASES, "view")).toBe(false);
    // Missing scope defaults to the least-privilege ASSIGNED, not ALL.
    expect(caseScopeOf(empty, Role.PARTNER)).toBe(CaseScope.ASSIGNED);
  });
});

describe("layer 2 — field denial", () => {
  const policy = seedPolicy();

  it("assistant cannot see the fees field on cases", () => {
    expect(canField(policy, Role.ASSISTANT, "cases", "fees")).toBe(false);
  });

  it("lawyer and partner can see the fees field on cases", () => {
    expect(canField(policy, Role.LAWYER, "cases", "fees")).toBe(true);
    expect(canField(policy, Role.PARTNER, "cases", "fees")).toBe(true);
  });

  it("non-denied fields remain visible even for the assistant", () => {
    expect(canField(policy, Role.ASSISTANT, "cases", "title")).toBe(true);
  });
});

describe("layer 3 — case row scope", () => {
  const policy = seedPolicy();
  const userId = "user-1";
  const assigned = ["user-1", "user-9"];
  const notAssigned = ["user-9"];

  it("partner (ALL) sees any case regardless of assignment", () => {
    expect(caseScopeOf(policy, Role.PARTNER)).toBe(CaseScope.ALL);
    expect(canViewCase(policy, Role.PARTNER, userId, notAssigned)).toBe(true);
  });

  it("lawyer (ASSIGNED) sees only cases they are assigned to", () => {
    expect(caseScopeOf(policy, Role.LAWYER)).toBe(CaseScope.ASSIGNED);
    expect(canViewCase(policy, Role.LAWYER, userId, assigned)).toBe(true);
    expect(canViewCase(policy, Role.LAWYER, userId, notAssigned)).toBe(false);
  });

  it("assistant is also ASSIGNED-scoped", () => {
    expect(caseScopeOf(policy, Role.ASSISTANT)).toBe(CaseScope.ASSIGNED);
    expect(canViewCase(policy, Role.ASSISTANT, userId, notAssigned)).toBe(false);
  });
});

describe("level ordering", () => {
  it("seedLevel resolves partner default to FULL and others to NONE", () => {
    expect(seedLevel(Role.PARTNER, PermModule.PULSE)).toBe(PermLevel.FULL);
    expect(seedLevel(Role.RECEPTION, PermModule.FINANCE)).toBe(PermLevel.NONE);
  });
});

describe("الصلاحيات admin — last-partner protection", () => {
  it("blocks demoting the sole partner in the office", () => {
    expect(wouldStrandLastPartner(Role.PARTNER, Role.LAWYER, 1)).toBe(true);
  });

  it("allows demoting a partner when another partner remains", () => {
    expect(wouldStrandLastPartner(Role.PARTNER, Role.LAWYER, 2)).toBe(false);
  });

  it("allows reassigning a partner to partner (no-op) regardless of count", () => {
    expect(wouldStrandLastPartner(Role.PARTNER, Role.PARTNER, 1)).toBe(false);
  });

  it("is irrelevant when the user being changed isn't currently a partner", () => {
    expect(wouldStrandLastPartner(Role.LAWYER, Role.ASSISTANT, 1)).toBe(false);
  });
});
