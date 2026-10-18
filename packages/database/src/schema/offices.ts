import { pgTable, text } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";

/** The tenant root. A session sees only its own office row. */
export const offices = pgTable(
  "offices",
  {
    id,
    name: text("name").notNull(),
    ...timestamps,
    ...audit,
  },
  () => [tenantPolicy("id")],
).enableRLS();
