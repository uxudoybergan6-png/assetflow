-- Bir contributor bir storage key'ni bir paytda faqat bitta worker job sifatida navbatga qo'ya oladi.
CREATE UNIQUE INDEX IF NOT EXISTS "IngestJob_contributorId_key_active_key"
ON "IngestJob" ("contributorId", "key")
WHERE "status" IN ('queued', 'processing');
