-- Bir contributor bir storage key'ni bir paytda faqat bitta worker job sifatida navbatga qo'ya oladi.
-- Eski production yozuvlarida shu invariantdan oldingi faol dublikatlar bo'lishi mumkin:
-- indexdan oldin processing (eng yangi claim) yoki eng eski queued jobni saqlab, qolganini
-- terminal `duplicate` qilamiz. Jadval lock'i eski API parallel yangi dublikat kiritmasligini
-- ta'minlaydi; fenced worker terminalga o'tkazilgan dublikat ustidan yoza olmaydi.
BEGIN;

LOCK TABLE "IngestJob" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "contributorId", "key"
      ORDER BY
        CASE WHEN "status" = 'processing' THEN 0 ELSE 1 END,
        "claimedAt" DESC NULLS LAST,
        "createdAt" ASC,
        "id" ASC
    ) AS rn
  FROM "IngestJob"
  WHERE "status" IN ('queued', 'processing')
)
UPDATE "IngestJob" AS job
SET
  "status" = 'duplicate',
  "lastError" = LEFT(COALESCE(job."lastError", '') || ' [deduplicated before active-key invariant]', 800),
  "claimedAt" = NULL,
  "finishedAt" = COALESCE(job."finishedAt", NOW()),
  "updatedAt" = NOW()
FROM ranked
WHERE job."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "IngestJob_contributorId_key_active_key"
ON "IngestJob" ("contributorId", "key")
WHERE "status" IN ('queued', 'processing');

COMMIT;
