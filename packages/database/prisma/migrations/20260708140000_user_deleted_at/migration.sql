-- FAZA 1c — GDPR self-serve account deletion (ADDITIVE).
-- deletedAt belgilangan = hisob anonimlashtirilgan (PII tozalangan, tokenlar bekor).
-- Moliyaviy yozuvlar (ContributorEarning/Payout) saqlanadi. Mavjud qatorlar NULL.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
