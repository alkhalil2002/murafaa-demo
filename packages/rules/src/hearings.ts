/** Hearing and task enumerations (legacy Prisma enums). Labels in @murafaa/i18n. */

/** Labels: hearing.status.* */
export const HEARING_STATUSES = ["UPCOMING", "HELD"] as const;
export type HearingStatus = (typeof HEARING_STATUSES)[number];

/** What a pending (معلّقة) hearing is still waiting for (legacy wizard step 4). Labels: cases.hearings.pendingItems.* */
export const HEARING_PENDING_ITEMS = ["minutes", "nextHearing"] as const;
export type HearingPendingItem = (typeof HEARING_PENDING_ITEMS)[number];

/** Task board columns. Labels: taskColumn.* */
export const TASK_COLUMNS = ["NEW", "IN_PROGRESS", "DONE"] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

/** Labels: taskPriority.* */
export const TASK_PRIORITIES = ["URGENT", "NORMAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Labels: taskCategory.* */
export const TASK_CATEGORIES = [
  "CONTRACT_SIGNING",
  "MEMO_DRAFTING",
  "CONTRACT_DOC_REVIEW",
  "LEGAL_RESEARCH",
  "PROCEDURAL_FOLLOWUP",
  "CLIENT_CORRESPONDENCE",
  "GENERAL",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** Where a task came from; AUTO_* tasks are created once per signature. */
export const TASK_SOURCES = [
  "MANUAL",
  "AUTO_HEARING_PREP",
  "AUTO_OBJECTION",
  "HEARING_ACTION",
  "AUTO_EXECUTION_FOLLOWUP",
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const REMINDER_SOURCES = [
  "MANUAL",
  "PENDING_HEARING",
  "HEARING_MINUTES",
  "EXECUTION_FOLLOWUP",
] as const;
export type ReminderSource = (typeof REMINDER_SOURCES)[number];

/** Which side filed something. Labels: docParty.* */
export const DOC_PARTIES = ["OURS", "OPPONENT", "COURT"] as const;
export type DocParty = (typeof DOC_PARTIES)[number];

/** Signatures that make automatic tasks idempotent (docs BR-TASK-3). */
export const autoTaskSignature = {
  objection: (caseId: string, dueIso: string) => `obj:${caseId}:${dueIso}`,
  hearingPrep: (caseId: string, dateIso: string) => `prep:${caseId}:${dateIso}`,
};
