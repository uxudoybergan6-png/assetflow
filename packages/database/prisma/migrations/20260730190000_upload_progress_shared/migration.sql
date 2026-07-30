-- BATCH 5 · T5.4 (#63) — upload progress instanslar aro (SSE fallback).
-- FAQAT ADDITIVE: yangi jadval, mavjud sxemaga tegilmaydi.
-- Ilgari progress FAQAT xotirada edi → SSE ulanishi boshqa Cloud Run instansiga
-- tushsa progress bar qimirlamasdi. Endi holat throttled (~1.5s) DB'ga yoziladi va
-- SSE lokal pub/sub'ga qo'shimcha ravishda shu jadvalni pollaydi.

CREATE TABLE IF NOT EXISTS "UploadProgress" (
  "templateId" TEXT NOT NULL,
  "stage"      TEXT NOT NULL,
  "pct"        INTEGER NOT NULL DEFAULT 0,
  "message"    TEXT NOT NULL DEFAULT '',
  "error"      TEXT,
  "done"       BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadProgress_pkey" PRIMARY KEY ("templateId")
);

-- Eskirgan qatorlarni tozalash (TTL supurishi) uchun.
CREATE INDEX IF NOT EXISTS "UploadProgress_updatedAt_idx"
  ON "UploadProgress" ("updatedAt");
