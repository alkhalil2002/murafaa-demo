import {
  CASE_OUTCOMES,
  type CaseOutcome,
  PROC_STAGES,
  type ProcStage,
  type HearingKind,
} from "./procedural.js";

/**
 * Case rules that were embedded in the legacy services (cases.ts, hearings.ts,
 * today.ts). Pure; the cases module calls them.
 */

/** Phrases in a hearing's result/minutes that mean judgment was delivered. */
export const JUDGMENT_TEXT = /بالحكم|صدر الحكم|صدور الحكم|نطقت/;

/**
 * Whether a recorded hearing delivered the judgment, which starts the 30-day
 * objection deadline (docs/06 §1). An explicit hearing kind wins; without one,
 * fall back to the result/minutes text.
 */
export function isJudgment(
  kind: HearingKind | null | undefined,
  result?: string | null,
  minutes?: string | null,
): boolean {
  if (kind != null) return kind === "JUDGMENT_PRONOUNCEMENT";
  return JUDGMENT_TEXT.test(`${result ?? ""} ${minutes ?? ""}`);
}

/** The stage before `stage` (remand), or null at the first stage. */
export function prevProcStage(stage: ProcStage): ProcStage | null {
  const i = PROC_STAGES.indexOf(stage);
  return i > 0 ? (PROC_STAGES[i - 1] ?? null) : null;
}

/**
 * The stage a case is effectively in: the stage of its most recent HELD
 * hearing that recorded one, else the stored baseline stage.
 */
export function effectiveStage(
  baseline: ProcStage,
  hearings: readonly {
    status: "UPCOMING" | "HELD";
    stageIndex: number | null;
    hearingDate: Date;
  }[],
): ProcStage {
  const latest = hearings
    .filter((h) => h.status === "HELD" && h.stageIndex != null)
    .sort((a, b) => b.hearingDate.getTime() - a.hearingDate.getTime())[0];
  if (latest?.stageIndex != null) return PROC_STAGES[latest.stageIndex] ?? baseline;
  return baseline;
}

/**
 * Office win rate in whole percent: (won + ½ × partial) / cases with an
 * outcome. Null when no case has an outcome yet.
 */
export function winRate(countByOutcome: Partial<Record<CaseOutcome, number>>): number | null {
  const total = CASE_OUTCOMES.reduce((sum, o) => sum + (countByOutcome[o] ?? 0), 0);
  if (total === 0) return null;
  const won = countByOutcome.WON ?? 0;
  const partial = countByOutcome.PARTIAL ?? 0;
  return Math.round(((won + partial * 0.5) / total) * 100);
}

/** Our client's side in the case. Labels: cases.role.plaintiff / cases.role.defendant. */
export const PARTY_ROLES = ["PLAINTIFF", "DEFENDANT"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

/** The opponent is on the other side of our client. */
export function opponentRole(role: PartyRole): PartyRole {
  return role === "PLAINTIFF" ? "DEFENDANT" : "PLAINTIFF";
}

/** Case timeline event kinds. Labels: caseEventType.* */
export const CASE_EVENT_TYPES = [
  "STAGE",
  "REQUEST",
  "DOC",
  "APPROVAL",
  "OPENING",
  "DEADLINE",
  "MESSAGE",
  "SYSTEM",
] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];

/** Conflict flag lifecycle: WAIVED is a documented partner decision; RESOLVED means it stopped firing. */
export const CONFLICT_STATUSES = ["ACTIVE", "WAIVED", "RESOLVED"] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

/** The fixed closing checklist (legacy CLOSING_CHECKLIST_ITEMS). Labels: cases.closing.checklist.* */
export const CLOSING_CHECKLIST_ITEMS = [
  "finalSettlement",
  "returnClientDocs",
  "closeLinkedTasks",
  "archiveFile",
] as const;
export type ClosingChecklistKey = (typeof CLOSING_CHECKLIST_ITEMS)[number];

/** Client satisfaction is a whole number of stars from 1 to 5. */
export function clampSatisfaction(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}
