ALTER TABLE "offices" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "cr_number" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "tax_address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_vat_number_format" CHECK ("offices"."vat_number" is null or "offices"."vat_number" ~ '^3[0-9]{13}3$');--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_cr_number_format" CHECK ("offices"."cr_number" is null or "offices"."cr_number" ~ '^[0-9]{10}$');--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_vat_number_format" CHECK ("clients"."vat_number" is null or "clients"."vat_number" ~ '^3[0-9]{13}3$');