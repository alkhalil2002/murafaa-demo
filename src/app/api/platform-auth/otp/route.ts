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
  return fail({ code: "INVALID" }, 400);
}
