import { AiSurface, ArenaRole, CitationAction, GateVerdict, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireCaseAccess, requireModule } from "@/lib/permissions/guard";
import { getEmbedder } from "@/lib/ai/embed";
import { getLlm } from "@/lib/ai/llm";
import { loadKbIndex, searchKb } from "@/lib/ai/vector";
import { runGate } from "@/lib/ai/gate";

/**
 * Legal-AI service (docs/02 §6). The one place any legal AI output is produced —
 * every path (assistant, case analysis, arena) runs embed → retrieve (closed KB)
 * → constrained generate → CITATION GATE → persist + audit, and NOTHING returns
 * model text un-gated. Module-gated (AI = المحاكمة الذكية), office-scoped,
 * case-row-scoped, PII-minimized.
 */

// Server-side prompt engineering (not UI chrome). The gate — not the prompt — is
// the enforcement; this only nudges the model.
const CITE_RULE =
  "لا تستشهد بأي مادة أو نظام أو سابقة إلا إذا وردت ضمن المصادر المسترجَعة المرفقة أدناه. " +
  "إن لم تجد سنداً في المصادر فاكتفِ بالتحليل المنطقي دون ذكر أي رقم مادة أو اسم نظام.";
const ASSISTANT_SYSTEM = `أنت مستشار قانوني سعودي داخل مكتب محاماة. أجب بالعربية بدقة استناداً إلى ملف القضية والمصادر المسترجَعة. ${CITE_RULE}`;
const ARENA_SYSTEM: Record<ArenaRole, string> = {
  OURS: `أنت محامي موكّلنا في نظام سعودي؛ ابنِ أقوى موقف لنا. ${CITE_RULE}`,
  OPPONENT: `أنت محامي الخصم؛ هاجم موقف موكّلنا بأقوى الدفوع. ${CITE_RULE}`,
  JUDGE: `أنت قاضٍ سعودي محايد؛ وازن بين الطرفين وقدّر المآل المرجّح. ${CITE_RULE}`,
};

/** Minimal, PII-light case context for the prompt (docs/02 §9). */
async function caseContext(session: AppSession, caseId: string): Promise<string> {
  // AI case analysis reads case fields → require the CASES module too, not just AI.
  await requireModule(session, PermModule.CASES, "view");
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    select: {
      title: true,
      stage: true,
      najizCaseType: true,
      factSummary: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!c) throw new PermissionError("scope");
  await requireCaseAccess(session, caseId, c.assignees.map((a) => a.userId));
  // Deliberately excludes client/opponent identities and contact PII.
  return [
    `القضية: ${c.title}`,
    `المرحلة: ${c.stage}`,
    c.najizCaseType ? `النوع: ${c.najizCaseType}` : "",
    c.factSummary ? `ملخص الوقائع: ${c.factSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type AiCitationDTO = {
  rawText: string;
  citationKey: string | null;
  articleNumber: string | null;
};
export type AiResultDTO = {
  id: string;
  surface: AiSurface;
  arenaRole: ArenaRole | null;
  finalOutput: string;
  verdict: GateVerdict;
  groundingNote: string | null;
  blockedCount: number;
  citations: AiCitationDTO[];
  disclaimer: string;
};

async function generateAndGate(
  session: AppSession,
  input: { surface: AiSurface; arenaRole?: ArenaRole | null; caseId?: string | null; question: string; threadId?: string | null; system: string },
): Promise<AiResultDTO> {
  const ctx = input.caseId ? await caseContext(session, input.caseId) : "";
  const query = ctx ? `${input.question}\n\n${ctx}` : input.question;

  const embedding = await getEmbedder().embed(query);
  const retrieved = await searchKb(embedding, 5);
  const kb = await loadKbIndex();

  const { text: rawDraft, model } = await getLlm().generate({
    system: input.system,
    question: query,
    sources: retrieved.map((r) => ({ citationKey: r.citationKey, articleNumber: r.articleNumber, content: r.content })),
    arenaRole: input.arenaRole ?? null,
  });

  const gate = runGate(rawDraft, kb, "block");
  const groundingNote = retrieved.length === 0 ? t("ai.groundingEmpty") : null;

  const sourceById = new Map(retrieved.map((r) => [r.sourceId, r]));
  const interaction = await prisma.$transaction(async (tx) => {
    const it = await tx.aiInteraction.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        surface: input.surface,
        arenaRole: input.arenaRole ?? null,
        threadId: input.threadId ?? null,
        caseId: input.caseId ?? null,
        question: input.question,
        retrievedChunkIds: retrieved.map((r) => r.chunkId),
        rawDraft,
        finalOutput: gate.finalOutput,
        verdict: gate.verdict,
        groundingNote,
        model,
      },
    });
    for (const c of gate.citations) {
      await tx.aiCitation.create({
        data: {
          interactionId: it.id,
          rawText: c.rawText,
          type: c.type,
          parsedLawName: c.parsedLawName,
          parsedArticleNumber: c.parsedArticleNumber,
          matchedSourceId: c.matchedSourceId,
          matchedChunkId: c.matchedChunkId,
          matchStatus: c.matchStatus,
          action: c.action,
        },
      });
    }
    return it;
  });

  await logAudit({
    session,
    action: gate.verdict === GateVerdict.BLOCKED ? "ai.gate.block" : "ai.generate",
    resource: "ai",
    targetId: interaction.id,
    detail: `${input.surface} ${gate.verdict} blocked=${gate.citations.filter((c) => c.action === CitationAction.BLOCKED).length}`,
  });

  const kept = gate.citations
    .filter((c) => c.action === CitationAction.KEPT)
    .map((c) => {
      const src = c.matchedSourceId ? sourceById.get(c.matchedSourceId) : null;
      return {
        rawText: c.rawText,
        citationKey: src?.citationKey ?? c.parsedLawName,
        articleNumber: c.parsedArticleNumber,
      };
    });

  return {
    id: interaction.id,
    surface: input.surface,
    arenaRole: input.arenaRole ?? null,
    finalOutput: gate.finalOutput,
    verdict: gate.verdict,
    groundingNote,
    blockedCount: gate.citations.filter((c) => c.action === CitationAction.BLOCKED).length,
    citations: kept,
    disclaimer: t("ai.disclaimer"),
  };
}

const askSchema = z.object({
  question: z.string().min(1),
  caseId: z.string().uuid().nullish(),
  threadId: z.string().nullish(),
});

export async function askAssistant(session: AppSession, raw: z.infer<typeof askSchema>) {
  await requireModule(session, PermModule.AI, "edit");
  const input = askSchema.parse(raw);
  return generateAndGate(session, {
    surface: input.caseId ? AiSurface.CASE_ANALYSIS : AiSurface.ASSISTANT,
    caseId: input.caseId,
    question: input.question,
    threadId: input.threadId,
    system: ASSISTANT_SYSTEM,
  });
}

const arenaSchema = z.object({
  caseId: z.string().uuid(),
  role: z.nativeEnum(ArenaRole),
  threadId: z.string().nullish(),
});

export async function runArenaTurn(session: AppSession, raw: z.infer<typeof arenaSchema>) {
  await requireModule(session, PermModule.AI, "edit");
  const input = arenaSchema.parse(raw);
  const prompt =
    input.role === ArenaRole.JUDGE
      ? "أصدر تقييماً للمآل المرجّح مع نقاط القوة والضعف والتوصية."
      : "قدّم حجّتك في ضوء وقائع القضية.";
  return generateAndGate(session, {
    surface: AiSurface.ARENA,
    arenaRole: input.role,
    caseId: input.caseId,
    question: prompt,
    threadId: input.threadId,
    system: ARENA_SYSTEM[input.role],
  });
}

async function loadArenaCase(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    select: { arenaSessionSeq: true, assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  await requireCaseAccess(session, caseId, c.assignees.map((a) => a.userId));
  return c;
}

/** Current arena thread + round number for a case (prototype arenaRound()'s counter). */
export async function getArenaState(session: AppSession, caseId: string) {
  const c = await loadArenaCase(session, caseId);
  const threadId = `arena:${caseId}:${c.arenaSessionSeq}`;
  const turnCount = await prisma.aiInteraction.count({
    where: { officeId: session.officeId, caseId, surface: AiSurface.ARENA, threadId },
  });
  return { threadId, roundNumber: Math.floor(turnCount / 3) + 1 };
}

/** One full round = OURS argument → OPPONENT rebuttal → JUDGE assessment, run
 * sequentially through the real gated pipeline (prototype arenaRound() — no
 * canned/fabricated output, each turn is a genuine generate+gate call). */
export async function runArenaRound(session: AppSession, caseId: string) {
  const { threadId } = await getArenaState(session, caseId);
  const ours = await runArenaTurn(session, { caseId, role: ArenaRole.OURS, threadId });
  const opponent = await runArenaTurn(session, { caseId, role: ArenaRole.OPPONENT, threadId });
  const judge = await runArenaTurn(session, { caseId, role: ArenaRole.JUDGE, threadId });
  return [ours, opponent, judge];
}

/** Start a fresh arena session (prototype "إعادة"/arenaReset()) — increments
 * the session counter so a NEW thread begins at round 1. Prior rounds are
 * NOT deleted: AiInteraction is the AI audit trail (docs/02 §6/§9) and must
 * stay intact even after a reset. */
export async function resetArena(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.AI, "edit");
  await loadArenaCase(session, caseId);
  await prisma.case.update({ where: { id: caseId }, data: { arenaSessionSeq: { increment: 1 } } });
  await logAudit({ session, action: "ai.arena.reset", resource: "cases", targetId: caseId });
}

export async function listInteractions(session: AppSession, opts: { caseId?: string; threadId?: string } = {}) {
  await requireModule(session, PermModule.AI, "view");

  // Row-scope: case-linked history requires access to that case; the personal
  // assistant view (no caseId) returns only the caller's OWN non-case chat, so
  // one user never sees another's questions or case analysis (docs/04 layer 3).
  let where: import("@prisma/client").Prisma.AiInteractionWhereInput;
  if (opts.caseId) {
    const c = await prisma.case.findFirst({
      where: { id: opts.caseId, officeId: session.officeId, deletedAt: null },
      select: { assignees: { select: { userId: true } } },
    });
    if (!c) throw new PermissionError("scope");
    await requireCaseAccess(session, opts.caseId, c.assignees.map((a) => a.userId));
    where = {
      officeId: session.officeId,
      caseId: opts.caseId,
      ...(opts.threadId ? { threadId: opts.threadId } : {}),
    };
  } else {
    where = {
      officeId: session.officeId,
      createdById: session.userId,
      caseId: null,
      ...(opts.threadId ? { threadId: opts.threadId } : {}),
    };
  }

  return prisma.aiInteraction.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      citations: { include: { matchedSource: { select: { title: true, citationKey: true } } } },
    },
  });
}

export async function listKnowledgeSources(session: AppSession) {
  await requireModule(session, PermModule.AI, "view");
  return prisma.knowledgeSource.findMany({
    where: { isActive: true },
    orderBy: { type: "asc" },
    include: { _count: { select: { chunks: true } } },
  });
}
