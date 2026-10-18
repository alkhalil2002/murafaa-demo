import { describe, expect, it } from "vitest";
import {
  CASE_OUTCOMES,
  EXEC_PROC_STATUSES,
  HEARING_KINDS,
  nextProcStage,
  PROC_STAGES,
} from "../src/procedural.js";

describe("procedural enumerations (docs/06 §10)", () => {
  it("orders litigation stages reconciliation → execution", () => {
    expect(PROC_STAGES).toEqual([
      "RECONCILIATION",
      "FIRST_INSTANCE",
      "APPEAL",
      "CASSATION",
      "EXECUTION",
    ]);
    expect(nextProcStage("APPEAL")).toBe("CASSATION");
    expect(nextProcStage("EXECUTION")).toBeNull();
  });

  it("has the 10 hearing kinds, the 4 execution statuses and the 4 outcomes", () => {
    expect(HEARING_KINDS).toHaveLength(10);
    expect(new Set(HEARING_KINDS).size).toBe(10);
    expect(EXEC_PROC_STATUSES).toEqual(["REQUIRED", "IN_PROGRESS", "EXECUTED", "STALLED"]);
    expect(CASE_OUTCOMES).toEqual(["WON", "PARTIAL", "SETTLED", "LOST"]);
  });
});
