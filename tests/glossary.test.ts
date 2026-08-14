import { describe, expect, it } from "vitest";
import {
  GLOSSARY,
  MAX_TERM_LENGTH,
  defaultTerms,
  resolveTerms,
  sanitizeTermOverrides,
} from "@/lib/i18n/glossary";
import { t } from "@/lib/i18n";

describe("resolveTerms", () => {
  it("returns every glossary id, so callers never see undefined", () => {
    const terms = resolveTerms({});
    for (const def of GLOSSARY) {
      expect(terms[def.id]).toBeTruthy();
    }
  });

  it("falls back to the i18n default when nothing is stored", () => {
    expect(defaultTerms().case).toBe(t("nav.cases"));
    expect(defaultTerms().trust).toBe(t("term.trust.default"));
  });

  it("uses the office's own wording when set", () => {
    expect(resolveTerms({ case: "ملفات" }).case).toBe("ملفات");
  });

  it("leaves untouched terms on their defaults", () => {
    const terms = resolveTerms({ case: "ملفات" });
    expect(terms.client).toBe(t("nav.clients"));
  });

  // The stored value is user-authored JSON from a database column. A malformed
  // override must degrade to our wording, never take a page down.
  it.each([
    ["null", null],
    ["a string", "not-an-object"],
    ["an array", ["case", "ملفات"]],
    ["a number", 42],
    ["undefined", undefined],
  ])("survives %s stored in the column", (_label, stored) => {
    expect(() => resolveTerms(stored)).not.toThrow();
    expect(resolveTerms(stored).case).toBe(t("nav.cases"));
  });

  it("ignores non-string and blank values", () => {
    const terms = resolveTerms({ case: 5, client: "   ", lead: null });
    expect(terms.case).toBe(t("nav.cases"));
    expect(terms.client).toBe(t("nav.clients"));
    expect(terms.lead).toBe(t("nav.leads"));
  });

  it("ignores an over-long value rather than breaking the nav layout", () => {
    expect(resolveTerms({ case: "ط".repeat(MAX_TERM_LENGTH + 1) }).case).toBe(t("nav.cases"));
  });

  it("ignores unknown ids", () => {
    const terms = resolveTerms({ nonsense: "x", case: "ملفات" });
    expect(terms.case).toBe("ملفات");
    expect((terms as Record<string, string>).nonsense).toBeUndefined();
  });
});

describe("sanitizeTermOverrides", () => {
  it("keeps a genuine rename", () => {
    expect(sanitizeTermOverrides({ case: " ملفات " })).toEqual({ case: "ملفات" });
  });

  it("drops unknown ids so the column cannot become a junk drawer", () => {
    expect(sanitizeTermOverrides({ notATerm: "x" })).toEqual({});
  });

  it("drops blanks, over-long values, and non-strings", () => {
    expect(
      sanitizeTermOverrides({ case: "  ", client: "ط".repeat(41), lead: 7 }),
    ).toEqual({});
  });

  it("does NOT store a value identical to the default", () => {
    // Pinning an office to today's wording would silently withhold a later
    // copy fix from them.
    expect(sanitizeTermOverrides({ case: t("nav.cases") })).toEqual({});
  });

  it("every glossary id has a distinct, resolvable default", () => {
    const ids = GLOSSARY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of GLOSSARY) {
      expect(t(def.defaultKey)).toBeTruthy();
      expect(t(def.hintKey)).toBeTruthy();
    }
  });
});
