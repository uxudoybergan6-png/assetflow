-- P1 #19 (P6 §4 / P7 §8) — QAYTA TIKLANADIGAN BULK-INGEST NAVBATI (ADDITIVE).
-- Ingest endi HTTP so'rov yo'lida emas: POST /ingest incoming kalitlarni shu navbatga
-- qo'shadi, alohida fon ishchisi (ingest-worker) birma-bir claim qilib ishlaydi.
-- Restart-safe: 'processing' rowlar claimedAt bo'yicha qayta claim qilinadi.
CREATE TABLE "IngestJob" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "kind" TEXT,
  "templateType" TEXT,
  "stockType" TEXT,
  "templateApp" TEXT,
  "contentType" TEXT,
  "rightsAcceptedAt" TIMESTAMP(3),
  "rightsTermsVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "resultTemplateId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IngestJob_status_createdAt_idx" ON "IngestJob"("status", "createdAt");
CREATE INDEX "IngestJob_batchId_idx" ON "IngestJob"("batchId");
CREATE INDEX "IngestJob_contributorId_createdAt_idx" ON "IngestJob"("contributorId", "createdAt");
