-- Approval engine: generic submitter → approver chain → executing department.

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('REQUEST', 'TRAVEL', 'PHOTO', 'MERCH_KIT', 'SALARY_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "workflow_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "requesterUserId" UUID NOT NULL,
    "subjectPlayerId" UUID,
    "subjectRosterId" UUID,
    "targetDepartmentId" UUID,
    "steps" JSONB NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "executorRole" TEXT,
    "payload" JSONB,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_items_organizationId_status_idx" ON "workflow_items"("organizationId", "status");
CREATE INDEX "workflow_items_organizationId_type_status_idx" ON "workflow_items"("organizationId", "type", "status");
CREATE UNIQUE INDEX "workflow_items_organizationId_id_key" ON "workflow_items"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "workflow_items" ADD CONSTRAINT "workflow_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_items" ADD CONSTRAINT "workflow_items_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_items" ADD CONSTRAINT "workflow_items_subjectPlayerId_fkey" FOREIGN KEY ("subjectPlayerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
