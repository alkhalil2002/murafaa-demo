import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api/response";
import { normalizeSaudiPhone } from "@/lib/auth/phone";

const schema = z.object({ phone: z.string().min(1) });

/** POST /api/auth/2fa-status — whether this staff phone has TOTP 2FA enabled,
 * so the login form can show the code field before the user submits it (and
 * so an unaware client fails once, not by burning the OTP challenge). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail({ code: "VALIDATION", fields: parsed.error.flatten().fieldErrors }, 422);

  const phone = normalizeSaudiPhone(parsed.data.phone);
  if (!phone) return ok({ required: false });

  const candidates = await prisma.user.findMany({
    where: { phone, isActive: true, deletedAt: null },
    select: { totpEnabled: true },
  });
  const required = candidates.length === 1 && candidates[0]!.totpEnabled;
  return ok({ required });
}
