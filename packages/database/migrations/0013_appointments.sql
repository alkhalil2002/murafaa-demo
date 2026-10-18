CREATE TYPE "public"."appointment_status" AS ENUM('SCHEDULED', 'CANCELLED', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('FIRST_CONSULTATION', 'CONTRACT_REVIEW', 'FOLLOW_UP');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"client_id" uuid,
	"lead_id" uuid,
	"scheduled_on" timestamp with time zone NOT NULL,
	"scheduled_time" text,
	"type" "appointment_type" DEFAULT 'FIRST_CONSULTATION' NOT NULL,
	"status" "appointment_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_date_idx" ON "appointments" USING btree ("office_id","scheduled_on");--> statement-breakpoint
CREATE UNIQUE INDEX "hearings_one_upcoming_key" ON "hearings" USING btree ("case_id") WHERE "hearings"."status" = 'UPCOMING' and "hearings"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "appointments" AS PERMISSIVE FOR ALL TO "murafaa_app" USING ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid) WITH CHECK ("office_id" = nullif(current_setting('app.office_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Cancel is a status change; removal is soft (deleted_at).
GRANT SELECT, INSERT, UPDATE ON "appointments" TO murafaa_app;
