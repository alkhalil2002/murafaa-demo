/** Citation-gate enums (docs/02 §6). Values match the future knowledge-base tables. */

export const KnowledgeSourceType = {
  STATUTE: "STATUTE",
  REGULATION: "REGULATION",
  PRECEDENT: "PRECEDENT",
} as const;
export type KnowledgeSourceType = (typeof KnowledgeSourceType)[keyof typeof KnowledgeSourceType];

export const CitationType = {
  ARTICLE: "ARTICLE",
  STATUTE: "STATUTE",
  PRECEDENT: "PRECEDENT",
} as const;
export type CitationType = (typeof CitationType)[keyof typeof CitationType];

export const CitationMatchStatus = {
  MATCHED: "MATCHED",
  UNMATCHED: "UNMATCHED",
} as const;
export type CitationMatchStatus = (typeof CitationMatchStatus)[keyof typeof CitationMatchStatus];

export const CitationAction = {
  KEPT: "KEPT",
  BLOCKED: "BLOCKED",
  FLAGGED: "FLAGGED",
} as const;
export type CitationAction = (typeof CitationAction)[keyof typeof CitationAction];

export const GateVerdict = {
  PASSED: "PASSED",
  FLAGGED: "FLAGGED",
  BLOCKED: "BLOCKED",
} as const;
export type GateVerdict = (typeof GateVerdict)[keyof typeof GateVerdict];
