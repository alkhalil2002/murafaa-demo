import {
  DOC_PARTIES,
  HEARING_KINDS,
  HEARING_PENDING_ITEMS,
  PROC_REQUEST_TYPES,
  TASK_CATEGORIES,
  TASK_COLUMNS,
  TASK_PRIORITIES,
} from "@murafaa/rules";
import { z } from "zod";

/** A calendar date from a date input (YYYY-MM-DD), stored as that day's UTC midnight. */
export const dateOnly = z.iso.date().transform((d) => new Date(`${d}T00:00:00.000Z`));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const hearingKind = z.enum(HEARING_KINDS);
export const docParty = z.enum(DOC_PARTIES);
export const procRequestType = z.enum(PROC_REQUEST_TYPES);
export const stageIndex = z.number().int().min(0).max(4);

/**
 * Record a held hearing (legacy 4-step wizard) and run the automation:
 * judgment → objection deadline + urgent task; next date → single upcoming
 * hearing + prep task + clash check; optional follow-up reminder, task and
 * procedural request in the same pass.
 */
export const recordHearingBody = z
  .object({
    hearingDate: dateOnly,
    kind: hearingKind.nullish(),
    stageIndex: stageIndex.nullish(),
    minutes: optionalText(20000),
    result: optionalText(500),
    clientReport: optionalText(10000),
    nextHearingDate: dateOnly.nullish(),
    isPending: z.boolean().default(false),
    pendingItems: z.array(z.enum(HEARING_PENDING_ITEMS)).default([]),
    reminderRecurDays: z.number().int().min(1).max(365).nullish(),
    actionReminderText: optionalText(500),
    actionReminderDueOn: dateOnly.nullish(),
    actionTaskTitle: optionalText(300),
    actionTaskAssigneeId: z.uuid().nullish(),
    actionTaskDueAt: dateOnly.nullish(),
    actionRequestParty: docParty.nullish(),
    actionRequestType: procRequestType.nullish(),
    actionRequestText: optionalText(1000),
  })
  .meta({ id: "RecordHearingBody" });

export const updateHearingBody = z
  .object({
    hearingDate: dateOnly.optional(),
    kind: hearingKind.nullish(),
    stageIndex: stageIndex.nullish(),
    minutes: optionalText(20000),
    result: optionalText(500),
    clientReport: optionalText(10000),
    isPending: z.boolean().optional(),
    pendingItems: z.array(z.enum(HEARING_PENDING_ITEMS)).optional(),
    reminderRecurDays: z.number().int().min(1).max(365).nullish(),
  })
  .meta({ id: "UpdateHearingBody" });

export const nextHearingBody = z.object({ date: dateOnly }).meta({ id: "NextHearingBody" });
export const hearingParams = z.object({ id: z.uuid(), hearingId: z.uuid() });
export const hearingItemParams = z.object({ id: z.uuid(), hearingId: z.uuid(), itemId: z.uuid() });

export const reminderBody = z
  .object({
    text: z.string().trim().min(1).max(500),
    dueOn: dateOnly,
    recurIntervalDays: z.number().int().min(1).max(365).nullish(),
  })
  .meta({ id: "ReminderBody" });
export const updateReminderBody = z
  .object({ text: z.string().trim().min(1).max(500), dueOn: dateOnly })
  .meta({ id: "UpdateReminderBody" });
export const escalateReminderBody = z
  .object({ assigneeId: z.uuid().nullish() })
  .meta({ id: "EscalateReminderBody" });

export const hearingTaskBody = z
  .object({
    title: z.string().trim().min(1).max(300),
    assigneeId: z.uuid().nullish(),
    dueAt: dateOnly.nullish(),
  })
  .meta({ id: "HearingTaskBody" });
export const updateHearingTaskBody = hearingTaskBody
  .extend({ done: z.boolean().optional() })
  .meta({ id: "UpdateHearingTaskBody" });

export const decideReportBody = z.object({ approve: z.boolean() }).meta({ id: "DecideReportBody" });

export const procedureRequestBody = z
  .object({
    stageIndex,
    party: docParty,
    type: procRequestType.nullish(),
    text: z.string().trim().min(1).max(1000),
    hearingId: z.uuid().nullish(),
  })
  .meta({ id: "ProcedureRequestBody" });
export const procedureRequestParams = z.object({ id: z.uuid(), requestId: z.uuid() });

const storedMessage = z.object({
  messageKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const hearingAction = z.object({
  reminders: z.array(
    z.object({
      id: z.uuid(),
      text: z.string(),
      dueOn: z.iso.datetime(),
      isTaskLinked: z.boolean(),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      assigneeId: z.uuid().nullable(),
      assigneeName: z.string().nullable(),
      dueAt: z.iso.datetime().nullable(),
      done: z.boolean(),
    }),
  ),
});

export const hearing = z
  .object({
    id: z.uuid(),
    sequenceNo: z.number().int().nullable(),
    hearingDate: z.iso.datetime(),
    status: z.enum(["UPCOMING", "HELD"]),
    stageIndex: z.number().int().nullable(),
    kind: hearingKind.nullable(),
    minutes: z.string().nullable(),
    result: z.string().nullable(),
    clientReport: z.string().nullable(),
    reportApprovalRequested: z.boolean(),
    reportApproved: z.boolean(),
    reportSentToClient: z.boolean(),
    isPending: z.boolean(),
    pendingItems: z.array(z.string()),
    reminderRecurDays: z.number().int().nullable(),
    actions: hearingAction,
  })
  .meta({ id: "Hearing" });

export const procedureRequest = z
  .object({
    id: z.uuid(),
    hearingId: z.uuid().nullable(),
    stageIndex: z.number().int(),
    party: docParty,
    type: z.string().nullable(),
    text: z.string(),
    status: z.enum(["SUBMITTED", "PENDING", "ACCEPTED", "REJECTED"]),
    log: z.array(
      z.object({
        id: z.uuid(),
        message: storedMessage.nullable(),
        text: z.string().nullable(),
        occurredAt: z.iso.datetime(),
      }),
    ),
  })
  .meta({ id: "ProcedureRequest" });

// ── Tasks board (module TASKS) ──

export const taskItem = z
  .object({
    id: z.uuid(),
    title: z.string(),
    assigneeId: z.uuid().nullable(),
    assigneeName: z.string().nullable(),
    priority: z.enum(TASK_PRIORITIES),
    dueAt: z.iso.datetime().nullable(),
    category: z.enum(TASK_CATEGORIES).nullable(),
    status: z.enum(TASK_COLUMNS),
    origin: z.string(),
    caseId: z.uuid().nullable(),
    caseTitle: z.string().nullable(),
  })
  .meta({ id: "TaskItem" });
export const taskList = z.array(taskItem).meta({ id: "TaskList" });

export const createTaskBody = z
  .object({
    title: z.string().trim().min(1).max(300),
    assigneeId: z.uuid().nullish(),
    priority: z.enum(TASK_PRIORITIES).default("NORMAL"),
    dueAt: dateOnly.nullish(),
    caseId: z.uuid().nullish(),
    category: z.enum(TASK_CATEGORIES).nullish(),
  })
  .meta({ id: "CreateTaskBody" });
export const moveTaskBody = z.object({ status: z.enum(TASK_COLUMNS) }).meta({ id: "MoveTaskBody" });
