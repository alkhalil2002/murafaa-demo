import { prisma } from "@/lib/db";
import type { OtpChannel, OtpDeliveryProvider } from "./otp-provider";

/**
 * Hand the code to the provider, and undo the challenge if delivery failed.
 *
 * Shared by all four OTP surfaces (staff, client portal, employee portal,
 * platform admin) so a vendor outage behaves identically on each.
 *
 * Two things this exists to get right:
 *
 *  1. A failed send must not become a 500. Before this, a provider throw
 *     escaped the route handler and the user saw an untranslated server error
 *     on the login screen — the one screen where every visitor is signed out
 *     and has no other way in. It is now an ordinary failure result.
 *
 *  2. A failed send must not start the resend cooldown. The challenge row has
 *     to be written BEFORE sending (otherwise a code could arrive that we
 *     cannot verify), but leaving a dead row behind means the user's natural
 *     response to "no code arrived" — press resend — is answered with
 *     RATE_LIMITED for a code that was never delivered. Deleting it restores
 *     the state as if the attempt never happened.
 */
export async function deliverOtp(
  provider: OtpDeliveryProvider,
  phone: string,
  code: string,
  channel: OtpChannel,
  challengeId: string,
): Promise<boolean> {
  try {
    await provider.send(phone, code, channel);
    return true;
  } catch (err) {
    // Never log `code`. The reason is diagnostic and vendor-supplied; the
    // provider is responsible for keeping credentials out of it.
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[otp] delivery failed via ${provider.name} to ${phone}: ${reason}`);
    await prisma.otpChallenge.delete({ where: { id: challengeId } }).catch(() => {
      // Best effort. A surviving row only costs the user one cooldown window.
    });
    return false;
  }
}
