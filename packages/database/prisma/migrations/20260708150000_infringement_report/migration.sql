-- FAZA 1d — DMCA / infringement report (ADDITIVE, FK-siz).
-- Ommaviy "Report infringement" formasi pending qator yaratadi; admin ko'rib,
-- mavjud takedown endpoint'i orqali amalga oshiradi.
CREATE TABLE "InfringementReport" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "reporterName" TEXT,
    "reporterEmail" TEXT NOT NULL,
    "claimantType" TEXT,
    "workDescription" TEXT NOT NULL,
    "infringingUrl" TEXT,
    "goodFaith" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolutionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfringementReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InfringementReport_status_idx" ON "InfringementReport"("status");
CREATE INDEX "InfringementReport_templateId_idx" ON "InfringementReport"("templateId");
CREATE INDEX "InfringementReport_createdAt_idx" ON "InfringementReport"("createdAt");
