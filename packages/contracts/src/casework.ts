import {
  APPROVAL_STAGES,
  CLIENT_APPROVAL_KINDS,
  CLIENT_APPROVAL_STATUSES,
  CLIENT_COMMUNICATION_TYPES,
  DOC_PARTIES,
  EXEC_FILE_STATUSES,
  EXEC_PROC_STATUSES,
  EXEC_PROC_TYPES,
  MAX_HALALAS,
  MESSAGE_SENDER_TYPES,
} from "@murafaa/rules";
import { z } from "zod";
import { storedMessage } from "./cases.js";
import { dateOnly } from "./hearings.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const halalas = z.number().int().min(0).max(MAX_HALALAS);
const logEntry = z.object({
  id: z.uuid(),
  message: storedMessage.nullable(),
  text: z.string().nullable(),
  actorName: z.string().nullable(),
  occurredAt: z.iso.datetime(),
});

// ── Internal approvals (الاعتمادات) ──

export const caseApproval = z
  .object({
    id: z.uuid(),
    title: z.string(),
    stage: z.enum(APPROVAL_STAGES),
    hearingId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    log: z.array(logEntry),
  })
  .meta({ id: "CaseApproval" });
export const caseApprovalList = z.array(caseApproval).meta({ id: "CaseApprovalList" });
export const createApprovalBody = z
  .object({ title: text(300), hearingId: z.uuid().nullish() })
  .meta({ id: "CreateApprovalBody" });
export const rejectApprovalBody = z
  .object({ note: optional(1000) })
  .meta({ id: "RejectApprovalBody" });
export const approvalParams = z.object({ id: z.uuid(), approvalId: z.uuid() });

// ── Contracts ──

export const caseContract = z
  .object({
    id: z.uuid(),
    title: z.string(),
    isSigned: z.boolean(),
    signedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "CaseContract" });
export const caseContractList = z.array(caseContract).meta({ id: "CaseContractList" });
export const contractBody = z.object({ title: text(300) }).meta({ id: "ContractBody" });
export const contractParams = z.object({ id: z.uuid(), contractId: z.uuid() });

// ── Client contact log ──

export const clientCommunication = z
  .object({
    id: z.uuid(),
    type: z.enum(CLIENT_COMMUNICATION_TYPES),
    note: z.string(),
    authorName: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "ClientCommunication" });
export const clientCommunicationList = z
  .array(clientCommunication)
  .meta({ id: "ClientCommunicationList" });
export const communicationBody = z
  .object({ type: z.enum(CLIENT_COMMUNICATION_TYPES), note: text(4000) })
  .meta({ id: "CommunicationBody" });
export const communicationParams = z.object({ id: z.uuid(), communicationId: z.uuid() });

// ── Case chat ──

export const caseMessage = z
  .object({
    id: z.uuid(),
    senderType: z.enum(MESSAGE_SENDER_TYPES),
    senderName: z.string().nullable(),
    body: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "CaseMessage" });
export const caseMessageList = z.array(caseMessage).meta({ id: "CaseMessageList" });
export const messageBody = z.object({ body: text(4000) }).meta({ id: "MessageBody" });

// ── Client approval requests (decided by the client on the portal) ──

export const clientApproval = z
  .object({
    id: z.uuid(),
    title: z.string(),
    kind: z.enum(CLIENT_APPROVAL_KINDS),
    amount: z.number().int().nullable(),
    note: z.string().nullable(),
    status: z.enum(CLIENT_APPROVAL_STATUSES),
    decisionNote: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "ClientApproval" });
export const clientApprovalList = z.array(clientApproval).meta({ id: "ClientApprovalList" });
export const clientApprovalBody = z
  .object({
    title: text(300),
    kind: z.enum(CLIENT_APPROVAL_KINDS),
    amount: halalas.nullish(),
    note: optional(2000),
  })
  .meta({ id: "ClientApprovalBody" });

// ── Execution (تنفيذ) ──

const execFields = {
  court: optional(200),
  requestNo: optional(100),
  amount: halalas.nullish(),
  debtor: optional(200),
  basis: optional(500),
};
export const openExecutionBody = z
  .object({ ...execFields, openedAt: dateOnly.nullish() })
  .meta({ id: "OpenExecutionBody" });
export const updateExecutionBody = z.object(execFields).meta({ id: "UpdateExecutionBody" });
export const executionStatusBody = z
  .object({ status: z.enum(EXEC_FILE_STATUSES) })
  .meta({ id: "ExecutionStatusBody" });
export const collectionBody = z
  .object({ amount: z.number().int().min(1).max(MAX_HALALAS) })
  .meta({ id: "CollectionBody" });
const procFields = {
  type: z.enum(EXEC_PROC_TYPES),
  note: optional(2000),
  party: z.enum(DOC_PARTIES).nullish(),
  date: dateOnly.nullish(),
};
export const executionProcedureBody = z
  .object({
    ...procFields,
    followUpDate: dateOnly.nullish(),
    followUpAssigneeId: z.uuid().nullish(),
  })
  .meta({ id: "ExecutionProcedureBody" });
export const updateExecutionProcedureBody = z
  .object(procFields)
  .meta({ id: "UpdateExecutionProcedureBody" });
export const executionProcedureParams = z.object({ id: z.uuid(), procedureId: z.uuid() });

export const caseExecution = z
  .object({
    id: z.uuid(),
    court: z.string().nullable(),
    requestNo: z.string().nullable(),
    amount: z.number().int().nullable(),
    collected: z.number().int(),
    debtor: z.string().nullable(),
    basis: z.string().nullable(),
    openedAt: z.iso.datetime().nullable(),
    status: z.enum(EXEC_FILE_STATUSES),
    procedures: z.array(
      z.object({
        id: z.uuid(),
        type: z.string(),
        status: z.enum(EXEC_PROC_STATUSES),
        note: z.string().nullable(),
        party: z.enum(DOC_PARTIES).nullable(),
        date: z.iso.datetime().nullable(),
        followUpDate: z.iso.datetime().nullable(),
        followUpAssigneeName: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: "CaseExecution" });
export const caseExecutionView = z
  .object({ execution: caseExecution.nullable() })
  .meta({ id: "CaseExecutionView" });

/** واتساب: hand-recorded message contacts across the visible cases. */
export const whatsappLog = z
  .array(
    z.object({
      id: z.uuid(),
      note: z.string(),
      createdAt: z.iso.datetime(),
      caseId: z.uuid(),
      caseTitle: z.string(),
      clientName: z.string().nullable(),
      clientPhone: z.string().nullable(),
    }),
  )
  .meta({ id: "WhatsappLog" });
