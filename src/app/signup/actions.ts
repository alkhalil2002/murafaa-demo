"use server";

import { registerOffice } from "@/server/registration";
import { sendOtp } from "@/lib/auth/otp";

/**
 * Signup step 1: create the tenant, then issue a login code.
 *
 * The office is created BEFORE the phone is verified because
 * `OtpChallenge.officeId` is a required FK — a code cannot exist without an
 * office to hang it on. The alternative (making that column nullable) would
 * loosen a core auth table for one flow.
 *
 * An abandoned signup therefore leaves an office nobody ever signed into. That
 * is self-limiting rather than harmful: it holds no data, and its trial lapses
 * into read-only after 7+3 days on its own. A periodic sweep of offices with
 * no successful login can reclaim them later if the volume ever matters.
 */
export type SignupState =
  | { step: "form"; error?: string }
  | { step: "verify"; phone: string; devCode?: string };

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const officeName = String(formData.get("officeName") ?? "");
  const adminName = String(formData.get("adminName") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const result = await registerOffice({ officeName, adminName, phone });
  if (!result.ok) {
    return { step: "form", error: result.code };
  }

  // Issue the first login code through the normal path — same rate limit,
  // same hashing, same audit trail as any other sign-in.
  const otp = await sendOtp(phone, "whatsapp");
  return {
    step: "verify",
    phone,
    devCode: otp.ok ? otp.devCode : undefined,
  };
}
