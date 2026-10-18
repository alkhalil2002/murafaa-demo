import { promises as fs } from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import type { Env } from "../../config/env.js";

/**
 * Where document bytes live (legacy lib/storage). Production: a Google Cloud
 * Storage bucket in me-central2 (PDPL residency). Development: the local disk.
 * Bytes always flow through an authorized, audited API route; no bucket URL
 * or credential ever reaches a client.
 */
export interface DocumentStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Throws when the object is missing. */
  get(key: string): Promise<Buffer>;
  /** No-op when the object is missing. */
  delete(key: string): Promise<void>;
}

export const DOCUMENT_STORAGE = Symbol("DOCUMENT_STORAGE");

/** Strip path separators and traversal; keep a readable name. */
export function sanitizeFilename(name: string): string {
  const base = name
    .replace(/[/\\]/g, "_")
    .replace(/\.\.+/g, "_")
    .replace(/\p{Cc}/gu, "")
    .trim();
  return (base || "file").slice(0, 200);
}

/** Office- and case-scoped object key, so tenancy is visible in the path. */
export function documentKey(p: {
  officeId: string;
  caseId: string | null;
  documentId: string;
  fileName: string;
}) {
  const scope = p.caseId ? `cases/${p.caseId}` : "office";
  return `offices/${p.officeId}/${scope}/documents/${p.documentId}/${sanitizeFilename(p.fileName)}`;
}

export class LocalStorage implements DocumentStorage {
  private readonly base: string;

  constructor(dir: string) {
    this.base = path.resolve(dir);
  }

  private resolve(key: string) {
    const target = path.resolve(this.base, key);
    if (!target.startsWith(this.base + path.sep)) throw new Error("STORAGE_INVALID_KEY");
    return target;
  }

  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  get(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

export class GcsStorage implements DocumentStorage {
  private readonly bucket;

  constructor(bucketName: string) {
    // Credentials come from the Cloud Run service account (workload identity).
    this.bucket = new Storage().bucket(bucketName);
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.bucket.file(key).save(data, { contentType, resumable: false });
  }

  async get(key: string) {
    const [buf] = await this.bucket.file(key).download();
    return buf;
  }

  async delete(key: string) {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}

export function storageFor(env: Env): DocumentStorage {
  return env.STORAGE_DRIVER === "gcs"
    ? new GcsStorage(env.GCS_BUCKET!)
    : new LocalStorage(env.STORAGE_LOCAL_DIR);
}
