import { cache as reactCache } from "react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { effectiveRole } from "@/lib/permissions/engine";
import {
  resolveTerms,
  sanitizeTermOverrides,
  defaultTerms,
  type Terms,
} from "@/lib/i18n/glossary";

/**
 * Per-office terminology, resolved once per request.
 *
 * Nav renders these on every page, so a naive implementation would query the
 * office once per label. React's `cache()` scopes memoisation to a single
 * request — the same reason `getAccess` in server/subscription.ts uses it, and
 * for the same reason a module-level Map would be wrong here: that cache is
 * per-process, so one tenant's terminology would leak into another tenant's
 * page for the lifetime of the container.
 */
const loadTerms = reactCache(async (officeId: string): Promise<Terms> => {
  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { branding: true },
  });
  const branding = office?.branding;
  const stored =
    branding && typeof branding === "object" && !Array.isArray(branding)
      ? (branding as Record<string, unknown>).terms
      : null;
  return resolveTerms(stored);
});

export function getTerms(officeId: string): Promise<Terms> {
  return loadTerms(officeId);
}

/** For surfaces with no office in scope (signup, platform admin). */
export { defaultTerms };

/**
 * Persist an office's renamed terms.
 *
 * PARTNER_ONLY, like the other office-wide settings. Merged into the existing
 * branding object rather than replacing it — branding also carries the
 * letterhead fields, and overwriting the column would wipe them.
 */
export async function updateOfficeTerms(
  session: AppSession,
  raw: Record<string, unknown>,
): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const terms = sanitizeTermOverrides(raw);

  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { branding: true },
  });
  const existing =
    office.branding && typeof office.branding === "object" && !Array.isArray(office.branding)
      ? (office.branding as Record<string, unknown>)
      : {};

  await prisma.office.update({
    where: { id: session.officeId },
    data: { branding: { ...existing, terms } },
  });
  await logAudit({
    session,
    action: "office.terms.update",
    resource: "offices",
    targetId: session.officeId,
  });
}
