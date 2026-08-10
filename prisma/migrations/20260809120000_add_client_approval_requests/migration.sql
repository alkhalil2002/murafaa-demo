-- CreateEnum
CREATE TYPE "ClientApprovalKind" AS ENUM ('MEMO', 'FEE', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "ClientApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "client_approval_requests" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ClientApprovalKind" NOT NULL,
    "amount" INTEGER,
    "note" TEXT,
    "status" "ClientApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "client_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_approval_requests_office_id_case_id_idx" ON "client_approval_requests"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "client_approval_requests_office_id_status_idx" ON "client_approval_requests"("office_id", "status");

-- AddForeignKey
ALTER TABLE "client_approval_requests" ADD CONSTRAINT "client_approval_requests_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_approval_requests" ADD CONSTRAINT "client_approval_requests_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
