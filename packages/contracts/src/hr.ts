import {
  ADVANCE_STATUSES,
  ATTENDANCE_STATUSES,
  CANDIDATE_STAGES,
  EMPLOYEE_STATUSES,
  LEAD_SOURCES,
  LEAVE_TYPES,
  MAX_HALALAS,
  NITAQAT_BANDS,
  PERFORMANCE_EVENT_KINDS,
  PULSE_WINDOWS,
  REQUEST_DECISIONS,
  REQUEST_KINDS,
  REQUEST_STATUSES,
  SAUDI_NATIONALITY,
} from "@murafaa/rules";
import { z } from "zod";
import { role, saudiPhone } from "./auth.js";

const halalas = z.number().int().min(0).max(MAX_HALALAS);
const positive = z.number().int().min(1).max(MAX_HALALAS);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const day = z.iso.date();
const bands = NITAQAT_BANDS.map((b) => b.key) as [string, ...string[]];

// ── Employees ──

export const employeeRow = z
  .object({
    id: z.uuid(),
    name: z.string(),
    department: z.string().nullable(),
    jobTitle: z.string().nullable(),
    nationality: z.string(),
    hireDate: day,
    status: z.enum(EMPLOYEE_STATUSES),
    basicSalary: z.number().int(),
    allowances: z.number().int(),
    performanceScore: z.number().int().nullable(),
  })
  .meta({ id: "EmployeeRow" });
export const employeeList = z.array(employeeRow).meta({ id: "EmployeeList" });

export const createEmployeeBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: saudiPhone.nullish().transform((v) => v ?? null),
    department: optional(120),
    jobTitle: optional(120),
    nationality: z.string().trim().min(1).max(60).default(SAUDI_NATIONALITY),
    nationalId: optional(20),
    iban: optional(34),
    hireDate: day,
    basicSalary: halalas,
    allowances: halalas.default(0),
    gosiContribution: halalas.default(0),
    leaveBalanceDays: z.number().int().min(0).max(3650).default(0),
  })
  .meta({ id: "CreateEmployeeBody" });

/** Partial edit; today the screens send the performance score only (legacy). */
export const updateEmployeeBody = createEmployeeBody
  .partial()
  .extend({ performanceScore: z.number().int().min(0).max(100).nullish() })
  .meta({ id: "UpdateEmployeeBody" });

const historyRow = z.object({ amount: z.number().int(), status: z.string() });

export const employeeDetail = z
  .object({
    id: z.uuid(),
    name: z.string(),
    department: z.string().nullable(),
    jobTitle: z.string().nullable(),
    nationality: z.string(),
    hireDate: day,
    status: z.enum(EMPLOYEE_STATUSES),
    basicSalary: z.number().int(),
    allowances: z.number().int(),
    gosiContribution: z.number().int(),
    leaveBalanceDays: z.number().int(),
    performanceScore: z.number().int().nullable(),
    /** Only the last four characters; the full IBAN goes to the WPS file alone. */
    ibanMasked: z.string().nullable(),
    terminatedAt: z.iso.datetime().nullable(),
    endOfService: z.object({
      /** Frozen at termination, else the award if terminated today. */
      awardMinor: z.number().int(),
      years: z.number().int().nullable(),
      frozen: z.boolean(),
    }),
    account: z
      .object({ name: z.string(), phone: z.string(), role, isActive: z.boolean() })
      .nullable(),
    advances: z.array(
      historyRow.extend({
        id: z.uuid(),
        monthlyDue: z.number().int(),
        remaining: z.number().int(),
      }),
    ),
    leaves: z.array(
      z.object({ id: z.uuid(), type: z.enum(LEAVE_TYPES), days: z.number().int(), startDate: day }),
    ),
    requests: z.array(
      z.object({
        id: z.uuid(),
        kind: z.enum(REQUEST_KINDS),
        status: z.enum(REQUEST_STATUSES),
        detail: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: "EmployeeDetail" });

export const grantAccountBody = z
  .object({ phone: saudiPhone, role })
  .meta({ id: "GrantAccountBody" });

// ── Advances, leaves, requests ──

export const advanceRow = z
  .object({
    id: z.uuid(),
    employeeId: z.uuid(),
    employeeName: z.string(),
    amount: z.number().int(),
    months: z.number().int(),
    paid: z.number().int(),
    monthlyDue: z.number().int(),
    remaining: z.number().int(),
    advanceDate: day,
    status: z.enum(ADVANCE_STATUSES),
    note: z.string().nullable(),
  })
  .meta({ id: "AdvanceRow" });
export const advanceList = z.array(advanceRow).meta({ id: "AdvanceList" });

export const createAdvanceBody = z
  .object({
    employeeId: z.uuid(),
    amount: positive,
    months: z.number().int().min(1).max(120).default(1),
    monthlyInstallment: positive.nullish(),
    advanceDate: day.optional(),
    note: optional(500),
  })
  .meta({ id: "CreateAdvanceBody" });

export const leaveRow = z
  .object({
    id: z.uuid(),
    employeeId: z.uuid(),
    employeeName: z.string(),
    type: z.enum(LEAVE_TYPES),
    days: z.number().int(),
    startDate: day,
    note: z.string().nullable(),
  })
  .meta({ id: "LeaveRow" });
export const leaveList = z.array(leaveRow).meta({ id: "LeaveList" });

export const createLeaveBody = z
  .object({
    employeeId: z.uuid(),
    type: z.enum(LEAVE_TYPES).default("ANNUAL"),
    days: z.number().int().min(1).max(365),
    startDate: day,
    note: optional(500),
  })
  .meta({ id: "CreateLeaveBody" });

export const requestRow = z
  .object({
    id: z.uuid(),
    employeeId: z.uuid(),
    employeeName: z.string(),
    kind: z.enum(REQUEST_KINDS),
    detail: z.string().nullable(),
    days: z.number().int().nullable(),
    status: z.enum(REQUEST_STATUSES),
    history: z.array(
      z.object({
        status: z.enum(REQUEST_STATUSES),
        by: z.uuid(),
        at: z.iso.datetime(),
        note: z.string().optional(),
      }),
    ),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "EmployeeRequestRow" });
export const requestList = z.array(requestRow).meta({ id: "EmployeeRequestList" });

export const createRequestBody = z
  .object({
    employeeId: z.uuid(),
    kind: z.enum(REQUEST_KINDS),
    detail: optional(1000),
    days: z.number().int().min(1).max(365).nullish(),
    department: optional(120),
  })
  .meta({ id: "CreateEmployeeRequestBody" });

export const decideRequestBody = z
  .object({ status: z.enum(REQUEST_DECISIONS), note: optional(500) })
  .meta({ id: "DecideEmployeeRequestBody" });

// ── Attendance, org chart, Saudization ──

export const attendanceToday = z
  .object({
    day,
    rows: z.array(
      z.object({
        employeeId: z.uuid(),
        employeeName: z.string(),
        status: z.enum(ATTENDANCE_STATUSES).nullable(),
        checkIn: z.iso.datetime().nullable(),
        checkOut: z.iso.datetime().nullable(),
      }),
    ),
  })
  .meta({ id: "AttendanceToday" });

export const attendanceMonth = z
  .object({
    month: z.string(),
    rows: z.array(
      z.object({
        employeeId: z.uuid(),
        employeeName: z.string(),
        daysPresent: z.number().int(),
        lateCount: z.number().int(),
        daysAbsent: z.number().int(),
      }),
    ),
  })
  .meta({ id: "AttendanceMonth" });

export const attendanceMonthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

export const setAttendanceBody = z
  .object({ status: z.enum(ATTENDANCE_STATUSES) })
  .meta({ id: "SetAttendanceBody" });

export const orgChart = z
  .array(
    z.object({
      /** null = no department. */
      department: z.string().nullable(),
      employees: z.array(
        z.object({ id: z.uuid(), name: z.string(), jobTitle: z.string().nullable() }),
      ),
    }),
  )
  .meta({ id: "OrgChart" });

export const saudization = z
  .object({
    total: z.number().int(),
    saudiCount: z.number().int(),
    pct: z.number(),
    band: z.enum(bands),
    targets: z.array(
      z.object({ band: z.enum(bands), minPct: z.number(), saudisNeeded: z.number().int() }),
    ),
  })
  .meta({ id: "Saudization" });

// ── Payroll and WPS ──

export const runPayrollBody = z
  .object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) })
  .meta({ id: "RunPayrollBody" });

const runTotals = {
  id: z.uuid(),
  periodKey: z.string(),
  totalBasic: z.number().int(),
  totalAllowances: z.number().int(),
  totalGosi: z.number().int(),
  totalAdvances: z.number().int(),
  totalNet: z.number().int(),
};

export const payrollRunList = z
  .array(z.object({ ...runTotals, lineCount: z.number().int() }))
  .meta({ id: "PayrollRunList" });

export const payrollRunDetail = z
  .object({
    ...runTotals,
    journalEntryId: z.uuid().nullable(),
    lines: z.array(
      z.object({
        id: z.uuid(),
        employeeName: z.string(),
        basic: z.number().int(),
        allowances: z.number().int(),
        gosi: z.number().int(),
        advanceDeduction: z.number().int(),
        net: z.number().int(),
      }),
    ),
  })
  .meta({ id: "PayrollRunDetail" });

export const wpsFile = z
  .object({
    periodKey: z.string(),
    recordCount: z.number().int(),
    totalNet: z.number().int(),
    /** Names of employees without an IBAN; a bank would reject their records. */
    missingIban: z.array(z.string()),
    records: z.array(
      z.object({
        employeeName: z.string(),
        nationalId: z.string().nullable(),
        ibanMasked: z.string().nullable(),
        basic: z.number().int(),
        allowances: z.number().int(),
        deductions: z.number().int(),
        net: z.number().int(),
      }),
    ),
  })
  .meta({ id: "WpsFile" });

// ── Recruitment ──

export const candidateRow = z
  .object({
    id: z.uuid(),
    name: z.string(),
    roleTitle: z.string().nullable(),
    source: z.enum(LEAD_SOURCES),
    stage: z.enum(CANDIDATE_STAGES),
  })
  .meta({ id: "CandidateRow" });
export const candidateList = z.array(candidateRow).meta({ id: "CandidateList" });

export const createCandidateBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    roleTitle: optional(200),
    source: z.enum(LEAD_SOURCES).default("OTHER"),
  })
  .meta({ id: "CreateCandidateBody" });

export const moveCandidateBody = z
  .object({ direction: z.union([z.literal(1), z.literal(-1)]) })
  .meta({ id: "MoveCandidateBody" });

// ── Team Pulse ──

export const pulseQuery = z.object({ window: z.enum(PULSE_WINDOWS).default("week") });

const pulseEvent = z.object({
  id: z.uuid(),
  kind: z.enum(PERFORMANCE_EVENT_KINDS),
  points: z.number().int(),
  occurredAt: z.iso.datetime(),
});

export const pulseSelf = z
  .object({
    points: z.number().int(),
    tasksDone: z.number().int(),
    completionRatePct: z.number().int(),
    events: z.array(pulseEvent),
  })
  .meta({ id: "PulseSelf" });

export const pulseTeam = z
  .object({
    totals: z.object({
      totalPoints: z.number().int(),
      tasksCompleted: z.number().int(),
      hearingsLogged: z.number().int(),
    }),
    ranking: z.array(
      z.object({ userId: z.uuid(), name: z.string(), role, points: z.number().int() }),
    ),
  })
  .meta({ id: "PulseTeam" });

export const pulseDrill = z
  .object({ userId: z.uuid(), name: z.string(), events: z.array(pulseEvent) })
  .meta({ id: "PulseDrill" });

export const pulseWeights = z
  .array(
    z.object({
      kind: z.enum(PERFORMANCE_EVENT_KINDS),
      points: z.number().int(),
      isDefault: z.boolean(),
    }),
  )
  .meta({ id: "PulseWeights" });

export const kindParams = z.object({ kind: z.enum(PERFORMANCE_EVENT_KINDS) });
export const setWeightBody = z
  .object({ points: z.number().int().min(0).max(1000) })
  .meta({ id: "SetPulseWeightBody" });
