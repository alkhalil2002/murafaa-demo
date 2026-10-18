-- CreateEnum
CREATE TYPE "DocKind" AS ENUM ('DOCUMENT', 'IMAGE', 'TEXT', 'FILE', 'LETTER');

-- CreateEnum
CREATE TYPE "DocSource" AS ENUM ('OPENING', 'PROCEDURAL_REQUEST', 'HEARING', 'CLIENT', 'TEMPLATE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "DocParty" AS ENUM ('OURS', 'OPPONENT', 'COURT');

-- CreateEnum
CREATE TYPE "DocumentTemplateCategory" AS ENUM ('CLAIMS', 'MEMOS', 'CONTRACTS', 'POWERS_OF_ATTORNEY', 'ADMIN', 'EXECUTION');

-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "branding" JSONB;

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "office_id" UUID,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentTemplateCategory" NOT NULL,
    "body_template" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID,
    "file_name" TEXT NOT NULL,
    "kind" "DocKind" NOT NULL DEFAULT 'DOCUMENT',
    "source" "DocSource" NOT NULL,
    "party" "DocParty",
    "doc_type" TEXT,
    "session_label" TEXT,
    "hearing_id" UUID,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "template_id" UUID,
    "field_values" JSONB,
    "rendered_html" TEXT,
    "generated_date" TIMESTAMP(3),
    "needs_ocr" BOOLEAN NOT NULL DEFAULT false,
    "extracted_text" TEXT,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "from_client" BOOLEAN NOT NULL DEFAULT false,
    "client_shared_at" TIMESTAMP(3),
    "client_shared_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_office_id_idx" ON "document_templates"("office_id");

-- CreateIndex
CREATE INDEX "document_templates_key_idx" ON "document_templates"("key");

-- CreateIndex
CREATE INDEX "documents_office_id_case_id_idx" ON "documents"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "documents_office_id_source_idx" ON "documents"("office_id", "source");

-- CreateIndex
CREATE INDEX "documents_office_id_client_visible_idx" ON "documents"("office_id", "client_visible");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

