CREATE TYPE "public"."office_status" AS ENUM('TRIAL', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"totp_secret_enc" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"office_id" uuid,
	"details" jsonb,
	"ip" "inet",
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "platform_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
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
ALTER TABLE "platform_otp_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
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
ALTER TABLE "platform_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "status" "office_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "license_number" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "trial_ends_at" date;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "paid_until" date;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_otp_challenges" ADD CONSTRAINT "platform_otp_challenges_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_phone_key" ON "platform_admins" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "platform_audit_created_idx" ON "platform_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_otp_admin_idx" ON "platform_otp_challenges" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_sessions_admin_idx" ON "platform_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE POLICY "platform_only" ON "platform_admins" AS PERMISSIVE FOR ALL TO "murafaa_app" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');--> statement-breakpoint
CREATE POLICY "platform_only" ON "platform_audit_log" AS PERMISSIVE FOR ALL TO "murafaa_app" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');--> statement-breakpoint
CREATE POLICY "platform_only" ON "platform_otp_challenges" AS PERMISSIVE FOR ALL TO "murafaa_app" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');--> statement-breakpoint
CREATE POLICY "platform_only" ON "platform_sessions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');--> statement-breakpoint
ALTER TABLE "platform_admins" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_otp_challenges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "platform_admins", "platform_otp_challenges", "platform_sessions" TO murafaa_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "platform_audit_log" TO murafaa_app;--> statement-breakpoint
-- Staff phones are unique across offices (owner, 2026-10-19): sign-in can't
-- choose between offices, so a phone used in one office is refused in another.
-- Like login_candidates, a narrow SECURITY DEFINER lookup owned by murafaa_auth.
CREATE FUNCTION auth_api.phone_offices(p_phone text)
  RETURNS TABLE (office_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT u.office_id FROM users u WHERE u.phone = p_phone AND u.deleted_at IS NULL
$$;--> statement-breakpoint
ALTER FUNCTION auth_api.phone_offices(text) OWNER TO murafaa_auth;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_api.phone_offices(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_api.phone_offices(text) TO murafaa_app;--> statement-breakpoint
-- إدارة المنصة reads across offices only through these functions, owned by
-- the NOLOGIN murafaa_platform role. It can read office metadata and the few
-- columns needed for counts, never case, client or document content. Every
-- function refuses to run outside withPlatform() (app.platform = 'on').
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'murafaa_platform') THEN
    CREATE ROLE murafaa_platform NOLOGIN;
  END IF;
END $$;--> statement-breakpoint
GRANT murafaa_platform TO CURRENT_USER;--> statement-breakpoint
CREATE SCHEMA platform_api AUTHORIZATION murafaa_platform;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO murafaa_platform;--> statement-breakpoint
GRANT USAGE ON TYPE "office_status" TO murafaa_platform;--> statement-breakpoint
GRANT SELECT ("id", "name", "status", "city", "license_number", "cr_number", "trial_ends_at", "paid_until", "suspended_at", "created_at", "deleted_at") ON "offices" TO murafaa_platform;--> statement-breakpoint
GRANT UPDATE ("status", "trial_ends_at", "paid_until", "suspended_at", "updated_at") ON "offices" TO murafaa_platform;--> statement-breakpoint
GRANT SELECT ("id", "office_id", "name", "phone", "role", "is_active", "last_login_at", "created_at", "deleted_at") ON "users" TO murafaa_platform;--> statement-breakpoint
GRANT SELECT ("office_id", "deleted_at") ON "cases" TO murafaa_platform;--> statement-breakpoint
GRANT SELECT ("office_id", "deleted_at") ON "clients" TO murafaa_platform;--> statement-breakpoint
GRANT SELECT ("office_id", "deleted_at", "size_bytes") ON "documents" TO murafaa_platform;--> statement-breakpoint
CREATE POLICY "platform_read" ON "offices" AS PERMISSIVE FOR SELECT TO murafaa_platform USING (true);--> statement-breakpoint
CREATE POLICY "platform_update" ON "offices" AS PERMISSIVE FOR UPDATE TO murafaa_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_read" ON "users" AS PERMISSIVE FOR SELECT TO murafaa_platform USING (true);--> statement-breakpoint
CREATE POLICY "platform_read" ON "cases" AS PERMISSIVE FOR SELECT TO murafaa_platform USING (true);--> statement-breakpoint
CREATE POLICY "platform_read" ON "clients" AS PERMISSIVE FOR SELECT TO murafaa_platform USING (true);--> statement-breakpoint
CREATE POLICY "platform_read" ON "documents" AS PERMISSIVE FOR SELECT TO murafaa_platform USING (true);--> statement-breakpoint
CREATE FUNCTION platform_api.offices()
  RETURNS TABLE (
    id uuid, name text, status office_status, city text, license_number text, cr_number text,
    trial_ends_at date, paid_until date, suspended_at timestamptz, created_at timestamptz,
    users int, cases int, clients int, documents int, storage_bytes bigint,
    owner_name text, owner_phone text
  )
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF current_setting('app.platform', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'platform context required';
  END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.status, o.city, o.license_number, o.cr_number,
         o.trial_ends_at, o.paid_until, o.suspended_at, o.created_at,
         (SELECT count(*)::int FROM users u WHERE u.office_id = o.id AND u.is_active AND u.deleted_at IS NULL),
         (SELECT count(*)::int FROM cases c WHERE c.office_id = o.id AND c.deleted_at IS NULL),
         (SELECT count(*)::int FROM clients c WHERE c.office_id = o.id AND c.deleted_at IS NULL),
         (SELECT count(*)::int FROM documents d WHERE d.office_id = o.id AND d.deleted_at IS NULL),
         (SELECT coalesce(sum(d.size_bytes), 0)::bigint FROM documents d WHERE d.office_id = o.id AND d.deleted_at IS NULL),
         p.name, p.phone
  FROM offices o
  LEFT JOIN LATERAL (
    SELECT u.name, u.phone FROM users u
    WHERE u.office_id = o.id AND u.role = 'PARTNER' AND u.deleted_at IS NULL
    ORDER BY u.created_at LIMIT 1
  ) p ON true
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at;
END
$$;--> statement-breakpoint
CREATE FUNCTION platform_api.office_users(p_office uuid)
  RETURNS TABLE (id uuid, name text, role role, is_active boolean, last_login_at timestamptz)
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF current_setting('app.platform', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'platform context required';
  END IF;
  RETURN QUERY
  SELECT u.id, u.name, u.role, u.is_active, u.last_login_at FROM users u
  WHERE u.office_id = p_office AND u.deleted_at IS NULL
  ORDER BY u.created_at;
END
$$;--> statement-breakpoint
-- suspended_at follows the status: set when an office is suspended, cleared when it is not.
CREATE FUNCTION platform_api.update_office(p_office uuid, p_status office_status, p_trial_ends_at date, p_paid_until date)
  RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF current_setting('app.platform', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'platform context required';
  END IF;
  UPDATE offices o SET
    status = p_status,
    trial_ends_at = p_trial_ends_at,
    paid_until = p_paid_until,
    suspended_at = CASE WHEN p_status = 'SUSPENDED' THEN coalesce(o.suspended_at, now()) ELSE NULL END,
    updated_at = now()
  WHERE o.id = p_office AND o.deleted_at IS NULL;
  RETURN FOUND;
END
$$;--> statement-breakpoint
ALTER FUNCTION platform_api.offices() OWNER TO murafaa_platform;--> statement-breakpoint
ALTER FUNCTION platform_api.office_users(uuid) OWNER TO murafaa_platform;--> statement-breakpoint
ALTER FUNCTION platform_api.update_office(uuid, office_status, date, date) OWNER TO murafaa_platform;--> statement-breakpoint
REVOKE ALL ON FUNCTION platform_api.offices() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION platform_api.office_users(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION platform_api.update_office(uuid, office_status, date, date) FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA platform_api TO murafaa_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION platform_api.offices() TO murafaa_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION platform_api.office_users(uuid) TO murafaa_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION platform_api.update_office(uuid, office_status, date, date) TO murafaa_app;
