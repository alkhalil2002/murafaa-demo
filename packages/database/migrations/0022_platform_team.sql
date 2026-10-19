CREATE TYPE "public"."platform_role" AS ENUM('OWNER', 'OPERATIONS', 'BILLING', 'SUPPORT');--> statement-breakpoint
CREATE TABLE "platform_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"totp_pending_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "platform_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_admins" ALTER COLUMN "totp_secret_enc" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "role" "platform_role" DEFAULT 'SUPPORT' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_invites" ADD CONSTRAINT "platform_invites_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invites_token_key" ON "platform_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "platform_invites_admin_idx" ON "platform_invites" USING btree ("admin_id");--> statement-breakpoint
CREATE POLICY "platform_only" ON "platform_invites" AS PERMISSIVE FOR ALL TO "murafaa_app" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');--> statement-breakpoint
ALTER TABLE "platform_invites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "platform_invites" TO murafaa_app;--> statement-breakpoint
-- Admins created before roles existed were full operators and activated
-- from the terminal: they become owners, already active. FORCE RLS hides
-- the rows from the migrating role too, so it is lifted for this update only.
ALTER TABLE "platform_admins" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "platform_admins" SET "role" = 'OWNER', "activated_at" = "created_at" WHERE "totp_secret_enc" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admins" FORCE ROW LEVEL SECURITY;
