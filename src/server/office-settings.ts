import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { effectiveRole } from "@/lib/permissions/engine";
import { resolveBranding, type OfficeBranding } from "@/lib/pdf/letterhead";
import { documentKey, getStorage } from "@/lib/storage";

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

const LOGO_MIME_ALLOW = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Reads the stored logo bytes back as a `data:` URI for embedding — in the
 * PDF letterhead (no network access there) and as an on-screen preview in
 * Settings. Never throws: a missing/corrupted object degrades to no logo
 * rather than breaking the page or a generated document. */
export async function resolveLogoDataUri(branding: OfficeBranding): Promise<string | null> {
  if (!branding.logoStorageKey) return null;
  try {
    const bytes = await getStorage().get(branding.logoStorageKey);
    const mime = branding.logoMimeType || "image/png";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function uploadOfficeLogo(
  session: AppSession,
  file: { fileName: string; mimeType: string; bytes: Buffer },
): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  if (!LOGO_MIME_ALLOW.has(file.mimeType)) throw new Error("LOGO_MIME_REJECTED");
  if (file.bytes.length === 0 || file.bytes.length > MAX_LOGO_BYTES) throw new Error("LOGO_SIZE_REJECTED");
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { branding: true } });
  const current = resolveBranding(office.branding);
  const storageKey = documentKey({
    officeId: session.officeId,
    caseId: null,
    documentId: randomUUID(),
    filename: file.fileName,
  });
  await getStorage().put(storageKey, file.bytes, file.mimeType);
  const oldKey = current.logoStorageKey;
  const merged = { ...current, logoStorageKey: storageKey, logoMimeType: file.mimeType };
  await prisma.office.update({ where: { id: session.officeId }, data: { branding: merged } });
  if (oldKey) await getStorage().delete(oldKey).catch(() => {});
  await logAudit({ session, action: "office.branding.logoUpload", resource: "offices", targetId: session.officeId });
}

export async function removeOfficeLogo(session: AppSession): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { branding: true } });
  const current = resolveBranding(office.branding);
  if (!current.logoStorageKey) return;
  const oldKey = current.logoStorageKey;
  const merged = { ...current, logoStorageKey: null, logoMimeType: null };
  await prisma.office.update({ where: { id: session.officeId }, data: { branding: merged } });
  await getStorage().delete(oldKey).catch(() => {});
  await logAudit({ session, action: "office.branding.logoRemove", resource: "offices", targetId: session.officeId });
}
