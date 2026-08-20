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

const IMAGE_MIME_ALLOW = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024;

/** The two letterhead image slots — a small logo mark (top of the header)
 * and a full-width decorative footer band. Same storage/validation rules,
 * different branding fields, so upload/remove/resolve are shared here
 * rather than duplicated per slot. */
const BRANDING_IMAGE_SLOTS = {
  logo: { keyField: "logoStorageKey", mimeField: "logoMimeType", auditAction: "office.branding.logo" },
  footer: { keyField: "footerImageStorageKey", mimeField: "footerImageMimeType", auditAction: "office.branding.footerImage" },
} as const;
type BrandingImageSlot = keyof typeof BRANDING_IMAGE_SLOTS;

async function resolveBrandingImageDataUri(
  storageKey: string | null | undefined,
  mimeType: string | null | undefined,
): Promise<string | null> {
  if (!storageKey) return null;
  try {
    const bytes = await getStorage().get(storageKey);
    return `data:${mimeType || "image/png"};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Reads the stored logo bytes back as a `data:` URI for embedding — in the
 * PDF letterhead (no network access there) and as an on-screen preview in
 * Settings. Never throws: a missing/corrupted object degrades to no logo
 * rather than breaking the page or a generated document. */
export async function resolveLogoDataUri(branding: OfficeBranding): Promise<string | null> {
  return resolveBrandingImageDataUri(branding.logoStorageKey, branding.logoMimeType);
}

export async function resolveFooterImageDataUri(branding: OfficeBranding): Promise<string | null> {
  return resolveBrandingImageDataUri(branding.footerImageStorageKey, branding.footerImageMimeType);
}

async function uploadBrandingImage(
  session: AppSession,
  slot: BrandingImageSlot,
  file: { fileName: string; mimeType: string; bytes: Buffer },
): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  if (!IMAGE_MIME_ALLOW.has(file.mimeType)) throw new Error("LOGO_MIME_REJECTED");
  if (file.bytes.length === 0 || file.bytes.length > MAX_BRANDING_IMAGE_BYTES) throw new Error("LOGO_SIZE_REJECTED");
  const { keyField, mimeField, auditAction } = BRANDING_IMAGE_SLOTS[slot];
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { branding: true } });
  const current = resolveBranding(office.branding);
  const storageKey = documentKey({
    officeId: session.officeId,
    caseId: null,
    documentId: randomUUID(),
    filename: file.fileName,
  });
  await getStorage().put(storageKey, file.bytes, file.mimeType);
  const oldKey = current[keyField];
  const merged = { ...current, [keyField]: storageKey, [mimeField]: file.mimeType };
  await prisma.office.update({ where: { id: session.officeId }, data: { branding: merged } });
  if (oldKey) await getStorage().delete(oldKey).catch(() => {});
  await logAudit({ session, action: `${auditAction}.upload`, resource: "offices", targetId: session.officeId });
}

async function removeBrandingImage(session: AppSession, slot: BrandingImageSlot): Promise<void> {
  if (effectiveRole(session) !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const { keyField, mimeField, auditAction } = BRANDING_IMAGE_SLOTS[slot];
  const office = await prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { branding: true } });
  const current = resolveBranding(office.branding);
  const oldKey = current[keyField];
  if (!oldKey) return;
  const merged = { ...current, [keyField]: null, [mimeField]: null };
  await prisma.office.update({ where: { id: session.officeId }, data: { branding: merged } });
  await getStorage().delete(oldKey).catch(() => {});
  await logAudit({ session, action: `${auditAction}.remove`, resource: "offices", targetId: session.officeId });
}

export async function uploadOfficeLogo(session: AppSession, file: { fileName: string; mimeType: string; bytes: Buffer }) {
  return uploadBrandingImage(session, "logo", file);
}
export async function removeOfficeLogo(session: AppSession) {
  return removeBrandingImage(session, "logo");
}
export async function uploadOfficeFooterImage(session: AppSession, file: { fileName: string; mimeType: string; bytes: Buffer }) {
  return uploadBrandingImage(session, "footer", file);
}
export async function removeOfficeFooterImage(session: AppSession) {
  return removeBrandingImage(session, "footer");
}
