-- CreateEnum
CREATE TYPE "ClientCommunicationType" AS ENUM ('CALL', 'MESSAGE', 'MEETING', 'EMAIL');

-- CreateTable
CREATE TABLE "client_communications" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" "ClientCommunicationType" NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "client_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_communications_office_id_case_id_idx" ON "client_communications"("office_id", "case_id");

-- AddForeignKey
ALTER TABLE "client_communications" ADD CONSTRAINT "client_communications_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_communications" ADD CONSTRAINT "client_communications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

