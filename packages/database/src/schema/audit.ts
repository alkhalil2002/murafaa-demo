import { index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";

/**
 * Append-only audit trail (PDPL access logging, permission denials, sensitive
 * actions). The app role is granted SELECT and INSERT only — see migration 0001.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: inet("ip"),
    requestId: text("request_id"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("audit_log_office_entity_idx").on(t.officeId, t.entity, t.entityId),
    tenantPolicy(),
  ],
).enableRLS();
