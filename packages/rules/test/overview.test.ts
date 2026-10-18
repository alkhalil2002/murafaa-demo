import { describe, expect, it } from "vitest";
import {
  activityCategory,
  deadlineAlertTier,
  inTodayDeadlineWindow,
  sortByTier,
} from "../src/overview.js";

const NOW = new Date("2026-07-24T09:00:00.000Z"); // 12:00 Riyadh

describe("deadline alert tiers", () => {
  it("overdue is critical, within two days is important, later is no alert", () => {
    expect(deadlineAlertTier("2026-07-23", NOW)).toBe("critical");
    expect(deadlineAlertTier("2026-07-24", NOW)).toBe("important");
    expect(deadlineAlertTier("2026-07-26", NOW)).toBe("important");
    expect(deadlineAlertTier("2026-07-27", NOW)).toBeNull();
  });

  it("sorts critical, important, info and keeps order inside a tier", () => {
    const sorted = sortByTier([
      { id: "a", tier: "info" as const },
      { id: "b", tier: "critical" as const },
      { id: "c", tier: "important" as const },
      { id: "d", tier: "critical" as const },
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "d", "c", "a"]);
  });
});

describe("today deadline window", () => {
  it("spans 3 days overdue to 45 days ahead", () => {
    expect(inTodayDeadlineWindow("2026-07-21", NOW)).toBe(true);
    expect(inTodayDeadlineWindow("2026-07-20", NOW)).toBe(false);
    expect(inTodayDeadlineWindow("2026-09-07", NOW)).toBe(true);
    expect(inTodayDeadlineWindow("2026-09-08", NOW)).toBe(false);
  });
});

describe("activity categories", () => {
  it("maps entities, with approvals taking precedence", () => {
    expect(activityCategory("case.create", "cases")).toBe("case");
    expect(activityCategory("lead.move", "leads")).toBe("client");
    expect(activityCategory("client.update", "clients")).toBe("client");
    expect(activityCategory("approval.move", "cases")).toBe("approval");
    expect(activityCategory("auth.login", "sessions")).toBe("other");
    expect(activityCategory("x", null)).toBe("other");
  });
});
