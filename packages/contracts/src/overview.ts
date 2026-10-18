import {
  ACTIVITY_CATEGORIES,
  ALERT_TIERS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  DEADLINE_KINDS,
  LEAD_STAGES,
} from "@murafaa/rules";
import { z } from "zod";
import { storedMessage } from "./cases.js";
import { dateOnly } from "./hearings.js";

// ── Appointments (module APPOINTMENTS) ──

export const appointment = z
  .object({
    id: z.uuid(),
    contactName: z.string(),
    clientId: z.uuid().nullable(),
    leadId: z.uuid().nullable(),
    scheduledOn: z.iso.datetime(),
    scheduledTime: z.string().nullable(),
    type: z.enum(APPOINTMENT_TYPES),
    status: z.enum(APPOINTMENT_STATUSES),
  })
  .meta({ id: "Appointment" });
export const appointmentList = z.array(appointment).meta({ id: "AppointmentList" });
export const createAppointmentBody = z
  .object({
    contactName: z.string().trim().min(1).max(200),
    clientId: z.uuid().nullish(),
    leadId: z.uuid().nullish(),
    scheduledOn: dateOnly,
    scheduledTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullish(),
    type: z.enum(APPOINTMENT_TYPES).default("FIRST_CONSULTATION"),
  })
  .meta({ id: "CreateAppointmentBody" });

// ── Deadlines (docs/06 §9) ──

export const deadlineItem = z
  .object({
    kind: z.enum(DEADLINE_KINDS),
    date: z.iso.date(),
    daysLeft: z.number().int(),
    urgency: z.enum(["overdue", "critical", "soon", "upcoming", "normal"]),
    caseId: z.uuid(),
    caseTitle: z.string(),
    /** Reminder text, for reminders. */
    label: z.string().nullable(),
    recurIntervalDays: z.number().int().nullable(),
  })
  .meta({ id: "DeadlineItem" });
export const deadlineList = z.array(deadlineItem).meta({ id: "DeadlineList" });

// ── Smart alerts and notifications: live reads, rendered from message keys ──

export const alertItem = z
  .object({ id: z.string(), tier: z.enum(ALERT_TIERS), message: storedMessage, href: z.string() })
  .meta({ id: "AlertItem" });
export const alertList = z.array(alertItem).meta({ id: "AlertList" });

export const notificationItem = z
  .object({ id: z.string(), message: storedMessage, href: z.string(), at: z.iso.datetime() })
  .meta({ id: "NotificationItem" });
export const notificationList = z.array(notificationItem).meta({ id: "NotificationList" });
export const notificationCount = z
  .object({ count: z.number().int() })
  .meta({ id: "NotificationCount" });

// ── Global search ──

const searchHit = z.object({
  id: z.uuid(),
  label: z.string(),
  sub: z.string().nullable(),
  href: z.string(),
});
export const searchResults = z
  .object({
    cases: z.array(searchHit),
    clients: z.array(searchHit),
    leads: z.array(searchHit),
    documents: z.array(searchHit),
    invoices: z.array(searchHit),
    tasks: z.array(searchHit),
    employees: z.array(searchHit),
  })
  .meta({ id: "SearchResults" });

// ── Dashboard, today, journey ──

export const dashboardSummary = z
  .object({
    activeCases: z.number().int(),
    winRatePct: z.number().int().nullable(),
    criticalAlerts: z.number().int(),
    clients: z.number().int(),
    openTasks: z.number().int(),
    byClassification: z.array(z.object({ label: z.string(), count: z.number().int() })),
  })
  .meta({ id: "DashboardSummary" });

const todayDated = z.object({
  caseId: z.uuid(),
  caseTitle: z.string(),
  date: z.iso.date(),
  daysLeft: z.number().int(),
});
export const todaySummary = z
  .object({
    employeeOfWeek: z
      .object({ name: z.string(), role: z.string(), points: z.number().int() })
      .nullable(),
    hearings: z.object({
      visible: z.boolean(),
      items: z.array(todayDated),
      totalWithin7: z.number().int(),
    }),
    deadlines: z.object({
      visible: z.boolean(),
      items: z.array(
        todayDated.extend({ kind: z.enum(DEADLINE_KINDS), label: z.string().nullable() }),
      ),
      totalWithin7: z.number().int(),
    }),
    approvals: z.object({
      visible: z.boolean(),
      items: z.array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          caseId: z.uuid(),
          caseTitle: z.string(),
          stage: z.string(),
        }),
      ),
      total: z.number().int(),
    }),
    tasks: z.object({
      visible: z.boolean(),
      items: z.array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          urgent: z.boolean(),
          dueOn: z.iso.date().nullable(),
          caseTitle: z.string().nullable(),
        }),
      ),
      total: z.number().int(),
    }),
    winRate: z.object({ visible: z.boolean(), pct: z.number().int().nullable() }),
  })
  .meta({ id: "TodaySummary" });

export const journeySummary = z
  .object({
    firstContact: z.number().int(),
    inboundChats: z.number().int(),
    leadsByStage: z.record(z.enum(LEAD_STAGES), z.number().int()),
    inPipeline: z.number().int(),
    appointments: z.number().int(),
    followUps: z.number().int(),
    contracted: z.number().int(),
    activeCases: z.number().int(),
    pendingApprovals: z.number().int(),
    invoicesDue: z.number().int(),
    /** Halalas. */
    uncollected: z.number().int(),
    archivedCases: z.number().int(),
    deadlinesWithin7: z.number().int(),
    unreadNotifications: z.number().int(),
    avgSatisfaction: z.number().nullable(),
  })
  .meta({ id: "JourneySummary" });

// ── Activity feed (same audit log as the security view, a wider lens) ──

export const activityQuery = z.object({
  type: z.enum(ACTIVITY_CATEGORIES).optional(),
  actor: z.uuid().optional(),
});
export const activityFeed = z
  .object({
    rows: z.array(
      z.object({
        id: z.uuid(),
        action: z.string(),
        entity: z.string().nullable(),
        detail: z.string().nullable(),
        category: z.enum(ACTIVITY_CATEGORIES),
        actorName: z.string().nullable(),
        at: z.iso.datetime(),
      }),
    ),
    actors: z.array(z.object({ id: z.uuid(), name: z.string() })),
    counts: z.record(z.enum(ACTIVITY_CATEGORIES), z.number().int()),
  })
  .meta({ id: "ActivityFeed" });
