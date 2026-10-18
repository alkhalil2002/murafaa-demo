CREATE TYPE "public"."case_scope" AS ENUM('ALL', 'ASSIGNED');--> statement-breakpoint
CREATE TYPE "public"."perm_level" AS ENUM('NONE', 'VIEW', 'EDIT', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."perm_module" AS ENUM('CASES', 'AI', 'CLIENTS', 'DOCUMENTS', 'FINANCE', 'HR', 'REPORTS', 'PERMISSIONS', 'WHATSAPP', 'APPOINTMENTS', 'TASKS', 'ALERTS', 'PULSE');--> statement-breakpoint
CREATE TABLE "field_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"resource" text NOT NULL,
	"field" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "field_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"module" "perm_module" NOT NULL,
	"level" "perm_level" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_case_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"scope" "case_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "role_case_scopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "field_permissions" ADD CONSTRAINT "field_permissions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_case_scopes" ADD CONSTRAINT "role_case_scopes_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_permissions_office_role_resource_field_key" ON "field_permissions" USING btree ("office_id","role","resource","field");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_office_role_module_key" ON "permissions" USING btree ("office_id","role","module");--> statement-breakpoint
CREATE UNIQUE INDEX "role_case_scopes_office_role_key" ON "role_case_scopes" USING btree ("office_id","role");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "field_permissions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "permissions" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "role_case_scopes" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);