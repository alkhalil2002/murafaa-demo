import type { PutResult, StorageDriver } from "./types";

/**
 * Google Cloud Storage driver (production, Dammam / me-central2 bucket for PDPL
 * residency). The SDK is an OPTIONAL dependency installed only in production
 * images, so it is loaded via a non-literal dynamic import (a truly optional
 * require) — the dev build never needs it present. Configure via GCS_BUCKET
 * (+ GOOGLE_APPLICATION_CREDENTIALS / workload identity). Credentials never
 * reach the client — bytes are streamed through an authorized server route.
 */

type GcsFile = {
  save: (data: Buffer, opts: { contentType: string; resumable: boolean }) => Promise<void>;
  download: () => Promise<[Buffer]>;
  delete: (opts: { ignoreNotFound: boolean }) => Promise<unknown>;
  exists: () => Promise<[boolean]>;
};
type GcsBucket = { file: (key: string) => GcsFile };

export class GcsStorageDriver implements StorageDriver {
  private readonly bucketName: string;
  private bucketPromise: Promise<GcsBucket> | null = null;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  private async bucket(): Promise<GcsBucket> {
    if (!this.bucketPromise) {
      this.bucketPromise = (async () => {
        // Non-literal specifier: keeps the optional SDK out of the build graph.
        const moduleName = "@google-cloud/storage";
        const mod = (await import(moduleName)) as unknown as {
          Storage: new () => { bucket: (name: string) => GcsBucket };
        };
        return new mod.Storage().bucket(this.bucketName);
      })();
    }
    return this.bucketPromise;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
    const bucket = await this.bucket();
    await bucket.file(key).save(data, { contentType, resumable: false });
    return { key, size: data.length, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const bucket = await this.bucket();
    const [buf] = await bucket.file(key).download();
    return buf;
  }

  async delete(key: string): Promise<void> {
    const bucket = await this.bucket();
    await bucket.file(key).delete({ ignoreNotFound: true });
  }

  async exists(key: string): Promise<boolean> {
    const bucket = await this.bucket();
    const [ok] = await bucket.file(key).exists();
    return ok;
  }
}
