import { describe, expect, it } from "vitest";
import { riyalsToHalalas } from "@/lib/money";
import {
  NITAQAT_BANDS,
  advanceMonthly,
  advanceRemaining,
  effectiveGosi,
  endOfServiceAward,
  eosWage,
  isSaudi,
  nitaqatBand,
  payAfterGosi,
  payrollAdvanceDeduction,
  payrollNet,
  saudisNeeded,
  saudizationPct,
  serviceYears,
} from "@/lib/hr/core";

const SAR = riyalsToHalalas;

describe("end-of-service award (docs/06 §5)", () => {
  it("wage = basic + allowances", () => {
    expect(eosWage(SAR(8000), SAR(2000))).toBe(SAR(10000));
  });

  it("≤5 years → 0.5 × wage × years", () => {
    // wage 10,000; 4 years → 0.5 * 10000 * 4 = 20,000
    expect(endOfServiceAward({ basicSalary: SAR(8000), allowances: SAR(2000), years: 4 })).toBe(SAR(20000));
  });

  it("exactly 5 years → half-wage for all five", () => {
    expect(endOfServiceAward({ basicSalary: SAR(10000), allowances: 0, years: 5 })).toBe(SAR(25000));
  });

  it(">5 years → half-wage×5 + full-wage×(years−5)", () => {
    // wage 10,000; 8 years → 0.5*10000*5 + 10000*3 = 25,000 + 30,000 = 55,000
    expect(endOfServiceAward({ basicSalary: SAR(10000), allowances: 0, years: 8 })).toBe(SAR(55000));
  });

  it("rounds the half-wage term to the nearest halala", () => {
    // wage = 1 halala, 1 year → 0.5 → rounds to 1 (round-half-up)
    expect(endOfServiceAward({ basicSalary: 1, allowances: 0, years: 1 })).toBe(1);
  });

  it("zero / negative years → no award", () => {
    expect(endOfServiceAward({ basicSalary: SAR(10000), allowances: 0, years: 0 })).toBe(0);
    expect(endOfServiceAward({ basicSalary: SAR(10000), allowances: 0, years: -3 })).toBe(0);
  });

  it("serviceYears = calendar-year difference, never negative", () => {
    expect(serviceYears(2018, 2026)).toBe(8);
    expect(serviceYears(2026, 2026)).toBe(0);
    expect(serviceYears(2030, 2026)).toBe(0);
  });
});

describe("Nitaqat bands (docs/06 §6)", () => {
  it("has the six documented bands in descending order", () => {
    expect(NITAQAT_BANDS.map((b) => b.key)).toEqual([
      "PLATINUM",
      "HIGH_GREEN",
      "MID_GREEN",
      "LOW_GREEN",
      "YELLOW",
      "RED",
    ]);
  });

  it("classifies each threshold and its boundary", () => {
    expect(nitaqatBand(95)).toBe("PLATINUM");
    expect(nitaqatBand(90)).toBe("PLATINUM");
    expect(nitaqatBand(89.9)).toBe("HIGH_GREEN");
    expect(nitaqatBand(80)).toBe("HIGH_GREEN");
    expect(nitaqatBand(60)).toBe("MID_GREEN");
    expect(nitaqatBand(40)).toBe("LOW_GREEN");
    expect(nitaqatBand(20)).toBe("YELLOW");
    expect(nitaqatBand(19.9)).toBe("RED");
    expect(nitaqatBand(0)).toBe("RED");
  });
});

describe("Saudization percentage + needed hires (docs/06 §6)", () => {
  it("pct = saudis / total × 100, guards empty office", () => {
    expect(saudizationPct(6, 10)).toBe(60);
    expect(saudizationPct(0, 0)).toBe(0);
  });

  it("needed = ceil((T% × total − saudi)/(1 − T%)), min 0", () => {
    // saudi 6, total 10, T 70 → (7−6)/0.3 = 3.33 → 4; after: 10/14 = 71.4% ≥ 70
    expect(saudisNeeded(6, 10, 70)).toBe(4);
    expect(saudizationPct(10, 14)).toBeGreaterThanOrEqual(70);
  });

  it("is exact at integer boundaries (no floating-point overshoot)", () => {
    // 0.8×6 − 4 = 0.8, /0.2 = 4 exactly → 4 hires (8/10 = 80%), never 5.
    expect(saudisNeeded(4, 6, 80)).toBe(4);
    expect(saudizationPct(8, 10)).toBe(80);
  });

  it("returns 0 when the target is already met", () => {
    expect(saudisNeeded(8, 10, 70)).toBe(0);
    expect(saudisNeeded(6, 10, 0)).toBe(0);
  });

  it("edge-clamps an unreachable 100% target to the non-Saudi count", () => {
    expect(saudisNeeded(6, 10, 100)).toBe(4);
  });

  it("isSaudi defaults to true and matches «سعودي»", () => {
    expect(isSaudi("سعودي")).toBe(true);
    expect(isSaudi("  سعودي  ")).toBe(true);
    expect(isSaudi("مصري")).toBe(false);
    expect(isSaudi(null)).toBe(true);
    expect(isSaudi(undefined)).toBe(true);
  });
});

describe("advances (docs/06 §8)", () => {
  it("monthly = explicit installment when provided", () => {
    expect(advanceMonthly({ amount: SAR(12000), monthlyInstallment: SAR(2000), months: 6 })).toBe(SAR(2000));
  });

  it("monthly = round(amount / max(1, months)) when no explicit installment", () => {
    expect(advanceMonthly({ amount: SAR(12000), monthlyInstallment: null, months: 5 })).toBe(SAR(2400));
    // months 0 → divide by 1 (whole amount due at once)
    expect(advanceMonthly({ amount: SAR(9000), monthlyInstallment: null, months: 0 })).toBe(SAR(9000));
  });

  it("a tiny amount spread over many months can round the installment to 0", () => {
    // 100 halalas / 300 months → round(0.33) = 0; createAdvance rejects this
    // (INSTALLMENT_TOO_SMALL) so an unrepayable advance can't be created.
    expect(advanceMonthly({ amount: 100, monthlyInstallment: null, months: 300 })).toBe(0);
  });

  it("remaining = max(0, amount − paid)", () => {
    expect(advanceRemaining({ amount: SAR(12000), paid: SAR(4000) })).toBe(SAR(8000));
    expect(advanceRemaining({ amount: SAR(12000), paid: SAR(15000) })).toBe(0);
  });
});

describe("payroll composition (data-model PAYROLL_RUNS)", () => {
  it("net = basic + allowances − gosi − advance deduction", () => {
    expect(payrollNet({ basic: SAR(8000), allowances: SAR(2000), gosi: SAR(880), advanceDeduction: SAR(1000) })).toBe(
      SAR(8120),
    );
  });

  it("pay after GOSI is floored at zero", () => {
    expect(payAfterGosi(SAR(8000), SAR(2000), SAR(880))).toBe(SAR(9120));
    expect(payAfterGosi(SAR(1000), 0, SAR(1500))).toBe(0);
  });

  it("effective GOSI is capped at the wage so net never goes negative", () => {
    expect(effectiveGosi(SAR(880), SAR(8000), SAR(2000))).toBe(SAR(880));
    // gosi > wage (data slip) → capped at wage → net = 0, not negative
    expect(effectiveGosi(SAR(150000), SAR(100000), 0)).toBe(SAR(100000));
    const gosi = effectiveGosi(SAR(150000), SAR(100000), 0);
    expect(payrollNet({ basic: SAR(100000), allowances: 0, gosi, advanceDeduction: 0 })).toBe(0);
  });

  it("advance deduction is the min of installment, remaining, and pay-after-GOSI", () => {
    // installment covered fully
    expect(payrollAdvanceDeduction({ installment: SAR(2000), remaining: SAR(8000), payAfterGosi: SAR(9000) })).toBe(
      SAR(2000),
    );
    // remaining smaller than installment (last, partial installment)
    expect(payrollAdvanceDeduction({ installment: SAR(2000), remaining: SAR(500), payAfterGosi: SAR(9000) })).toBe(
      SAR(500),
    );
    // pay-after-GOSI is the binding cap → net never negative
    expect(payrollAdvanceDeduction({ installment: SAR(2000), remaining: SAR(8000), payAfterGosi: SAR(300) })).toBe(
      SAR(300),
    );
  });

  it("a capped deduction keeps net ≥ 0", () => {
    const basic = SAR(1000);
    const allowances = 0;
    const gosi = SAR(100);
    const ded = payrollAdvanceDeduction({
      installment: SAR(5000),
      remaining: SAR(5000),
      payAfterGosi: payAfterGosi(basic, allowances, gosi),
    });
    expect(payrollNet({ basic, allowances, gosi, advanceDeduction: ded })).toBe(0);
  });
});
