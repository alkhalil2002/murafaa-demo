import { PermLevel, PermModule, Role, SCREEN_ACCESS } from "@murafaa/auth";
import { normalizeSaudiPhone } from "@murafaa/rules";
import { z } from "zod";

/** A Saudi mobile number in any common format, normalized to E.164 (+9665XXXXXXXX). */
export const saudiPhone = z
  .string()
  .trim()
  .max(20)
  .transform((value, ctx) => {
    const phone = normalizeSaudiPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "auth.error.phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  });

const sixDigits = z.string().regex(/^\d{6}$/);

export const role = z.enum(Object.values(Role));
export const permModule = z.enum(Object.values(PermModule));
export const permLevel = z.enum(Object.values(PermLevel));
export const screen = z.enum(Object.keys(SCREEN_ACCESS) as [keyof typeof SCREEN_ACCESS]);

export const requestOtpBody = z
  .object({ phone: saudiPhone, channel: z.enum(["sms", "whatsapp"]).default("whatsapp") })
  .meta({ id: "RequestOtpBody" });

/**
 * Always `sent: true`, whether or not the number is registered, so the
 * endpoint can't be used to discover users. `devCode` only with the console
 * provider (local development).
 */
export const requestOtpResponse = z
  .object({ sent: z.literal(true), devCode: sixDigits.optional() })
  .meta({ id: "RequestOtpResponse" });

export const verifyOtpBody = z
  .object({ phone: saudiPhone, code: sixDigits, totp: sixDigits.optional() })
  .meta({ id: "VerifyOtpBody" });

export const sessionUser = z
  .object({
    id: z.uuid(),
    officeId: z.uuid(),
    name: z.string(),
    role,
    /** Set while a partner previews another role (view-only). */
    previewRole: role.nullable(),
  })
  .meta({ id: "SessionUser" });

/** Mobile clients (X-Client-Type: mobile) get the token in the body; web gets an httpOnly cookie only. */
export const verifyOtpResponse = z
  .object({ user: sessionUser, token: z.string().optional() })
  .meta({ id: "VerifyOtpResponse" });

export const me = z
  .object({
    user: sessionUser,
    /** readOnly: suspended by إدارة المنصة; the API refuses every write. */
    office: z.object({ id: z.uuid(), name: z.string(), readOnly: z.boolean() }),
    /** Screens this session may open (docs/04 layer 1, effective role). */
    screens: z.array(screen),
    /** Effective module levels, for hiding controls; the API still enforces. */
    modules: z.record(permModule, permLevel),
    /** The REAL role is partner (role preview does not change this). */
    isPartner: z.boolean(),
    /** The caller's own login phone (E.164), for the account panel. */
    phone: z.string(),
  })
  .meta({ id: "Me" });
export type Me = z.infer<typeof me>;
