import { describe, expect, it } from "vitest";
import { canField, canModule, caseScopeOf } from "../src/engine.js";
import { CaseScope, PermModule, Role } from "../src/enums.js";
import { seedPolicy } from "../src/policy.js";

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
