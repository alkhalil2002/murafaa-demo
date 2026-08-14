import { GcsStorageDriver } from "./gcs";
import { LocalStorageDriver } from "./local";
import type { StorageDriver } from "./types";

export * from "./types";

/**
 * Resolve the active storage driver from config. Dev/test default to the local
 * filesystem so `npm run dev` needs no cloud credentials; production sets
 * STORAGE_DRIVER=gcs + GCS_BUCKET (Dammam / me-central2). Callers depend only
 * on the StorageDriver interface, never on the concrete driver.
 */
let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "volume") {
    // Same filesystem driver as "local" — the distinct name is the point. It
    // is the operator's explicit statement that STORAGE_LOCAL_DIR is a mounted
    // persistent disk, which is what lets the startup guard tell a deliberate
    // volume deployment apart from a production deploy that simply forgot to
    // configure storage and would silently discard every document.
    const dir = process.env.STORAGE_LOCAL_DIR;
    if (!dir) throw new Error("STORAGE_MISCONFIGURED: STORAGE_LOCAL_DIR is required when STORAGE_DRIVER=volume");
    cached = new LocalStorageDriver(dir);
    return cached;
  }
  if (driver === "gcs") {
    const bucket = process.env.GCS_BUCKET;
    if (!bucket) throw new Error("STORAGE_MISCONFIGURED: GCS_BUCKET is required when STORAGE_DRIVER=gcs");
    cached = new GcsStorageDriver(bucket);
  } else {
    cached = new LocalStorageDriver(process.env.STORAGE_LOCAL_DIR);
  }
  return cached;
}

/** Test hook to reset the memoized driver. */
export function __resetStorage(): void {
  cached = null;
}
