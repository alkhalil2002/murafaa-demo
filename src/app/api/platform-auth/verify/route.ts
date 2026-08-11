import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { verifyPlatformOtp } from "@/lib/auth/platform-otp";
import { createPlatformSession } from "@/lib/auth/platform-session";

const schema = z.object({ phone: z.string().min(1), code: z.string().min(1) });

/** POST /api/platform-auth/verify — exchange a code for a platform session. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail({ code: "VALIDATION" }, 422);

  const result = await verifyPlatformOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) return fail({ code: result.code }, 401);

  await createPlatformSession({
    adminId: result.admin.id,
    name: result.admin.name,
    phone: result.admin.phone,
  });
  return ok({ signedIn: true });
}
