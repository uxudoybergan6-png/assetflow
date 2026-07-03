-- Grandfather: email-verify gate joriy etilishidan OLDIN mavjud barcha
-- foydalanuvchilar "tasdiqlangan" hisoblanadi (gate ularni bloklamasin).
-- Yangi ro'yxatdan o'tganlar emailVerified=NULL bilan yaratiladi va tasdiqlashi
-- shart bo'ladi (faqat RESEND_API_KEY sozlangan bo'lsa — aks holda gate ishlamaydi).
-- Idempotent: faqat NULL qatorlarni to'ldiradi; createdAt (ro'yxat vaqti) bilan.
UPDATE "User"
SET "emailVerified" = COALESCE("emailVerified", "createdAt")
WHERE "emailVerified" IS NULL;
