-- CreateEnum
CREATE TYPE "IntegrationKey" AS ENUM ('GOSI', 'QIWA', 'MUDAD', 'ZATCA', 'ABSHER', 'MUQEEM');

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "key" "IntegrationKey" NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_office_id_key_key" ON "integration_connections"("office_id", "key");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

