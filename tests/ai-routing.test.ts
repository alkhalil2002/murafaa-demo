import { describe, expect, it } from "vitest";
import { route, isCaseBearing, type ProviderSpec } from "@/lib/ai/providers";
import type { LlmRequest } from "@/lib/ai/llm";

/**
 * The residency rule is a compliance control, not an optimisation. These tests
 * exist so that a future change which makes routing "smarter" or "cheaper"
 * cannot quietly start sending Saudi case data to an out-of-Kingdom endpoint.
 */

const spec = (id: string, residency: ProviderSpec["residency"], cost: number): ProviderSpec => ({
  id: id as ProviderSpec["id"],
  residency,
  costPerMTokOut: cost,
  create: () => ({ name: id, generate: async () => ({ text: "", model: id }) }),
});

const base: LlmRequest = { system: "s", question: "q", sources: [] };
const withCase: LlmRequest = { ...base, sources: [{ citationKey: "نظام", content: "..." }] };

describe("isCaseBearing", () => {
  it("treats retrieved sources as case data", () => {
    expect(isCaseBearing(withCase)).toBe(true);
  });
  it("treats an arena role as case data", () => {
    expect(isCaseBearing({ ...base, arenaRole: "OURS" })).toBe(true);
  });
  it("treats a bare question as non-case", () => {
    expect(isCaseBearing(base)).toBe(false);
  });
});

describe("route — residency", () => {
  const all = [
    spec("openai-compatible", "external", 1), // cheapest, but external
    spec("vertex-claude", "in-kingdom", 5),
    spec("local", "self-hosted", 0),
  ];

  it("never sends case data to an external provider, even when cheapest", () => {
    const d = route(withCase, all)!;
    expect(d.provider).not.toBe("openai-compatible");
    expect(d.fallbacks).not.toContain("openai-compatible");
  });

  it("prefers the cheapest ELIGIBLE provider for case data", () => {
    expect(route(withCase, all)!.provider).toBe("local");
  });

  it("allows any provider when no case data is involved", () => {
    expect(route(base, all)!.provider).toBe("local");
    expect(route(base, all)!.fallbacks).toContain("openai-compatible");
  });

  it("returns null rather than falling back to an ineligible provider", () => {
    expect(route(withCase, [spec("openai-compatible", "external", 1)])).toBeNull();
  });

  it("orders fallbacks by cost", () => {
    const d = route(base, all)!;
    expect([d.provider, ...d.fallbacks]).toEqual(["local", "openai-compatible", "vertex-claude"]);
  });
});
