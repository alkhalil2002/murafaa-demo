CREATE TYPE "public"."client_status" AS ENUM('ACTIVE', 'PROSPECT', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('INDIVIDUAL', 'COMPANY', 'ESTABLISHMENT');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('REFERRAL', 'WEBSITE', 'LINKEDIN', 'PHONE_CALL', 'EXHIBITION', 'WHATSAPP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('PROSPECT', 'FIRST_CONSULTATION', 'FEE_PROPOSAL_SENT', 'CONTRACTED');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"city" text,
	"type" "client_type" DEFAULT 'INDIVIDUAL' NOT NULL,
	"status" "client_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "client_type" DEFAULT 'INDIVIDUAL' NOT NULL,
	"source" "lead_source" DEFAULT 'OTHER' NOT NULL,
	"stage" "lead_stage" DEFAULT 'PROSPECT' NOT NULL,
	"expected_value" bigint DEFAULT 0 NOT NULL,
	"next_action" text,
	"phone" text,
	"converted_client_id" uuid,
	"converted_case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_client_id_clients_id_fk" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_office_phone_key" ON "clients" USING btree ("office_id","phone");--> statement-breakpoint
CREATE INDEX "leads_office_stage_idx" ON "leads" USING btree ("office_id","stage");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "clients" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "leads" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);