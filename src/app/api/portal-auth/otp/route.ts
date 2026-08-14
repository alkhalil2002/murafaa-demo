import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { sendClientOtp } from "@/lib/auth/portal-otp";

const schema = z.object({
  phone: z.string().min(1),
  channel: z.enum(["sms", "whatsapp"]).optional(),
});

/** POST /api/portal-auth/otp — request an OTP code for a client-portal phone number. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION", fields: parsed.error.flatten().fieldErrors }, 422);
  }

  const result = await sendClientOtp(parsed.data.phone, parsed.data.channel ?? "whatsapp");
  if (result.ok) return ok({ sent: true, devCode: result.devCode });

  switch (result.code) {
    case "PHONE_INVALID":
      return fail({ code: result.code, messageKey: "auth.error.phoneInvalid" }, 422);
    case "CLIENT_NOT_FOUND":
      return fail({ code: result.code, messageKey: "auth.error.userNotFound" }, 404);
    case "RATE_LIMITED":
      return fail({ code: result.code, messageKey: "auth.otp.rateLimited" }, 429);
    case "DELIVERY_FAILED":
      // 502: our side is fine, the WhatsApp webhook is not. Distinct from a
      // 500 so uptime checks attribute the failure to the vendor.
      return fail({ code: result.code, messageKey: "auth.otp.deliveryFailed" }, 502);
    default:
      return fail({ code: "GENERIC", messageKey: "auth.error.generic" }, 400);
  }
}
