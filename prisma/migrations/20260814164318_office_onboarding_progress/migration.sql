-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "onboarding_done_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_step" INTEGER NOT NULL DEFAULT 0;
