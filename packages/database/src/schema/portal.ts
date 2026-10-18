import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";

/**
 * Client and employee portals (بوابة العميل / بوابة الموظف). Their sign-in
 * codes and sessions live apart from staff ones: a portal session can never
 * be mistaken for a staff principal, and each is a revocable row (legacy used
 * a signed cookie that stayed valid for 7 days whatever happened).
 */
export const portalKindEnum = pgEnum("portal_kind", ["CLIENT", "EMPLOYEE"]);

export const portalOtpChallenges = pgTable(
  "portal_otp_challenges",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    kind: portalKindEnum("kind").notNull(),
    /** The client or employee id. */
    subjectId: uuid("subject_id").notNull(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("portal_otp_subject_idx").on(t.officeId, t.kind, t.subjectId, t.createdAt),
    tenantPolicy(),
  ],
).enableRLS();

/** `<officeId>.<id>.<secret>` on the client; only a SHA-256 of the secret is stored. */
export const portalSessions = pgTable(
  "portal_sessions",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    kind: portalKindEnum("kind").notNull(),
    subjectId: uuid("subject_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("portal_sessions_subject_idx").on(t.officeId, t.kind, t.subjectId), tenantPolicy()],
).enableRLS();
