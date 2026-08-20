import { describe, expect, it } from "vitest";
import { draftHearingReport, parseDraftPayload } from "@/lib/ai/hearing-draft";

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

describe("parseDraftPayload", () => {
  it("passes through a valid next date and suggested action", () => {
    const draft = parseDraftPayload({
      minutes: "م",
      result: "ن",
      clientReport: "ت",
      nextHearingDate: "2026-09-01",
      suggestedAction: { kind: "reminder", text: "تذكير بالمرافعة" },
    });
    expect(draft.nextHearingDate).toBe("2026-09-01");
    expect(draft.suggestedAction).toEqual({ kind: "reminder", text: "تذكير بالمرافعة" });
  });

  it("defaults missing fields to null", () => {
    const draft = parseDraftPayload({ minutes: "م", result: "ن", clientReport: "ت" });
    expect(draft.nextHearingDate).toBeNull();
    expect(draft.suggestedAction).toBeNull();
  });

  it("falls back to null on a garbage date instead of throwing", () => {
    const draft = parseDraftPayload({ nextHearingDate: "not-a-date" });
    expect(draft.nextHearingDate).toBeNull();
  });

  it("falls back to null on an invalid suggestedAction.kind", () => {
    const draft = parseDraftPayload({ suggestedAction: { kind: "invented", text: "x" } });
    expect(draft.suggestedAction).toBeNull();
  });

  it("falls back to null when suggestedAction.text is blank", () => {
    const draft = parseDraftPayload({ suggestedAction: { kind: "task", text: "  " } });
    expect(draft.suggestedAction).toBeNull();
  });
});
