import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { sendPlatformOtp } from "@/lib/auth/platform-otp";

const schema = z.object({ phone: z.string().min(1) });

/** POST /api/platform-auth/otp — request a platform-admin login code. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail({ code: "VALIDATION" }, 422);

  const result = await sendPlatformOtp(parsed.data.phone);
  if (result.ok) return ok({ sent: true, devCode: result.devCode });

  // ADMIN_NOT_FOUND is reported as a generic failure: this endpoint is public,
  // and a distinct response would let anyone enumerate which numbers are
  // platform staff.
  if (result.code === "RATE_LIMITED") return fail({ code: result.code }, 429);
  // Adds no enumeration signal that 200-vs-400 above does not already give:
  // a valid admin number returns 200 and an unknown one returns 400, so this
  // endpoint is already distinguishable. (Closing that gap means returning an
  // identical response in both cases — a deliberate change to admin login, not
  // something to slip in here.)
  if (result.code === "DELIVERY_FAILED") return fail({ code: result.code }, 502);
  return fail({ code: "INVALID" }, 400);
}
