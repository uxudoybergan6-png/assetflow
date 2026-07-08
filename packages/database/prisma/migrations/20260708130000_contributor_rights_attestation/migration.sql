-- FAZA 1b — Contributor rights attestation capture (ADDITIVE).
-- Yuklovchi "bu kontent menga tegishli / tarqatishga haqim bor" tasdig'i qayd etiladi.
-- Mavjud shablonlar NULL (attestatsiyadan oldingi) — hech narsa buzilmaydi.
ALTER TABLE "ContributorTemplate" ADD COLUMN "rightsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ContributorTemplate" ADD COLUMN "rightsTermsVersion" TEXT;
