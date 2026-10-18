ALTER TABLE "offices" ADD COLUMN "branding" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_expires_at" timestamp with time zone;