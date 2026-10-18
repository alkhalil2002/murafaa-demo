import { describe, expect, it } from "vitest";
import {
  completionRatePct,
  isSaudi,
  leaveDeductsBalance,
  payrollPayDate,
  payrollPeriodKey,
  pulseSince,
  requestDecided,
  SAUDI_NATIONALITY,
  stampsCheckIn,
} from "../src/index.js";

describe("HR workflow rules (legacy server/hr/*)", () => {
  it("only annual leave draws down the balance", () => {
    expect(leaveDeductsBalance("ANNUAL")).toBe(true);
    expect(leaveDeductsBalance("SICK")).toBe(false);
    expect(leaveDeductsBalance("UNPAID")).toBe(false);
  });

  it("treats approved and rejected requests as final", () => {
    expect(requestDecided("APPROVED")).toBe(true);
    expect(requestDecided("REJECTED")).toBe(true);
    expect(requestDecided("IN_REVIEW")).toBe(false);
    expect(requestDecided("SUBMITTED")).toBe(false);
  });

  it("stamps a check-in only for present or late", () => {
    expect(stampsCheckIn("PRESENT")).toBe(true);
    expect(stampsCheckIn("LATE")).toBe(true);
    expect(stampsCheckIn("ABSENT")).toBe(false);
  });

  it("keys a payroll month and pays on its last day", () => {
    expect(payrollPeriodKey(2026, 7)).toBe("2026-07");
    expect(payrollPayDate(2026, 2)).toBe("2026-02-28");
    expect(payrollPayDate(2028, 2)).toBe("2028-02-29");
    expect(payrollPayDate(2026, 12)).toBe("2026-12-31");
  });

  it("uses the default nationality as Saudi", () => {
    expect(isSaudi(SAUDI_NATIONALITY)).toBe(true);
  });
});

describe("Team Pulse windows (Riyadh time)", () => {
  // 2026-10-18 22:30 UTC is already 2026-10-19 01:30 in Riyadh.
  const at = new Date("2026-10-18T22:30:00.000Z");

  it("starts today at Riyadh midnight, not server midnight", () => {
    expect(pulseSince("today", at).toISOString()).toBe("2026-10-18T21:00:00.000Z");
  });

  it("starts the month on the 1st in Riyadh", () => {
    expect(pulseSince("month", new Date("2026-10-31T21:30:00.000Z")).toISOString()).toBe(
      "2026-10-31T21:00:00.000Z",
    );
    expect(pulseSince("month", at).toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("covers the last seven days for the week", () => {
    expect(pulseSince("week", at).toISOString()).toBe("2026-10-11T22:30:00.000Z");
  });

  it("rounds the completion rate and is 0 without tasks", () => {
    expect(completionRatePct(1, 3)).toBe(33);
    expect(completionRatePct(0, 0)).toBe(0);
  });
});
