/**
 * Fixed procedural enumerations (docs/06 §10). Order matters where the docs
 * give one (litigation stages run RECONCILIATION → EXECUTION). Labels live in
 * @murafaa/i18n under case.stage.*, hearing.kind.*, execProcStatus.*,
 * execFileStatus.*, case.outcome.* and case.status.*.
 */

/** Litigation stages in procedural order (PROC_STAGES). */
export const PROC_STAGES = [
  "RECONCILIATION",
  "FIRST_INSTANCE",
  "APPEAL",
  "CASSATION",
  "EXECUTION",
] as const;
export type ProcStage = (typeof PROC_STAGES)[number];

/** The 10 hearing kinds (HEARING_KINDS). */
export const HEARING_KINDS = [
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
] as const;
export type HearingKind = (typeof HEARING_KINDS)[number];

/** Status of one execution procedure (EXEC_STATUS). */
export const EXEC_PROC_STATUSES = ["REQUIRED", "IN_PROGRESS", "EXECUTED", "STALLED"] as const;
export type ExecProcStatus = (typeof EXEC_PROC_STATUSES)[number];

/** Status of an execution file as a whole (collection progress). */
export const EXEC_FILE_STATUSES = [
  "ACTIVE",
  "PARTIALLY_COLLECTED",
  "FULLY_COLLECTED",
  "STALLED",
  "CLOSED",
] as const;
export type ExecFileStatus = (typeof EXEC_FILE_STATUSES)[number];

/** Case outcomes; they feed the dashboard win rate. */
export const CASE_OUTCOMES = ["WON", "PARTIAL", "SETTLED", "LOST"] as const;
export type CaseOutcome = (typeof CASE_OUTCOMES)[number];

export const CASE_STATUSES = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** The stage after `stage`, or null at the last stage (EXECUTION). */
export function nextProcStage(stage: ProcStage): ProcStage | null {
  return PROC_STAGES[PROC_STAGES.indexOf(stage) + 1] ?? null;
}
