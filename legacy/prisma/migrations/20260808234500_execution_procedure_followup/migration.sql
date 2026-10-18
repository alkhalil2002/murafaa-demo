-- AlterTable
ALTER TABLE "execution_procedures" ADD COLUMN     "follow_up_assignee_id" UUID,
ADD COLUMN     "follow_up_date" TIMESTAMP(3),
ADD COLUMN     "reminder_id" UUID;

