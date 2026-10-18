import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { clients, leads } from "./crm.js";
import { offices } from "./offices.js";

/** Values match @murafaa/rules APPOINTMENT_TYPES / APPOINTMENT_STATUSES. */
export const appointmentTypeEnum = pgEnum("appointment_type", [
  "FIRST_CONSULTATION",
  "CONTRACT_REVIEW",
  "FOLLOW_UP",
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "SCHEDULED",
  "CANCELLED",
  "DONE",
]);

/** Office meetings with a client or lead (module APPOINTMENTS), not tied to a case. */
export const appointments = pgTable(
  "appointments",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    /** Denormalized: the contact may be a client, a lead or neither. */
    contactName: text("contact_name").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    leadId: uuid("lead_id").references(() => leads.id),
    scheduledOn: timestamp("scheduled_on", { withTimezone: true }).notNull(),
    /** Free "HH:MM" as legacy stored it. */
    scheduledTime: text("scheduled_time"),
    type: appointmentTypeEnum("type").notNull().default("FIRST_CONSULTATION"),
    status: appointmentStatusEnum("status").notNull().default("SCHEDULED"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("appointments_date_idx").on(t.officeId, t.scheduledOn), tenantPolicy()],
).enableRLS();
