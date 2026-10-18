import { describe, expect, it } from "vitest";
import { isBalanced } from "../src/finance.js";
import { ACCOUNT_TYPES } from "../src/ledger.js";
import { amountsFromNet } from "../src/finance.js";
import {
  ACC,
  advancePosting,
  badDebtPosting,
  canDebitTrust,
  COA_SEED,
  creditNotePosting,
  expensePosting,
  invoicePosting,
  nextDocNumber,
  paymentPosting,
  payrollPosting,
  trustPosting,
} from "../src/postings.js";

describe("chart of accounts seed", () => {
  it("seeds every standard account code exactly once, with a valid type", () => {
    expect(COA_SEED.map((a) => a.code).sort()).toEqual(Object.values(ACC).sort());
    for (const a of COA_SEED) expect(ACCOUNT_TYPES).toContain(a.type);
  });
});

describe("posting rules are balanced", () => {
  const inv = amountsFromNet(100_000); // 1,000 SAR + 15% VAT

  it("invoice: Dr receivables / Cr revenue + VAT", () => {
    const lines = invoicePosting(inv);
    expect(lines).toEqual([
      { code: ACC.RECEIVABLES, debit: 115_000, credit: 0 },
      { code: ACC.FEE_REVENUE, debit: 0, credit: 100_000 },
      { code: ACC.VAT_PAYABLE, debit: 0, credit: 15_000 },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it("payment, credit note, bad debt, expense and advance balance", () => {
    for (const lines of [
      paymentPosting(50_000),
      creditNotePosting(inv),
      badDebtPosting(65_000),
      expensePosting({ net: 1_000, vat: 150, gross: 1_150 }),
      expensePosting({ net: 1_000, vat: 0, gross: 1_000 }),
      advancePosting(300_000),
    ]) {
      expect(isBalanced(lines)).toBe(true);
    }
    expect(expensePosting({ net: 1_000, vat: 0, gross: 1_000 })).toHaveLength(2);
  });

  it("payroll: salaries = GOSI + advances recovered + net pay", () => {
    const lines = payrollPosting({
      gross: 1_000_000,
      gosi: 97_500,
      advances: 50_000,
      net: 852_500,
    });
    expect(isBalanced(lines)).toBe(true);
    expect(payrollPosting({ gross: 500_000, gosi: 0, advances: 0, net: 500_000 })).toHaveLength(2);
  });

  it("trust stays separate from revenue except on transfer to fees", () => {
    expect(trustPosting("DEPOSIT", 10_000, false)).toEqual([
      { code: ACC.TRUST_ASSET, debit: 10_000, credit: 0 },
      { code: ACC.TRUST_LIABILITY, debit: 0, credit: 10_000 },
    ]);
    expect(trustPosting("WITHDRAWAL", 10_000, false)[1]?.code).toBe(ACC.TRUST_ASSET);
    expect(trustPosting("TRANSFER_TO_FEES", 10_000, true)[1]?.code).toBe(ACC.RECEIVABLES);
    expect(trustPosting("TRANSFER_TO_FEES", 10_000, false)[1]?.code).toBe(ACC.FEE_REVENUE);
    for (const t of ["DEPOSIT", "WITHDRAWAL", "TRANSFER_TO_FEES"] as const) {
      expect(isBalanced(trustPosting(t, 1, false))).toBe(true);
    }
  });

  it("never lets trust go negative", () => {
    expect(canDebitTrust(10_000, 10_000)).toBe(true);
    expect(canDebitTrust(9_999, 10_000)).toBe(false);
    expect(canDebitTrust(10_000, 0)).toBe(false);
  });
});

describe("document numbering", () => {
  it("starts after the base and continues from the highest existing number", () => {
    expect(nextDocNumber("INV", [])).toBe("INV-1043");
    expect(nextDocNumber("INV", ["INV-1043", "INV-1050", "INV-1044"])).toBe("INV-1051");
    expect(nextDocNumber("JV", ["JV-150"])).toBe("JV-201");
  });
});
