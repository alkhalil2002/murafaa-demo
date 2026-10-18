CREATE TYPE "public"."ai_surface" AS ENUM('ASSISTANT', 'CASE_ANALYSIS', 'ARENA', 'HEARING_DRAFT');--> statement-breakpoint
CREATE TYPE "public"."arena_role" AS ENUM('OURS', 'OPPONENT', 'JUDGE');--> statement-breakpoint
CREATE TYPE "public"."citation_action" AS ENUM('KEPT', 'BLOCKED', 'FLAGGED');--> statement-breakpoint
CREATE TYPE "public"."citation_match" AS ENUM('MATCHED', 'UNMATCHED');--> statement-breakpoint
CREATE TYPE "public"."citation_type" AS ENUM('ARTICLE', 'STATUTE', 'PRECEDENT');--> statement-breakpoint
CREATE TYPE "public"."gate_verdict" AS ENUM('PASSED', 'FLAGGED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('STATUTE', 'REGULATION', 'PRECEDENT');--> statement-breakpoint
CREATE TABLE "ai_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"interaction_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"type" "citation_type" NOT NULL,
	"parsed_law_name" text,
	"parsed_article_number" text,
	"matched_source_id" uuid,
	"matched_chunk_id" uuid,
	"match_status" "citation_match" NOT NULL,
	"action" "citation_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_citations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"surface" "ai_surface" NOT NULL,
	"arena_role" "arena_role",
	"thread_id" text,
	"case_id" uuid,
	"question" text NOT NULL,
	"retrieved_chunk_ids" jsonb NOT NULL,
	"raw_draft" text NOT NULL,
	"final_output" text NOT NULL,
	"verdict" "gate_verdict" NOT NULL,
	"grounded" boolean NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_interactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"article_number" text,
	"content" text NOT NULL,
	"search_text" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"type" "knowledge_source_type" NOT NULL,
	"title" text NOT NULL,
	"citation_key" text NOT NULL,
	"official_ref" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_interaction_id_ai_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."ai_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_matched_source_id_knowledge_sources_id_fk" FOREIGN KEY ("matched_source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_matched_chunk_id_knowledge_chunks_id_fk" FOREIGN KEY ("matched_chunk_id") REFERENCES "public"."knowledge_chunks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_citations_interaction_idx" ON "ai_citations" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "ai_interactions_case_idx" ON "ai_interactions" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "ai_interactions_thread_idx" ON "ai_interactions" USING btree ("office_id","thread_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("office_id","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_search_idx" ON "knowledge_chunks" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_sources_office_key" ON "knowledge_sources" USING btree ("office_id","citation_key");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ai_citations" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ai_interactions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "knowledge_chunks" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "knowledge_sources" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "knowledge_sources" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_interactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_citations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- The AI audit trail is append-only.
GRANT SELECT, INSERT ON "ai_interactions", "ai_citations" TO murafaa_app;--> statement-breakpoint
-- Knowledge base: sources are deactivated, never deleted (past citations point at them).
GRANT SELECT, INSERT, UPDATE ON "knowledge_sources", "knowledge_chunks" TO murafaa_app;
