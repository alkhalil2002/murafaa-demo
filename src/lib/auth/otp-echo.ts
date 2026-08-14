import type { OtpDeliveryProvider } from "./otp-provider";

/**
 * Whether the freshly generated code may be echoed back in the HTTP response.
 *
 * This is a convenience for local development: the console provider delivers
 * nowhere, so returning the code saves a trip to the server log.
 *
 * It is also, in production, a complete authentication bypass. The OTP request
 * endpoint is unauthenticated by necessity — it is how a signed-out user starts
 * logging in — so echoing the code hands anyone who can guess a phone number a
 * valid session as that user. Observed live: a staging deploy running
 * OTP_PROVIDER=console answered an anonymous POST with
 * {"sent":true,"devCode":"470453"} for a seeded partner account.
 *
 * The provider check alone was not enough, because "console in production" is a
 * configuration we deliberately support for internal staging (see
 * src/lib/config/env.ts, which warns about it). NODE_ENV is therefore the
 * deciding factor: outside development the code is never echoed, whatever the
 * provider. Staging reads it from the log like any operator would.
 */
export function mayEchoCode(provider: OtpDeliveryProvider): boolean {
  return provider.name === "console" && process.env.NODE_ENV !== "production";
}
