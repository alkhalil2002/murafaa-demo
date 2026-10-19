import { describe, expect, it } from "vitest";
import { officeReadOnly, OFFICE_STATUSES, subscriptionDueDate } from "../src/index.js";

describe("platform: office status", () => {
  it("makes only a suspended office read-only", () => {
    expect(OFFICE_STATUSES.filter(officeReadOnly)).toEqual(["SUSPENDED"]);
  });

  it("dates a trial by its end and an active office by its paid-until day", () => {
    const o = { trialEndsAt: "2026-11-01", paidUntil: "2026-12-31" };
    expect(subscriptionDueDate({ ...o, status: "TRIAL" })).toBe("2026-11-01");
    expect(subscriptionDueDate({ ...o, status: "ACTIVE" })).toBe("2026-12-31");
    expect(subscriptionDueDate({ ...o, status: "SUSPENDED" })).toBeNull();
    expect(
      subscriptionDueDate({ status: "ACTIVE", trialEndsAt: null, paidUntil: null }),
    ).toBeNull();
  });
});
