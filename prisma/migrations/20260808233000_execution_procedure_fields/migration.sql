-- AlterTable
ALTER TABLE "execution_procedures" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "party" "DocParty",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

