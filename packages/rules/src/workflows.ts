/**
 * Ordered pipelines and status cycles that were embedded in legacy services
 * (leads.ts, approvals.ts, hr/recruitment.ts, procedure-requests.ts,
 * execution.ts). Labels live in @murafaa/i18n.
 */

/** CRM lead pipeline; moving is bounded at both ends. Labels: leadStage.* */
export const LEAD_STAGES = [
  "PROSPECT",
  "FIRST_CONSULTATION",
  "FEE_PROPOSAL_SENT",
  "CONTRACTED",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Internal document approval chain, advanced one step at a time. Labels: approvalStage.* */
export const APPROVAL_STAGES = [
  "DRAFT",
  "SENIOR_LAWYER",
  "COUNSEL",
  "PROOFREADING",
  "PARTNER",
  "APPROVED",
] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

/** Recruitment pipeline. Labels: hr.recruit.stage.* */
export const CANDIDATE_STAGES = ["APPLIED", "INTERVIEW", "OFFER", "HIRED"] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

/** Procedural request statuses; the UI cycles through them. Labels: procedureRequestStatus.* */
export const PROCEDURE_REQUEST_STATUSES = ["SUBMITTED", "PENDING", "ACCEPTED", "REJECTED"] as const;
export type ProcedureRequestStatus = (typeof PROCEDURE_REQUEST_STATUSES)[number];

/** Move one step through an ordered pipeline; stays put at either end. */
export function stepStage<T extends string>(order: readonly T[], current: T, direction: 1 | -1): T {
  const next = order.indexOf(current) + direction;
  return next < 0 || next >= order.length ? current : (order[next] ?? current);
}

/** The next value in a cycle, wrapping from the last back to the first. */
export function cycleNext<T extends string>(order: readonly T[], current: T): T {
  return order[(order.indexOf(current) + 1) % order.length] ?? current;
}

/**
 * Execution file status after recording a collection: CLOSED and STALLED are
 * sticky; reaching the judged amount is FULLY_COLLECTED; anything collected is
 * PARTIALLY_COLLECTED.
 */
export function statusAfterCollection<
  S extends "ACTIVE" | "PARTIALLY_COLLECTED" | "FULLY_COLLECTED" | "STALLED" | "CLOSED",
>(
  current: S,
  amountMinor: number | null,
  collectedMinor: number,
): S | "FULLY_COLLECTED" | "PARTIALLY_COLLECTED" {
  if (current === "CLOSED" || current === "STALLED") return current;
  if (amountMinor != null && collectedMinor >= amountMinor) return "FULLY_COLLECTED";
  if (collectedMinor > 0) return "PARTIALLY_COLLECTED";
  return current;
}
