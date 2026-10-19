import { describe, expect, it } from "vitest";
import { canPlatform, PLATFORM_ACTIONS, platformActions } from "../src/index.js";

describe("platform roles", () => {
  it("gives each role exactly its actions", () => {
    const grid = Object.fromEntries(
      (["OWNER", "OPERATIONS", "BILLING", "SUPPORT"] as const).map((r) => [
        r,
        PLATFORM_ACTIONS.filter((a) => canPlatform(r, a)),
      ]),
    );
    expect(grid).toEqual({
      OWNER: ["office.create", "office.status", "subscription.update", "team.manage"],
      OPERATIONS: ["office.create", "office.status", "subscription.update"],
      BILLING: ["subscription.update"],
      SUPPORT: [],
    });
  });

  it("lets only the owner manage the team", () => {
    expect(PLATFORM_ACTIONS.length).toBe(4);
    expect(platformActions("OPERATIONS")).not.toContain("team.manage");
    expect(platformActions("OWNER")).toContain("team.manage");
  });
});
