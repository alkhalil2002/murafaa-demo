import { describe, expect, it } from "vitest";
import { maskIban, redactPii } from "../src/pii.js";

describe("maskIban", () => {
  it("keeps only the country code and the last 4 characters", () => {
    expect(maskIban(" SA0380000000608010167519 ")).toBe("SA••••7519");
  });

  it("leaves very short values unchanged", () => {
    expect(maskIban("1234")).toBe("1234");
  });
});

describe("redactPii", () => {
  it("removes IBANs, phones, national IDs and e-mails, also in Arabic-Indic digits", () => {
    const out = redactPii(
      "اتصل على ٠٥٥١٢٣٤٥٦٧ أو +966 55 123 4567، هوية 1012345678 وإقامة 2456789012، الآيبان SA0380000000608010167519 والبريد ali.k@example.com",
    );
    expect(out).toBe(
      "اتصل على [PHONE] أو [PHONE]، هوية [ID] وإقامة [ID]، الآيبان [IBAN] والبريد [EMAIL]",
    );
    expect(redactPii("المادة 77 من نظام العمل بمبلغ 50000 ريال")).toBe(
      "المادة 77 من نظام العمل بمبلغ 50000 ريال",
    );
  });
});
