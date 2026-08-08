-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('STAFF', 'CLIENT');

-- CreateTable
CREATE TABLE "case_messages" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "sender_type" "MessageSenderType" NOT NULL,
    "sender_user_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_messages_office_id_case_id_created_at_idx" ON "case_messages"("office_id", "case_id", "created_at");

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_messages" ADD CONSTRAINT "case_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

