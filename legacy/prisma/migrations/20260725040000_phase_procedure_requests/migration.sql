-- CreateEnum
CREATE TYPE "ProcedureRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProcedureRequestDocRole" AS ENUM ('REQUEST', 'RESULT');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "procedure_doc_role" "ProcedureRequestDocRole",
ADD COLUMN     "procedure_request_id" UUID;

-- CreateTable
CREATE TABLE "procedure_requests" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "stage_index" INTEGER NOT NULL,
    "party" "DocParty" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ProcedureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "procedure_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procedure_requests_office_id_case_id_idx" ON "procedure_requests"("office_id", "case_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_procedure_request_id_fkey" FOREIGN KEY ("procedure_request_id") REFERENCES "procedure_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

