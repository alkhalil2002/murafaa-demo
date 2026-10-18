import {
  CASE_EVENT_TYPES,
  CASE_OUTCOMES,
  CASE_STATUSES,
  CLOSING_CHECKLIST_ITEMS,
  CONFLICT_STATUSES,
  PARTY_ROLES,
  PROC_STAGES,
} from "@murafaa/rules";
import { z } from "zod";

export const procStage = z.enum(PROC_STAGES);
export const caseStatus = z.enum(CASE_STATUSES);
export const caseOutcome = z.enum(CASE_OUTCOMES);
export const partyRole = z.enum(PARTY_ROLES);
export const conflictSeverity = z.enum(["HIGH", "MEDIUM"]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** A message stored as an i18n key + params (render with tStored on the client). */
export const storedMessage = z.object({
  messageKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const caseListItem = z
  .object({
    id: z.uuid(),
    number: z.string(),
    title: z.string(),
    clientName: z.string().nullable(),
    opposingParty: z.string().nullable(),
    city: z.string().nullable(),
    najizMainClass: z.string().nullable(),
    stage: procStage,
    status: caseStatus,
    conflictSeverity: conflictSeverity.nullable(),
  })
  .meta({ id: "CaseListItem" });
export const caseList = z.array(caseListItem).meta({ id: "CaseList" });

export const caseEvent = z
  .object({
    id: z.uuid(),
    type: z.enum(CASE_EVENT_TYPES),
    message: storedMessage.nullable(),
    text: z.string().nullable(),
    actorName: z.string().nullable(),
    occurredAt: z.iso.datetime(),
  })
  .meta({ id: "CaseEvent" });

export const conflictFlag = z
  .object({
    id: z.uuid(),
    severity: conflictSeverity,
    status: z.enum(CONFLICT_STATUSES),
    /** Already scope-safe: titles of cases the viewer can't see are replaced by a count. */
    message: storedMessage,
    waiverNote: z.string().nullable(),
  })
  .meta({ id: "ConflictFlag" });

export const caseDetail = z
  .object({
    id: z.uuid(),
    number: z.string(),
    title: z.string(),
    clientRole: partyRole,
    client: z.object({ id: z.uuid(), name: z.string(), phone: z.string().nullable() }).nullable(),
    opposingParty: z.string().nullable(),
    entity: z.string().nullable(),
    najizMainClass: z.string().nullable(),
    najizSubClass: z.string().nullable(),
    najizCaseType: z.string().nullable(),
    city: z.string().nullable(),
    stage: procStage,
    /** The stage shown to users: the latest held hearing's stage, else `stage`. */
    effectiveStage: procStage,
    status: caseStatus,
    outcome: caseOutcome.nullable(),
    judgmentDate: z.iso.datetime().nullable(),
    objectionDueAt: z.iso.datetime().nullable(),
    procEnded: z.boolean(),
    procResult: z.string().nullable(),
    closingChecklist: z.record(z.string(), z.boolean()),
    clientSatisfactionScore: z.number().int().nullable(),
    referralRequested: z.boolean(),
    isArchived: z.boolean(),
    assignees: z.array(z.object({ userId: z.uuid(), name: z.string() })),
    conflicts: z.array(conflictFlag),
    events: z.array(caseEvent),
  })
  .meta({ id: "CaseDetail" });

const caseFields = {
  number: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  clientRole: partyRole,
  clientId: z.uuid().nullish(),
  opposingParty: optionalText(300),
  entity: optionalText(300),
  najizMainClass: optionalText(200),
  najizSubClass: optionalText(200),
  najizCaseType: optionalText(200),
  city: optionalText(100),
  stage: procStage,
  status: caseStatus,
};

export const createCaseBody = z
  .object({
    ...caseFields,
    clientRole: caseFields.clientRole.default("PLAINTIFF"),
    stage: caseFields.stage.default("FIRST_INSTANCE"),
    status: caseFields.status.default("ACTIVE"),
    assigneeIds: z.array(z.uuid()).max(50).default([]),
  })
  .meta({ id: "CreateCaseBody" });

export const updateCaseBody = z.object(caseFields).partial().meta({ id: "UpdateCaseBody" });

export const setOutcomeBody = z
  .object({ outcome: caseOutcome.nullable() })
  .meta({ id: "SetOutcomeBody" });
export const assigneeBody = z.object({ userId: z.uuid() }).meta({ id: "AssigneeBody" });
export const caseAssigneeParams = z.object({ id: z.uuid(), userId: z.uuid() });
export const endProcedureBody = z
  .object({ result: optionalText(500) })
  .meta({ id: "EndProcedureBody" });
export const checklistBody = z
  .object({ key: z.enum(CLOSING_CHECKLIST_ITEMS) })
  .meta({ id: "ChecklistBody" });
export const satisfactionBody = z
  .object({ score: z.number().int().min(1).max(5) })
  .meta({ id: "SatisfactionBody" });
export const waiveConflictBody = z
  .object({ note: z.string().trim().min(1).max(1000) })
  .meta({ id: "WaiveConflictBody" });
export const conflictParams = z.object({ id: z.uuid(), flagId: z.uuid() });

export const assignableUsers = z
  .array(z.object({ id: z.uuid(), name: z.string() }))
  .meta({ id: "AssignableUsers" });

export const createdCase = z.object({ id: z.uuid() }).meta({ id: "CreatedCase" });
export const convertedLead = z
  .object({ clientId: z.uuid(), caseId: z.uuid() })
  .meta({ id: "ConvertedLead" });
