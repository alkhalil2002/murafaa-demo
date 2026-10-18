-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PROSPECT', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('PLAINTIFF', 'DEFENDANT');

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('UPCOMING', 'HELD');

-- CreateEnum
CREATE TYPE "HearingKind" AS ENUM ('PRELIMINARY', 'PLEADING', 'MEMO_EXCHANGE', 'PROCEDURAL_CONTROL', 'WITNESS_HEARING', 'EXPERT_EXAMINATION', 'RESERVED_FOR_JUDGMENT', 'JUDGMENT_PRONOUNCEMENT', 'RECONCILIATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseEventType" AS ENUM ('STAGE', 'REQUEST', 'DOC', 'APPROVAL', 'OPENING', 'DEADLINE', 'MESSAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('PROSPECT', 'FIRST_CONSULTATION', 'FEE_PROPOSAL_SENT', 'CONTRACTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'WEBSITE', 'LINKEDIN', 'PHONE_CALL', 'EXHIBITION', 'WHATSAPP', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskColumn" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'NORMAL');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('CONTRACT_SIGNING', 'MEMO_DRAFTING', 'CONTRACT_DOC_REVIEW', 'LEGAL_RESEARCH', 'PROCEDURAL_FOLLOWUP', 'CLIENT_CORRESPONDENCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'AUTO_HEARING_PREP', 'AUTO_OBJECTION', 'HEARING_ACTION');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('FIRST_CONSULTATION', 'CONTRACT_REVIEW', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('HIGH', 'MEDIUM');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('OPPONENT_IS_CLIENT', 'OPPONENT_IS_LEAD', 'OPPONENT_IS_OUR_CLIENT_OTHER_CASE', 'OUR_CLIENT_IS_OPPONENT_OTHER_CASE');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('ACTIVE', 'WAIVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReminderSource" AS ENUM ('MANUAL', 'PENDING_HEARING', 'HEARING_MINUTES', 'EXECUTION_FOLLOWUP');

-- AlterEnum
ALTER TYPE "ClientType" ADD VALUE 'ESTABLISHMENT';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "client_role" "PartyRole" NOT NULL DEFAULT 'PLAINTIFF',
ADD COLUMN     "client_satisfaction_score" INTEGER,
ADD COLUMN     "conflict_checked_at" TIMESTAMP(3),
ADD COLUMN     "conflict_severity" "ConflictSeverity",
ADD COLUMN     "fact_summary" TEXT,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "judgment_date" TIMESTAMP(3),
ADD COLUMN     "najiz_case_type" TEXT,
ADD COLUMN     "najiz_main_class" TEXT,
ADD COLUMN     "najiz_sub_class" TEXT,
ADD COLUMN     "poa_expires_at" TIMESTAMP(3),
ADD COLUMN     "proc_ended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proc_result" TEXT,
ADD COLUMN     "referral_requested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "hearings" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "sequence_no" INTEGER,
    "hearing_date" TIMESTAMP(3) NOT NULL,
    "status" "HearingStatus" NOT NULL DEFAULT 'UPCOMING',
    "stage_index" INTEGER,
    "kind" "HearingKind",
    "minutes" TEXT,
    "result" TEXT,
    "client_report" TEXT,
    "report_sent_to_client" BOOLEAN NOT NULL DEFAULT false,
    "report_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_pending" BOOLEAN NOT NULL DEFAULT false,
    "pending_items" JSONB,
    "reminder_recur_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hearings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_events" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" "CaseEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "actor" TEXT,
    "actor_user_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_reminders" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "due_on" TIMESTAMP(3) NOT NULL,
    "recur_interval_days" INTEGER,
    "source" "ReminderSource" NOT NULL DEFAULT 'MANUAL',
    "is_task_linked" BOOLEAN NOT NULL DEFAULT false,
    "hearing_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "case_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "stage" "LeadStage" NOT NULL DEFAULT 'PROSPECT',
    "expected_value" INTEGER NOT NULL DEFAULT 0,
    "next_action" TEXT,
    "phone" TEXT,
    "converted_client_id" UUID,
    "converted_case_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "assignee_id" UUID,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "due_at" TIMESTAMP(3),
    "category" "TaskCategory",
    "status" "TaskColumn" NOT NULL DEFAULT 'NEW',
    "position" INTEGER NOT NULL DEFAULT 0,
    "origin" "TaskSource" NOT NULL DEFAULT 'MANUAL',
    "auto_signature" TEXT,
    "completed_at" TIMESTAMP(3),
    "case_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "contact_name" TEXT NOT NULL,
    "client_id" UUID,
    "lead_id" UUID,
    "scheduled_on" TIMESTAMP(3) NOT NULL,
    "scheduled_time" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'FIRST_CONSULTATION',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_flags" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "conflict_type" "ConflictType" NOT NULL,
    "message_key" TEXT NOT NULL,
    "message_params" JSONB,
    "matched_name" TEXT,
    "matched_client_id" UUID,
    "matched_lead_id" UUID,
    "matched_case_ids" JSONB,
    "status" "ConflictStatus" NOT NULL DEFAULT 'ACTIVE',
    "waiver_note" TEXT,
    "waived_by_id" UUID,
    "waived_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflict_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "najiz_classifications" (
    "id" UUID NOT NULL,
    "main_class" TEXT NOT NULL,
    "sub_class" TEXT NOT NULL,
    "case_type" TEXT NOT NULL,

    CONSTRAINT "najiz_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hearings_office_id_case_id_idx" ON "hearings"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "hearings_office_id_hearing_date_idx" ON "hearings"("office_id", "hearing_date");

-- CreateIndex
CREATE INDEX "hearings_office_id_status_idx" ON "hearings"("office_id", "status");

-- CreateIndex
CREATE INDEX "case_events_office_id_case_id_occurred_at_idx" ON "case_events"("office_id", "case_id", "occurred_at");

-- CreateIndex
CREATE INDEX "case_events_office_id_case_id_type_idx" ON "case_events"("office_id", "case_id", "type");

-- CreateIndex
CREATE INDEX "case_reminders_office_id_case_id_idx" ON "case_reminders"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "case_reminders_office_id_due_on_idx" ON "case_reminders"("office_id", "due_on");

-- CreateIndex
CREATE INDEX "leads_office_id_stage_idx" ON "leads"("office_id", "stage");

-- CreateIndex
CREATE INDEX "leads_office_id_idx" ON "leads"("office_id");

-- CreateIndex
CREATE INDEX "tasks_office_id_status_idx" ON "tasks"("office_id", "status");

-- CreateIndex
CREATE INDEX "tasks_office_id_assignee_id_idx" ON "tasks"("office_id", "assignee_id");

-- CreateIndex
CREATE INDEX "tasks_office_id_case_id_idx" ON "tasks"("office_id", "case_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_office_id_auto_signature_key" ON "tasks"("office_id", "auto_signature");

-- CreateIndex
CREATE INDEX "appointments_office_id_scheduled_on_idx" ON "appointments"("office_id", "scheduled_on");

-- CreateIndex
CREATE INDEX "conflict_flags_office_id_case_id_idx" ON "conflict_flags"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "conflict_flags_office_id_status_idx" ON "conflict_flags"("office_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conflict_flags_case_id_conflict_type_matched_name_key" ON "conflict_flags"("case_id", "conflict_type", "matched_name");

-- CreateIndex
CREATE INDEX "najiz_classifications_main_class_idx" ON "najiz_classifications"("main_class");

-- CreateIndex
CREATE UNIQUE INDEX "najiz_classifications_main_class_sub_class_case_type_key" ON "najiz_classifications"("main_class", "sub_class", "case_type");

-- CreateIndex
CREATE INDEX "cases_office_id_deleted_at_idx" ON "cases"("office_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_office_id_phone_key" ON "clients"("office_id", "phone");

-- AddForeignKey
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_reminders" ADD CONSTRAINT "case_reminders_hearing_id_fkey" FOREIGN KEY ("hearing_id") REFERENCES "hearings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_case_id_fkey" FOREIGN KEY ("converted_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_matched_client_id_fkey" FOREIGN KEY ("matched_client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_matched_lead_id_fkey" FOREIGN KEY ("matched_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_waived_by_id_fkey" FOREIGN KEY ("waived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

