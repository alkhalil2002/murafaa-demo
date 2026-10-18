ALTER TABLE "cases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_assignees" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conflict_flags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "cases", "case_events", "conflict_flags" TO murafaa_app;--> statement-breakpoint
-- case_assignees is a join table: unassigning removes the row (the only DELETE grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON "case_assignees" TO murafaa_app;--> statement-breakpoint
-- Leads remember the case created when they were converted.
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_case_id_cases_id_fk" FOREIGN KEY ("converted_case_id") REFERENCES "public"."cases"("id");
