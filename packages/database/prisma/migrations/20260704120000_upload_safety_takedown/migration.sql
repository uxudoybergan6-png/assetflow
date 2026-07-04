-- Bosqich 2 #2 — Upload xavfsizligi (malware skan + hash dedup) va DMCA/takedown.
-- ADDITIVE only, NON-destructive: faqat yangi nullable ustunlar + indekslar. Hech qanday DROP yo'q.
-- Mavjud shablonlar: barcha yangi ustun NULL => xatti-harakat o'zgarmaydi (skan qilinmagan = eski).

-- Pack malware skan + content-hash dedup.
ALTER TABLE "ContributorTemplate" ADD COLUMN "packHash" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "packScanStatus" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "packScanDetail" TEXT;

-- DMCA / huquqiy takedown (katalogdan/serve'dan olib tashlash).
ALTER TABLE "ContributorTemplate" ADD COLUMN "takedownAt" TIMESTAMP(3);
ALTER TABLE "ContributorTemplate" ADD COLUMN "takedownReason" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "takedownById" TEXT;

CREATE INDEX "ContributorTemplate_packHash_idx" ON "ContributorTemplate"("packHash");
CREATE INDEX "ContributorTemplate_takedownAt_idx" ON "ContributorTemplate"("takedownAt");
