/**
 * OTP delivery adapter (docs/02 §7 — integrations are adapters behind a uniform
 * interface). The real Saudi provider (Unifonic / WhatsApp Business) plugs in
 * here later without touching call sites. Dev uses the console provider.
 */
export type OtpChannel = "sms" | "whatsapp";

export interface OtpDeliveryProvider {
  readonly name: string;
  send(phone: string, code: string, channel: OtpChannel): Promise<void>;
}

/** Dev provider: prints the code to the server log, sends nothing. */
class ConsoleOtpProvider implements OtpDeliveryProvider {
  readonly name = "console";
  async send(phone: string, code: string, channel: OtpChannel): Promise<void> {
    console.info(`[otp:console] ${channel} → ${phone}: ${code}`);
  }
}

/** Placeholder for the real provider — wired up in the integrations phase. */
class UnifonicOtpProvider implements OtpDeliveryProvider {
  readonly name = "unifonic";
  async send(): Promise<void> {
    throw new Error(
      "Unifonic OTP provider not configured yet (see docs/02 §14). Set OTP_PROVIDER=console for dev.",
    );
  }
}

export function getOtpProvider(): OtpDeliveryProvider {
  const which = process.env.OTP_PROVIDER ?? "console";
  switch (which) {
    case "unifonic":
      return new UnifonicOtpProvider();
    case "console":
    default:
      return new ConsoleOtpProvider();
  }
}
