-- Add memo body + client-approval link to case_approvals, and approval link to documents.

ALTER TABLE "case_approvals" ADD COLUMN "body" TEXT;
ALTER TABLE "case_approvals" ADD COLUMN "client_approval_request_id" UUID;

ALTER TABLE "case_approvals"
  ADD CONSTRAINT "case_approvals_client_approval_request_id_key" UNIQUE ("client_approval_request_id");

ALTER TABLE "case_approvals"
  ADD CONSTRAINT "case_approvals_client_approval_request_id_fkey"
  FOREIGN KEY ("client_approval_request_id") REFERENCES "client_approval_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD COLUMN "approval_id" UUID;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_approval_id_fkey"
  FOREIGN KEY ("approval_id") REFERENCES "case_approvals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
