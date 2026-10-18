CREATE TYPE "public"."portal_kind" AS ENUM('CLIENT', 'EMPLOYEE');--> statement-breakpoint
CREATE TABLE "portal_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"kind" "portal_kind" NOT NULL,
	"subject_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "portal_otp_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"kind" "portal_kind" NOT NULL,
	"subject_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "portal_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal_otp_challenges" ADD CONSTRAINT "portal_otp_challenges_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_otp_subject_idx" ON "portal_otp_challenges" USING btree ("office_id","kind","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "portal_sessions_subject_idx" ON "portal_sessions" USING btree ("office_id","kind","subject_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_otp_challenges" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_sessions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "portal_otp_challenges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portal_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "portal_otp_challenges", "portal_sessions" TO murafaa_app;--> statement-breakpoint
-- Portal sign-in lookup, like auth_api.login_candidates: at sign-in only a
-- phone is known, so one narrow SECURITY DEFINER function owned by the
-- NOLOGIN murafaa_auth role returns the matching (subject, office) pairs.
-- It reads only these columns. A client must be ACTIVE; an employee ACTIVE or
-- ON_LEAVE (an employee on leave still files requests).
GRANT SELECT ("id", "office_id", "phone", "status", "deleted_at") ON "clients" TO murafaa_auth;--> statement-breakpoint
GRANT SELECT ("id", "office_id", "phone", "status", "deleted_at") ON "employees" TO murafaa_auth;--> statement-breakpoint
CREATE POLICY "auth_portal_lookup" ON "clients" AS PERMISSIVE FOR SELECT TO murafaa_auth USING (true);--> statement-breakpoint
CREATE POLICY "auth_portal_lookup" ON "employees" AS PERMISSIVE FOR SELECT TO murafaa_auth USING (true);--> statement-breakpoint
CREATE FUNCTION auth_api.portal_candidates(p_phone text, p_kind text)
  RETURNS TABLE (subject_id uuid, office_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.office_id FROM clients c
  WHERE p_kind = 'CLIENT' AND c.phone = p_phone AND c.status = 'ACTIVE' AND c.deleted_at IS NULL
  UNION ALL
  SELECT e.id, e.office_id FROM employees e
  WHERE p_kind = 'EMPLOYEE' AND e.phone = p_phone AND e.status IN ('ACTIVE', 'ON_LEAVE') AND e.deleted_at IS NULL
  LIMIT 2
$$;--> statement-breakpoint
ALTER FUNCTION auth_api.portal_candidates(text, text) OWNER TO murafaa_auth;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_api.portal_candidates(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_api.portal_candidates(text, text) TO murafaa_app;
