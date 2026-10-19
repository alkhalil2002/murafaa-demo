import { isValidCrNumber, OFFICE_STATUSES } from "@murafaa/rules";
import { z } from "zod";
import { role, saudiPhone } from "./auth.js";

const sixDigits = z.string().regex(/^\d{6}$/);
const day = z.iso.date();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** إدارة المنصة sign-in: an OTP and, always, the authenticator code. */
export const platformVerifyBody = z
  .object({ phone: saudiPhone, code: sixDigits, totp: sixDigits })
  .meta({ id: "PlatformVerifyBody" });

export const platformMe = z.object({ name: z.string() }).meta({ id: "PlatformMe" });

export const officeStatus = z.enum(OFFICE_STATUSES);

/** An office as the platform sees it: metadata and counts, never content. */
export const platformOffice = z
  .object({
    id: z.uuid(),
    name: z.string(),
    status: officeStatus,
    city: z.string().nullable(),
    licenseNumber: z.string().nullable(),
    crNumber: z.string().nullable(),
    trialEndsAt: day.nullable(),
    paidUntil: day.nullable(),
    suspendedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    users: z.number().int(),
    cases: z.number().int(),
    clients: z.number().int(),
    documents: z.number().int(),
    storageBytes: z.number().int(),
    ownerName: z.string().nullable(),
    ownerPhone: z.string().nullable(),
  })
  .meta({ id: "PlatformOffice" });
export const platformOfficeList = z.array(platformOffice).meta({ id: "PlatformOfficeList" });

export const platformAuditRow = z
  .object({
    id: z.uuid(),
    action: z.string(),
    actorName: z.string().nullable(),
    officeId: z.uuid().nullable(),
    officeName: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "PlatformAuditRow" });
export const platformAuditList = z.array(platformAuditRow).meta({ id: "PlatformAuditList" });

export const platformOfficeDetail = platformOffice
  .extend({
    staff: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        role,
        isActive: z.boolean(),
        lastLoginAt: z.iso.datetime().nullable(),
      }),
    ),
    audit: platformAuditList,
  })
  .meta({ id: "PlatformOfficeDetail" });

/** A trial needs its end date; a suspended office is never created. */
export const platformCreateOfficeBody = z
  .object({
    name: z.string().trim().min(2).max(200),
    city: optionalText(80),
    crNumber: optionalText(10).refine((v) => v == null || isValidCrNumber(v), {
      message: "errors.CR_NUMBER_INVALID",
    }),
    licenseNumber: optionalText(40),
    ownerName: z.string().trim().min(2).max(120),
    ownerPhone: saudiPhone,
    status: z.enum(["TRIAL", "ACTIVE"]),
    trialEndsAt: day.nullish().transform((v) => v ?? null),
    paidUntil: day.nullish().transform((v) => v ?? null),
  })
  .refine((b) => b.status !== "TRIAL" || b.trialEndsAt !== null, {
    message: "platform.err.TRIAL_END_REQUIRED",
    path: ["trialEndsAt"],
  })
  .meta({ id: "PlatformCreateOfficeBody" });

export const platformUpdateOfficeBody = z
  .object({
    status: officeStatus,
    trialEndsAt: day.nullish().transform((v) => v ?? null),
    paidUntil: day.nullish().transform((v) => v ?? null),
  })
  .meta({ id: "PlatformUpdateOfficeBody" });
