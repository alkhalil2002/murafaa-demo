import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, LAST_STEP_INDEX } from "@/server/onboarding";

/**
 * The wizard's step arithmetic, isolated from the database.
 *
 * The persisted `onboardingStep` is an unconstrained Int and the URL carries a
 * user-supplied `?step=`, so both are untrusted inputs into an array index.
 */

/** Mirrors the clamp in src/app/onboarding/page.tsx. */
function resolveIndex(requestedRaw: string | undefined, persisted: number): number {
  const persistedSafe = Math.min(Math.max(persisted, 0), LAST_STEP_INDEX);
  const requested = Number.parseInt(requestedRaw ?? "", 10);
  return Number.isFinite(requested)
    ? Math.min(Math.max(requested, 0), Math.min(persistedSafe + 1, LAST_STEP_INDEX))
    : persistedSafe;
}

describe("onboarding step resolution", () => {
  it("starts at the intro for a fresh office", () => {
    expect(ONBOARDING_STEPS[resolveIndex(undefined, 0)]).toBe("intro");
  });

  it("resumes where an abandoned wizard stopped", () => {
    expect(ONBOARDING_STEPS[resolveIndex(undefined, 2)]).toBe("terms");
  });

  it("lets the user step back to review an earlier screen", () => {
    expect(ONBOARDING_STEPS[resolveIndex("1", 3)]).toBe("identity");
  });

  it("allows exactly one step forward, so Next works", () => {
    expect(resolveIndex("3", 2)).toBe(3);
  });

  it("refuses to jump past what was actually reached", () => {
    // A hand-typed ?step=4 must not skip setup that never happened.
    expect(resolveIndex("4", 0)).toBe(1);
  });

  it.each([
    ["negative", "-5"],
    ["not a number", "banana"],
    ["empty", ""],
    ["huge", "999999"],
  ])("stays in bounds for a %s step param", (_label, param) => {
    const i = resolveIndex(param, 2);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThanOrEqual(LAST_STEP_INDEX);
    expect(ONBOARDING_STEPS[i]).toBeDefined();
  });

  it.each([
    ["a negative persisted value", -3],
    ["a persisted value past the end", 99],
  ])("stays in bounds given %s", (_label, persisted) => {
    const i = resolveIndex(undefined, persisted);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThanOrEqual(LAST_STEP_INDEX);
    expect(ONBOARDING_STEPS[i]).toBeDefined();
  });

  it("has a stable step order — the index is persisted, so reordering orphans it", () => {
    expect([...ONBOARDING_STEPS]).toEqual(["intro", "identity", "terms", "team", "done"]);
    expect(LAST_STEP_INDEX).toBe(4);
  });
});
