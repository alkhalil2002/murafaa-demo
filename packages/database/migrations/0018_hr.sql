CREATE TYPE "public"."advance_status" AS ENUM('ACTIVE', 'SETTLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'LATE', 'ABSENT', 'LEAVE');--> statement-breakpoint
CREATE TYPE "public"."candidate_stage" AS ENUM('APPLIED', 'INTERVIEW', 'OFFER', 'HIRED');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."performance_event_kind" AS ENUM('TASK_COMPLETED', 'HEARING_RECORDED', 'DOCUMENT_GENERATED', 'INVOICE_CREATED', 'LEAD_CONVERTED');--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('LEAVE', 'ADVANCE', 'CERTIFICATE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"monthly_installment" bigint,
	"months" integer DEFAULT 1 NOT NULL,
	"paid" bigint DEFAULT 0 NOT NULL,
	"advance_date" date NOT NULL,
	"status" "advance_status" DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "advances_amount_positive" CHECK ("advances"."amount" > 0 and "advances"."months" >= 1),
	CONSTRAINT "advances_paid_range" CHECK ("advances"."paid" >= 0 and "advances"."paid" <= "advances"."amount")
);
--> statement-breakpoint
ALTER TABLE "advances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" "attendance_status" DEFAULT 'PRESENT' NOT NULL,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role_title" text,
	"source" "lead_source" DEFAULT 'OTHER' NOT NULL,
	"stage" "candidate_stage" DEFAULT 'APPLIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"department" text,
	"kind" "request_kind" NOT NULL,
	"detail" text,
	"days" integer,
	"status" "request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "employee_requests_days_positive" CHECK ("employee_requests"."days" is null or "employee_requests"."days" > 0)
);
--> statement-breakpoint
ALTER TABLE "employee_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"department" text,
	"job_title" text,
	"nationality" text DEFAULT 'سعودي' NOT NULL,
	"national_id" text,
	"iban" text,
	"hire_date" date NOT NULL,
	"status" "employee_status" DEFAULT 'ACTIVE' NOT NULL,
	"basic_salary" bigint NOT NULL,
	"allowances" bigint DEFAULT 0 NOT NULL,
	"gosi_contribution" bigint DEFAULT 0 NOT NULL,
	"leave_balance_days" integer DEFAULT 0 NOT NULL,
	"performance_score" integer,
	"terminated_at" timestamp with time zone,
	"end_of_service_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "employees_money_nonnegative" CHECK ("employees"."basic_salary" >= 0 and "employees"."allowances" >= 0 and "employees"."gosi_contribution" >= 0),
	CONSTRAINT "employees_leave_balance_nonnegative" CHECK ("employees"."leave_balance_days" >= 0),
	CONSTRAINT "employees_score_range" CHECK ("employees"."performance_score" is null or "employees"."performance_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" "leave_type" DEFAULT 'ANNUAL' NOT NULL,
	"days" integer NOT NULL,
	"start_date" date NOT NULL,
	"note" text,
	"deducted_balance" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "leaves_days_positive" CHECK ("leaves"."days" > 0)
);
--> statement-breakpoint
ALTER TABLE "leaves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "office_performance_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"kind" "performance_event_kind" NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "office_performance_weights_nonnegative" CHECK ("office_performance_weights"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "office_performance_weights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"basic" bigint NOT NULL,
	"allowances" bigint NOT NULL,
	"gosi" bigint NOT NULL,
	"advance_deduction" bigint NOT NULL,
	"net" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "payroll_lines_balanced" CHECK ("payroll_lines"."net" = "payroll_lines"."basic" + "payroll_lines"."allowances" - "payroll_lines"."gosi" - "payroll_lines"."advance_deduction" and "payroll_lines"."net" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payroll_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"total_basic" bigint DEFAULT 0 NOT NULL,
	"total_allowances" bigint DEFAULT 0 NOT NULL,
	"total_gosi" bigint DEFAULT 0 NOT NULL,
	"total_advances" bigint DEFAULT 0 NOT NULL,
	"total_net" bigint DEFAULT 0 NOT NULL,
	"journal_entry_id" uuid,
	"posted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "payroll_runs_period_format" CHECK ("payroll_runs"."period_key" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "performance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "performance_event_kind" NOT NULL,
	"points" integer NOT NULL,
	"source_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "performance_events_points_nonnegative" CHECK ("performance_events"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "performance_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advances" ADD CONSTRAINT "advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_performance_weights" ADD CONSTRAINT "office_performance_weights_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_events" ADD CONSTRAINT "performance_events_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_events" ADD CONSTRAINT "performance_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advances_employee_idx" ON "advances" USING btree ("office_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_employee_day_key" ON "attendance" USING btree ("office_id","employee_id","day");--> statement-breakpoint
CREATE INDEX "attendance_day_idx" ON "attendance" USING btree ("office_id","day");--> statement-breakpoint
CREATE INDEX "candidates_stage_idx" ON "candidates" USING btree ("office_id","stage");--> statement-breakpoint
CREATE INDEX "employee_requests_employee_idx" ON "employee_requests" USING btree ("office_id","employee_id");--> statement-breakpoint
CREATE INDEX "employee_requests_status_idx" ON "employee_requests" USING btree ("office_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_user_key" ON "employees" USING btree ("user_id") WHERE "employees"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("office_id","status");--> statement-breakpoint
CREATE INDEX "leaves_employee_idx" ON "leaves" USING btree ("office_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_performance_weights_kind_key" ON "office_performance_weights" USING btree ("office_id","kind");--> statement-breakpoint
CREATE INDEX "payroll_lines_run_idx" ON "payroll_lines" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "payroll_lines_employee_idx" ON "payroll_lines" USING btree ("office_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_period_key" ON "payroll_runs" USING btree ("office_id","period_key");--> statement-breakpoint
CREATE INDEX "performance_events_user_idx" ON "performance_events" USING btree ("office_id","user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "performance_events_time_idx" ON "performance_events" USING btree ("office_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_events_source_key" ON "performance_events" USING btree ("office_id","kind","source_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "advances" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "attendance" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "candidates" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "employee_requests" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "employees" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "leaves" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "office_performance_weights" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payroll_lines" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payroll_runs" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "performance_events" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "advances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leaves" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "employee_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payroll_lines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "performance_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "office_performance_weights" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "employees", "advances", "leaves", "attendance", "employee_requests", "payroll_runs", "candidates", "office_performance_weights" TO murafaa_app;--> statement-breakpoint
-- Posted payroll lines and earned points are history: append-only.
GRANT SELECT, INSERT ON "payroll_lines", "performance_events" TO murafaa_app;
