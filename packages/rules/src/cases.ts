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
