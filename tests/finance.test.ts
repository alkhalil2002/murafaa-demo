import { describe, expect, it } from "vitest";
import { FeeType, InvoiceBaseStatus, TrustTxnType } from "@prisma/client";
import { riyalsToHalalas } from "@/lib/money";
import {
  agingBucket,
  amountsFromNet,
  expenseSplit,
  feeNet,
  invoiceNetOf,
  invoiceStatus,
  isBalanced,
  lineNetOf,
  remainingOf,
  timeEntryValue,
  trustBalanceOf,
} from "@/lib/finance/core";

const SAR = riyalsToHalalas;

describe("invoice amounts + VAT (docs/06 §2)", () => {
  it("net = Σ lines, vat = 15%, total inclusive", () => {
    const net = invoiceNetOf([
      { quantity: 2, unitPrice: SAR(3000) },
      { quantity: 1, unitPrice: SAR(1000) },
    ]);
    expect(net).toBe(SAR(7000));
    const a = amountsFromNet(net);
    expect(a.vat).toBe(SAR(1050));
    expect(a.total).toBe(SAR(8050));
  });

  it("lineNet rounds qty × price", () => {
    expect(lineNetOf(3, SAR(33.33))).toBe(3 * 3333);
  });
});

describe("derived invoice status (docs/06 §7)", () => {
  const base = { totalAmount: SAR(1000), baseStatus: InvoiceBaseStatus.DUE, isBadDebt: false, isCredited: false };
  it("credited wins over everything", () => {
    expect(invoiceStatus({ ...base, isCredited: true, isBadDebt: true }, SAR(1000))).toBe("CANCELLED");
  });
  it("bad debt next", () => {
    expect(invoiceStatus({ ...base, isBadDebt: true }, 0)).toBe("BAD_DEBT");
  });
  it("fully paid → PAID", () => {
    expect(invoiceStatus(base, SAR(1000))).toBe("PAID");
  });
  it("partial → PARTIALLY_PAID", () => {
    expect(invoiceStatus(base, SAR(400))).toBe("PARTIALLY_PAID");
  });
  it("overdue base with no payment → OVERDUE", () => {
    expect(invoiceStatus({ ...base, baseStatus: InvoiceBaseStatus.OVERDUE }, 0)).toBe("OVERDUE");
  });
  it("otherwise → DUE", () => {
    expect(invoiceStatus(base, 0)).toBe("DUE");
  });
  it("remainingOf floors at 0", () => {
    expect(remainingOf(SAR(1000), SAR(1200))).toBe(0);
  });
});

describe("fee agreements — 4 types (docs/06 §3)", () => {
  it("FLAT = value", () => {
    expect(feeNet({ type: FeeType.FLAT, feeValueMinor: SAR(15000), percentageBps: null, awardedMinor: null })).toBe(SAR(15000));
  });
  it("RETAINER = periodic value (same branch as flat)", () => {
    expect(feeNet({ type: FeeType.RETAINER, feeValueMinor: SAR(5000), percentageBps: null, awardedMinor: null })).toBe(SAR(5000));
  });
  it("HOURLY = Σ (minutes/60 × rate) over unbilled time", () => {
    const net = feeNet(
      { type: FeeType.HOURLY, feeValueMinor: null, percentageBps: null, awardedMinor: null },
      [
        { minutes: 90, hourlyRate: SAR(500) }, // 1.5h × 500 = 750
        { minutes: 60, hourlyRate: SAR(450) }, // 1h × 450 = 450
      ],
    );
    expect(net).toBe(SAR(1200));
  });
  it("PERCENTAGE = awarded × bps/10000", () => {
    // 10% (1000 bps) of 200,000 SAR = 20,000 SAR
    expect(
      feeNet({ type: FeeType.PERCENTAGE, feeValueMinor: null, percentageBps: 1000, awardedMinor: SAR(200000) }),
    ).toBe(SAR(20000));
  });
  it("timeEntryValue rounds", () => {
    expect(timeEntryValue(90, SAR(500))).toBe(SAR(750));
  });
});

describe("expense VAT extraction (FIN-EXP-VAT-EXTRACT)", () => {
  it("extracts 15/115 from a gross when no explicit VAT", () => {
    const { net, vat } = expenseSplit(SAR(1150));
    expect(vat).toBe(SAR(150));
    expect(net).toBe(SAR(1000));
  });
  it("uses explicit VAT when provided; clamps invalid", () => {
    expect(expenseSplit(SAR(1000), SAR(50)).net).toBe(SAR(950));
    expect(expenseSplit(SAR(1000), SAR(5000)).vat).toBe(0); // vat>gross → 0
  });
});

describe("trust ledger (guardrail 5)", () => {
  it("deposits add, withdrawals/transfers subtract", () => {
    const bal = trustBalanceOf([
      { type: TrustTxnType.DEPOSIT, amountMinor: SAR(50000) },
      { type: TrustTxnType.WITHDRAWAL, amountMinor: SAR(12000) },
      { type: TrustTxnType.TRANSFER_TO_FEES, amountMinor: SAR(8000) },
    ]);
    expect(bal).toBe(SAR(30000));
  });
});

describe("aging buckets + journal balance", () => {
  it("buckets by age", () => {
    expect(agingBucket(10)).toBe("b0_30");
    expect(agingBucket(45)).toBe("b31_60");
    expect(agingBucket(80)).toBe("b61_90");
    expect(agingBucket(200)).toBe("b90_plus");
  });
  it("balanced entry: ≥2 lines, one-sided, Σdr=Σcr", () => {
    expect(
      isBalanced([
        { debit: SAR(1150), credit: 0 },
        { debit: 0, credit: SAR(1000) },
        { debit: 0, credit: SAR(150) },
      ]),
    ).toBe(true);
    expect(isBalanced([{ debit: SAR(100), credit: 0 }, { debit: 0, credit: SAR(90) }])).toBe(false);
    expect(isBalanced([{ debit: SAR(100), credit: SAR(100) }, { debit: 0, credit: SAR(100) }])).toBe(false);
  });
});
