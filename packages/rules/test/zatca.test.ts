import { describe, expect, it } from "vitest";
import {
  decodeZatcaQr,
  isValidCrNumber,
  isValidVatNumber,
  zatcaAmount,
  zatcaQrPayload,
  zatcaTimestamp,
} from "../src/index.js";

describe("ZATCA phase 1 QR (TLV, base64)", () => {
  it("matches ZATCA's published example", () => {
    expect(
      zatcaQrPayload({
        sellerName: "Bobs Records",
        vatNumber: "310122393500003",
        timestamp: new Date("2022-04-25T15:30:00Z"),
        total: 100_000,
        vat: 15_000,
      }),
    ).toBe(
      "AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==",
    );
  });

  it("counts Arabic names in UTF-8 bytes and round-trips", () => {
    const payload = zatcaQrPayload({
      sellerName: "مكتب مُرافعة للمحاماة",
      vatNumber: "300000000000003",
      timestamp: new Date("2026-10-18T09:05:07.123Z"),
      total: 115_050,
      vat: 15_007,
    });
    expect(decodeZatcaQr(payload)).toEqual([
      "مكتب مُرافعة للمحاماة",
      "300000000000003",
      "2026-10-18T09:05:07Z",
      "1150.50",
      "150.07",
    ]);
    // tag 1 length is the UTF-8 byte count, not the character count
    expect(atob(payload).charCodeAt(1)).toBe(
      new TextEncoder().encode("مكتب مُرافعة للمحاماة").length,
    );
  });

  it("refuses an invalid VAT number or an over-long field", () => {
    const base = { vatNumber: "300000000000003", timestamp: new Date(), total: 1, vat: 0 };
    expect(() => zatcaQrPayload({ ...base, sellerName: "x", vatNumber: "123" })).toThrow(/VAT/);
    expect(() => zatcaQrPayload({ ...base, sellerName: "م".repeat(200) })).toThrow(/255/);
  });

  it("validates VAT and CR numbers and formats amounts and time", () => {
    expect(isValidVatNumber("310122393500003")).toBe(true);
    expect(isValidVatNumber("210122393500003")).toBe(false);
    expect(isValidVatNumber("31012239350000")).toBe(false);
    expect(isValidCrNumber("1010123456")).toBe(true);
    expect(isValidCrNumber("10101234")).toBe(false);
    expect(zatcaAmount(5)).toBe("0.05");
    expect(zatcaAmount(123_456)).toBe("1234.56");
    expect(zatcaTimestamp(new Date("2026-01-02T03:04:05.678Z"))).toBe("2026-01-02T03:04:05Z");
  });
});
