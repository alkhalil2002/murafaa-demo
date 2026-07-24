import { promises as fs } from "node:fs";
import path from "node:path";
import type { PutResult, StorageDriver } from "./types";

/**
 * Local-filesystem storage driver for development. Writes under `.storage/`
 * (gitignored) at the project root, mirroring the object-key path. NOT for
 * production — prod uses the GCS driver (Dammam).
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), ".storage");
  }

  private resolve(key: string): string {
    // Prevent traversal outside baseDir.
    const target = path.resolve(this.baseDir, key);
    if (!target.startsWith(path.resolve(this.baseDir) + path.sep)) {
      throw new Error("STORAGE_INVALID_KEY");
    }
    return target;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return { key, size: data.length, contentType };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
