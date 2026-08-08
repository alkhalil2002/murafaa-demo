-- CreateEnum
CREATE TYPE "ExecutionFileStatus" AS ENUM ('ACTIVE', 'PARTIALLY_COLLECTED', 'FULLY_COLLECTED', 'STALLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExecutionProcStatus" AS ENUM ('REQUIRED', 'IN_PROGRESS', 'EXECUTED', 'STALLED');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "closing_checklist" JSONB;

-- CreateTable
CREATE TABLE "case_executions" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "court" TEXT,
    "request_no" TEXT,
    "amount_minor" INTEGER,
    "collected_minor" INTEGER NOT NULL DEFAULT 0,
    "debtor" TEXT,
    "basis" TEXT,
    "opened_at" TIMESTAMP(3),
    "status" "ExecutionFileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "case_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_procedures" (
    "id" UUID NOT NULL,
    "case_execution_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ExecutionProcStatus" NOT NULL DEFAULT 'REQUIRED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_executions_case_id_key" ON "case_executions"("case_id");

-- CreateIndex
CREATE INDEX "execution_procedures_case_execution_id_idx" ON "execution_procedures"("case_execution_id");

-- AddForeignKey
ALTER TABLE "case_executions" ADD CONSTRAINT "case_executions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_executions" ADD CONSTRAINT "case_executions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_procedures" ADD CONSTRAINT "execution_procedures_case_execution_id_fkey" FOREIGN KEY ("case_execution_id") REFERENCES "case_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

