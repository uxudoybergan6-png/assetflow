-- Step 20 (MUAMMOLAR-1) — ADDITIVE only.
--   1) TemplateDownloadEvent: sybil clustering audit izi (ip/ipPrefix/userAgent/asn).
--      Faqat admin fraud-tahlili o'qiydi; earning/pool matematikasiga TEGMAYDI.
--   2) InfraCost: D3 pool bazasidan ayiriladigan oylik infratuzilma xarajati
--      (storage + egress + compute). ProviderInvoice naqshi.
-- Hech narsa o'chirilmaydi/o'zgartirilmaydi — money-zone consume/refund/HMAC'ga TEGMAYDI.

ALTER TABLE "TemplateDownloadEvent" ADD COLUMN "ip" TEXT;
ALTER TABLE "TemplateDownloadEvent" ADD COLUMN "ipPrefix" TEXT;
ALTER TABLE "TemplateDownloadEvent" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "TemplateDownloadEvent" ADD COLUMN "asn" TEXT;
CREATE INDEX "tde_contributor_ipprefix_idx" ON "TemplateDownloadEvent"("contributorId", "ipPrefix");

CREATE TABLE "InfraCost" (
    "id" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "storageUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "egressUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "computeUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfraCost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InfraCost_periodMonth_key" ON "InfraCost"("periodMonth");
CREATE INDEX "InfraCost_periodMonth_idx" ON "InfraCost"("periodMonth");
