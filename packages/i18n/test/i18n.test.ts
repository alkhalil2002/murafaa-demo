import { describe, expect, it } from "vitest";
import { ar, dirOf, formatSar, formatWhen, messagesFor, roleLabel, t } from "../src/index.js";

describe("i18n", () => {
  it("interpolates params and leaves unknown placeholders", () => {
    expect(t("today.since", { n: 3 })).toBe("منذ 3 يوم");
    expect(t("today.since")).toBe(ar["today.since"]);
  });

  it("falls back to Arabic for untranslated English keys", () => {
    expect(messagesFor("en")["app.name"]).toBe("Murafaa");
    expect(messagesFor("en")["app.tagline"]).toBe(ar["app.tagline"]);
  });

  it("is RTL for Arabic", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });

  it("formats halalas as SAR without float drift", () => {
    expect(formatSar(690000)).toContain(ar["common.currency.sar"]);
    expect(formatSar(5, "en")).toMatch(/^0\.05 /);
  });

  it("labels every role", () => {
    for (const role of ["PARTNER", "LAWYER", "ASSISTANT", "ACCOUNTANT", "ADMIN", "RECEPTION"]) {
      expect(roleLabel(role), role).toBe(ar[`role.${role.toLowerCase()}` as keyof typeof ar]);
      expect(roleLabel(role)).toBeTruthy();
    }
  });

  it("formats audit times in Riyadh", () => {
    // 21:30 UTC is 00:30 the next day in Riyadh (UTC+3).
    expect(formatWhen("2026-01-01T21:30:00Z", "en")).toContain("Jan 2, 2026");
  });
});
