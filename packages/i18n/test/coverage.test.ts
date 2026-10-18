import {
  ACCOUNT_TYPES,
  APPROVAL_STAGES,
  CANDIDATE_STAGES,
  CASE_EVENT_TYPES,
  DOC_PARTIES,
  HEARING_PENDING_ITEMS,
  HEARING_STATUSES,
  TASK_CATEGORIES,
  TASK_COLUMNS,
  TASK_PRIORITIES,
  CASE_OUTCOMES,
  CLOSING_CHECKLIST_ITEMS,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  LEAD_SOURCES,
  CASE_STATUSES,
  EMPLOYEE_STATUSES,
  EXEC_FILE_STATUSES,
  EXEC_PROC_STATUSES,
  HEARING_KINDS,
  LEAD_STAGES,
  NITAQAT_BANDS,
  PERFORMANCE_EVENT_KINDS,
  PROC_STAGES,
  PROCEDURE_REQUEST_STATUSES,
} from "@murafaa/rules";
import { PermLevel, PermModule } from "@murafaa/auth";
import { DOC_KINDS, DocumentTemplateCategory } from "@murafaa/documents";
import { describe, expect, it } from "vitest";
import { ar } from "../src/index.js";

/** Every enum value a screen can show must have an Arabic label. */
const LABELLED: Array<[prefix: string, values: readonly string[]]> = [
  ["case.stage.", PROC_STAGES],
  ["hearing.kind.", HEARING_KINDS],
  ["execProcStatus.", EXEC_PROC_STATUSES],
  ["execFileStatus.", EXEC_FILE_STATUSES],
  ["case.outcome.", CASE_OUTCOMES],
  ["case.status.", CASE_STATUSES],
  ["nitaqat.", NITAQAT_BANDS.map((b) => b.key)],
  ["docCategory.", Object.values(DocumentTemplateCategory)],
  ["docKind.", DOC_KINDS],
  ["leadStage.", LEAD_STAGES],
  ["caseEventType.", CASE_EVENT_TYPES],
  ["hearing.status.", HEARING_STATUSES],
  ["cases.hearings.pendingItems.", HEARING_PENDING_ITEMS],
  ["taskColumn.", TASK_COLUMNS],
  ["taskPriority.", TASK_PRIORITIES],
  ["taskCategory.", TASK_CATEGORIES],
  ["docParty.", DOC_PARTIES],
  ["cases.closing.checklist.", CLOSING_CHECKLIST_ITEMS],
  ["leadSource.", LEAD_SOURCES],
  ["clientType.", CLIENT_TYPES],
  ["clientStatus.", CLIENT_STATUSES],
  ["approvalStage.", APPROVAL_STAGES],
  ["hr.recruit.stage.", CANDIDATE_STAGES],
  ["procedureRequestStatus.", PROCEDURE_REQUEST_STATUSES],
  ["performanceEventKind.", PERFORMANCE_EVENT_KINDS],
  ["accType.", ACCOUNT_TYPES],
  ["empStatus.", EMPLOYEE_STATUSES],
  ["module.", Object.values(PermModule).map((m) => m.toLowerCase())],
  ["permLevel.", Object.values(PermLevel)],
];

describe("i18n coverage of rule enumerations", () => {
  it.each(LABELLED)("%s* has a label for every value", (prefix, values) => {
    const missing = values.filter((v) => !(`${prefix}${v}` in ar));
    expect(missing).toEqual([]);
  });
});
