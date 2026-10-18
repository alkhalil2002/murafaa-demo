import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";

export const outboxStatusEnum = pgEnum("outbox_status", ["PENDING", "DISPATCHED", "FAILED"]);

/**
 * Transactional outbox: domain events are written in the same transaction as
 * the change that caused them, then dispatched to Cloud Tasks. Nothing is lost
 * if the process dies, and the dispatcher is safe to run on many instances.
 */
export const outbox = pgTable(
  "outbox",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("outbox_pending_idx").on(t.status, t.availableAt), tenantPolicy()],
).enableRLS();
