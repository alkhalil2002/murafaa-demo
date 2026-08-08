-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "hearing_id" UUID;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "hearings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

