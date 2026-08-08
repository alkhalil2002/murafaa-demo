-- AlterTable
ALTER TABLE "procedure_requests" ADD COLUMN     "type" TEXT,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
