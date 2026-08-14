import { t, type MessageKey } from "./index";

/**
 * Per-office terminology.
 *
 * Offices do not agree on what things are called. One calls a matter قضية,
 * another ملف, a corporate practice معاملة. Forcing our vocabulary on them makes
 * the product feel like someone else's software.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE GLOSSARY AND NOT AN OVERRIDE ON t()
 *
 * There are 1,378 message keys and 1,407 `t()` call sites across 103 files.
 * `t()` is a pure synchronous lookup against a static object, with no request
 * or office context — that is exactly why it can be called freely from server
 * and client components alike.
 *
 * Making it office-aware would mean threading an async lookup (or a context)
 * through every one of those call sites, to let an office rename "حفظ" and
 * "إلغاء" — which no office wants to do. The nouns below are what they
 * actually want to rename.
 *
 * So the glossary is deliberately small and explicit. Adding a term here is a
 * decision, not a default. Everything else stays in `t()` and stays cheap.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Overrides live in `Office.branding.terms` — the branding column is already
 * JSON, so this needs no migration.
 */

/** A renameable concept. `singular`/`plural` fall back to these i18n keys. */
export type TermDef = {
  /** Stable id — the storage key. NEVER change one; it orphans the override. */
  id: TermId;
  /** Default label, via the normal i18n layer. */
  defaultKey: MessageKey;
  /** Shown in the onboarding step so the user knows what they are renaming. */
  hintKey: MessageKey;
};

export type TermId =
  | "case"
  | "client"
  | "lead"
  | "task"
  | "hearing"
  | "document"
  | "invoice"
  | "employee"
  | "appointment"
  | "deadline"
  | "trust"
  | "fee"
  | "expense"
  | "report";

/**
 * The renameable set. Ordered as the onboarding step presents them: the ones
 * an office is most likely to care about first.
 */
export const GLOSSARY: readonly TermDef[] = [
  { id: "case", defaultKey: "nav.cases", hintKey: "onboarding.terms.hint.case" },
  { id: "client", defaultKey: "nav.clients", hintKey: "onboarding.terms.hint.client" },
  { id: "lead", defaultKey: "nav.leads", hintKey: "onboarding.terms.hint.lead" },
  { id: "task", defaultKey: "nav.tasks", hintKey: "onboarding.terms.hint.task" },
  { id: "hearing", defaultKey: "term.hearing.default", hintKey: "onboarding.terms.hint.hearing" },
  { id: "document", defaultKey: "nav.documents", hintKey: "onboarding.terms.hint.document" },
  { id: "invoice", defaultKey: "term.invoice.default", hintKey: "onboarding.terms.hint.invoice" },
  { id: "employee", defaultKey: "term.employee.default", hintKey: "onboarding.terms.hint.employee" },
  { id: "appointment", defaultKey: "nav.appointments", hintKey: "onboarding.terms.hint.appointment" },
  { id: "deadline", defaultKey: "nav.deadlines", hintKey: "onboarding.terms.hint.deadline" },
  { id: "trust", defaultKey: "term.trust.default", hintKey: "onboarding.terms.hint.trust" },
  { id: "fee", defaultKey: "term.fee.default", hintKey: "onboarding.terms.hint.fee" },
  { id: "expense", defaultKey: "term.expense.default", hintKey: "onboarding.terms.hint.expense" },
  { id: "report", defaultKey: "module.reports", hintKey: "onboarding.terms.hint.report" },
] as const;

const BY_ID = new Map(GLOSSARY.map((d) => [d.id, d]));

/** Resolved labels for one office: every id present, defaults filled in. */
export type Terms = Record<TermId, string>;

/** Longest label an office may set. Long enough to be useful, short enough to fit a nav item. */
export const MAX_TERM_LENGTH = 40;

/**
 * Build the resolved term map from whatever is stored on the office.
 *
 * Tolerant by design: the input is user-authored JSON out of a database column,
 * so anything unexpected falls back to the default rather than throwing. A
 * malformed override must never be able to take the application down — the
 * worst outcome is a screen showing our wording instead of theirs.
 */
export function resolveTerms(stored: unknown): Terms {
  const overrides =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const out = {} as Terms;
  for (const def of GLOSSARY) {
    const raw = overrides[def.id];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    out[def.id] = trimmed && trimmed.length <= MAX_TERM_LENGTH ? trimmed : t(def.defaultKey);
  }
  return out;
}

/** The untouched defaults — what an office sees before it renames anything. */
export function defaultTerms(): Terms {
  return resolveTerms(null);
}

/** Keep only recognised ids with usable values, for persisting. */
export function sanitizeTermOverrides(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(input)) {
    if (!BY_ID.has(id as TermId)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_TERM_LENGTH) continue;
    // Storing a value identical to the default is noise: it pins the office to
    // today's wording, so a later copy fix would silently not reach them.
    if (trimmed === t(BY_ID.get(id as TermId)!.defaultKey)) continue;
    out[id] = trimmed;
  }
  return out;
}
