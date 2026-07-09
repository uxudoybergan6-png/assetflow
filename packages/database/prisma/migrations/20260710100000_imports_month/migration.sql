-- P21: import limiti umrlik (importsTotal) o'rniga OYLIK bo'ldi (ADDITIVE).
-- Yangi importsMonth hisoblagichi downloadsMonth kabi monthResetAt'da 0 ga tiklanadi.
-- importsTotal umrlik statistika uchun qoladi (o'zgarmaydi). Default 0 → mavjud
-- foydalanuvchilar shu oy importsMonth=0 dan boshlaydi (qotib qolgan lifetime-cap ochiladi).
ALTER TABLE "PluginProfile" ADD COLUMN "importsMonth" INTEGER NOT NULL DEFAULT 0;
