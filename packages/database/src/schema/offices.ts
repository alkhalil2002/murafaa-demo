import { pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";

/** The tenant root. A session sees only its own office row. */
export const offices = pgTable(
  "offices",
  {
    id,
    name: text("name").notNull(),
    /** Office IP allowlist (exact IPv4/IPv6 or IPv4 CIDR). Empty = unrestricted. */
    ipAllowlist: text("ip_allowlist")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ...timestamps,
    ...audit,
  },
  () => [tenantPolicy("id")],
).enableRLS();
