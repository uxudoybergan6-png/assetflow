-- FAZA 6b — contributor onboarding: USER "Become a contributor" so'rovi belgisi.
-- Additive: mavjud qatorlarga NULL, hech narsa buzilmaydi.
ALTER TABLE "User" ADD COLUMN "contributorRequestedAt" TIMESTAMP(3);
