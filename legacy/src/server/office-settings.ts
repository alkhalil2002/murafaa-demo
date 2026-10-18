import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { effectiveRole } from "@/lib/permissions/engine";
import { resolveBranding, type OfficeBranding } from "@/lib/pdf/letterhead";

/**
 * إعدادات المكتب (docs/05 `settings`) — office name/branding that already
 * feeds every generated PDF letterhead (src/lib/pdf/letterhead.ts) but had
 * no edit UI, so every office was stuck on DEFAULT_BRANDING forever.
 * Partner-only, like the other office-wide settings (IP allowlist, recycle
 * bin purge).
 */

export async function getOfficeBranding(session: AppSession): Promise<OfficeBranding> {
  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { branding: true, name: true },
  });
  return resolveBranding(office.branding ?? { name: office.name });
}

const brandingSchema = z.object({
  name: z.string().trim().min(1),
  tagline: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim(),
  website: z.string().trim(),
  address: z.string().trim(),
  licenseNo: z.string().trim(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
  confidentialityNotice: z.string().trim(),
});
export type UpdateOfficeBrandingInput = z.input<typeof brandingSchema>;

export async function updateOfficeBranding(session: AppSession, raw: UpdateOfficeBrandingInput): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const input = brandingSchema.parse(raw);
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { branding: true } });
  const merged = { ...resolveBranding(office.branding), ...input };
  await prisma.office.update({
    where: { id: session.officeId },
    data: { name: input.name, branding: merged },
  });
  await logAudit({ session, action: "office.branding.update", resource: "offices", targetId: session.officeId });
}
