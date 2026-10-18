import { describe, expect, it } from "vitest";
import {
  daysLeft,
  dateInDays,
  minusDays,
  objectionDeadline,
  plusDays,
  urgencyOf,
} from "@/lib/dates";

// A fixed "now" so tests are deterministic and timezone-stable.
const NOW = new Date("2026-07-24T09:00:00.000Z");

describe("objection deadline (docs/06 §1)", () => {
  it("= judgment date + 30 calendar days", () => {
    const due = objectionDeadline("2026-06-18");
    expect(due.toISOString().slice(0, 10)).toBe("2026-07-18");
  });

  it("minusDays gives the reminder lead time (due − 5)", () => {
    const due = objectionDeadline("2026-06-18");
    expect(minusDays(due, 5).toISOString().slice(0, 10)).toBe("2026-07-13");
  });
});

describe("daysLeft (docs/06 §9)", () => {
  it("counts whole calendar days, sign-stable across time of day", () => {
    expect(daysLeft("2026-07-24", NOW)).toBe(0); // today
    expect(daysLeft("2026-07-27", NOW)).toBe(3);
    expect(daysLeft("2026-07-20", NOW)).toBe(-4); // overdue
  });

  it("dateInDays(n) is n days from today", () => {
    expect(daysLeft(dateInDays(10, NOW), NOW)).toBe(10);
    expect(plusDays("2026-07-24", 10).toISOString().slice(0, 10)).toBe("2026-08-03");
  });
});

describe("urgency banding (docs/06 §9)", () => {
  it("bands by days remaining", () => {
    expect(urgencyOf("2026-07-20", NOW)).toBe("overdue"); // -4
    expect(urgencyOf("2026-07-25", NOW)).toBe("critical"); // 1
    expect(urgencyOf("2026-07-26", NOW)).toBe("critical"); // 2
    expect(urgencyOf("2026-07-30", NOW)).toBe("soon"); // 6
    expect(urgencyOf("2026-08-10", NOW)).toBe("upcoming"); // 17
    expect(urgencyOf("2026-09-30", NOW)).toBe("normal"); // >30
  });
});
