import { describe, expect, it } from "vitest";
import { objectionDeadline, objectionReminderDue } from "../src/dates.js";
import { creditNoteBlocker } from "../src/finance.js";
import { advanceBlocker, countsForSaudization, leaveApprovalBlocker } from "../src/hr.js";

describe("rules recovered from legacy services", () => {
  it("objection reminder is due 5 days before the 30-day deadline", () => {
    const deadline = objectionDeadline("2026-01-01T00:00:00Z");
    expect(objectionReminderDue(deadline).toISOString().slice(0, 10)).toBe("2026-01-26");
  });

  it("blocks credit notes on credited, bad-debt or partly paid invoices", () => {
    expect(creditNoteBlocker({ isCredited: false, isBadDebt: false }, 0)).toBeNull();
    expect(creditNoteBlocker({ isCredited: true, isBadDebt: false }, 0)).toBe("ALREADY_CREDITED");
    expect(creditNoteBlocker({ isCredited: false, isBadDebt: true }, 0)).toBe("INVOICE_BAD_DEBT");
    expect(creditNoteBlocker({ isCredited: false, isBadDebt: false }, 1)).toBe(
      "INVOICE_HAS_PAYMENTS",
    );
  });

  it("rejects advances that could never be repaid or overpay", () => {
    expect(advanceBlocker({ amount: 300_000, monthlyInstallment: null, months: 3 })).toBeNull();
    expect(advanceBlocker({ amount: 100, monthlyInstallment: 200, months: 1 })).toBe(
      "INSTALLMENT_EXCEEDS_AMOUNT",
    );
    expect(advanceBlocker({ amount: 1, monthlyInstallment: null, months: 12 })).toBe(
      "INSTALLMENT_TOO_SMALL",
    );
  });

  it("counts on-leave and suspended staff for Saudization, not terminated", () => {
    expect(countsForSaudization("ON_LEAVE")).toBe(true);
    expect(countsForSaudization("SUSPENDED")).toBe(true);
    expect(countsForSaudization("TERMINATED")).toBe(false);
  });

  it("approves leave only with days and enough balance", () => {
    expect(leaveApprovalBlocker(null, 30)).toBe("LEAVE_REQUEST_MISSING_DAYS");
    expect(leaveApprovalBlocker(5, 4)).toBe("LEAVE_BALANCE_INSUFFICIENT");
    expect(leaveApprovalBlocker(5, 5)).toBeNull();
  });
});
