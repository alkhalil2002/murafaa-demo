-- Hardening that drizzle-kit does not express in the schema.

-- pgvector for the AI knowledge base (docs/02 §6). Cloud SQL supports it natively.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

-- FORCE: policies apply even to the table owner, so a misconfigured connection
-- string that uses the owner still cannot read across offices.
ALTER TABLE "offices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbox" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Least privilege for the app role. No DELETE anywhere: records are soft-deleted.
GRANT USAGE ON SCHEMA public TO murafaa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "offices", "users", "outbox" TO murafaa_app;--> statement-breakpoint
-- The audit log is append-only.
GRANT SELECT, INSERT ON "audit_log" TO murafaa_app;
