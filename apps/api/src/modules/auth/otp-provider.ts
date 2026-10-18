import { Logger } from "@nestjs/common";

/** OTP delivery adapter (docs/02 §7: integrations sit behind a uniform interface). */
export type OtpChannel = "sms" | "whatsapp";

export interface OtpProvider {
  readonly name: "console" | "unifonic";
  send(phone: string, code: string, channel: OtpChannel): Promise<void>;
}

/** Development only: logs the code and sends nothing. Boot refuses it in production. */
export class ConsoleOtpProvider implements OtpProvider {
  readonly name = "console";
  private readonly logger = new Logger("OtpConsole");

  async send(phone: string, code: string, channel: OtpChannel): Promise<void> {
    this.logger.log(`[otp:console] ${channel} → ${phone}: ${code}`);
  }
}

/**
 * Unifonic (Saudi SMS/WhatsApp), as in legacy: not connected yet. It fails
 * loudly instead of pretending to send (no fabricated integrations).
 */
export class UnifonicOtpProvider implements OtpProvider {
  readonly name = "unifonic";

  async send(): Promise<void> {
    throw new Error(
      "Unifonic OTP provider is not configured yet (docs/02 §14). Use OTP_PROVIDER=console in development.",
    );
  }
}

export const OTP_PROVIDER = Symbol("OTP_PROVIDER");
