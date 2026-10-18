import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { verifyEmpPortalOtp } from "@/lib/auth/emp-portal-otp";
import { createEmpPortalSession } from "@/lib/auth/emp-portal-session";

const schema = z.object({ phone: z.string().min(1), code: z.string().min(1) });

/** POST /api/emp-portal-auth/verify — verify an OTP and mint an employee-portal session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "VALIDATION", fields: parsed.error.flatten().fieldErrors }, 422);
  }

  const result = await verifyEmpPortalOtp(parsed.data.phone, parsed.data.code);
  if (!result.ok) {
    return fail({ code: result.code, messageKey: "auth.otp.invalid" }, 401);
  }

  await createEmpPortalSession({
    employeeId: result.employee.id,
    officeId: result.employee.officeId,
    name: result.employee.name,
    phone: result.employee.phone,
  });
  return ok({ verified: true });
}
