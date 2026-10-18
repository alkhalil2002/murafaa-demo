-- CreateEnum
CREATE TYPE "InvoiceBaseStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InvoiceOrigin" AS ENUM ('MANUAL', 'FEE_AGREEMENT', 'EXPENSE_REIMBURSEMENT', 'TIME_ENTRY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MADA', 'CASH', 'CHEQUE', 'FROM_TRUST');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FLAT', 'RETAINER', 'HOURLY', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARIES', 'OFFICE_RENT', 'MARKETING', 'SUBSCRIPTIONS', 'GOVERNMENT_FEES', 'COURT_FEES', 'EXPERT_FEES', 'ADMIN_EXPENSES', 'HOSPITALITY_TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('BANK_TRANSFER', 'MADA', 'CASH', 'CHEQUE');

-- CreateEnum
CREATE TYPE "TrustTxnType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_TO_FEES');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'EXPENSE', 'TRUST_DEPOSIT', 'TRUST_WITHDRAWAL', 'TRUST_TRANSFER', 'MANUAL');

-- AlterTable
ALTER TABLE "offices" ADD COLUMN     "require_approval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "case_fee_agreements" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "type" "FeeType" NOT NULL DEFAULT 'FLAT',
    "fee_value_minor" INTEGER,
    "percentage_bps" INTEGER,
    "awarded_minor" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "case_fee_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "case_id" UUID,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "base_status" "InvoiceBaseStatus" NOT NULL DEFAULT 'DUE',
    "origin" "InvoiceOrigin" NOT NULL DEFAULT 'MANUAL',
    "basis" TEXT,
    "is_bad_debt" BOOLEAN NOT NULL DEFAULT false,
    "is_credited" BOOLEAN NOT NULL DEFAULT false,
    "from_expense_id" UUID,
    "from_time_entry_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "line_net" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "invoice_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "vendor" TEXT,
    "net_amount" INTEGER NOT NULL,
    "input_vat" INTEGER NOT NULL,
    "method" "ExpensePaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "document_no" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "client_id" UUID,
    "case_id" UUID,
    "reimbursement_invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "lawyer_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "description" TEXT,
    "minutes" INTEGER NOT NULL,
    "hourly_rate" INTEGER NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_accounts" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "balance_minor" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trust_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_transactions" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "trust_account_id" UUID NOT NULL,
    "type" "TrustTxnType" NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "related_invoice_id" UUID,
    "related_case_id" UUID,
    "journal_entry_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "trust_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "entry_no" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source_type" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "source_id" UUID,
    "period_key" TEXT NOT NULL,
    "posted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "line_no" INTEGER NOT NULL,
    "memo" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" UUID NOT NULL,
    "office_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" UUID,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_fee_agreements_case_id_key" ON "case_fee_agreements"("case_id");

-- CreateIndex
CREATE INDEX "case_fee_agreements_office_id_idx" ON "case_fee_agreements"("office_id");

-- CreateIndex
CREATE INDEX "invoices_office_id_client_id_idx" ON "invoices"("office_id", "client_id");

-- CreateIndex
CREATE INDEX "invoices_office_id_case_id_idx" ON "invoices"("office_id", "case_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_office_id_number_key" ON "invoices"("office_id", "number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_office_id_invoice_id_idx" ON "payments"("office_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_office_id_number_key" ON "payments"("office_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_invoice_id_key" ON "credit_notes"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_office_id_number_key" ON "credit_notes"("office_id", "number");

-- CreateIndex
CREATE INDEX "expenses_office_id_category_idx" ON "expenses"("office_id", "category");

-- CreateIndex
CREATE INDEX "expenses_office_id_case_id_idx" ON "expenses"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "time_entries_office_id_case_id_idx" ON "time_entries"("office_id", "case_id");

-- CreateIndex
CREATE INDEX "time_entries_office_id_lawyer_id_idx" ON "time_entries"("office_id", "lawyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_accounts_client_id_key" ON "trust_accounts"("client_id");

-- CreateIndex
CREATE INDEX "trust_accounts_office_id_idx" ON "trust_accounts"("office_id");

-- CreateIndex
CREATE INDEX "trust_transactions_office_id_trust_account_id_idx" ON "trust_transactions"("office_id", "trust_account_id");

-- CreateIndex
CREATE INDEX "chart_of_accounts_office_id_idx" ON "chart_of_accounts"("office_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_office_id_code_key" ON "chart_of_accounts"("office_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_office_id_period_key_idx" ON "journal_entries"("office_id", "period_key");

-- CreateIndex
CREATE INDEX "journal_entries_office_id_source_type_source_id_idx" ON "journal_entries"("office_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_office_id_entry_no_key" ON "journal_entries"("office_id", "entry_no");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_office_id_period_key_key" ON "accounting_periods"("office_id", "period_key");

-- AddForeignKey
ALTER TABLE "case_fee_agreements" ADD CONSTRAINT "case_fee_agreements_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_fee_agreements" ADD CONSTRAINT "case_fee_agreements_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_lawyer_id_fkey" FOREIGN KEY ("lawyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_accounts" ADD CONSTRAINT "trust_accounts_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_accounts" ADD CONSTRAINT "trust_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_transactions" ADD CONSTRAINT "trust_transactions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_transactions" ADD CONSTRAINT "trust_transactions_trust_account_id_fkey" FOREIGN KEY ("trust_account_id") REFERENCES "trust_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

