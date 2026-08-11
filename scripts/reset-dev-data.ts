/**
 * Dev-only: wipe all APP ROWS (keeping the schema + migration history) so the
 * seed can repopulate a clean state.
 *
 * This used to be a hand-maintained list of `deleteMany()` calls in FK order.
 * That list rotted — 13 tables added by later phases (attendance, candidates,
 * case_approvals, case_executions, case_messages, client_approval_requests,
 * client_communications, contracts, execution_procedures,
 * integration_connections, office_performance_weights, performance_events,
 * procedure_requests) were never added, so the script died on a foreign-key
 * violation (`performance_events_user_id_fkey`) before reaching `office`.
 *
 * It now discovers every table from information_schema and truncates them in a
 * single CASCADE statement, so tables added by future migrations are handled
 * automatically and FK order stops mattering. The seed rebuilds the global
 * reference data (Najiz taxonomy, KB corpus, system document templates) on its
 * next run — those seeders execute before the "office already seeded" check.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Never truncated: Prisma's own migration ledger. */
const KEEP = new Set(["_prisma_migrations"]);

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (!isLocal && process.env.ALLOW_REMOTE_RESET !== "1") {
    throw new Error(
      "reset-dev-data refuses to run: DATABASE_URL does not point at localhost. " +
        "This script deletes every application row. If you really mean to run it " +
        "against a remote database, set ALLOW_REMOTE_RESET=1.",
    );
  }
}

async function main() {
  assertLocalDatabase();

  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  const targets = rows.map((r) => r.tablename).filter((t) => !KEEP.has(t));
  if (targets.length === 0) {
    console.info("No application tables found; nothing to do.");
    return;
  }

  // One statement so CASCADE resolves every FK between them at once.
  const list = targets.map((t) => `"public"."${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  console.info(`Cleared ${targets.length} app tables (schema + migrations kept).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
