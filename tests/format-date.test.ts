import { describe, expect, it } from "vitest";
import { formatDateAr } from "@/lib/dates";

/**
 * Cover for the display date formatter. The two defects it replaces:
 * Latin digits in an Arabic UI, and UTC-vs-Riyadh off-by-one.
 */
describe("formatDateAr", () => {
  it("renders Arabic-Indic digits, not Latin", () => {
    const out = formatDateAr(new Date("2026-08-12T09:00:00.000Z"));
    expect(out).toMatch(/[٠-٩]/);
    expect(out).not.toMatch(/[0-9]/);
  });

  it("uses the Riyadh calendar day, not the UTC one", () => {
    // 2026-08-12T22:30Z is already 2026-08-13 in Riyadh (UTC+3).
    // toISOString().slice(0,10) would have said "2026-08-12".
    const riyadhNextDay = formatDateAr(new Date("2026-08-12T22:30:00.000Z"));
    const sameDayInRiyadh = formatDateAr(new Date("2026-08-13T06:00:00.000Z"));
    expect(riyadhNextDay).toBe(sameDayInRiyadh);
  });

  it("does not shift a mid-day timestamp", () => {
    const a = formatDateAr(new Date("2026-08-12T09:00:00.000Z"));
    const b = formatDateAr(new Date("2026-08-12T12:00:00.000Z"));
    expect(a).toBe(b);
  });

  it("accepts strings as well as Date objects", () => {
    expect(formatDateAr("2026-08-12T09:00:00.000Z")).toBe(
      formatDateAr(new Date("2026-08-12T09:00:00.000Z")),
    );
  });

  it("degrades to a dash for empty and invalid input", () => {
    expect(formatDateAr(null)).toBe("—");
    expect(formatDateAr(undefined)).toBe("—");
    expect(formatDateAr("")).toBe("—");
    expect(formatDateAr("not-a-date")).toBe("—");
  });
});
