import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

/** Office letterhead branding (legacy settings → office). */
export const officeBranding = z
  .object({
    name: z.string().trim().min(1).max(200),
    tagline: z.string().trim().max(200),
    phone: z.string().trim().max(40),
    email: z.string().trim().max(200),
    website: z.string().trim().max(200),
    address: z.string().trim().max(300),
    licenseNo: z.string().trim().max(100),
    primaryColor: hexColor,
    accentColor: hexColor,
    confidentialityNotice: z.string().trim().max(1000),
  })
  .meta({ id: "OfficeBranding" });
export type OfficeBrandingDto = z.infer<typeof officeBranding>;

export const securityStatus = z
  .object({ totpEnabled: z.boolean(), phone: z.string() })
  .meta({ id: "SecurityStatus" });

/** A new TOTP secret to add to an authenticator app; valid for 10 minutes until confirmed. */
export const totpEnrollment = z
  .object({ secret: z.string(), uri: z.string() })
  .meta({ id: "TotpEnrollment" });

export const totpCodeBody = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .meta({ id: "TotpCodeBody" });

/** Office IP allowlist: exact IPv4/IPv6 addresses or IPv4 CIDR blocks. Empty = unrestricted. */
export const ipAllowlist = z
  .object({ entries: z.array(z.string().trim().min(1).max(64)).max(100) })
  .meta({ id: "IpAllowlist" });

/** Recycle bin (soft-deleted records the caller may see). Kinds register as their modules are rebuilt. */
export const recycleItem = z
  .object({
    kind: z.enum(["case", "lead", "document", "employee"]),
    id: z.uuid(),
    label: z.string(),
    deletedAt: z.iso.datetime(),
  })
  .meta({ id: "RecycleItem" });
export const recycleBin = z.array(recycleItem).meta({ id: "RecycleBin" });

/**
 * الباقات (legacy /billing): a real usage summary, not invented plans — there
 * is no payment gateway. Counts for modules not rebuilt yet are 0 because
 * those records don't exist yet.
 */
export const billingUsage = z
  .object({
    seats: z.number().int(),
    cases: z.number().int(),
    clients: z.number().int(),
    documents: z.number().int(),
    memberSince: z.iso.datetime(),
  })
  .meta({ id: "BillingUsage" });
