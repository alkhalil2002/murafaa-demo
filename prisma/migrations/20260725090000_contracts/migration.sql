-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_office_id_case_id_idx" ON "contracts"("office_id", "case_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

