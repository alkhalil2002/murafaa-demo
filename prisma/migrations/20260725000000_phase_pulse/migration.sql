-- CreateEnum
CREATE TYPE "PerformanceEventKind" AS ENUM ('TASK_COMPLETED', 'HEARING_RECORDED', 'DOCUMENT_GENERATED', 'INVOICE_CREATED', 'LEAD_CONVERTED');

-- CreateTable
CREATE TABLE "performance_events" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "PerformanceEventKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_events_office_id_user_id_occurred_at_idx" ON "performance_events"("office_id", "user_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "performance_events" ADD CONSTRAINT "performance_events_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_events" ADD CONSTRAINT "performance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

