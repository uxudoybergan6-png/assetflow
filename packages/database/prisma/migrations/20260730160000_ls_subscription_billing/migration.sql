-- BATCH 2 (billing/obuna) — audit #9, #11, #12, #45, #47.
--
-- #9 (B1): Lemon Squeezy webhook `Subscription` qatorini YOZMAS edi → `subscriptionIsPro()`
--   har LS mijozi uchun false. Endi LS ham shu qatorni yozadi; `provider` ustuni qaysi
--   provayder egaligini bildiradi (#45/B5: reconcile faqat "stripe" qatorlarga tegadi).
-- #47 (B7): LS test-mode obunasi jonli tushumdan ajratiladi.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lsSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_lsSubscriptionId_key" ON "Subscription"("lsSubscriptionId");

-- #12 (B4): pause → resume sikli to'lovsiz oylik kreditni tiklardi. Endi plan
-- o'zgarishida kredit to'ldirish faqat BILLING DAVRI kaliti o'zgarganda bo'ladi.
ALTER TABLE "PluginProfile" ADD COLUMN IF NOT EXISTS "billingPeriodKey" TEXT;

-- #47 (B7): LS test-mode to'lovi moliyaviy xulosalardan chiqariladi.
ALTER TABLE "RevenueEvent" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN NOT NULL DEFAULT false;

-- #11 (B3): kredit-paket granti order ID bo'yicha idempotent (LS retry 2× kredit bermasin).
ALTER TABLE "CreditLedger" ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_sourceKey_key" ON "CreditLedger"("sourceKey");
