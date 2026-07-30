-- #89 (C10) — rad etish turi (soft/hard) uchun HAQIQIY maydon.
-- Ilgari farq faqat `reviewNote` ichidagi "[hard]" matn markerida edi.
ALTER TABLE "ContributorTemplate" ADD COLUMN IF NOT EXISTS "rejectKind" TEXT;

-- Mavjud rad etilgan yozuvlarni bir martalik backfill (matn markeridan → maydonga).
UPDATE "ContributorTemplate"
SET "rejectKind" = CASE
    WHEN lower(coalesce("reviewNote", '')) LIKE '%[hard]%' THEN 'hard'
    WHEN lower(coalesce("reviewNote", '')) LIKE '%hard reject%' THEN 'hard'
    ELSE 'soft'
  END
WHERE "reviewStatus" = 'REJECTED' AND "rejectKind" IS NULL;
