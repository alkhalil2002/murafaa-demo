import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOtpProvider, whatsappOtpPayload, OtpDeliveryError } from "@/lib/auth/otp-provider";
import { mayEchoCode } from "@/lib/auth/otp-echo";
import { normalizeSaudiPhone } from "@/lib/auth/phone";

const ENDPOINT = "https://example.invalid/outbound/webhook/test";

describe("whatsappOtpPayload", () => {
  it("sends a bare international number — the webhook rejects a leading +", () => {
    expect(whatsappOtpPayload("+966512345678", "123456")).toEqual([
      { phone: "966512345678", otp: "123456" },
    ]);
  });

  it("is an array, because the webhook takes a batch even for one recipient", () => {
    const body = whatsappOtpPayload("+966512345678", "000000");
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("consumes exactly what normalizeSaudiPhone produces", () => {
    // Pins the seam between our phone model and the vendor's wire format. If
    // normalization ever stops emitting E.164, this fails here rather than as
    // codes that quietly stop arriving.
    const stored = normalizeSaudiPhone("0512345678");
    expect(stored).toBe("+966512345678");
    expect(whatsappOtpPayload(stored!, "654321")[0]!.phone).toBe("966512345678");
  });

  it("preserves a leading zero in the code — the OTP is a string, not a number", () => {
    expect(whatsappOtpPayload("+966512345678", "007123")[0]!.otp).toBe("007123");
  });
});

describe("WhatsApp provider delivery", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OTP_PROVIDER", "whatsapp");
    vi.stubEnv("WHATSAPP_OTP_URL", ENDPOINT);
    vi.stubEnv("WHATSAPP_OTP_TOKEN", "test-token");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs the payload as JSON with a bearer token", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    await getOtpProvider().send("+966512345678", "123456", "whatsapp");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual([{ phone: "966512345678", otp: "123456" }]);
  });

  it("always passes an abort signal — an unbounded fetch would hang the login", () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    return getOtpProvider()
      .send("+966512345678", "123456", "whatsapp")
      .then(() => {
        expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
      });
  });

  it("retries once on 5xx, then reports failure", async () => {
    fetchMock.mockResolvedValue(new Response("upstream down", { status: 503 }));
    await expect(getOtpProvider().send("+966512345678", "1", "whatsapp")).rejects.toThrow(
      OtpDeliveryError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 4xx — a bad token or number cannot be fixed by repeating it", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    await expect(getOtpProvider().send("+966512345678", "1", "whatsapp")).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a transport error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getOtpProvider().send("+966512345678", "1", "whatsapp")).rejects.toThrow(
      OtpDeliveryError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never puts the code or the token in the thrown message", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 400 }));
    let message = "";
    try {
      await getOtpProvider().send("+966512345678", "987654", "whatsapp");
      expect.unreachable("delivery should have failed");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain("987654");
    expect(message).not.toContain("test-token");
  });

  it("refuses to construct without credentials rather than failing mid-login", () => {
    vi.stubEnv("WHATSAPP_OTP_TOKEN", "");
    expect(() => getOtpProvider()).toThrow(OtpDeliveryError);
  });
});

describe("mayEchoCode — the OTP request endpoint is unauthenticated", () => {
  afterEach(() => vi.unstubAllEnvs());

  const consoleProvider = { name: "console", send: async () => {} };
  const whatsappProvider = { name: "whatsapp", send: async () => {} };

  it("echoes the code in development, where it is a convenience", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(mayEchoCode(consoleProvider)).toBe(true);
  });

  it("NEVER echoes in production, even with the console provider", () => {
    // Observed live: an anonymous POST to /api/auth/otp answered
    // {"sent":true,"devCode":"470453"} for a seeded account. Anyone who can
    // guess a phone number could then complete the login.
    vi.stubEnv("NODE_ENV", "production");
    expect(mayEchoCode(consoleProvider)).toBe(false);
  });

  it("never echoes for a real delivery provider in any environment", () => {
    for (const env of ["development", "test", "production"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(mayEchoCode(whatsappProvider)).toBe(false);
    }
  });
});
