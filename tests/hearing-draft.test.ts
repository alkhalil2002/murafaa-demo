import { describe, expect, it } from "vitest";
import { draftHearingReport } from "@/lib/ai/hearing-draft";

describe("draftHearingReport", () => {
  it("refuses empty raw notes", async () => {
    const result = await draftHearingReport("   ");
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("reports unavailable when no provider is configured", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await draftHearingReport("عُقدت الجلسة وتقرر التأجيل");
      expect(result).toEqual({ ok: false, reason: "unavailable" });
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});
