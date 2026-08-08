import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { verifyClientOtp } from "@/lib/auth/portal-otp";
import { createPortalSession } from "@/lib/auth/portal-session";

const schema = z.object({ phone: z.string().min(1), code: z.string().min(1) });

/** POST /api/portal-auth/verify — verify an OTP and mint a client-portal session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION", fields: parsed.error.flatten().fieldErrors }, 422);
  }

  const result = await verifyClientOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return fail({ code: result.code, messageKey: "auth.otp.invalid" }, 401);
  }

  await createPortalSession({
    clientId: result.client.id,
    officeId: result.client.officeId,
    name: result.client.name,
    phone: result.client.phone,
  });
  return ok({ verified: true });
}
