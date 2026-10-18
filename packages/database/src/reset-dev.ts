import postgres from "postgres";

/**
 * Development only (legacy scripts/reset-dev-data.ts): empty every app table,
 * keeping the schema and migration history, so `pnpm db:seed` starts clean.
 * Refuses anything but a database on this machine.
 */
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) || process.env.NODE_ENV === "production") {
  throw new Error(
    `refusing to reset ${host}: db:reset only runs against a local development database`,
  );
}

const sql = postgres(url, { max: 1 });
try {
  const tables = await sql<{ name: string }[]>`
    select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`;
  if (tables.length) await sql.unsafe(`truncate ${tables.map((t) => t.name).join(", ")} cascade`);
  console.log(`emptied ${tables.length} tables on ${host}; run pnpm db:seed next`);
} finally {
  await sql.end();
}
