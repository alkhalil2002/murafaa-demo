-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('DRAFT', 'SENIOR_LAWYER', 'COUNSEL', 'PROOFREADING', 'PARTNER', 'APPROVED');

-- CreateTable
CREATE TABLE "case_approvals" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "ApprovalStage" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "case_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_approvals_office_id_case_id_idx" ON "case_approvals"("office_id", "case_id");

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

