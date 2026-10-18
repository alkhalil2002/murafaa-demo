import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type DbHandle = { db: Db; close: () => Promise<void> };

/** Connect with a pooled postgres-js client. The API uses a non-owner login (RLS applies). */
export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const client = postgres(url, { max: options.max ?? 10, prepare: false });
  return { db: drizzle(client, { schema, casing: "snake_case" }), close: () => client.end() };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run `fn` in a transaction scoped to one office. The office id is set with
 * set_config(..., is_local = true), so it lasts only for this transaction and
 * cannot leak to the next request that reuses the pooled connection.
 */
export async function withTenant<T>(
  db: Db,
  officeId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(officeId)) throw new Error("withTenant: officeId must be a UUID");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.office_id', ${officeId}, true)`);
    return fn(tx);
  });
}
