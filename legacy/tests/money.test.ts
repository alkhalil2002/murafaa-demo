import { describe, expect, it } from "vitest";
import { grossOf, riyalsToHalalas, vatOf } from "@/lib/money";

/**
 * docs/06 §2: VAT is 15% of net, total = net + vat. Money is integer halalas.
 */
describe("VAT (docs/06 §2)", () => {
  it("computes 15% VAT and gross on a whole-riyal net", () => {
    const net = riyalsToHalalas(6000); // 600,000 halalas
    expect(vatOf(net)).toBe(riyalsToHalalas(900)); // 90,000
    expect(grossOf(net)).toBe(riyalsToHalalas(6900)); // 690,000
  });

  it("rounds VAT to the nearest halala", () => {
    // 33.33 SAR net → 3,333 halalas → 15% = 499.95 → 500 halalas.
    const net = riyalsToHalalas(33.33);
    expect(net).toBe(3333);
    expect(vatOf(net)).toBe(500);
    expect(grossOf(net)).toBe(3833);
  });

  it("keeps money as integers (no floating-point drift)", () => {
    const net = riyalsToHalalas(0.1) + riyalsToHalalas(0.2);
    expect(net).toBe(30); // not 0.30000000000000004
    expect(Number.isInteger(vatOf(net))).toBe(true);
  });
});
