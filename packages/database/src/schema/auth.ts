import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";
import { roleEnum, users } from "./users.js";

/** One login code sent to a user. Only an HMAC of the code is stored. */
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("otp_challenges_office_phone_idx").on(t.officeId, t.phone, t.createdAt),
    tenantPolicy(),
  ],
).enableRLS();

/**
 * A signed-in session. The client holds `<officeId>.<id>.<secret>`; only a
 * SHA-256 of the secret is stored, so a database leak can't be replayed.
 */
export const sessions = pgTable(
  "sessions",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    /** Set while a partner previews another role (view-only). */
    previewRole: roleEnum("preview_role"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("sessions_user_idx").on(t.officeId, t.userId), tenantPolicy()],
).enableRLS();
