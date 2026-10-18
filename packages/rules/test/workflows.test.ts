import { describe, expect, it } from "vitest";
import {
  APPROVAL_STAGES,
  cycleNext,
  LEAD_STAGES,
  PROCEDURE_REQUEST_STATUSES,
  statusAfterCollection,
  stepStage,
} from "../src/workflows.js";
import { EXEC_PROC_STATUSES } from "../src/procedural.js";
import { isValidPoints, pointsFor } from "../src/performance.js";
import { accountBalance, periodKeyFor, periodKeyOf } from "../src/ledger.js";

describe("pipelines and cycles", () => {
  it("steps through a pipeline, bounded at both ends", () => {
    expect(stepStage(LEAD_STAGES, "PROSPECT", 1)).toBe("FIRST_CONSULTATION");
    expect(stepStage(LEAD_STAGES, "PROSPECT", -1)).toBe("PROSPECT");
    expect(stepStage(APPROVAL_STAGES, "APPROVED", 1)).toBe("APPROVED");
  });

  it("cycles statuses and wraps around", () => {
    expect(cycleNext(PROCEDURE_REQUEST_STATUSES, "REJECTED")).toBe("SUBMITTED");
    expect(cycleNext(EXEC_PROC_STATUSES, "REQUIRED")).toBe("IN_PROGRESS");
  });

  it("derives the execution file status from collections", () => {
    expect(statusAfterCollection("ACTIVE", 10_000, 10_000)).toBe("FULLY_COLLECTED");
    expect(statusAfterCollection("ACTIVE", 10_000, 1)).toBe("PARTIALLY_COLLECTED");
    expect(statusAfterCollection("ACTIVE", null, 0)).toBe("ACTIVE");
    expect(statusAfterCollection("STALLED", 10_000, 10_000)).toBe("STALLED");
    expect(statusAfterCollection("CLOSED", 10_000, 1)).toBe("CLOSED");
  });
});

describe("pulse points", () => {
  it("uses the office override when present", () => {
    expect(pointsFor("HEARING_RECORDED")).toBe(15);
    expect(pointsFor("HEARING_RECORDED", 0)).toBe(0);
    expect(isValidPoints(2.5)).toBe(false);
    expect(isValidPoints(-1)).toBe(false);
  });
});

describe("ledger", () => {
  it("measures balances on the account's normal side", () => {
    expect(accountBalance("ASSET", 500, 200)).toBe(300);
    expect(accountBalance("REVENUE", 100, 400)).toBe(300);
  });

  it("keys accounting periods by UTC year-month", () => {
    expect(periodKeyOf(new Date("2026-03-31T23:30:00Z"))).toBe("2026-03");
    expect(periodKeyFor(2026, 9)).toBe("2026-09");
  });
});
