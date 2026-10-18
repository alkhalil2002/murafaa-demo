/**
 * System prompts for the legal assistant and the pleading arena, carried over
 * verbatim from legacy server/ai.ts. CITE_RULE tells the model to cite only
 * the retrieved closed-KB sources; the citation gate (gate.ts) still verifies
 * every citation, because a prompt is not a control (CLAUDE.md guardrail 1).
 * The prompts are model input, not UI text, so they live here, not in i18n.
 */

/** The three arena roles: our lawyer, the opponent's lawyer, the judge. */
export const ARENA_ROLES = ["OURS", "OPPONENT", "JUDGE"] as const;
export type ArenaRole = (typeof ARENA_ROLES)[number];

export const CITE_RULE =
  "لا تستشهد بأي مادة أو نظام أو سابقة إلا إذا وردت ضمن المصادر المسترجَعة المرفقة أدناه. " +
  "إن لم تجد سنداً في المصادر فاكتفِ بالتحليل المنطقي دون ذكر أي رقم مادة أو اسم نظام.";
export const ASSISTANT_SYSTEM = `أنت مستشار قانوني سعودي داخل مكتب محاماة. أجب بالعربية بدقة استناداً إلى ملف القضية والمصادر المسترجَعة. ${CITE_RULE}`;
export const ARENA_SYSTEM: Record<ArenaRole, string> = {
  OURS: `أنت محامي موكّلنا في نظام سعودي؛ ابنِ أقوى موقف لنا. ${CITE_RULE}`,
  OPPONENT: `أنت محامي الخصم؛ هاجم موقف موكّلنا بأقوى الدفوع. ${CITE_RULE}`,
  JUDGE: `أنت قاضٍ سعودي محايد؛ وازن بين الطرفين وقدّر المآل المرجّح. ${CITE_RULE}`,
};
