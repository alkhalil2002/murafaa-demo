/**
 * Upload limits (legacy documents.ts / portal.ts). Enforce on the server; the
 * UI may show the same limits.
 */

/** Staff uploads (case documents). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Client-portal uploads. */
export const MAX_PORTAL_UPLOAD_BYTES = 20 * 1024 * 1024;

export const UPLOAD_MIME_ALLOW: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Document kinds. LETTER is for generated letterhead documents, not uploads. Labels: docKind.* */
export const DOC_KINDS = ["DOCUMENT", "IMAGE", "TEXT", "FILE", "LETTER"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export function docKindForMime(mime: string): DocKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime === "text/plain") return "TEXT";
  if (mime === "application/pdf") return "DOCUMENT";
  return "FILE";
}

/** Null when the upload is acceptable, else the reason. */
export function uploadRejection(
  file: { mime: string; bytes: number },
  source: "staff" | "portal",
): "type" | "size" | "empty" | null {
  if (!UPLOAD_MIME_ALLOW.has(file.mime)) return "type";
  if (file.bytes <= 0) return "empty";
  const max = source === "portal" ? MAX_PORTAL_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  return file.bytes > max ? "size" : null;
}
