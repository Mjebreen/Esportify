-- Invoice approval workflow: Player submits → Manager approves → Finance pays.

-- New system role for the finance team.
ALTER TYPE "SystemRole" ADD VALUE IF NOT EXISTS 'FINANCE';

-- Workflow states on invoices.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'MANAGER_APPROVED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Approval tracking columns.
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approvedById" UUID,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
