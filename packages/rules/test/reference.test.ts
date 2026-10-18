import { describe, expect, it } from "vitest";
import { SAUDI_CITIES } from "../src/reference/cities.js";
import { NAJIZ, najizLeaves } from "../src/reference/najiz.js";

describe("reference data", () => {
  it("Najiz taxonomy is main → sub → non-empty leaf types, with no duplicate leaves", () => {
    for (const [main, subs] of Object.entries(NAJIZ)) {
      expect(Object.keys(subs).length, main).toBeGreaterThan(0);
      for (const [sub, leaves] of Object.entries(subs))
        expect(leaves.length, `${main}/${sub}`).toBeGreaterThan(0);
    }
    const keys = najizLeaves().map((l) => `${l.mainClass}/${l.subClass}/${l.caseType}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("city list has no duplicates", () => {
    expect(new Set(SAUDI_CITIES).size).toBe(SAUDI_CITIES.length);
  });
});
