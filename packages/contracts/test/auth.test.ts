import { describe, expect, it } from "vitest";
import { requestOtpBody, verifyOtpBody } from "../src/auth.js";

describe("auth contracts", () => {
  it("normalizes Saudi phones and defaults the channel to WhatsApp", () => {
    expect(requestOtpBody.parse({ phone: "0500000001" })).toEqual({
      phone: "+966500000001",
      channel: "whatsapp",
    });
  });

  it("rejects non-Saudi-mobile phones with an i18n key", () => {
    const r = requestOtpBody.safeParse({ phone: "0112345678" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("auth.error.phoneInvalid");
  });

  it("requires 6-digit codes", () => {
    expect(verifyOtpBody.safeParse({ phone: "0500000001", code: "12345" }).success).toBe(false);
    expect(verifyOtpBody.parse({ phone: "0500000001", code: "123456", totp: "654321" }).totp).toBe(
      "654321",
    );
  });
});
