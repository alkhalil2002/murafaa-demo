import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/http/params";

/**
 * Regression cover for dynamic-segment validation.
 *
 * /finance/[id] matches any single segment, so /finance/invoices arrived as
 * id="invoices" and went into a Prisma `where` on a uuid column — raising
 * P2023 and rendering a 500 instead of a 404.
 */
describe("isUuid", () => {
  it("accepts ids the database issues", () => {
    expect(isUuid("e72fedc7-07be-4cc5-bd11-58554e3323da")).toBe(true);
    expect(isUuid("561EAB81-5CEF-4CFD-A0B3-3006D62F64D4")).toBe(true);
  });

  it("rejects the path segments that caused the 500", () => {
    expect(isUuid("invoices")).toBe(false);
    expect(isUuid("new")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("rejects malformed and injection-shaped values", () => {
    expect(isUuid("e72fedc7-07be-4cc5-bd11-58554e3323d")).toBe(false); // short
    expect(isUuid("e72fedc7-07be-4cc5-bd11-58554e3323daa")).toBe(false); // long
    expect(isUuid("e72fedc7_07be_4cc5_bd11_58554e3323da")).toBe(false); // wrong sep
    expect(isUuid("g72fedc7-07be-4cc5-bd11-58554e3323da")).toBe(false); // non-hex
    expect(isUuid("' OR 1=1 --")).toBe(false);
    expect(isUuid("../../etc/passwd")).toBe(false);
  });

  it("does not accept a uuid with surrounding whitespace or padding", () => {
    expect(isUuid(" e72fedc7-07be-4cc5-bd11-58554e3323da")).toBe(false);
    expect(isUuid("e72fedc7-07be-4cc5-bd11-58554e3323da/edit")).toBe(false);
  });
});
