import { ConflictSeverity, ConflictType } from "@prisma/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Conflict-of-interest detection (docs/06 §4) — PURE. Given a subject case and
 * the office's candidate clients/leads/other-cases, returns the conflict
 * findings. No DB, no I/O: the service loads office-scoped candidates and calls
 * this. Findings carry i18n message keys + params, never Arabic literals
 * (guardrail 6).
 *
 * The four rules (docs/06 §4):
 *   1. opponent is a registered CLIENT           → HIGH
 *   2. opponent is a LEAD in the pipeline         → MEDIUM
 *   3. opponent is OUR client in another case     → HIGH
 *   4. our client is the opponent in another case → HIGH
 */

export type ConflictSubject = {
  id: string;
  opposingParty: string | null;
  /** Our client's name, resolved from clientId → Client.name. */
  clientName: string | null;
};

export type CandidateClient = { id: string; name: string };
export type CandidateLead = { id: string; name: string };
export type CandidateCase = {
  id: string;
  title: string;
  clientName: string | null;
  opposingParty: string | null;
};

export type ConflictCandidates = {
  clients: CandidateClient[];
  leads: CandidateLead[];
  /** Other cases in the office (the caller must exclude the subject case). */
  otherCases: CandidateCase[];
};

export type ConflictFinding = {
  conflictType: ConflictType;
  severity: ConflictSeverity;
  /** The original (trimmed) name that triggered the match — for display/storage. */
  matchedName: string;
  matchedClientId?: string;
  matchedLeadId?: string;
  matchedCaseIds?: string[];
  matchedCaseTitles?: string[];
  messageKey: MessageKey;
  messageParams: Record<string, string>;
};

/**
 * Arabic-aware name normalization for identity matching. This intentionally
 * HARDENS the prototype's trim-only compare (caseConflicts ~1225): a conflict
 * miss is a serious professional-liability risk, so matching errs toward
 * catching more (fewer false negatives). Normalizes alef/ya/ta-marbuta
 * variants, strips tashkeel + tatweel, collapses whitespace, lowercases Latin.
 */
export function normalizeName(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .replace(/[ً-ْٰ]/g, "") // tashkeel + superscript alef
    .replace(/ـ/g, "") // tatweel
    .replace(/[أإآٱ]/g, "ا") // أإآٱ → ا
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ى/g, "ي") // ى → ي
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function detectConflicts(
  subject: ConflictSubject,
  candidates: ConflictCandidates,
): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  const oppRaw = String(subject.opposingParty ?? "").trim();
  const cliRaw = String(subject.clientName ?? "").trim();
  const opp = normalizeName(oppRaw);
  const cli = normalizeName(cliRaw);

  // Rules 1–3 require a non-empty opponent.
  if (opp) {
    // Rule 1 — opponent is a registered client.
    const client = candidates.clients.find((c) => normalizeName(c.name) === opp);
    if (client) {
      findings.push({
        conflictType: ConflictType.OPPONENT_IS_CLIENT,
        severity: ConflictSeverity.HIGH,
        matchedName: oppRaw,
        matchedClientId: client.id,
        messageKey: "conflict.opponentIsClient",
        messageParams: { opponent: oppRaw },
      });
    }

    // Rule 2 — opponent is a lead (single, deduped flag).
    const lead = candidates.leads.find((l) => normalizeName(l.name) === opp);
    if (lead) {
      findings.push({
        conflictType: ConflictType.OPPONENT_IS_LEAD,
        severity: ConflictSeverity.MEDIUM,
        matchedName: oppRaw,
        matchedLeadId: lead.id,
        messageKey: "conflict.opponentIsLead",
        messageParams: { opponent: oppRaw },
      });
    }

    // Rule 3 — opponent is our client in another case (non-empty client guard).
    const asOurClient = candidates.otherCases.filter(
      (o) => o.clientName && normalizeName(o.clientName) === opp,
    );
    if (asOurClient.length > 0) {
      findings.push({
        conflictType: ConflictType.OPPONENT_IS_OUR_CLIENT_OTHER_CASE,
        severity: ConflictSeverity.HIGH,
        matchedName: oppRaw,
        matchedCaseIds: asOurClient.map((o) => o.id),
        matchedCaseTitles: asOurClient.map((o) => o.title),
        messageKey: "conflict.opponentIsOurClientOtherCase",
        messageParams: {
          opponent: oppRaw,
          cases: asOurClient.map((o) => o.title).join("، "),
        },
      });
    }
  }

  // Rule 4 — our client is the opponent in another case (requires non-empty client).
  if (cli) {
    const asOpponent = candidates.otherCases.filter(
      (o) => normalizeName(o.opposingParty) === cli,
    );
    if (asOpponent.length > 0) {
      findings.push({
        conflictType: ConflictType.OUR_CLIENT_IS_OPPONENT_OTHER_CASE,
        severity: ConflictSeverity.HIGH,
        matchedName: cliRaw,
        matchedCaseIds: asOpponent.map((o) => o.id),
        matchedCaseTitles: asOpponent.map((o) => o.title),
        messageKey: "conflict.ourClientIsOpponentOtherCase",
        messageParams: {
          client: cliRaw,
          cases: asOpponent.map((o) => o.title).join("، "),
        },
      });
    }
  }

  return findings;
}

/** The highest severity among findings (HIGH wins), or null if none. */
export function highestSeverity(
  findings: readonly ConflictFinding[],
): ConflictSeverity | null {
  if (findings.length === 0) return null;
  return findings.some((f) => f.severity === ConflictSeverity.HIGH)
    ? ConflictSeverity.HIGH
    : ConflictSeverity.MEDIUM;
}

/**
 * Coarse office-wide detector (docs/06 §4 BR-CONFLICT-ALERT-SAMEPARTY): the
 * same opposing party appearing in more than one case. Separate from the
 * four-rule detector above; both ship (this backs the Alerts screen).
 */
export function duplicateOpposingParties(
  cases: readonly { id: string; opposingParty: string | null }[],
): Array<{ party: string; caseIds: string[] }> {
  const groups = new Map<string, { party: string; caseIds: string[] }>();
  for (const c of cases) {
    const raw = String(c.opposingParty ?? "").trim();
    if (!raw) continue;
    const key = normalizeName(raw);
    const g = groups.get(key) ?? { party: raw, caseIds: [] };
    g.caseIds.push(c.id);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.caseIds.length > 1);
}
