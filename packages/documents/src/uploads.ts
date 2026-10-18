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

/** Where a document came from (legacy DocSource). Labels: docSource.* */
export const DOC_SOURCES = [
  "OPENING",
  "PROCEDURAL_REQUEST",
  "HEARING",
  "CLIENT",
  "TEMPLATE",
  "UPLOAD",
] as const;
export type DocSource = (typeof DOC_SOURCES)[number];
/** Sources a staff member may pick for an upload (TEMPLATE and CLIENT are set by the system). */
export const STAFF_UPLOAD_SOURCES = ["UPLOAD", "OPENING", "PROCEDURAL_REQUEST", "HEARING"] as const;
/** An attachment's role on a procedural request (legacy ProcedureRequestDocRole). */
export const PROCEDURE_DOC_ROLES = ["REQUEST", "RESULT"] as const;
export type ProcedureDocRole = (typeof PROCEDURE_DOC_ROLES)[number];

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/**
 * Whether the bytes really are the declared type. The browser's declared
 * type is only a hint (legacy trusted it), so an executable renamed to .pdf
 * is refused. Text must be valid UTF-8 without NUL bytes.
 */
export function contentMatchesMime(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // zip container
    case "application/msword":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2
    case "text/plain": {
      if (bytes.includes(0)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return true;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}
