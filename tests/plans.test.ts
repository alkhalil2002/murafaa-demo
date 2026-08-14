import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeSaudiPhone } from "@/lib/auth/phone";

/** Mirrors planSchema in src/server/platform.ts. */
const planSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, "CODE_INVALID"),
  nameAr: z.string().trim().min(1).max(80),
  priceRiyals: z.number().int().min(0).max(1_000_000),
  seatLimit: z.number().int().min(1).max(10_000).nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

const base = { code: "pro", nameAr: "احترافي", priceRiyals: 1299, seatLimit: 20 };

describe("plan validation", () => {
  it("accepts a normal plan", () => {
    expect(planSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a null seat limit as 'unlimited'", () => {
    expect(planSchema.safeParse({ ...base, seatLimit: null }).success).toBe(true);
  });

  it("rejects a blank price rather than defaulting it to free", () => {
    // The action maps "" to NaN precisely so this fails: Number("") is 0, which
    // would silently create a free plan out of an empty field.
    expect(planSchema.safeParse({ ...base, priceRiyals: Number.NaN }).success).toBe(false);
  });

  it("rejects a fractional price — money is halalas, never a float", () => {
    expect(planSchema.safeParse({ ...base, priceRiyals: 99.5 }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(planSchema.safeParse({ ...base, priceRiyals: -1 }).success).toBe(false);
  });

  it("rejects a zero seat limit — a plan nobody can use", () => {
    expect(planSchema.safeParse({ ...base, seatLimit: 0 }).success).toBe(false);
  });

  it.each([["upper case", "Pro"], ["a space", "pro plan"], ["a dash", "pro-plan"], ["too short", "p"]])(
    "rejects a code with %s",
    (_label, code) => {
      expect(planSchema.safeParse({ ...base, code }).success).toBe(false);
    },
  );

  it("converts riyals to halalas without floating point", () => {
    const price = planSchema.parse(base).priceRiyals * 100;
    expect(price).toBe(129900);
    expect(Number.isInteger(price)).toBe(true);
  });
});

/** Mirrors deletePlan's guard in src/server/platform.ts. */
function mayDelete(subscriberCount: number): boolean {
  return subscriberCount === 0;
}

describe("deleting a plan", () => {
  it("allows deleting a plan nobody is on", () => {
    expect(mayDelete(0)).toBe(true);
  });

  it("refuses to delete a plan with live subscribers", () => {
    // That plan is the terms of an agreement an office is paying on, and the
    // subscription's FK depends on it. Retiring is the operation for this case.
    expect(mayDelete(1)).toBe(false);
    expect(mayDelete(97)).toBe(false);
  });
});

describe("platform admin phone", () => {
  it("normalises the owner's number to E.164", () => {
    expect(normalizeSaudiPhone("966590015636")).toBe("+966590015636");
    expect(normalizeSaudiPhone("0590015636")).toBe("+966590015636");
    expect(normalizeSaudiPhone("+966590015636")).toBe("+966590015636");
  });
});
