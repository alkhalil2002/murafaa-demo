-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('APPLIED', 'INTERVIEW', 'OFFER', 'HIRED');

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role_title" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "stage" "CandidateStage" NOT NULL DEFAULT 'APPLIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidates_office_id_stage_idx" ON "candidates"("office_id", "stage");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

