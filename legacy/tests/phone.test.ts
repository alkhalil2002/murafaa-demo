import { describe, expect, it } from "vitest";
import { normalizeSaudiPhone } from "@/lib/auth/phone";

describe("normalizeSaudiPhone", () => {
  it("normalizes the common Saudi formats to E.164", () => {
    const expected = "+966512345678";
    expect(normalizeSaudiPhone("0512345678")).toBe(expected);
    expect(normalizeSaudiPhone("512345678")).toBe(expected);
    expect(normalizeSaudiPhone("966512345678")).toBe(expected);
    expect(normalizeSaudiPhone("+966512345678")).toBe(expected);
    expect(normalizeSaudiPhone("+966 51 234 5678")).toBe(expected);
    expect(normalizeSaudiPhone("05-1234-5678".replace("5678", "5678"))).toBe(
      "+966512345678",
    );
  });

  it("rejects non-Saudi-mobile inputs", () => {
    expect(normalizeSaudiPhone("0112345678")).toBeNull(); // landline (starts 1)
    expect(normalizeSaudiPhone("51234567")).toBeNull(); // too short
    expect(normalizeSaudiPhone("5123456789")).toBeNull(); // too long
    expect(normalizeSaudiPhone("abc")).toBeNull();
    expect(normalizeSaudiPhone("")).toBeNull();
  });
});
