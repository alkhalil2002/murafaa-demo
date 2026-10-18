import { describe, expect, it } from "vitest";
import { canField, canModule, caseScopeOf } from "../src/engine.js";
import { CaseScope, PermModule, Role } from "../src/enums.js";
import { policyFromRows, seedPolicy } from "../src/policy.js";

describe("seedPolicy", () => {
  const policy = seedPolicy();

  it("resolves every role × module", () => {
    expect(canModule(policy, Role.PARTNER, PermModule.PERMISSIONS, "delete")).toBe(true);
    expect(canModule(policy, Role.RECEPTION, PermModule.FINANCE, "view")).toBe(false);
    expect(canModule(policy, Role.ACCOUNTANT, PermModule.FINANCE, "delete")).toBe(true);
  });

  it("carries field denials and case scopes from the seed", () => {
    expect(canField(policy, Role.ASSISTANT, "cases", "fees")).toBe(false);
    expect(canField(policy, Role.LAWYER, "cases", "fees")).toBe(true);
    expect(caseScopeOf(policy, Role.LAWYER)).toBe(CaseScope.ASSIGNED);
  });
});

describe("policyFromRows", () => {
  it("builds the policy from stored rows", () => {
    const policy = policyFromRows(
      [{ role: Role.LAWYER, module: PermModule.FINANCE, level: "VIEW" }],
      [{ role: Role.LAWYER, resource: "cases", field: "fees" }],
      [{ role: Role.LAWYER, scope: CaseScope.ALL }],
    );
    expect(canModule(policy, Role.LAWYER, PermModule.FINANCE, "view")).toBe(true);
    expect(canField(policy, Role.LAWYER, "cases", "fees")).toBe(false);
    expect(caseScopeOf(policy, Role.LAWYER)).toBe(CaseScope.ALL);
  });

  it("fails closed when an office has no rows", () => {
    const policy = policyFromRows([], [], []);
    expect(canModule(policy, Role.PARTNER, PermModule.CASES, "view")).toBe(false);
    expect(caseScopeOf(policy, Role.PARTNER)).toBe(CaseScope.ASSIGNED);
  });
});
