import { PLATFORM_ACTIONS, PLATFORM_ROLES } from "@murafaa/auth";
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

export const platformRole = z.enum(PLATFORM_ROLES);

/** The signed-in operator, with what their role may do (the UI hides the rest; the API enforces). */
export const platformMe = z
  .object({ name: z.string(), role: platformRole, actions: z.array(z.enum(PLATFORM_ACTIONS)) })
  .meta({ id: "PlatformMe" });

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

// ── فريق المنصة ──

export const platformMember = z
  .object({
    id: z.uuid(),
    name: z.string(),
    /** Masked: only the last digits. */
    phone: z.string(),
    role: platformRole,
    status: z.enum(["ACTIVE", "PENDING", "DISABLED"]),
    lastLoginAt: z.iso.datetime().nullable(),
    isSelf: z.boolean(),
  })
  .meta({ id: "PlatformMember" });
export const platformTeam = z.array(platformMember).meta({ id: "PlatformTeam" });

export const platformInviteBody = z
  .object({ name: z.string().trim().min(2).max(120), phone: saudiPhone, role: platformRole })
  .meta({ id: "PlatformInviteBody" });

export const platformUpdateMemberBody = z
  .object({ role: platformRole.optional(), isActive: z.boolean().optional() })
  .refine((b) => b.role !== undefined || b.isActive !== undefined, {
    message: "errors.VALIDATION_FAILED",
  })
  .meta({ id: "PlatformUpdateMemberBody" });

/** The activation link, shown once to whoever invited the member. */
export const platformInviteLink = z
  .object({ id: z.uuid(), link: z.url(), expiresAt: z.iso.datetime() })
  .meta({ id: "PlatformInviteLink" });

// ── Activation (public, token-gated) ──

const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const platformActivateBody = z
  .object({ token: inviteToken })
  .meta({ id: "PlatformActivateBody" });
export const platformActivateOtpResponse = z
  .object({ name: z.string(), phone: z.string(), devCode: sixDigits.optional() })
  .meta({ id: "PlatformActivateOtpResponse" });
export const platformActivateVerifyBody = z
  .object({ token: inviteToken, code: sixDigits })
  .meta({ id: "PlatformActivateVerifyBody" });
/** The new authenticator secret, shown only in the member's own browser after the OTP. */
export const platformActivateEnrolment = z
  .object({ qrSvg: z.string(), setupKey: z.string() })
  .meta({ id: "PlatformActivateEnrolment" });
export const platformActivateConfirmBody = z
  .object({ token: inviteToken, totp: sixDigits })
  .meta({ id: "PlatformActivateConfirmBody" });
