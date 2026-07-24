-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARTNER', 'LAWYER', 'ASSISTANT', 'ACCOUNTANT', 'ADMIN', 'RECEPTION');

-- CreateEnum
CREATE TYPE "PermModule" AS ENUM ('CASES', 'AI', 'CLIENTS', 'DOCUMENTS', 'FINANCE', 'HR', 'REPORTS', 'PERMISSIONS', 'WHATSAPP', 'APPOINTMENTS', 'TASKS', 'ALERTS', 'PULSE');

-- CreateEnum
CREATE TYPE "PermLevel" AS ENUM ('NONE', 'VIEW', 'EDIT', 'FULL');

-- CreateEnum
CREATE TYPE "CaseScope" AS ENUM ('ALL', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "ProcStage" AS ENUM ('RECONCILIATION', 'FIRST_INSTANCE', 'APPEAL', 'CASSATION', 'EXECUTION');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('WON', 'PARTIAL', 'SETTLED', 'LOST');

-- CreateTable
CREATE TABLE "offices" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "module" "PermModule" NOT NULL,
    "level" "PermLevel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_permissions" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "resource" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_case_scopes" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "scope" "CaseScope" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_case_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "type" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_id" UUID,
    "opposing_party" TEXT,
    "city" TEXT,
    "stage" "ProcStage" NOT NULL DEFAULT 'FIRST_INSTANCE',
    "status" "CaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "outcome" "CaseOutcome",
    "objection_due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_assignees" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "target_id" TEXT,
    "decision" TEXT,
    "detail" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_office_id_idx" ON "users"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_office_id_phone_key" ON "users"("office_id", "phone");

-- CreateIndex
CREATE INDEX "otp_challenges_office_id_phone_idx" ON "otp_challenges"("office_id", "phone");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "permissions_office_id_idx" ON "permissions"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_office_id_role_module_key" ON "permissions"("office_id", "role", "module");

-- CreateIndex
CREATE INDEX "field_permissions_office_id_idx" ON "field_permissions"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_permissions_office_id_role_resource_field_key" ON "field_permissions"("office_id", "role", "resource", "field");

-- CreateIndex
CREATE INDEX "role_case_scopes_office_id_idx" ON "role_case_scopes"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_case_scopes_office_id_role_key" ON "role_case_scopes"("office_id", "role");

-- CreateIndex
CREATE INDEX "clients_office_id_idx" ON "clients"("office_id");

-- CreateIndex
CREATE INDEX "cases_office_id_idx" ON "cases"("office_id");

-- CreateIndex
CREATE INDEX "cases_office_id_client_id_idx" ON "cases"("office_id", "client_id");

-- CreateIndex
CREATE INDEX "case_assignees_office_id_idx" ON "case_assignees"("office_id");

-- CreateIndex
CREATE INDEX "case_assignees_user_id_idx" ON "case_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_assignees_case_id_user_id_key" ON "case_assignees"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_office_id_created_at_idx" ON "audit_logs"("office_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_office_id_actor_id_idx" ON "audit_logs"("office_id", "actor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_permissions" ADD CONSTRAINT "field_permissions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_case_scopes" ADD CONSTRAINT "role_case_scopes_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignees" ADD CONSTRAINT "case_assignees_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_assignees" ADD CONSTRAINT "case_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
