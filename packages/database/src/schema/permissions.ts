import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { offices } from "./offices.js";
import { roleEnum } from "./users.js";

/** Values match PermModule / PermLevel / CaseScope in @murafaa/auth. */
export const permModuleEnum = pgEnum("perm_module", [
  "CASES",
  "AI",
  "CLIENTS",
  "DOCUMENTS",
  "FINANCE",
  "HR",
  "REPORTS",
  "PERMISSIONS",
  "WHATSAPP",
  "APPOINTMENTS",
  "TASKS",
  "ALERTS",
  "PULSE",
]);
export const permLevelEnum = pgEnum("perm_level", ["NONE", "VIEW", "EDIT", "FULL"]);
export const caseScopeEnum = pgEnum("case_scope", ["ALL", "ASSIGNED"]);

/** docs/04 layer 1: the office's editable role × module matrix. */
export const permissions = pgTable(
  "permissions",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    role: roleEnum("role").notNull(),
    module: permModuleEnum("module").notNull(),
    level: permLevelEnum("level").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("permissions_office_role_module_key").on(t.officeId, t.role, t.module),
    tenantPolicy(),
  ],
).enableRLS();

/** docs/04 layer 2: fields a role may not see within a resource it can open (e.g. assistant → cases.fees). */
export const fieldPermissions = pgTable(
  "field_permissions",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    role: roleEnum("role").notNull(),
    resource: text("resource").notNull(),
    field: text("field").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("field_permissions_office_role_resource_field_key").on(
      t.officeId,
      t.role,
      t.resource,
      t.field,
    ),
    tenantPolicy(),
  ],
).enableRLS();

/** docs/04 layer 3: which cases a role sees (ALL, or only cases it is assigned to). */
export const roleCaseScopes = pgTable(
  "role_case_scopes",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    role: roleEnum("role").notNull(),
    scope: caseScopeEnum("scope").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [uniqueIndex("role_case_scopes_office_role_key").on(t.officeId, t.role), tenantPolicy()],
).enableRLS();
