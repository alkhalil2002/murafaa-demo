ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- No DELETE: clients and leads are soft-deleted (recycle bin).
GRANT SELECT, INSERT, UPDATE ON "clients", "leads" TO murafaa_app;
