import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";

/** Values match CLIENT_TYPES / CLIENT_STATUSES / LEAD_SOURCES / LEAD_STAGES in @murafaa/rules. */
export const clientTypeEnum = pgEnum("client_type", ["INDIVIDUAL", "COMPANY", "ESTABLISHMENT"]);
export const clientStatusEnum = pgEnum("client_status", ["ACTIVE", "PROSPECT", "INACTIVE"]);
export const leadSourceEnum = pgEnum("lead_source", [
  "REFERRAL",
  "WEBSITE",
  "LINKEDIN",
  "PHONE_CALL",
  "EXHIBITION",
  "WHATSAPP",
  "OTHER",
]);
export const leadStageEnum = pgEnum("lead_stage", [
  "PROSPECT",
  "FIRST_CONSULTATION",
  "FEE_PROPOSAL_SENT",
  "CONTRACTED",
]);

export const clients = pgTable(
  "clients",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    name: text("name").notNull(),
    /** E.164; also the client-portal login key, so unique per office when present. */
    phone: text("phone"),
    /** The buyer's VAT number: when set, invoices are full tax invoices, else simplified (ZATCA). */
    vatNumber: text("vat_number"),
    city: text("city"),
    type: clientTypeEnum("type").notNull().default("INDIVIDUAL"),
    status: clientStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("clients_office_phone_key").on(t.officeId, t.phone),
    check(
      "clients_vat_number_format",
      sql`${t.vatNumber} is null or ${t.vatNumber} ~ '^3[0-9]{13}3$'`,
    ),
    tenantPolicy(),
  ],
).enableRLS();

export const leads = pgTable(
  "leads",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    name: text("name").notNull(),
    type: clientTypeEnum("type").notNull().default("INDIVIDUAL"),
    source: leadSourceEnum("source").notNull().default("OTHER"),
    stage: leadStageEnum("stage").notNull().default("PROSPECT"),
    /** Expected deal value in halalas. */
    expectedValue: bigint("expected_value", { mode: "number" }).notNull().default(0),
    nextAction: text("next_action"),
    phone: text("phone"),
    /** Set when the lead is converted into a client (and a case, once cases exist). */
    convertedClientId: uuid("converted_client_id").references(() => clients.id),
    convertedCaseId: uuid("converted_case_id"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("leads_office_stage_idx").on(t.officeId, t.stage), tenantPolicy()],
).enableRLS();
