-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('LEAVE', 'ADVANCE', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED');

-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'PAYROLL';

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "job_title" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'سعودي',
    "national_id" TEXT,
    "iban" TEXT,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "basic_salary" INTEGER NOT NULL,
    "allowances" INTEGER NOT NULL DEFAULT 0,
    "gosi_contribution" INTEGER NOT NULL DEFAULT 0,
    "leave_balance_days" INTEGER NOT NULL DEFAULT 0,
    "performance_score" INTEGER,
    "terminated_at" TIMESTAMP(3),
    "end_of_service_minor" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advances" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "monthly_installment" INTEGER,
    "months" INTEGER NOT NULL DEFAULT 1,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "advance_date" TIMESTAMP(3) NOT NULL,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
    "days" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "deducted_balance" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_requests" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "department" TEXT,
    "kind" "RequestKind" NOT NULL,
    "detail" TEXT,
    "days" INTEGER,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'POSTED',
    "total_basic" INTEGER NOT NULL DEFAULT 0,
    "total_allowances" INTEGER NOT NULL DEFAULT 0,
    "total_gosi" INTEGER NOT NULL DEFAULT 0,
    "total_advances" INTEGER NOT NULL DEFAULT 0,
    "total_net" INTEGER NOT NULL DEFAULT 0,
    "journal_entry_id" UUID,
    "posted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "basic" INTEGER NOT NULL,
    "allowances" INTEGER NOT NULL,
    "gosi" INTEGER NOT NULL,
    "advance_deduction" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_office_id_status_idx" ON "employees"("office_id", "status");

-- CreateIndex
CREATE INDEX "employees_office_id_nationality_idx" ON "employees"("office_id", "nationality");

-- CreateIndex
CREATE INDEX "advances_office_id_employee_id_idx" ON "advances"("office_id", "employee_id");

-- CreateIndex
CREATE INDEX "advances_office_id_status_idx" ON "advances"("office_id", "status");

-- CreateIndex
CREATE INDEX "leaves_office_id_employee_id_idx" ON "leaves"("office_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_requests_office_id_employee_id_idx" ON "employee_requests"("office_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_requests_office_id_status_idx" ON "employee_requests"("office_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_office_id_period_key_key" ON "payroll_runs"("office_id", "period_key");

-- CreateIndex
CREATE INDEX "payroll_lines_payroll_run_id_idx" ON "payroll_lines"("payroll_run_id");

-- CreateIndex
CREATE INDEX "payroll_lines_employee_id_idx" ON "payroll_lines"("employee_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_requests" ADD CONSTRAINT "employee_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

