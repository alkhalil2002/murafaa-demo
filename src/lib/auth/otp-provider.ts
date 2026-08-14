/**
 * OTP delivery adapter (docs/02 §7 — integrations are adapters behind a uniform
 * interface). Call sites depend only on OtpDeliveryProvider, never on a vendor.
 *
 * Providers:
 *   console  — dev/staging; prints the code to the server log, sends nothing
 *   whatsapp — production; POSTs to the outbound webhook (WHATSAPP_OTP_URL)
 *   unifonic — reserved; not built
 */
export type OtpChannel = "sms" | "whatsapp";

export interface OtpDeliveryProvider {
  readonly name: string;
  send(phone: string, code: string, channel: OtpChannel): Promise<void>;
}

/** Raised when a provider could not deliver. Never carries the code or a credential. */
export class OtpDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpDeliveryError";
  }
}

/** Dev provider: prints the code to the server log, sends nothing. */
class ConsoleOtpProvider implements OtpDeliveryProvider {
  readonly name = "console";
  async send(phone: string, code: string, channel: OtpChannel): Promise<void> {
    console.info(`[otp:console] ${channel} → ${phone}: ${code}`);
  }
}

export type WhatsAppOtpRecipient = { phone: string; otp: string };

/**
 * Body for the outbound webhook: a JSON ARRAY of recipients, one per number.
 *
 * The webhook wants a bare international number ("9665XXXXXXXX"), while we
 * store E.164 ("+9665XXXXXXXX") everywhere else — normalizeSaudiPhone is the
 * single writer of that format. Stripping the "+" is therefore a property of
 * THIS vendor, not of our phone model, so it happens here and nowhere else.
 *
 * Pure and exported so the wire format is pinned by a test rather than
 * discovered in production when codes silently stop arriving.
 */
export function whatsappOtpPayload(phone: string, code: string): WhatsAppOtpRecipient[] {
  return [{ phone: phone.replace(/^\+/, ""), otp: code }];
}

const WHATSAPP_TIMEOUT_MS = 8_000;

/**
 * WhatsApp OTP via the outbound webhook.
 *
 * Two deliberate choices on a login-critical path:
 *
 *  - A timeout. `fetch` has no default one, so a vendor that accepts the
 *    connection and never answers would hang the login request until the
 *    platform's own timeout kills it — the user sees a spinner, then nothing.
 *
 *  - One retry, on transport failure or 5xx only. A 4xx means the request
 *    itself is wrong (bad token, malformed number); repeating it just doubles
 *    the latency before the same failure.
 *
 * Nothing here logs the code or the bearer token. A thrown message is surfaced
 * to operators, and OTP delivery errors are exactly the kind of message that
 * gets pasted into a support ticket.
 */
class WhatsAppOtpProvider implements OtpDeliveryProvider {
  readonly name = "whatsapp";

  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {}

  async send(phone: string, code: string, _channel: OtpChannel): Promise<void> {
    const body = JSON.stringify(whatsappOtpPayload(phone, code));

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body,
          signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
        });
      } catch (err) {
        // Transport-level: DNS, TLS, connection reset, or our own timeout.
        lastError = err instanceof Error ? err.name : "network error";
        continue;
      }

      if (res.ok) return;

      // Read a bounded slice of the body for diagnostics. The vendor decides
      // what goes in it, so cap the length rather than trusting it to be short.
      const detail = await res.text().then((t) => t.slice(0, 200)).catch(() => "");
      lastError = `HTTP ${res.status}${detail ? ` — ${detail}` : ""}`;
      if (res.status < 500) break; // client error: retrying cannot fix it
    }

    throw new OtpDeliveryError(`WhatsApp OTP delivery failed: ${lastError}`);
  }
}

/** Reserved for Unifonic SMS. Not built — the WhatsApp webhook replaced it. */
class UnifonicOtpProvider implements OtpDeliveryProvider {
  readonly name = "unifonic";
  async send(): Promise<void> {
    throw new OtpDeliveryError(
      "Unifonic OTP provider is not implemented. Use OTP_PROVIDER=whatsapp (production) or console (dev).",
    );
  }
}

export function getOtpProvider(): OtpDeliveryProvider {
  const which = process.env.OTP_PROVIDER ?? "console";
  switch (which) {
    case "whatsapp": {
      const endpoint = process.env.WHATSAPP_OTP_URL;
      const token = process.env.WHATSAPP_OTP_TOKEN;
      // Startup already refuses to boot without these (src/lib/config/env.ts);
      // this is the second line of defence for a runtime env change.
      if (!endpoint || !token) {
        throw new OtpDeliveryError(
          "OTP_PROVIDER=whatsapp requires WHATSAPP_OTP_URL and WHATSAPP_OTP_TOKEN",
        );
      }
      return new WhatsAppOtpProvider(endpoint, token);
    }
    case "unifonic":
      return new UnifonicOtpProvider();
    case "console":
    default:
      return new ConsoleOtpProvider();
  }
}
