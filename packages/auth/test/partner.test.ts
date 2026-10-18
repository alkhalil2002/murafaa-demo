import { describe, expect, it } from "vitest";
import { Role } from "../src/enums.js";
import { canPartnerOnly, previewAllows } from "../src/partner.js";

describe("partner-only actions", () => {
  it("allows partners and nobody else", () => {
    expect(canPartnerOnly({ role: Role.PARTNER }, "permissions.manage")).toBe(true);
    expect(canPartnerOnly({ role: Role.ADMIN }, "permissions.manage")).toBe(false);
    expect(canPartnerOnly({ role: Role.ACCOUNTANT }, "finance.requireApproval.set")).toBe(false);
  });

  it("drops partner powers while previewing another role", () => {
    expect(canPartnerOnly({ role: Role.PARTNER, previewRole: Role.LAWYER }, "billing.view")).toBe(
      false,
    );
  });

  it("checks the real role to start a preview", () => {
    expect(
      canPartnerOnly({ role: Role.PARTNER, previewRole: Role.LAWYER }, "rolePreview.start"),
    ).toBe(true);
    expect(
      canPartnerOnly({ role: Role.LAWYER, previewRole: Role.PARTNER }, "rolePreview.start"),
    ).toBe(false);
  });
});

describe("role preview is view-only", () => {
  it("allows only view actions while previewing", () => {
    expect(previewAllows({ previewRole: Role.LAWYER }, "view")).toBe(true);
    expect(previewAllows({ previewRole: Role.LAWYER }, "edit")).toBe(false);
    expect(previewAllows({ previewRole: null }, "delete")).toBe(true);
  });
});
