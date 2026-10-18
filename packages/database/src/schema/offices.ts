import { boolean, check, jsonb, pgTable, text } from "drizzle-orm/pg-core";
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
    /** Letterhead branding (colours, contact, notice); merged over defaults by resolveBranding(). */
    branding: jsonb("branding"),
    /** Finance governance: new payments and expenses wait for a partner's approval. */
    requireApproval: boolean("require_approval").notNull().default(false),
    /** ZATCA tax profile: printed on every tax invoice and carried in its QR (docs/02 §7). */
    vatNumber: text("vat_number"),
    crNumber: text("cr_number"),
    /** National address as printed on invoices. */
    taxAddress: text("tax_address"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    tenantPolicy("id"),
    check(
      "offices_vat_number_format",
      sql`${t.vatNumber} is null or ${t.vatNumber} ~ '^3[0-9]{13}3$'`,
    ),
    check("offices_cr_number_format", sql`${t.crNumber} is null or ${t.crNumber} ~ '^[0-9]{10}$'`),
  ],
).enableRLS();
