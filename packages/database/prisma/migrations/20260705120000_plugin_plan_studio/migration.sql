-- STUDIO tarifi — PluginPlanTier enum'iga ADDITIVE qiymat qo'shish.
-- Non-destructive: mavjud FREE/PRO qiymatlari va profillari o'zgarmaydi.
-- STUDIO faqat Lemon Squeezy obuna webhook'i orqali beriladi (self-serve emas).
-- Eslatma: `ADD VALUE` yangi qiymatni SHU tranzaksiyada ISHLATMAYDI — PG 12+ da xavfsiz.
ALTER TYPE "PluginPlanTier" ADD VALUE IF NOT EXISTS 'STUDIO';
