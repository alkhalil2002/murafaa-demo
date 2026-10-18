import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { cases } from "./cases.js";
import { caseReminders, docPartyEnum, hearings } from "./hearings.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/** Values match @murafaa/rules. */
export const approvalStageEnum = pgEnum("approval_stage", [
  "DRAFT",
  "SENIOR_LAWYER",
  "COUNSEL",
  "PROOFREADING",
  "PARTNER",
  "APPROVED",
]);
export const execFileStatusEnum = pgEnum("exec_file_status", [
  "ACTIVE",
  "PARTIALLY_COLLECTED",
  "FULLY_COLLECTED",
  "STALLED",
  "CLOSED",
]);
export const execProcStatusEnum = pgEnum("exec_proc_status", [
  "REQUIRED",
  "IN_PROGRESS",
  "EXECUTED",
  "STALLED",
]);
export const clientCommunicationTypeEnum = pgEnum("client_communication_type", [
  "CALL",
  "MESSAGE",
  "MEETING",
  "EMAIL",
]);
export const messageSenderTypeEnum = pgEnum("message_sender_type", ["STAFF", "CLIENT"]);
export const clientApprovalKindEnum = pgEnum("client_approval_kind", ["MEMO", "FEE", "SETTLEMENT"]);
export const clientApprovalStatusEnum = pgEnum("client_approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

const officeRef = () =>
  uuid("office_id")
    .notNull()
    .references(() => offices.id);
const caseRef = () =>
  uuid("case_id")
    .notNull()
    .references(() => cases.id);

/** Internal review pipeline (الاعتمادات): DRAFT → … → PARTNER → APPROVED. */
export const caseApprovals = pgTable(
  "case_approvals",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    title: text("title").notNull(),
    stage: approvalStageEnum("stage").notNull().default("DRAFT"),
    /** Approving the item can also approve this hearing's client report. */
    hearingId: uuid("hearing_id").references(() => hearings.id),
    ...timestamps,
    ...audit,
  },
  (t) => [index("case_approvals_case_idx").on(t.officeId, t.caseId), tenantPolicy()],
).enableRLS();

/** Named contracts on a case with a signed toggle (prototype wsAddContract). */
export const contracts = pgTable(
  "contracts",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    title: text("title").notNull(),
    isSigned: boolean("is_signed").notNull().default(false),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [index("contracts_case_idx").on(t.officeId, t.caseId), tenantPolicy()],
).enableRLS();

/** Client contact log (سجل التواصل): calls, messages, meetings, emails. */
export const clientCommunications = pgTable(
  "client_communications",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    type: clientCommunicationTypeEnum("type").notNull(),
    note: text("note").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [index("client_communications_case_idx").on(t.officeId, t.caseId), tenantPolicy()],
).enableRLS();

/** Case chat between the office and the client (the client side arrives with the portal). */
export const caseMessages = pgTable(
  "case_messages",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    senderType: messageSenderTypeEnum("sender_type").notNull(),
    senderUserId: uuid("sender_user_id").references(() => users.id),
    body: text("body").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [index("case_messages_case_idx").on(t.officeId, t.caseId, t.createdAt), tenantPolicy()],
).enableRLS();

/** Post-judgment enforcement file: at most one live file per case. Money in halalas. */
export const caseExecutions = pgTable(
  "case_executions",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    court: text("court"),
    requestNo: text("request_no"),
    amount: bigint("amount", { mode: "number" }),
    collected: bigint("collected", { mode: "number" }).notNull().default(0),
    debtor: text("debtor"),
    basis: text("basis"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    status: execFileStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("case_executions_one_per_case_key")
      .on(t.caseId)
      .where(sql`${t.deletedAt} is null`),
    tenantPolicy(),
  ],
).enableRLS();

/** Enforcement steps inside an execution file. */
export const executionProcedures = pgTable(
  "execution_procedures",
  {
    id,
    officeId: officeRef(),
    caseExecutionId: uuid("case_execution_id")
      .notNull()
      .references(() => caseExecutions.id),
    type: text("type").notNull(),
    status: execProcStatusEnum("status").notNull().default("REQUIRED"),
    note: text("note"),
    party: docPartyEnum("party"),
    date: timestamp("date", { withTimezone: true }),
    followUpDate: timestamp("follow_up_date", { withTimezone: true }),
    followUpAssigneeId: uuid("follow_up_assignee_id").references(() => users.id),
    reminderId: uuid("reminder_id").references(() => caseReminders.id),
    ...timestamps,
    ...audit,
  },
  (t) => [index("execution_procedures_file_idx").on(t.officeId, t.caseExecutionId), tenantPolicy()],
).enableRLS();

/** Requests the client approves on the portal: memo, fee proposal, settlement. Amount in halalas. */
export const clientApprovalRequests = pgTable(
  "client_approval_requests",
  {
    id,
    officeId: officeRef(),
    caseId: caseRef(),
    title: text("title").notNull(),
    kind: clientApprovalKindEnum("kind").notNull(),
    amount: bigint("amount", { mode: "number" }),
    note: text("note"),
    status: clientApprovalStatusEnum("status").notNull().default("PENDING"),
    decisionNote: text("decision_note"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("client_approval_requests_case_idx").on(t.officeId, t.caseId),
    index("client_approval_requests_status_idx").on(t.officeId, t.status),
    tenantPolicy(),
  ],
).enableRLS();
