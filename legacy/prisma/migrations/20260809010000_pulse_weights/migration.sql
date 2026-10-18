-- CreateTable
CREATE TABLE "office_performance_weights" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "kind" "PerformanceEventKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "office_performance_weights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "office_performance_weights_office_id_kind_key" ON "office_performance_weights"("office_id", "kind");

-- AddForeignKey
ALTER TABLE "office_performance_weights" ADD CONSTRAINT "office_performance_weights_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

