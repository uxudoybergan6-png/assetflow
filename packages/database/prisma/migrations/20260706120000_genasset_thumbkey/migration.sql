-- FAZA 2 #8 — video gen uchun haqiqiy poster (birinchi kadr JPG) obyekt kaliti.
-- ADDITIVE, NON-destructive. NULL = eski asset (poster yo'q, thumbUrl = video url).

ALTER TABLE "GenAsset" ADD COLUMN "thumbKey" TEXT;
