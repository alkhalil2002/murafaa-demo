CREATE TYPE "public"."case_event_type" AS ENUM('STAGE', 'REQUEST', 'DOC', 'APPROVAL', 'OPENING', 'DEADLINE', 'MESSAGE', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."case_outcome" AS ENUM('WON', 'PARTIAL', 'SETTLED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."conflict_severity" AS ENUM('HIGH', 'MEDIUM');--> statement-breakpoint
CREATE TYPE "public"."conflict_status" AS ENUM('ACTIVE', 'WAIVED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."conflict_type" AS ENUM('OPPONENT_IS_CLIENT', 'OPPONENT_IS_LEAD', 'OPPONENT_IS_OUR_CLIENT_OTHER_CASE', 'OUR_CLIENT_IS_OPPONENT_OTHER_CASE');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('PLAINTIFF', 'DEFENDANT');--> statement-breakpoint
CREATE TYPE "public"."proc_stage" AS ENUM('RECONCILIATION', 'FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'EXECUTION');--> statement-breakpoint
CREATE TABLE "case_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_assignees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"type" "case_event_type" NOT NULL,
	"message_key" text,
	"params" jsonb,
	"text" text,
	"actor_user_id" uuid,
	"procedure_request_id" uuid,
	"approval_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"client_role" "party_role" DEFAULT 'PLAINTIFF' NOT NULL,
	"client_id" uuid,
	"opposing_party" text,
	"entity" text,
	"najiz_main_class" text,
	"najiz_sub_class" text,
	"najiz_case_type" text,
	"city" text,
	"stage" "proc_stage" DEFAULT 'FIRST_INSTANCE' NOT NULL,
	"status" "case_status" DEFAULT 'ACTIVE' NOT NULL,
	"outcome" "case_outcome",
	"fact_summary" text,
	"judgment_date" timestamp with time zone,
	"objection_due_at" timestamp with time zone,
	"poa_expires_at" timestamp with time zone,
	"arena_session_seq" integer DEFAULT 1 NOT NULL,
	"client_satisfaction_score" smallint,
	"referral_requested" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"proc_ended" boolean DEFAULT false NOT NULL,
	"proc_result" text,
	"closing_checklist" jsonb,
	"conflict_severity" "conflict_severity",
	"conflict_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conflict_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"severity" "conflict_severity" NOT NULL,
	"conflict_type" "conflict_type" NOT NULL,
	"message_key" text NOT NULL,
	"message_params" jsonb,
	"matched_name" text NOT NULL,
	"matched_client_id" uuid,
	"matched_lead_id" uuid,
	"matched_case_ids" jsonb,
	"status" "conflict_status" DEFAULT 'ACTIVE' NOT NULL,
	"waiver_note" text,
	"waived_by" uuid,
	"waived_at" timestamp with time zone,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "conflict_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_assignees" ADD CONSTRAINT "case_assignees_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignees" ADD CONSTRAINT "case_assignees_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignees" ADD CONSTRAINT "case_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_matched_client_id_clients_id_fk" FOREIGN KEY ("matched_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_matched_lead_id_leads_id_fk" FOREIGN KEY ("matched_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_waived_by_users_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_assignees_case_user_key" ON "case_assignees" USING btree ("case_id","user_id");--> statement-breakpoint
CREATE INDEX "case_assignees_user_idx" ON "case_assignees" USING btree ("office_id","user_id");--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" USING btree ("office_id","case_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cases_office_client_idx" ON "cases" USING btree ("office_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conflict_flags_case_type_name_key" ON "conflict_flags" USING btree ("case_id","conflict_type","matched_name");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_assignees" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "case_events" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "cases" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "conflict_flags" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);