-- CreateEnum
CREATE TYPE "AiSurface" AS ENUM ('ASSISTANT', 'CASE_ANALYSIS', 'ARENA');

-- CreateEnum
CREATE TYPE "ArenaRole" AS ENUM ('OURS', 'OPPONENT', 'JUDGE');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('STATUTE', 'REGULATION', 'PRECEDENT');

-- CreateEnum
CREATE TYPE "CitationType" AS ENUM ('ARTICLE', 'STATUTE', 'PRECEDENT');

-- CreateEnum
CREATE TYPE "CitationMatchStatus" AS ENUM ('MATCHED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "CitationAction" AS ENUM ('KEPT', 'BLOCKED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "GateVerdict" AS ENUM ('PASSED', 'FLAGGED', 'BLOCKED');

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "citation_key" TEXT NOT NULL,
    "official_ref" TEXT,
    "issuer" TEXT,
    "issue_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "article_number" TEXT,
    "section_ref" TEXT,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "ord" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "surface" "AiSurface" NOT NULL,
    "arena_role" "ArenaRole",
    "thread_id" TEXT,
    "case_id" UUID,
    "question" TEXT NOT NULL,
    "retrieved_chunk_ids" JSONB NOT NULL,
    "raw_draft" TEXT NOT NULL,
    "final_output" TEXT NOT NULL,
    "verdict" "GateVerdict" NOT NULL,
    "grounding_note" TEXT,
    "disclaimer_shown" BOOLEAN NOT NULL DEFAULT true,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_citations" (
    "id" UUID NOT NULL,
    "interaction_id" UUID NOT NULL,
    "raw_text" TEXT NOT NULL,
    "type" "CitationType" NOT NULL,
    "parsed_law_name" TEXT,
    "parsed_article_number" TEXT,
    "matched_source_id" UUID,
    "matched_chunk_id" UUID,
    "match_status" "CitationMatchStatus" NOT NULL,
    "action" "CitationAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_sources_citation_key_key" ON "knowledge_sources"("citation_key");

-- CreateIndex
CREATE INDEX "knowledge_sources_citation_key_idx" ON "knowledge_sources"("citation_key");

-- CreateIndex
CREATE INDEX "knowledge_chunks_source_id_idx" ON "knowledge_chunks"("source_id");

-- CreateIndex
CREATE INDEX "ai_interactions_office_id_case_id_idx" ON "ai_interactions"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "ai_interactions_office_id_surface_idx" ON "ai_interactions"("office_id", "surface");

-- CreateIndex
CREATE INDEX "ai_citations_interaction_id_idx" ON "ai_citations"("interaction_id");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_matched_source_id_fkey" FOREIGN KEY ("matched_source_id") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_matched_chunk_id_fkey" FOREIGN KEY ("matched_chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

