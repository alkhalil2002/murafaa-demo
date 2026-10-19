import {
  boolean,
  pgEnum,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { audit, id, platformPolicy, timestamps } from "./_helpers.js";

/** Values match PLATFORM_ROLES in @murafaa/auth. */
export const platformRoleEnum = pgEnum("platform_role", [
  "OWNER",
  "OPERATIONS",
  "BILLING",
  "SUPPORT",
]);

/**
 * إدارة المنصة: the Murafaa team's operators. They manage offices (create,
 * suspend, record payment) and see aggregate usage only, never case, client
 * or document content. TOTP is mandatory; the account is created by an
 * operator script, never from a web page.
 */
export const platformAdmins = pgTable(
  "platform_admins",
  {
    id,
    name: text("name").notNull(),
    /** E.164 phone, the OTP identity. */
    phone: text("phone").notNull(),
    role: platformRoleEnum("role").notNull().default("SUPPORT"),
    /** TOTP secret, AES-256-GCM encrypted by the API; null until activated. */
    totpSecretEnc: text("totp_secret_enc"),
    /** Set when the member finished their activation link; sign-in needs it. */
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [uniqueIndex("platform_admins_phone_key").on(t.phone), platformPolicy()],
).enableRLS();

export const platformOtpChallenges = pgTable(
  "platform_otp_challenges",
  {
    id,
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [index("platform_otp_admin_idx").on(t.adminId, t.createdAt), platformPolicy()],
).enableRLS();

/** `p.<id>.<secret>` on the client; only a SHA-256 of the secret is stored. */
export const platformSessions = pgTable(
  "platform_sessions",
  {
    id,
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("platform_sessions_admin_idx").on(t.adminId), platformPolicy()],
).enableRLS();

/** Append-only (SELECT and INSERT only for the app role). */
export const platformAuditLog = pgTable(
  "platform_audit_log",
  {
    id,
    /** The platform admin, or null for a sign-in attempt or the system. */
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    /** The office acted on, if any. */
    officeId: uuid("office_id"),
    details: jsonb("details"),
    ip: inet("ip"),
    requestId: text("request_id"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("platform_audit_created_idx").on(t.createdAt), platformPolicy()],
).enableRLS();

/**
 * A one-time activation link (24 h). The member proves the invited phone
 * with an OTP, scans a new TOTP secret in their own browser, and confirms
 * it; only then is the account usable. Only a SHA-256 of the token is kept.
 */
export const platformInvites = pgTable(
  "platform_invites",
  {
    id,
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /** Wrong codes so far; at the limit the link is burned. */
    attempts: integer("attempts").notNull().default(0),
    /** Set after the OTP step: the secret being enrolled, encrypted. */
    totpPendingEnc: text("totp_pending_enc"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("platform_invites_token_key").on(t.tokenHash),
    index("platform_invites_admin_idx").on(t.adminId),
    platformPolicy(),
  ],
).enableRLS();
