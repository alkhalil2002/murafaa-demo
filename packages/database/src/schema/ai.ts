import {
  boolean,
  customType,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { cases } from "./cases.js";
import { offices } from "./offices.js";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const officeRef = () =>
  uuid("office_id")
    .notNull()
    .references(() => offices.id);

/** Values match apps/api modules/ai/ai.enums.ts. */
export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", [
  "STATUTE",
  "REGULATION",
  "PRECEDENT",
]);
export const aiSurfaceEnum = pgEnum("ai_surface", [
  "ASSISTANT",
  "CASE_ANALYSIS",
  "ARENA",
  "HEARING_DRAFT",
]);
export const arenaRoleEnum = pgEnum("arena_role", ["OURS", "OPPONENT", "JUDGE"]);
export const gateVerdictEnum = pgEnum("gate_verdict", ["PASSED", "FLAGGED", "BLOCKED"]);
export const citationTypeEnum = pgEnum("citation_type", ["ARTICLE", "STATUTE", "PRECEDENT"]);
export const citationMatchEnum = pgEnum("citation_match", ["MATCHED", "UNMATCHED"]);
export const citationActionEnum = pgEnum("citation_action", ["KEPT", "BLOCKED", "FLAGGED"]);

/**
 * The closed knowledge base (docs/02 §6): the only sources the AI may cite.
 * Kept per office like every table (owner decision 2026-07-05). `is_demo`
 * marks illustrative development content that is not official text.
 */
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id,
    officeId: officeRef(),
    type: knowledgeSourceTypeEnum("type").notNull(),
    title: text("title").notNull(),
    /** The canonical name the citation gate matches against. */
    citationKey: text("citation_key").notNull(),
    officialRef: text("official_ref"),
    isActive: boolean("is_active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    ...timestamps,
    ...audit,
  },
  (t) => [
    uniqueIndex("knowledge_sources_office_key").on(t.officeId, t.citationKey),
    tenantPolicy(),
  ],
).enableRLS();

/**
 * Article-level chunks. Retrieval is full-text over `search` (normalized
 * Arabic) until an embedding provider is chosen; a vector column is added
 * with that decision.
 */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id,
    officeId: officeRef(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id),
    articleNumber: text("article_number"),
    content: text("content").notNull(),
    /** Normalized text (no tashkeel/tatweel, unified alef/ya/ta marbuta) the search runs on. */
    searchText: text("search_text").notNull(),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('simple', search_text)`),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("knowledge_chunks_source_idx").on(t.officeId, t.sourceId),
    index("knowledge_chunks_search_idx").using("gin", t.search),
    tenantPolicy(),
  ],
).enableRLS();

/** Every AI generation: what was asked, retrieved, drafted and finally shown (append-only audit trail). */
export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id,
    officeId: officeRef(),
    surface: aiSurfaceEnum("surface").notNull(),
    arenaRole: arenaRoleEnum("arena_role"),
    threadId: text("thread_id"),
    caseId: uuid("case_id").references(() => cases.id),
    question: text("question").notNull(),
    retrievedChunkIds: jsonb("retrieved_chunk_ids").$type<string[]>().notNull(),
    rawDraft: text("raw_draft").notNull(),
    finalOutput: text("final_output").notNull(),
    verdict: gateVerdictEnum("verdict").notNull(),
    grounded: boolean("grounded").notNull(),
    model: text("model").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("ai_interactions_case_idx").on(t.officeId, t.caseId),
    index("ai_interactions_thread_idx").on(t.officeId, t.threadId),
    tenantPolicy(),
  ],
).enableRLS();

export const aiCitations = pgTable(
  "ai_citations",
  {
    id,
    officeId: officeRef(),
    interactionId: uuid("interaction_id")
      .notNull()
      .references(() => aiInteractions.id),
    rawText: text("raw_text").notNull(),
    type: citationTypeEnum("type").notNull(),
    parsedLawName: text("parsed_law_name"),
    parsedArticleNumber: text("parsed_article_number"),
    matchedSourceId: uuid("matched_source_id").references(() => knowledgeSources.id),
    matchedChunkId: uuid("matched_chunk_id").references(() => knowledgeChunks.id),
    matchStatus: citationMatchEnum("match_status").notNull(),
    action: citationActionEnum("action").notNull(),
    ...timestamps,
    ...audit,
  },
  (t) => [index("ai_citations_interaction_idx").on(t.interactionId), tenantPolicy()],
).enableRLS();
