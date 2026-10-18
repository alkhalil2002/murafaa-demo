CREATE TYPE "public"."approval_stage" AS ENUM('DRAFT', 'SENIOR_LAWYER', 'COUNSEL', 'PROOFREADING', 'PARTNER', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."client_approval_kind" AS ENUM('MEMO', 'FEE', 'SETTLEMENT');--> statement-breakpoint
CREATE TYPE "public"."client_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."client_communication_type" AS ENUM('CALL', 'MESSAGE', 'MEETING', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."exec_file_status" AS ENUM('ACTIVE', 'PARTIALLY_COLLECTED', 'FULLY_COLLECTED', 'STALLED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."exec_proc_status" AS ENUM('REQUIRED', 'IN_PROGRESS', 'EXECUTED', 'STALLED');--> statement-breakpoint
CREATE TYPE "public"."message_sender_type" AS ENUM('STAFF', 'CLIENT');--> statement-breakpoint
CREATE TABLE "case_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"title" text NOT NULL,
	"stage" "approval_stage" DEFAULT 'DRAFT' NOT NULL,
	"hearing_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"court" text,
	"request_no" text,
	"amount" bigint,
	"collected" bigint DEFAULT 0 NOT NULL,
	"debtor" text,
	"basis" text,
	"opened_at" timestamp with time zone,
	"status" "exec_file_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_executions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"sender_type" "message_sender_type" NOT NULL,
	"sender_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "client_approval_kind" NOT NULL,
	"amount" bigint,
	"note" text,
	"status" "client_approval_status" DEFAULT 'PENDING' NOT NULL,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "client_approval_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"type" "client_communication_type" NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "client_communications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_signed" boolean DEFAULT false NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "execution_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_execution_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" "exec_proc_status" DEFAULT 'REQUIRED' NOT NULL,
	"note" text,
	"party" "doc_party",
	"date" timestamp with time zone,
	"follow_up_date" timestamp with time zone,
	"follow_up_assignee_id" uuid,
	"reminder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "execution_procedures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_executions" ADD CONSTRAINT "case_executions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_executions" ADD CONSTRAINT "case_executions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_approval_requests" ADD CONSTRAINT "client_approval_requests_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_approval_requests" ADD CONSTRAINT "client_approval_requests_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_communications" ADD CONSTRAINT "client_communications_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_communications" ADD CONSTRAINT "client_communications_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_procedures" ADD CONSTRAINT "execution_procedures_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_procedures" ADD CONSTRAINT "execution_procedures_case_execution_id_case_executions_id_fk" FOREIGN KEY ("case_execution_id") REFERENCES "public"."case_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_procedures" ADD CONSTRAINT "execution_procedures_follow_up_assignee_id_users_id_fk" FOREIGN KEY ("follow_up_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_procedures" ADD CONSTRAINT "execution_procedures_reminder_id_case_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."case_reminders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_approvals_case_idx" ON "case_approvals" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_executions_one_per_case_key" ON "case_executions" USING btree ("case_id") WHERE "case_executions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "case_messages_case_idx" ON "case_messages" USING btree ("office_id","case_id","created_at");--> statement-breakpoint
CREATE INDEX "client_approval_requests_case_idx" ON "client_approval_requests" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "client_approval_requests_status_idx" ON "client_approval_requests" USING btree ("office_id","status");--> statement-breakpoint
CREATE INDEX "client_communications_case_idx" ON "client_communications" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "contracts_case_idx" ON "contracts" USING btree ("office_id","case_id");--> statement-breakpoint
CREATE INDEX "execution_procedures_file_idx" ON "execution_procedures" USING btree ("office_id","case_execution_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_approvals" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_executions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_messages" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "client_approval_requests" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "client_communications" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "contracts" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "execution_procedures" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "case_approvals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contracts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_communications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_executions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "execution_procedures" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_approval_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Soft delete only (deleted_at). Chat messages are never edited.
GRANT SELECT, INSERT, UPDATE ON "case_approvals", "contracts", "client_communications", "case_executions", "execution_procedures", "client_approval_requests" TO murafaa_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "case_messages" TO murafaa_app;
