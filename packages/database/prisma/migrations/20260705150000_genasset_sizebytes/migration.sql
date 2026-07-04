-- Bosqich 4 #4 — Storage kvota uchun per-asset bayt hisobi. ADDITIVE, NON-destructive.
-- Nullable ustun (eski qatorlar = NULL = noma'lum, kvota hisobida 0 deb qaraladi).

ALTER TABLE "GenAsset" ADD COLUMN "sizeBytes" INTEGER;
