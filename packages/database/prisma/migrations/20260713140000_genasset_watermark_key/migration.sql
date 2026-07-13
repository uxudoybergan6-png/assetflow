-- P4 (14b) — FREE reja AI generatsiyalari uchun SUV BELGILI yuklab-olish nusxasi kaliti.
-- ADDITIVE (yangi ustun; hech narsa buzilmaydi). Pullik (PRO/STUDIO) reja TOZA asl faylni
-- oladi — bu ustun faqat FREE yuklab olish/import yo'lida ishlatiladi. Eski qatorlar NULL
-- qoladi (backfill skripti to'ldiradi); NULL bo'lsa FREE'ga TOZA 4K asl HECH QACHON berilmaydi
-- (kichik display derivativ fallback), backfill'gacha.
ALTER TABLE "GenAsset" ADD COLUMN IF NOT EXISTS "watermarkKey" TEXT;
