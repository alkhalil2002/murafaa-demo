ALTER TABLE "permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "field_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_case_scopes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- No DELETE: a policy row is changed in place (upsert), never removed.
GRANT SELECT, INSERT, UPDATE ON "permissions", "field_permissions", "role_case_scopes" TO murafaa_app;
