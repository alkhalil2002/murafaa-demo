ALTER TABLE "hearings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "case_reminders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "procedure_requests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Soft delete only (deleted_at).
GRANT SELECT, INSERT, UPDATE ON "hearings", "case_reminders", "tasks", "procedure_requests" TO murafaa_app;
