CREATE TYPE "public"."doc_kind" AS ENUM('DOCUMENT', 'IMAGE', 'TEXT', 'FILE', 'LETTER');--> statement-breakpoint
CREATE TYPE "public"."doc_source" AS ENUM('OPENING', 'PROCEDURAL_REQUEST', 'HEARING', 'CLIENT', 'TEMPLATE', 'UPLOAD');--> statement-breakpoint
CREATE TYPE "public"."procedure_doc_role" AS ENUM('REQUEST', 'RESULT');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid,
	"file_name" text NOT NULL,
	"kind" "doc_kind" DEFAULT 'DOCUMENT' NOT NULL,
	"source" "doc_source" NOT NULL,
	"party" "doc_party",
	"doc_type" text,
	"session_label" text,
	"hearing_id" uuid,
	"procedure_request_id" uuid,
	"procedure_doc_role" "procedure_doc_role",
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"template_key" text,
	"field_values" jsonb,
	"rendered_html" text,
	"generated_date" timestamp with time zone,
	"needs_ocr" boolean DEFAULT false NOT NULL,
	"extracted_text" text,
	"client_visible" boolean DEFAULT false NOT NULL,
	"from_client" boolean DEFAULT false NOT NULL,
	"client_shared_at" timestamp with time zone,
	"client_shared_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_procedure_request_id_procedure_requests_id_fk" FOREIGN KEY ("procedure_request_id") REFERENCES "public"."procedure_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_shared_by_users_id_fk" FOREIGN KEY ("client_shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_case_idx" ON "documents" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "documents" USING btree ("office_id","source");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "documents" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Soft delete only (deleted_at); stored objects are kept for the recycle bin.
GRANT SELECT, INSERT, UPDATE ON "documents" TO murafaa_app;
