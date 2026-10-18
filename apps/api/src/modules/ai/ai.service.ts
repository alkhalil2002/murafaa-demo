import { Inject, Injectable } from "@nestjs/common";
import { canModule, effectiveRole, PermModule } from "@murafaa/auth";
import { ErrorCode, type kbSourceBody } from "@murafaa/contracts";
import {
  aiCitations,
  aiInteractions,
  cases,
  knowledgeChunks,
  knowledgeSources,
  type Tx,
} from "@murafaa/database";
import { normalizeName, redactPii } from "@murafaa/rules";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { CaseAccess, type CaseRow, type Meta } from "../cases/case-access.service.js";
import { CitationAction, GateVerdict } from "./ai.enums.js";
import { type GateResult, type KbIndex, runGate } from "./gate.js";
import { LLM, type LlmProvider } from "./llm.js";
import { ARENA_SYSTEM, type ArenaRole, ASSISTANT_SYSTEM, CITE_RULE } from "./prompts.js";

type Surface = "ASSISTANT" | "CASE_ANALYSIS" | "ARENA" | "HEARING_DRAFT";
type Retrieved = {
  chunkId: string;
  sourceId: string;
  citationKey: string;
  articleNumber: string | null;
  content: string;
};

const RETRIEVE = 5;
const ARENA_PROMPT: Record<ArenaRole, string> = {
  OURS: "قدّم حجّتك في ضوء وقائع القضية.",
  OPPONENT: "قدّم حجّتك في ضوء وقائع القضية.",
  JUDGE: "أصدر تقييماً للمآل المرجّح مع نقاط القوة والضعف والتوصية.",
};
const DRAFT_SYSTEM =
  "أنت مساعد صياغة لمكتب محاماة سعودي. تُعطى ملاحظات خام كتبها المحامي عن جلسة قضائية للتو. " +
  "أعد صياغتها فقط - لا تضف وقائع أو تواريخ أو أرقام مواد نظامية أو نتائج غير واردة صراحة في الملاحظات. " +
  "أعد النتيجة بصيغة JSON فقط بالحقول التالية: " +
  "minutes: محضر منظم بصيغة رسمية للملاحظات نفسها؛ " +
  "result: ملخص نتيجة الجلسة في جملة أو جملتين؛ " +
  "clientReport: تقرير مختصر وودود للعميل عمّا جرى، بدون مصطلحات قانونية معقدة. " +
  "لا تكتب أي شيء خارج كائن الـ JSON. " +
  CITE_RULE;

const DRAFT_FIELDS = ["minutes", "result", "clientReport"] as const;

/** Search terms from free text: normalized Arabic words and numbers, safe for to_tsquery. */
type StoredCitation = {
  rawText: string;
  action: string;
  articleNumber: string | null;
  sourceTitle: string | null;
  citationKey: string | null;
  isDemo: boolean | null;
};

/**
 * The sources listed under an answer: verified citations whose sentence
 * survived the gate (a valid statute name inside a removed sentence is not a
 * source of the answer), once each, and a bare statute mention only when no
 * article of it is cited.
 */
export function shownSources(cites: StoredCitation[], finalOutput: string) {
  const kept = cites.filter(
    (c) => c.action === CitationAction.KEPT && c.citationKey && finalOutput.includes(c.rawText),
  );
  const withArticle = new Set(kept.filter((c) => c.articleNumber).map((c) => c.citationKey));
  const seen = new Set<string>();
  return kept
    .filter((c) => c.articleNumber || !withArticle.has(c.citationKey))
    .filter((c) => {
      const key = `${c.citationKey}|${c.articleNumber ?? ""}`;
      return !seen.has(key) && Boolean(seen.add(key));
    })
    .map((c) => ({
      rawText: c.rawText,
      sourceTitle: c.sourceTitle!,
      citationKey: c.citationKey!,
      articleNumber: c.articleNumber,
      isDemo: Boolean(c.isDemo),
    }));
}

export function searchTerms(text: string): string[] {
  const words = normalizeName(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  return [...new Set(words)].slice(0, 24);
}

/**
 * The legal-AI pipeline (docs/02 §6; legacy server/ai.ts): retrieve from the
 * office's closed knowledge base → generate with the configured provider,
 * constrained to the retrieved sources → CITATION GATE → persist + audit.
 * No path returns model text that skipped the gate. Prompts carry no party
 * names, and identifiers are redacted before anything leaves (guardrail 3).
 */
@Injectable()
export class AiService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly access: CaseAccess,
    private readonly policies: PolicyService,
    @Inject(LLM) private readonly llm: LlmProvider,
  ) {}

  /**
   * Anything run on a case reads case fields, so it also needs the cases
   * module (legacy rule) besides the case being in the caller's row scope.
   */
  private async withCaseForAi<T>(
    p: Principal,
    caseId: string,
    meta: Meta,
    fn: (tx: Tx, c: CaseRow) => Promise<T>,
  ): Promise<T> {
    const policy = await this.policies.forOffice(p.officeId);
    if (!canModule(policy, effectiveRole(p), PermModule.CASES, "view"))
      throw new ApiException(ErrorCode.FORBIDDEN);
    return this.access.withCase(p, caseId, meta, fn);
  }

  status() {
    return { connected: this.llm.connected, provider: this.llm.name, region: this.llm.region };
  }

  /** Full-text retrieval over active sources (pgvector replaces it once an embedding provider is chosen). */
  private async retrieve(tx: Tx, query: string): Promise<Retrieved[]> {
    const terms = searchTerms(query);
    if (terms.length === 0) return [];
    const q = sql`to_tsquery('simple', ${terms.join(" | ")})`;
    return tx
      .select({
        chunkId: knowledgeChunks.id,
        sourceId: knowledgeSources.id,
        citationKey: knowledgeSources.citationKey,
        articleNumber: knowledgeChunks.articleNumber,
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .innerJoin(knowledgeSources, eq(knowledgeSources.id, knowledgeChunks.sourceId))
      .where(
        and(
          eq(knowledgeSources.isActive, true),
          isNull(knowledgeChunks.deletedAt),
          sql`${knowledgeChunks.search} @@ ${q}`,
        ),
      )
      .orderBy(sql`ts_rank(${knowledgeChunks.search}, ${q}) desc`)
      .limit(RETRIEVE);
  }

  /** Every active source and article the gate may match against. */
  private async kbIndex(tx: Tx): Promise<KbIndex> {
    const sources = await tx
      .select({
        id: knowledgeSources.id,
        citationKey: knowledgeSources.citationKey,
        title: knowledgeSources.title,
        type: knowledgeSources.type,
        isActive: knowledgeSources.isActive,
      })
      .from(knowledgeSources)
      .where(and(eq(knowledgeSources.isActive, true), isNull(knowledgeSources.deletedAt)));
    const chunks = sources.length
      ? await tx
          .select({
            id: knowledgeChunks.id,
            sourceId: knowledgeChunks.sourceId,
            articleNumber: knowledgeChunks.articleNumber,
          })
          .from(knowledgeChunks)
          .where(
            and(
              inArray(
                knowledgeChunks.sourceId,
                sources.map((s) => s.id),
              ),
              isNull(knowledgeChunks.deletedAt),
            ),
          )
      : [];
    return { sources, chunks };
  }

  /** Case facts for the prompt, without party names or contact details. */
  private caseContext(c: {
    title: string;
    stage: string;
    najizCaseType: string | null;
    factSummary: string | null;
  }) {
    return [
      `القضية: ${c.title}`,
      `المرحلة: ${c.stage}`,
      c.najizCaseType ? `النوع: ${c.najizCaseType}` : "",
      c.factSummary ? `ملخص الوقائع: ${c.factSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private prompt(question: string, sources: Retrieved[]) {
    const list = sources.length
      ? sources
          .map(
            (s, i) =>
              `[${i + 1}] ${s.citationKey}${s.articleNumber ? ` — المادة (${s.articleNumber})` : ""}: ${s.content}`,
          )
          .join("\n")
      : "(لا توجد مصادر مسترجَعة)";
    return `المصادر المسترجَعة من القاعدة المعرفية:\n${list}\n\nالسؤال:\n${question}`;
  }

  /**
   * One gated generation. Retrieval and the KB index are read first; the
   * model call runs outside any transaction; the gate result and every
   * citation are stored together with the audit row.
   */
  private async generate(
    p: Principal,
    meta: Meta,
    input: {
      surface: Surface;
      system: string;
      question: string;
      context: string;
      caseId: string | null;
      threadId?: string | null;
      arenaRole?: ArenaRole | null;
    },
  ) {
    const query = redactPii(
      input.context ? `${input.question}\n\n${input.context}` : input.question,
    );
    const { retrieved, kb } = await this.tenantDb.run(async (tx) => ({
      retrieved: await this.retrieve(tx, query),
      kb: await this.kbIndex(tx),
    }));
    const { text: rawDraft, model } = await this.llm.generate({
      system: input.system,
      prompt: this.prompt(query, retrieved),
    });
    return this.store(p, meta, input, {
      rawDraft,
      model,
      kb,
      retrieved,
      gated: runGate(rawDraft, kb, "block"),
    });
  }

  private async store(
    p: Principal,
    meta: Meta,
    input: {
      surface: Surface;
      question: string;
      caseId: string | null;
      threadId?: string | null;
      arenaRole?: ArenaRole | null;
    },
    out: {
      rawDraft: string;
      model: string;
      kb: KbIndex;
      retrieved: Retrieved[];
      gated: ReturnType<typeof runGate>;
      finalOutput?: string;
    },
  ) {
    const { gated } = out;
    const finalOutput = out.finalOutput ?? gated.finalOutput;
    const blocked = gated.citations.filter((c) => c.action === CitationAction.BLOCKED).length;
    const id = await this.tenantDb.run(async (tx) => {
      const [it] = await tx
        .insert(aiInteractions)
        .values({
          officeId: p.officeId,
          surface: input.surface,
          arenaRole: input.arenaRole ?? null,
          threadId: input.threadId ?? null,
          caseId: input.caseId,
          question: redactPii(input.question),
          retrievedChunkIds: out.retrieved.map((r) => r.chunkId),
          rawDraft: out.rawDraft,
          finalOutput,
          verdict: gated.verdict,
          grounded: out.retrieved.length > 0,
          model: out.model,
          createdBy: p.userId,
        })
        .returning({ id: aiInteractions.id });
      if (gated.citations.length) {
        await tx.insert(aiCitations).values(
          gated.citations.map((c) => ({
            officeId: p.officeId,
            interactionId: it!.id,
            rawText: c.rawText,
            type: c.type,
            parsedLawName: c.parsedLawName,
            parsedArticleNumber: c.parsedArticleNumber,
            matchedSourceId: c.matchedSourceId,
            matchedChunkId: c.matchedChunkId,
            matchStatus: c.matchStatus,
            action: c.action,
            createdBy: p.userId,
          })),
        );
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: gated.verdict === "BLOCKED" ? "ai.gate.block" : "ai.generate",
        entity: "ai",
        entityId: it!.id,
        after: { surface: input.surface, verdict: gated.verdict, blocked },
        ...meta,
      });
      return it!.id;
    });
    return (await this.answers(eq(aiInteractions.id, id)))[0]!;
  }

  /** Stored answers with only the citations that were kept (never an unmatched one). */
  private answers(where: ReturnType<typeof eq> | ReturnType<typeof and>) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(aiInteractions)
        .where(where)
        .orderBy(asc(aiInteractions.createdAt));
      const ids = rows.map((r) => r.id);
      const cites = ids.length
        ? await tx
            .select({
              interactionId: aiCitations.interactionId,
              rawText: aiCitations.rawText,
              action: aiCitations.action,
              articleNumber: aiCitations.parsedArticleNumber,
              sourceTitle: knowledgeSources.title,
              citationKey: knowledgeSources.citationKey,
              isDemo: knowledgeSources.isDemo,
            })
            .from(aiCitations)
            .leftJoin(knowledgeSources, eq(knowledgeSources.id, aiCitations.matchedSourceId))
            .where(inArray(aiCitations.interactionId, ids))
        : [];
      return rows.map((r) => {
        const mine = cites.filter((c) => c.interactionId === r.id);
        return {
          id: r.id,
          surface: r.surface,
          arenaRole: r.arenaRole,
          question: r.question,
          finalOutput: r.finalOutput,
          verdict: r.verdict as GateVerdict,
          grounded: r.grounded,
          blockedCount: mine.filter((c) => c.action === "BLOCKED").length,
          citations: shownSources(mine, r.finalOutput),
          createdAt: r.createdAt.toISOString(),
        };
      });
    });
  }

  /** The assistant; with a case it becomes case analysis (needs the case in scope). */
  async ask(p: Principal, question: string, caseId: string | null | undefined, meta: Meta) {
    const context = caseId
      ? await this.withCaseForAi(p, caseId, meta, async (_tx, c) => this.caseContext(c))
      : "";
    return this.generate(p, meta, {
      surface: caseId ? "CASE_ANALYSIS" : "ASSISTANT",
      system: ASSISTANT_SYSTEM,
      question,
      context,
      caseId: caseId ?? null,
    });
  }

  /** Case history to anyone who may see the case; without a case, only the caller's own questions. */
  async history(p: Principal, caseId: string | undefined, meta: Meta) {
    if (caseId) {
      await this.withCaseForAi(p, caseId, meta, async () => undefined);
      return this.answers(
        and(eq(aiInteractions.caseId, caseId), sql`${aiInteractions.surface} <> 'ARENA'`)!,
      );
    }
    return this.answers(
      and(isNull(aiInteractions.caseId), eq(aiInteractions.createdBy, p.userId))!,
    );
  }

  // ── Pleading arena: OURS → OPPONENT → JUDGE, each through the gate ──

  private async arenaCase(p: Principal, caseId: string, meta: Meta) {
    return this.withCaseForAi(p, caseId, meta, async (_tx, c) => ({
      seq: c.arenaSessionSeq,
      context: this.caseContext(c),
    }));
  }

  async arena(p: Principal, caseId: string, meta: Meta) {
    const { seq } = await this.arenaCase(p, caseId, meta);
    const threadId = `arena:${caseId}:${seq}`;
    const turns = await this.answers(eq(aiInteractions.threadId, threadId));
    return { threadId, round: Math.floor(turns.length / 3) + 1, turns };
  }

  /** One full round, each turn a real gated generation (no canned text). */
  async arenaRound(p: Principal, caseId: string, meta: Meta) {
    const { seq, context } = await this.arenaCase(p, caseId, meta);
    const threadId = `arena:${caseId}:${seq}`;
    for (const role of ["OURS", "OPPONENT", "JUDGE"] as const) {
      await this.generate(p, meta, {
        surface: "ARENA",
        system: ARENA_SYSTEM[role],
        question: ARENA_PROMPT[role],
        context,
        caseId,
        threadId,
        arenaRole: role,
      });
    }
    return this.arena(p, caseId, meta);
  }

  /** A fresh arena session; earlier rounds stay in the audit trail. */
  async arenaReset(p: Principal, caseId: string, meta: Meta) {
    await this.withCaseForAi(p, caseId, meta, async (tx, c) => {
      await tx
        .update(cases)
        .set({ arenaSessionSeq: c.arenaSessionSeq + 1, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "ai.arena.reset",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  /**
   * Hearing minutes → result + client report (prototype wzGen). Legacy called
   * the model directly from outside the Kingdom and skipped the gate; here
   * both fields go through the gate, and the client report is what reaches
   * the client, so a sentence with an unmatched citation is dropped from it.
   */
  async hearingDraft(p: Principal, caseId: string, notes: string, meta: Meta) {
    const context = await this.withCaseForAi(p, caseId, meta, async (_tx, c) =>
      this.caseContext(c),
    );
    const question = redactPii(`${notes}\n\n${context}`);
    const { retrieved, kb } = await this.tenantDb.run(async (tx) => ({
      retrieved: await this.retrieve(tx, question),
      kb: await this.kbIndex(tx),
    }));
    const { text: rawDraft, model } = await this.llm.generate({
      system: DRAFT_SYSTEM,
      prompt: this.prompt(question, retrieved),
    });
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawDraft.replace(/```(?:json)?/g, "").trim()) as Record<string, unknown>;
    } catch {
      throw new ApiException(ErrorCode.UNAVAILABLE, undefined, "errors.AI_BAD_OUTPUT");
    }
    if (typeof parsed !== "object" || parsed === null)
      throw new ApiException(ErrorCode.UNAVAILABLE, undefined, "errors.AI_BAD_OUTPUT");
    // Every field reaches the lawyer, so every field goes through the gate.
    const gated = DRAFT_FIELDS.map((f) => runGate(String(parsed[f] ?? ""), kb, "block"));
    const [minutes, result, report] = gated as [GateResult, GateResult, GateResult];
    const citations = gated.flatMap((g) => g.citations);
    const verdicts = gated.map((g) => g.verdict);
    const verdict: GateVerdict = verdicts.includes(GateVerdict.BLOCKED)
      ? GateVerdict.BLOCKED
      : verdicts.includes(GateVerdict.FLAGGED)
        ? GateVerdict.FLAGGED
        : GateVerdict.PASSED;
    await this.store(
      p,
      meta,
      { surface: "HEARING_DRAFT", question: notes, caseId },
      {
        rawDraft,
        model,
        kb,
        retrieved,
        gated: { citations, verdict, finalOutput: gated.map((g) => g.finalOutput).join("\n\n") },
      },
    );
    return {
      minutes: minutes.finalOutput,
      result: result.finalOutput,
      clientReport: report.finalOutput,
      verdict,
      blockedCount: citations.filter((c) => c.action === CitationAction.BLOCKED).length,
    };
  }

  // ── Knowledge base (the closed corpus the gate matches against) ──

  kbList() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: knowledgeSources.id,
          type: knowledgeSources.type,
          title: knowledgeSources.title,
          citationKey: knowledgeSources.citationKey,
          officialRef: knowledgeSources.officialRef,
          isActive: knowledgeSources.isActive,
          isDemo: knowledgeSources.isDemo,
          chunks: count(knowledgeChunks.id),
        })
        .from(knowledgeSources)
        .leftJoin(
          knowledgeChunks,
          and(eq(knowledgeChunks.sourceId, knowledgeSources.id), isNull(knowledgeChunks.deletedAt)),
        )
        .where(isNull(knowledgeSources.deletedAt))
        .groupBy(knowledgeSources.id)
        .orderBy(asc(knowledgeSources.type), asc(knowledgeSources.title));
      return rows;
    });
  }

  /** Add a source with its articles (AI full level). Content is the office's responsibility to verify. */
  async kbAdd(
    p: Principal,
    input: z.infer<typeof kbSourceBody>,
    meta: Meta,
    opts: { demo?: boolean } = {},
  ) {
    try {
      return await this.tenantDb.run(async (tx) => {
        const [src] = await tx
          .insert(knowledgeSources)
          .values({
            officeId: p.officeId,
            type: input.type,
            title: input.title,
            citationKey: input.citationKey,
            officialRef: input.officialRef,
            isDemo: opts.demo ?? false,
            createdBy: p.userId,
          })
          .returning({ id: knowledgeSources.id });
        await tx.insert(knowledgeChunks).values(
          input.chunks.map((c) => ({
            officeId: p.officeId,
            sourceId: src!.id,
            articleNumber: c.articleNumber
              ? c.articleNumber.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
              : null,
            content: c.content,
            searchText: normalizeName(
              `${input.citationKey} ${input.title} ${c.articleNumber ? `المادة ${c.articleNumber}` : ""} ${c.content}`,
            ),
            createdBy: p.userId,
          })),
        );
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "kb.source.add",
          entity: "ai",
          entityId: src!.id,
          after: { citationKey: input.citationKey, chunks: input.chunks.length },
          ...meta,
        });
        return { id: src!.id };
      });
    } catch (e) {
      if (isUniqueViolation(e, "knowledge_sources_office_key"))
        throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.KB_SOURCE_EXISTS");
      throw e;
    }
  }

  /** Activate/deactivate a source: an inactive source is neither retrieved nor accepted by the gate. */
  kbSetActive(p: Principal, id: string, active: boolean, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [done] = await tx
        .update(knowledgeSources)
        .set({ isActive: active, updatedBy: p.userId })
        .where(and(eq(knowledgeSources.id, id), isNull(knowledgeSources.deletedAt)))
        .returning({ id: knowledgeSources.id });
      if (!done) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: active ? "kb.source.activate" : "kb.source.deactivate",
        entity: "ai",
        entityId: id,
        ...meta,
      });
    });
  }
}
