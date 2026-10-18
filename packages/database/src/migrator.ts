import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";

export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/** Apply all migrations. `ownerUrl` must be the table owner, never the app role. */
export async function runMigrations(ownerUrl: string): Promise<void> {
  const { db, close } = createDb(ownerUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}
