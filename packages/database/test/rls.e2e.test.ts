import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle, withTenant } from "../src/client.js";
import { runMigrations } from "../src/migrator.js";
import { auditLog, offices, users } from "../src/schema/index.js";

/**
 * Proves tenant isolation is enforced by Postgres, not by app code: the app
 * login (a member of murafaa_app) can only see and write its own office's rows.
 */

const OWNER_URL =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  "postgres://murafaa:murafaa@localhost:5440/murafaa_test";
const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://murafaa_api:murafaa_api@localhost:5440/murafaa_test";

const OFFICE_A = "aaaaaaaa-0000-4000-8000-000000000001";
const OFFICE_B = "bbbbbbbb-0000-4000-8000-000000000002";

let owner: ReturnType<typeof postgres>;

/** Drizzle wraps driver errors ("Failed query: …"); the Postgres reason is in `cause`. */
async function pgErrorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return err.cause?.message ?? err.message;
  }
  throw new Error("expected the query to fail");
}
let app: DbHandle;

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  owner = postgres(OWNER_URL, { max: 1 });
  await owner`truncate audit_log, outbox, users, offices cascade`;
  // The owner is subject to FORCE RLS too, so seed each office inside its own scope.
  for (const [office, phone] of [
    [OFFICE_A, "+966500000001"],
    [OFFICE_B, "+966500000002"],
  ] as const) {
    await owner.begin(async (tx) => {
      await tx`select set_config('app.office_id', ${office}, true)`;
      await tx`insert into offices (id, name) values (${office}, ${"office " + office.slice(0, 1)})`;
      await tx`insert into users (office_id, name, phone, role) values (${office}, 'u', ${phone}, 'PARTNER')`;
    });
  }
  app = createDb(APP_URL, { max: 2 });
});

afterAll(async () => {
  await app?.close();
  await owner?.end();
});

describe("row-level security", () => {
  it("is enabled, forced and has a policy on every public table", async () => {
    const rows = await owner<
      { relname: string; rls: boolean; forced: boolean; policies: number }[]
    >`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r, r.relname).toMatchObject({ rls: true, forced: true });
    for (const r of rows) expect(r.policies, r.relname).toBeGreaterThan(0);
  });

  it("returns nothing when no office is set (fails closed)", async () => {
    expect(await app.db.select().from(users)).toHaveLength(0);
    expect(await app.db.select().from(offices)).toHaveLength(0);
  });

  it("shows only the current office's rows", async () => {
    const seen = await withTenant(app.db, OFFICE_A, (tx) => tx.select().from(users));
    expect(seen.map((u) => u.officeId)).toEqual([OFFICE_A]);
    const office = await withTenant(app.db, OFFICE_A, (tx) => tx.select().from(offices));
    expect(office.map((o) => o.id)).toEqual([OFFICE_A]);
  });

  it("rejects writes into another office", async () => {
    const reason = await pgErrorOf(
      withTenant(app.db, OFFICE_A, (tx) =>
        tx
          .insert(users)
          .values({ officeId: OFFICE_B, name: "x", phone: "+966500000009", role: "LAWYER" }),
      ),
    );
    expect(reason).toMatch(/row-level security/);
  });

  it("cannot update another office's rows", async () => {
    const updated = await withTenant(app.db, OFFICE_A, (tx) =>
      tx.update(users).set({ name: "hijacked" }).where(eq(users.officeId, OFFICE_B)).returning(),
    );
    expect(updated).toHaveLength(0);
  });

  it("keeps the office setting local to the transaction", async () => {
    await withTenant(app.db, OFFICE_A, async () => undefined);
    const [row] = await app.db.execute<{ v: string | null }>(
      sql`select nullif(current_setting('app.office_id', true), '') as v`,
    );
    expect(row?.v ?? null).toBeNull();
  });

  it("has no DELETE privilege and an append-only audit log", async () => {
    expect(
      await pgErrorOf(
        withTenant(app.db, OFFICE_A, (tx) => tx.delete(users).where(eq(users.officeId, OFFICE_A))),
      ),
    ).toMatch(/permission denied/);
    await withTenant(app.db, OFFICE_A, (tx) =>
      tx.insert(auditLog).values({ officeId: OFFICE_A, action: "test", entity: "users" }),
    );
    expect(
      await pgErrorOf(
        withTenant(app.db, OFFICE_A, (tx) => tx.update(auditLog).set({ action: "tampered" })),
      ),
    ).toMatch(/permission denied/);
  });
});
