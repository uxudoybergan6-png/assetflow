-- P9 / P9.2 — GenAsset media-sifat derivativlari. ADDITIVE (yangi ustunlar; hech narsa buzilmaydi).
--   displayKey = 1280px WebP display derivativ (Retina karta + alfa saqlanadi)
--   previewKey = 720p video hover-preview (asl fayl saqlanadi, lightbox/download asl'ni ishlatadi)
-- Eski qatorlar NULL qoladi (backfill skripti to'ldiradi) — klient thumb/asl'ga fallback qiladi.
ALTER TABLE "GenAsset" ADD COLUMN IF NOT EXISTS "displayKey" TEXT;
ALTER TABLE "GenAsset" ADD COLUMN IF NOT EXISTS "previewKey" TEXT;
