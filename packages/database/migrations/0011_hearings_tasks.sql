CREATE TYPE "public"."doc_party" AS ENUM('OURS', 'OPPONENT', 'COURT');--> statement-breakpoint
CREATE TYPE "public"."hearing_kind" AS ENUM('PRELIMINARY', 'PLEADING', 'MEMO_EXCHANGE', 'PROCEDURAL_CONTROL', 'WITNESS_HEARING', 'EXPERT_EXAMINATION', 'RESERVED_FOR_JUDGMENT', 'JUDGMENT_PRONOUNCEMENT', 'RECONCILIATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."hearing_status" AS ENUM('UPCOMING', 'HELD');--> statement-breakpoint
CREATE TYPE "public"."procedure_request_status" AS ENUM('SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."reminder_source" AS ENUM('MANUAL', 'PENDING_HEARING', 'HEARING_MINUTES', 'EXECUTION_FOLLOWUP');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('CONTRACT_SIGNING', 'MEMO_DRAFTING', 'CONTRACT_DOC_REVIEW', 'LEGAL_RESEARCH', 'PROCEDURAL_FOLLOWUP', 'CLIENT_CORRESPONDENCE', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."task_column" AS ENUM('NEW', 'IN_PROGRESS', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('URGENT', 'NORMAL');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('MANUAL', 'AUTO_HEARING_PREP', 'AUTO_OBJECTION', 'HEARING_ACTION', 'AUTO_EXECUTION_FOLLOWUP');--> statement-breakpoint
CREATE TABLE "case_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"hearing_id" uuid,
	"text" text NOT NULL,
	"due_on" timestamp with time zone NOT NULL,
	"recur_interval_days" integer,
	"source" "reminder_source" DEFAULT 'MANUAL' NOT NULL,
	"is_task_linked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hearings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"sequence_no" integer,
	"hearing_date" timestamp with time zone NOT NULL,
	"status" "hearing_status" DEFAULT 'UPCOMING' NOT NULL,
	"stage_index" smallint,
	"kind" "hearing_kind",
	"minutes" text,
	"result" text,
	"client_report" text,
	"report_approval_requested" boolean DEFAULT false NOT NULL,
	"report_approved" boolean DEFAULT false NOT NULL,
	"report_sent_to_client" boolean DEFAULT false NOT NULL,
	"is_pending" boolean DEFAULT false NOT NULL,
	"pending_items" jsonb,
	"reminder_recur_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "hearings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "procedure_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"hearing_id" uuid,
	"stage_index" smallint NOT NULL,
	"party" "doc_party" NOT NULL,
	"type" text,
	"text" text NOT NULL,
	"status" "procedure_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "procedure_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"title" text NOT NULL,
	"assignee_id" uuid,
	"priority" "task_priority" DEFAULT 'NORMAL' NOT NULL,
	"due_at" timestamp with time zone,
	"category" "task_category",
	"status" "task_column" DEFAULT 'NEW' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"origin" "task_source" DEFAULT 'MANUAL' NOT NULL,
	"auto_signature" text,
	"completed_at" timestamp with time zone,
	"case_id" uuid,
	"hearing_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_reminders_due_idx" ON "case_reminders" USING btree ("office_id","due_on");--> statement-breakpoint
CREATE INDEX "hearings_case_idx" ON "hearings" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "hearings_date_idx" ON "hearings" USING btree ("office_id","hearing_date");--> statement-breakpoint
CREATE INDEX "procedure_requests_case_idx" ON "procedure_requests" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_office_auto_signature_key" ON "tasks" USING btree ("office_id","auto_signature");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("office_id","status");--> statement-breakpoint
CREATE INDEX "tasks_case_idx" ON "tasks" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_reminders" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "hearings" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "procedure_requests" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tasks" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);