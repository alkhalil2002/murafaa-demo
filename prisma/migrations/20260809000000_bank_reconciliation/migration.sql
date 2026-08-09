-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "cleared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cleared_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "cleared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cleared_at" TIMESTAMP(3);

