import { ArenaRole } from "@prisma/client";

/**
 * LLM adapter. Dev uses a deterministic, offline stub that argues in Arabic and
 * cites ONLY from the sources it is given (so the end-to-end pipeline runs
 * offline and the well-behaved output passes the gate). Production swaps to
 * Claude via Vertex (regional endpoint, residency deferred config) behind this
 * same interface. The stub is NOT the safety control — the citation gate is; the
 * gate is what catches a real model that fabricates.
 */

export type LlmSource = {
  citationKey: string;
  articleNumber?: string | null;
  content: string;
};

export type LlmRequest = {
  system: string;
  question: string;
  /** The retrieved KB passages the generation is constrained to. */
  sources: LlmSource[];
  arenaRole?: ArenaRole | null;
};

export interface Llm {
  generate(req: LlmRequest): Promise<{ text: string; model: string }>;
}

const ROLE_LEAD: Record<ArenaRole, string> = {
  OURS: "بصفتي محامي موكّلنا، أبني موقفنا كالتالي",
  OPPONENT: "بصفتي محامي الخصم، أهاجم موقفكم كالتالي",
  JUDGE: "بصفتي القاضي، أوازن بين الطرفين وأقدّر المآل",
};

class StubLlm implements Llm {
  async generate(req: LlmRequest): Promise<{ text: string; model: string }> {
    const lead = req.arenaRole ? ROLE_LEAD[req.arenaRole] : "بناءً على ملف القضية والقاعدة المعرفية";
    if (req.sources.length === 0) {
      // No grounding: reason WITHOUT citing any statute/article (empty-KB safe path).
      const body = `${lead}: هذا تحليل استرشادي يعتمد على المنطق القانوني ووقائع الملف دون إسناد نظامي، إذ لم يُسترجَع سند من القاعدة المعرفية لهذا السؤال. ${req.question}`;
      return { text: body, model: "stub-offline" };
    }
    const cites = req.sources
      .slice(0, 3)
      .map((s) =>
        s.articleNumber ? `المادة (${s.articleNumber}) من ${s.citationKey}` : s.citationKey,
      );
    const grounded = cites.map((c) => `وبحسب ${c}`).join("، ");
    const body = `${lead}: ${grounded} يترجّح موقفنا. (تحليل مبني على المصادر المسترجَعة من القاعدة المعرفية.)`;
    return { text: body, model: "stub-offline" };
  }
}

let cached: Llm | null = null;

export function getLlm(): Llm {
  if (cached) return cached;
  // AI_PROVIDER=vertex would load the Claude-on-Vertex regional adapter (prod).
  cached = new StubLlm();
  return cached;
}
