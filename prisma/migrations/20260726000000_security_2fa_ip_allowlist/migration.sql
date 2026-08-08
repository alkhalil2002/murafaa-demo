-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "ip_allowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totp_secret" TEXT;

