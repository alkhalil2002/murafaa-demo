/** Client contact log kinds (legacy ClientCommunicationType). Labels: clientCommunicationType.* */
export const CLIENT_COMMUNICATION_TYPES = ["CALL", "MESSAGE", "MEETING", "EMAIL"] as const;
export type ClientCommunicationType = (typeof CLIENT_COMMUNICATION_TYPES)[number];

/** Who wrote a case chat message. */
export const MESSAGE_SENDER_TYPES = ["STAFF", "CLIENT"] as const;
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

/** Client-facing approval requests (legacy ClientApprovalKind/Status). Labels: clientApprovalKind.*, clientApprovalStatus.* */
export const CLIENT_APPROVAL_KINDS = ["MEMO", "FEE", "SETTLEMENT"] as const;
export type ClientApprovalKind = (typeof CLIENT_APPROVAL_KINDS)[number];
export const CLIENT_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ClientApprovalStatus = (typeof CLIENT_APPROVAL_STATUSES)[number];

/** A memo carries no amount; fee and settlement requests may (legacy). */
export function clientApprovalAmount(
  kind: ClientApprovalKind,
  amount: number | null | undefined,
): number | null {
  return kind === "MEMO" ? null : (amount ?? null);
}

/**
 * Approval pipeline: the step out of the PARTNER stage is the partner's own
 * approval, so it needs the partner-tier level (CASES at FULL). Legacy let
 * any editor take it.
 */
export function approvalStepNeedsPartner(current: string): boolean {
  return current === "PARTNER";
}
