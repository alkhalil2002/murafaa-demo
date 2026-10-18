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
import { cases } from "./cases.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/** Values match @murafaa/rules. */
export const hearingStatusEnum = pgEnum("hearing_status", ["UPCOMING", "HELD"]);
export const hearingKindEnum = pgEnum("hearing_kind", [
  "PRELIMINARY",
  "PLEADING",
  "MEMO_EXCHANGE",
  "PROCEDURAL_CONTROL",
  "WITNESS_HEARING",
  "EXPERT_EXAMINATION",
  "RESERVED_FOR_JUDGMENT",
  "JUDGMENT_PRONOUNCEMENT",
  "RECONCILIATION",
  "OTHER",
]);
export const taskColumnEnum = pgEnum("task_column", ["NEW", "IN_PROGRESS", "DONE"]);
export const taskPriorityEnum = pgEnum("task_priority", ["URGENT", "NORMAL"]);
export const taskCategoryEnum = pgEnum("task_category", [
  "CONTRACT_SIGNING",
  "MEMO_DRAFTING",
  "CONTRACT_DOC_REVIEW",
  "LEGAL_RESEARCH",
  "PROCEDURAL_FOLLOWUP",
  "CLIENT_CORRESPONDENCE",
  "GENERAL",
]);
export const taskSourceEnum = pgEnum("task_source", [
  "MANUAL",
  "AUTO_HEARING_PREP",
  "AUTO_OBJECTION",
  "HEARING_ACTION",
  "AUTO_EXECUTION_FOLLOWUP",
]);
export const reminderSourceEnum = pgEnum("reminder_source", [
  "MANUAL",
  "PENDING_HEARING",
  "HEARING_MINUTES",
  "EXECUTION_FOLLOWUP",
]);
export const docPartyEnum = pgEnum("doc_party", ["OURS", "OPPONENT", "COURT"]);
export const procedureRequestStatusEnum = pgEnum("procedure_request_status", [
  "SUBMITTED",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

/** Court sessions. At most one UPCOMING per case (docs BR-CASE-04); HELD ones are numbered. */
export const hearings = pgTable(
  "hearings",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    sequenceNo: integer("sequence_no"),
    hearingDate: timestamp("hearing_date", { withTimezone: true }).notNull(),
    status: hearingStatusEnum("status").notNull().default("UPCOMING"),
    /** 0..4 = RECONCILIATION..EXECUTION; drives the case's effective stage. */
    stageIndex: smallint("stage_index"),
    kind: hearingKindEnum("kind"),
    minutes: text("minutes"),
    result: text("result"),
    clientReport: text("client_report"),
    reportApprovalRequested: boolean("report_approval_requested").notNull().default(false),
    reportApproved: boolean("report_approved").notNull().default(false),
    /** True only once the report PDF is actually shared on the client portal (documents module). */
    reportSentToClient: boolean("report_sent_to_client").notNull().default(false),
    isPending: boolean("is_pending").notNull().default(false),
    pendingItems: jsonb("pending_items").$type<string[]>(),
    reminderRecurDays: integer("reminder_recur_days"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("hearings_case_idx").on(t.officeId, t.caseId),
    index("hearings_date_idx").on(t.officeId, t.hearingDate),
    tenantPolicy(),
  ],
).enableRLS();

export const caseReminders = pgTable(
  "case_reminders",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    hearingId: uuid("hearing_id").references(() => hearings.id),
    text: text("text").notNull(),
    dueOn: timestamp("due_on", { withTimezone: true }).notNull(),
    recurIntervalDays: integer("recur_interval_days"),
    source: reminderSourceEnum("source").notNull().default("MANUAL"),
    /** Escalated into a task (legacy "↗ أرسله لقسمه"). */
    isTaskLinked: boolean("is_task_linked").notNull().default(false),
    ...timestamps,
    ...audit,
  },
  (t) => [index("case_reminders_due_idx").on(t.officeId, t.dueOn), tenantPolicy()],
).enableRLS();

export const tasks = pgTable(
  "tasks",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    title: text("title").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id),
    priority: taskPriorityEnum("priority").notNull().default("NORMAL"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    category: taskCategoryEnum("category"),
    status: taskColumnEnum("status").notNull().default("NEW"),
    position: integer("position").notNull().default(0),
    origin: taskSourceEnum("origin").notNull().default("MANUAL"),
    /** Set on system-generated tasks; unique per office so automation never duplicates. */
    autoSignature: text("auto_signature"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    caseId: uuid("case_id").references(() => cases.id),
    hearingId: uuid("hearing_id").references(() => hearings.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("tasks_office_auto_signature_key").on(t.officeId, t.autoSignature),
    index("tasks_status_idx").on(t.officeId, t.status),
    index("tasks_case_idx").on(t.officeId, t.caseId),
    tenantPolicy(),
  ],
).enableRLS();

/** Motions filed within a procedural stage (legacy ProcedureRequest). */
export const procedureRequests = pgTable(
  "procedure_requests",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    hearingId: uuid("hearing_id").references(() => hearings.id),
    stageIndex: smallint("stage_index").notNull(),
    party: docPartyEnum("party").notNull(),
    type: text("type"),
    text: text("text").notNull(),
    status: procedureRequestStatusEnum("status").notNull().default("SUBMITTED"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("procedure_requests_case_idx").on(t.officeId, t.caseId), tenantPolicy()],
).enableRLS();
