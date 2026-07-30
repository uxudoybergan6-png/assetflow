-- #95 (A7) — umumiy hisob to'xtatish (global account suspension).
-- Ilgari admin panelidagi "Status" ustuni faqat `contributorBlockedAt` ni ko'rsatardi:
-- u contributor YUKLASHINI to'xtatadi, lekin hisobning o'zi (web + AE plagin) ochiq
-- qolardi. Bu maydonlar butun hisobni yopish uchun.
-- FAQAT ADDITIVE.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;
