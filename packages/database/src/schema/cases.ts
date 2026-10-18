import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { clients, leads } from "./crm.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/** Values match @murafaa/rules. */
export const partyRoleEnum = pgEnum("party_role", ["PLAINTIFF", "DEFENDANT"]);
export const procStageEnum = pgEnum("proc_stage", [
  "RECONCILIATION",
  "FIRST_INSTANCE",
  "APPEAL",
  "CASSATION",
  "EXECUTION",
]);
export const caseStatusEnum = pgEnum("case_status", ["ACTIVE", "SUSPENDED", "CLOSED"]);
export const caseOutcomeEnum = pgEnum("case_outcome", ["WON", "PARTIAL", "SETTLED", "LOST"]);
export const conflictSeverityEnum = pgEnum("conflict_severity", ["HIGH", "MEDIUM"]);
export const conflictTypeEnum = pgEnum("conflict_type", [
  "OPPONENT_IS_CLIENT",
  "OPPONENT_IS_LEAD",
  "OPPONENT_IS_OUR_CLIENT_OTHER_CASE",
  "OUR_CLIENT_IS_OPPONENT_OTHER_CASE",
]);
export const conflictStatusEnum = pgEnum("conflict_status", ["ACTIVE", "WAIVED", "RESOLVED"]);
export const caseEventTypeEnum = pgEnum("case_event_type", [
  "STAGE",
  "REQUEST",
  "DOC",
  "APPROVAL",
  "OPENING",
  "DEADLINE",
  "MESSAGE",
  "SYSTEM",
]);

export const cases = pgTable(
  "cases",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    clientRole: partyRoleEnum("client_role").notNull().default("PLAINTIFF"),
    clientId: uuid("client_id").references(() => clients.id),
    opposingParty: text("opposing_party"),
    /** The court or authority (الجهة). */
    entity: text("entity"),
    najizMainClass: text("najiz_main_class"),
    najizSubClass: text("najiz_sub_class"),
    najizCaseType: text("najiz_case_type"),
    city: text("city"),
    /** Baseline stage; the shown stage also follows held hearings (effectiveStage). */
    stage: procStageEnum("stage").notNull().default("FIRST_INSTANCE"),
    status: caseStatusEnum("status").notNull().default("ACTIVE"),
    outcome: caseOutcomeEnum("outcome"),
    factSummary: text("fact_summary"),
    judgmentDate: timestamp("judgment_date", { withTimezone: true }),
    /** judgment + 30 days (docs/06 §1), set when a judgment hearing is recorded. */
    objectionDueAt: timestamp("objection_due_at", { withTimezone: true }),
    poaExpiresAt: timestamp("poa_expires_at", { withTimezone: true }),
    arenaSessionSeq: integer("arena_session_seq").notNull().default(1),
    clientSatisfactionScore: smallint("client_satisfaction_score"),
    referralRequested: boolean("referral_requested").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    procEnded: boolean("proc_ended").notNull().default(false),
    procResult: text("proc_result"),
    closingChecklist: jsonb("closing_checklist").$type<Record<string, boolean>>(),
    /** Highest ACTIVE conflict severity, kept in sync by the conflicts service. */
    conflictSeverity: conflictSeverityEnum("conflict_severity"),
    conflictCheckedAt: timestamp("conflict_checked_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [index("cases_office_client_idx").on(t.officeId, t.clientId), tenantPolicy()],
).enableRLS();

/** Who works on a case; drives the ASSIGNED row scope (docs/04 layer 3). */
export const caseAssignees = pgTable(
  "case_assignees",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("case_assignees_case_user_key").on(t.caseId, t.userId),
    index("case_assignees_user_idx").on(t.officeId, t.userId),
    tenantPolicy(),
  ],
).enableRLS();

/**
 * Case timeline (legacy CaseEvent). System events store an i18n key and
 * params, rendered at read time; user-written entries store their text.
 */
export const caseEvents = pgTable(
  "case_events",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    type: caseEventTypeEnum("type").notNull(),
    messageKey: text("message_key"),
    params: jsonb("params").$type<Record<string, string | number>>(),
    text: text("text"),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    procedureRequestId: uuid("procedure_request_id"),
    approvalId: uuid("approval_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...audit,
  },
  (t) => [index("case_events_case_idx").on(t.officeId, t.caseId, t.occurredAt), tenantPolicy()],
).enableRLS();

/** Persisted conflict-of-interest findings (docs/06 §4), reconciled on every recompute. */
export const conflictFlags = pgTable(
  "conflict_flags",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    severity: conflictSeverityEnum("severity").notNull(),
    conflictType: conflictTypeEnum("conflict_type").notNull(),
    messageKey: text("message_key").notNull(),
    messageParams: jsonb("message_params").$type<Record<string, string>>(),
    matchedName: text("matched_name").notNull(),
    matchedClientId: uuid("matched_client_id").references(() => clients.id),
    matchedLeadId: uuid("matched_lead_id").references(() => leads.id),
    matchedCaseIds: jsonb("matched_case_ids").$type<string[]>(),
    status: conflictStatusEnum("status").notNull().default("ACTIVE"),
    waiverNote: text("waiver_note"),
    waivedBy: uuid("waived_by").references(() => users.id),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("conflict_flags_case_type_name_key").on(t.caseId, t.conflictType, t.matchedName),
    tenantPolicy(),
  ],
).enableRLS();
