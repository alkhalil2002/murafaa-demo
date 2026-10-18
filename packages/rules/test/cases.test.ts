import { describe, expect, it } from "vitest";
import {
  clampSatisfaction,
  effectiveStage,
  isJudgment,
  opponentRole,
  prevProcStage,
  winRate,
} from "../src/cases.js";

describe("isJudgment (starts the 30-day objection deadline)", () => {
  it("trusts an explicit hearing kind over the text", () => {
    expect(isJudgment("JUDGMENT_PRONOUNCEMENT")).toBe(true);
    expect(isJudgment("PLEADING", "صدر الحكم لصالح موكلنا")).toBe(false);
  });

  it("falls back to judgment phrases in the result or minutes", () => {
    expect(isJudgment(null, "صدر الحكم")).toBe(true);
    expect(isJudgment(undefined, null, "نطقت المحكمة")).toBe(true);
    expect(isJudgment(null, "تأجيل الجلسة")).toBe(false);
  });
});

describe("stages", () => {
  it("remands one stage back and stops at the first", () => {
    expect(prevProcStage("APPEAL")).toBe("FIRST_INSTANCE");
    expect(prevProcStage("RECONCILIATION")).toBeNull();
  });

  it("takes the stage of the latest held hearing, else the baseline", () => {
    const d = (s: string) => new Date(s);
    expect(
      effectiveStage("FIRST_INSTANCE", [
        { status: "HELD", stageIndex: 2, hearingDate: d("2026-01-10") },
        { status: "HELD", stageIndex: 1, hearingDate: d("2026-01-01") },
        { status: "UPCOMING", stageIndex: 3, hearingDate: d("2026-02-01") },
      ]),
    ).toBe("APPEAL");
    expect(
      effectiveStage("FIRST_INSTANCE", [
        { status: "HELD", stageIndex: null, hearingDate: d("2026-01-10") },
      ]),
    ).toBe("FIRST_INSTANCE");
  });
});

describe("winRate", () => {
  it("counts partial wins as half", () => {
    expect(winRate({ WON: 3, PARTIAL: 2, LOST: 5 })).toBe(40);
  });

  it("is null with no outcomes", () => {
    expect(winRate({})).toBeNull();
  });
});

describe("case helpers", () => {
  it("puts the opponent on the other side", () => {
    expect(opponentRole("PLAINTIFF")).toBe("DEFENDANT");
    expect(opponentRole("DEFENDANT")).toBe("PLAINTIFF");
  });

  it("clamps satisfaction to 1–5 whole stars", () => {
    expect(clampSatisfaction(0)).toBe(1);
    expect(clampSatisfaction(3.6)).toBe(4);
    expect(clampSatisfaction(9)).toBe(5);
  });
});
