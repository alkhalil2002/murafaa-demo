-- Auth tables follow the same rules as every tenant table.
ALTER TABLE "otp_challenges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "otp_challenges", "sessions" TO murafaa_app;--> statement-breakpoint

-- Login lookup. At login we only have a phone number, not an office, so the
-- normal tenant policy hides every user. Instead of weakening RLS, one narrow
-- SECURITY DEFINER function, owned by a NOLOGIN role that can read only these
-- columns, returns the matching (user, office) pairs. The API then continues
-- inside withTenant(office) as usual.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'murafaa_auth') THEN
    CREATE ROLE murafaa_auth NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
-- The migrating role must be a member to hand the schema and function to murafaa_auth.
GRANT murafaa_auth TO CURRENT_USER;--> statement-breakpoint
CREATE SCHEMA auth_api AUTHORIZATION murafaa_auth;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO murafaa_auth;--> statement-breakpoint
GRANT SELECT ("id", "office_id", "phone", "is_active", "totp_enabled", "deleted_at") ON "users" TO murafaa_auth;--> statement-breakpoint
CREATE POLICY "auth_login_lookup" ON "users" AS PERMISSIVE FOR SELECT TO murafaa_auth USING (true);--> statement-breakpoint
CREATE FUNCTION auth_api.login_candidates(p_phone text)
  RETURNS TABLE (user_id uuid, office_id uuid, totp_enabled boolean)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.office_id, u.totp_enabled
  FROM users u
  WHERE u.phone = p_phone AND u.is_active AND u.deleted_at IS NULL
  LIMIT 2
$$;--> statement-breakpoint
ALTER FUNCTION auth_api.login_candidates(text) OWNER TO murafaa_auth;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_api.login_candidates(text) FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA auth_api TO murafaa_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_api.login_candidates(text) TO murafaa_app;
