import { sql } from "drizzle-orm";
import { pgPolicy, pgRole, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Column helpers every table uses (CLAUDE.md conventions): UUID id, created/
 * updated/deleted timestamps (soft delete) and created/updated by.
 */

export const id = uuid("id").primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const audit = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

/**
 * The role the API connects as (via a LOGIN member such as murafaa_api). It
 * does not own the tables, so row-level security always applies to it.
 * Created by migration 0000.
 */
export const appRole = pgRole("murafaa_app").existing();

/**
 * The office the current transaction is scoped to, set by withTenant(). An
 * unset value is NULL, which matches no rows — the policy fails closed.
 */
export const currentOffice = sql`nullif(current_setting('app.office_id', true), '')::uuid`;

/** Tenant isolation policy: rows are visible and writable only for the current office. */
export function tenantPolicy(column: "office_id" | "id" = "office_id") {
  const match = sql`${sql.identifier(column)} = ${currentOffice}`;
  return pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    to: appRole,
    using: match,
    withCheck: match,
  });
}
