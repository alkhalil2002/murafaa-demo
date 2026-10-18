import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";

/** docs/04 roles. Values match Role in @murafaa/auth. */
export const roleEnum = pgEnum("role", [
  "PARTNER",
  "LAWYER",
  "ASSISTANT",
  "ACCOUNTANT",
  "ADMIN",
  "RECEPTION",
]);

export const users = pgTable(
  "users",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    name: text("name").notNull(),
    /** E.164 phone, the OTP login identity. */
    phone: text("phone").notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    /** TOTP secret, AES-256-GCM encrypted by the API (never stored in plaintext). */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [uniqueIndex("users_office_phone_key").on(t.officeId, t.phone), tenantPolicy()],
).enableRLS();
