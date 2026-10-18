import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { leadSourceEnum } from "./crm.js";
import { journalEntries } from "./finance.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/**
 * HR (docs/06 §5 end of service, §6 Nitaqat, §8 advances; legacy server/hr/*
 * and server/pulse.ts). Money is bigint halalas. Payroll lines and performance
 * events are append-only (grants in the migration); a posted payroll run is
 * immutable and has its journal entry.
 */

const money = (name: string) => bigint(name, { mode: "number" });
const officeRef = () =>
  uuid("office_id")
    .notNull()
    .references(() => offices.id);

/** Values match @murafaa/rules. */
export const employeeStatusEnum = pgEnum("employee_status", [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
]);
export const advanceStatusEnum = pgEnum("advance_status", ["ACTIVE", "SETTLED", "CANCELLED"]);
export const leaveTypeEnum = pgEnum("leave_type", [
  "ANNUAL",
  "SICK",
  "UNPAID",
  "MATERNITY",
  "OTHER",
]);
export const requestKindEnum = pgEnum("request_kind", ["LEAVE", "ADVANCE", "CERTIFICATE", "OTHER"]);
export const requestStatusEnum = pgEnum("request_status", [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "PRESENT",
  "LATE",
  "ABSENT",
  "LEAVE",
]);
export const candidateStageEnum = pgEnum("candidate_stage", [
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "HIRED",
]);
export const performanceEventKindEnum = pgEnum("performance_event_kind", [
  "TASK_COMPLETED",
  "HEARING_RECORDED",
  "DOCUMENT_GENERATED",
  "INVOICE_CREATED",
  "LEAD_CONVERTED",
]);

export const employees = pgTable(
  "employees",
  {
    id,
    officeId: officeRef(),
    /** Optional login account (docs/04: employees have no system role by default). */
    userId: uuid("user_id").references(() => users.id),
    name: text("name").notNull(),
    /** E.164, for the employee portal (M8). */
    phone: text("phone"),
    department: text("department"),
    jobTitle: text("job_title"),
    /** Free text as legacy stored it; Saudization compares it to "سعودي" (packages/rules isSaudi). */
    nationality: text("nationality").notNull().default("سعودي"),
    nationalId: text("national_id"),
    iban: text("iban"),
    hireDate: date("hire_date", { mode: "string" }).notNull(),
    status: employeeStatusEnum("status").notNull().default("ACTIVE"),
    basicSalary: money("basic_salary").notNull(),
    allowances: money("allowances").notNull().default(0),
    /** The employee's monthly GOSI deduction. */
    gosiContribution: money("gosi_contribution").notNull().default(0),
    leaveBalanceDays: integer("leave_balance_days").notNull().default(0),
    performanceScore: integer("performance_score"),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    /** The end-of-service award frozen at termination. */
    endOfServiceMinor: money("end_of_service_minor"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("employees_user_key")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
    index("employees_status_idx").on(t.officeId, t.status),
    check(
      "employees_money_nonnegative",
      sql`${t.basicSalary} >= 0 and ${t.allowances} >= 0 and ${t.gosiContribution} >= 0`,
    ),
    check("employees_leave_balance_nonnegative", sql`${t.leaveBalanceDays} >= 0`),
    check(
      "employees_score_range",
      sql`${t.performanceScore} is null or ${t.performanceScore} between 0 and 100`,
    ),
    tenantPolicy(),
  ],
).enableRLS();

export const advances = pgTable(
  "advances",
  {
    id,
    officeId: officeRef(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    amount: money("amount").notNull(),
    /** Explicit installment; otherwise derived from amount / months (packages/rules advanceMonthly). */
    monthlyInstallment: money("monthly_installment"),
    months: integer("months").notNull().default(1),
    /** Repaid so far, through payroll. */
    paid: money("paid").notNull().default(0),
    advanceDate: date("advance_date", { mode: "string" }).notNull(),
    status: advanceStatusEnum("status").notNull().default("ACTIVE"),
    note: text("note"),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("advances_employee_idx").on(t.officeId, t.employeeId),
    check("advances_amount_positive", sql`${t.amount} > 0 and ${t.months} >= 1`),
    check("advances_paid_range", sql`${t.paid} >= 0 and ${t.paid} <= ${t.amount}`),
    tenantPolicy(),
  ],
).enableRLS();

export const leaves = pgTable(
  "leaves",
  {
    id,
    officeId: officeRef(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    type: leaveTypeEnum("type").notNull().default("ANNUAL"),
    days: integer("days").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    note: text("note"),
    /** Whether this leave drew down the balance (only ANNUAL does). */
    deductedBalance: boolean("deducted_balance").notNull().default(false),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("leaves_employee_idx").on(t.officeId, t.employeeId),
    check("leaves_days_positive", sql`${t.days} > 0`),
    tenantPolicy(),
  ],
).enableRLS();

export const attendance = pgTable(
  "attendance",
  {
    id,
    officeId: officeRef(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    /** Riyadh calendar day; one row per employee per day. */
    day: date("day", { mode: "string" }).notNull(),
    status: attendanceStatusEnum("status").notNull().default("PRESENT"),
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("attendance_employee_day_key").on(t.officeId, t.employeeId, t.day),
    index("attendance_day_idx").on(t.officeId, t.day),
    tenantPolicy(),
  ],
).enableRLS();

/** One step of a request's decision trail. */
export type RequestHistoryEntry = { status: string; by: string; at: string; note?: string };

export const employeeRequests = pgTable(
  "employee_requests",
  {
    id,
    officeId: officeRef(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    department: text("department"),
    kind: requestKindEnum("kind").notNull(),
    detail: text("detail"),
    days: integer("days"),
    status: requestStatusEnum("status").notNull().default("SUBMITTED"),
    /** Append-only decision trail; decisions lock the row first. */
    history: jsonb("history").$type<RequestHistoryEntry[]>().notNull().default([]),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("employee_requests_employee_idx").on(t.officeId, t.employeeId),
    index("employee_requests_status_idx").on(t.officeId, t.status),
    check("employee_requests_days_positive", sql`${t.days} is null or ${t.days} > 0`),
    tenantPolicy(),
  ],
).enableRLS();

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id,
    officeId: officeRef(),
    /** YYYY-MM */
    periodKey: text("period_key").notNull(),
    totalBasic: money("total_basic").notNull().default(0),
    totalAllowances: money("total_allowances").notNull().default(0),
    totalGosi: money("total_gosi").notNull().default(0),
    totalAdvances: money("total_advances").notNull().default(0),
    totalNet: money("total_net").notNull().default(0),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id),
    postedBy: uuid("posted_by").references(() => users.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("payroll_runs_period_key").on(t.officeId, t.periodKey),
    check("payroll_runs_period_format", sql`${t.periodKey} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    tenantPolicy(),
  ],
).enableRLS();

export const payrollLines = pgTable(
  "payroll_lines",
  {
    id,
    /** Legacy lines had no office_id; every tenant table has one here. */
    officeId: officeRef(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    basic: money("basic").notNull(),
    allowances: money("allowances").notNull(),
    gosi: money("gosi").notNull(),
    advanceDeduction: money("advance_deduction").notNull(),
    net: money("net").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("payroll_lines_run_idx").on(t.payrollRunId),
    index("payroll_lines_employee_idx").on(t.officeId, t.employeeId),
    check(
      "payroll_lines_balanced",
      sql`${t.net} = ${t.basic} + ${t.allowances} - ${t.gosi} - ${t.advanceDeduction} and ${t.net} >= 0`,
    ),
    tenantPolicy(),
  ],
).enableRLS();

export const candidates = pgTable(
  "candidates",
  {
    id,
    officeId: officeRef(),
    name: text("name").notNull(),
    roleTitle: text("role_title"),
    source: leadSourceEnum("source").notNull().default("OTHER"),
    stage: candidateStageEnum("stage").notNull().default("APPLIED"),
    ...timestamps,
    ...audit,
  },
  (t) => [index("candidates_stage_idx").on(t.officeId, t.stage), tenantPolicy()],
).enableRLS();

/** نبض الفريق: points earned by real actions, written by the service that performs them. */
export const performanceEvents = pgTable(
  "performance_events",
  {
    id,
    officeId: officeRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: performanceEventKindEnum("kind").notNull(),
    points: integer("points").notNull(),
    /** The task, hearing, document, invoice or case behind the points: each counts once. */
    sourceId: uuid("source_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("performance_events_user_idx").on(t.officeId, t.userId, t.occurredAt),
    index("performance_events_time_idx").on(t.officeId, t.occurredAt),
    uniqueIndex("performance_events_source_key").on(t.officeId, t.kind, t.sourceId),
    check("performance_events_points_nonnegative", sql`${t.points} >= 0`),
    tenantPolicy(),
  ],
).enableRLS();

/** An office's override of a kind's points; a soft-deleted row means "back to the default". */
export const officePerformanceWeights = pgTable(
  "office_performance_weights",
  {
    id,
    officeId: officeRef(),
    kind: performanceEventKindEnum("kind").notNull(),
    points: integer("points").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("office_performance_weights_kind_key").on(t.officeId, t.kind),
    check("office_performance_weights_nonnegative", sql`${t.points} >= 0`),
    tenantPolicy(),
  ],
).enableRLS();
