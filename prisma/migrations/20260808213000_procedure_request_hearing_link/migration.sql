-- AlterTable
ALTER TABLE "procedure_requests" ADD COLUMN     "hearing_id" UUID;

-- AddForeignKey
ALTER TABLE "procedure_requests" ADD CONSTRAINT "procedure_requests_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "hearings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

