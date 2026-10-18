/**
 * Storage abstraction for document objects (PDFs, uploads). Production stores
 * in Google Cloud Storage (Dammam / me-central2) for PDDL residency; dev uses
 * a local-filesystem driver. Bytes are always served through an AUTHORIZED
 * server route (permission + audit) — raw bucket URLs / credentials are never
 * exposed to the client (docs/02 §9).
 */

export type PutResult = {
  key: string;
  size: number;
  contentType: string;
};

export interface StorageDriver {
  /** Store bytes at key; overwrites. */
  put(key: string, data: Buffer, contentType: string): Promise<PutResult>;
  /** Read bytes at key. Throws if missing. */
  get(key: string): Promise<Buffer>;
  /** Remove object; no-op if missing. */
  delete(key: string): Promise<void>;
  /** Whether an object exists. */
  exists(key: string): Promise<boolean>;
}

/**
 * Object key scheme — office- and case-scoped so tenancy is visible in the
 * path and a stray cross-tenant read is obvious. Never interpolate raw user
 * input beyond the sanitized filename.
 */
export function documentKey(params: {
  officeId: string;
  caseId: string | null;
  documentId: string;
  filename: string;
}): string {
  const safe = sanitizeFilename(params.filename);
  const scope = params.caseId ? `cases/${params.caseId}` : "office";
  return `offices/${params.officeId}/${scope}/documents/${params.documentId}/${safe}`;
}

/** Strip path separators and traversal; keep a reasonable filename. */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\.\.+/g, "_").trim();
  return (base || "file").slice(0, 200);
}
