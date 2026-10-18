/**
 * Domain enums used by the rules. Values match the database enums in
 * @murafaa/database so rule inputs can be passed straight from rows.
 */

export const FeeType = {
  FLAT: "FLAT",
  RETAINER: "RETAINER",
  HOURLY: "HOURLY",
  PERCENTAGE: "PERCENTAGE",
} as const;
export type FeeType = (typeof FeeType)[keyof typeof FeeType];

export const InvoiceBaseStatus = {
  DUE: "DUE",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;
export type InvoiceBaseStatus = (typeof InvoiceBaseStatus)[keyof typeof InvoiceBaseStatus];

export const TrustTxnType = {
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  TRANSFER_TO_FEES: "TRANSFER_TO_FEES",
} as const;
export type TrustTxnType = (typeof TrustTxnType)[keyof typeof TrustTxnType];

export const ConflictSeverity = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
} as const;
export type ConflictSeverity = (typeof ConflictSeverity)[keyof typeof ConflictSeverity];

export const ConflictType = {
  OPPONENT_IS_CLIENT: "OPPONENT_IS_CLIENT",
  OPPONENT_IS_LEAD: "OPPONENT_IS_LEAD",
  OPPONENT_IS_OUR_CLIENT_OTHER_CASE: "OPPONENT_IS_OUR_CLIENT_OTHER_CASE",
  OUR_CLIENT_IS_OPPONENT_OTHER_CASE: "OUR_CLIENT_IS_OPPONENT_OTHER_CASE",
} as const;
export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];
