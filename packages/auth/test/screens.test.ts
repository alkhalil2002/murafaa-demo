import { describe, expect, it } from "vitest";
import { PermModule, Role } from "../src/enums.js";
import { seedPolicy } from "../src/policy.js";
import { canSeeScreen, SCREEN_ACCESS } from "../src/screens.js";

describe("screen access (docs/04 VIEW2MOD + FREE_VIEWS)", () => {
  const policy = seedPolicy();

  it("matches the docs/04 map exactly", () => {
    const free = Object.entries(SCREEN_ACCESS)
      .filter(([, a]) => a === "FREE")
      .map(([s]) => s);
    expect(free).toEqual(
      expect.arrayContaining([
        "today",
        "dashboard",
        "settings",
        "notifications",
        "clientportal",
        "empportal",
      ]),
    );
    expect(SCREEN_ACCESS).toMatchObject({
      cases: PermModule.CASES,
      workspace: PermModule.CASES,
      copilot: PermModule.AI,
      kb: PermModule.DOCUMENTS,
      billing: PermModule.FINANCE,
      journey: PermModule.REPORTS,
      activity: PermModule.REPORTS,
      perms: PermModule.PERMISSIONS,
      deadlines: PermModule.APPOINTMENTS,
      pulse: PermModule.PULSE,
    });
  });

  it("opens free screens to everyone and gates the rest by module", () => {
    expect(canSeeScreen(policy, { role: Role.RECEPTION }, "dashboard")).toBe(true);
    expect(canSeeScreen(policy, { role: Role.RECEPTION }, "finance")).toBe(false);
    expect(canSeeScreen(policy, { role: Role.ACCOUNTANT }, "finance")).toBe(true);
    expect(canSeeScreen(policy, { role: Role.LAWYER }, "perms")).toBe(false);
  });

  it("uses the previewed role", () => {
    expect(
      canSeeScreen(policy, { role: Role.PARTNER, previewRole: Role.RECEPTION }, "finance"),
    ).toBe(false);
  });
});
