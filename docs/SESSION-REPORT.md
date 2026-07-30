# Sessiya hisoboti — 2026-07-30 (BATCH 2 — BILLING / OBUNA)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md` (BATCH 0/1/4 + T3.1-T3.2 oldingi commitlarda)

- **#9 (T2.1)** LS webhook endi `Subscription` qatorini upsert qiladi (`status`, `currentPeriodEnd`,
  `provider="lemonsqueezy"`, `lsSubscriptionId`, `testMode`) → `subscriptionIsPro()` LS mijozlari uchun ishlaydi.
- **#10 (T2.2)** `setPluginPlan`: faol obuna bilan QO'LDA FREE'ga tushirish 409 + o'zbekcha xabar.
- **#11 (T2.3)** kredit granti `CreditLedger.sourceKey` (`ls:order:<id>:credits`) bilan idempotent;
  webhook xatoda dedup claim ENDI O'CHIRILMAYDI; pul harakati accountingdan oldin bajariladi.
- **#12 (T2.4)** `applyBillingPlan(..., { periodKey })` — kredit reset faqat YANGI billing davrida
  (`PluginProfile.billingPeriodKey` = LS `renews_at`); pause→resume to'lovsiz kredit bermaydi.
- **#45 (T2.5)** `reconcile:plans` fail-safe: `provider !== "stripe"` yoki obuna qatori yo'q → TEGMAYDI
  (+ faol STUDIO PRO'ga tushirilmaydi); hisobotda `skipped` soni.
- **#46** faol obunada yangi obuna checkout'i 409; **#47** `RevenueEvent.testMode` + moliyaviy
  xulosalardan chiqarish; **#48** qisman refund endi kirishni o'chirmaydi (faqat to'liq refund).
- **#49/#124** payout: hold oynasi MAJBURIY (`allowHeld` bilan chetlab o'tish + audit), earninglar
  atomik `updateMany` guard bilan band qilinadi → parallel 2× to'lov yo'q.
- **#125** admin "LS VARIANT (MONTHLY)" endi haqiqatan o'qiladi (checkout uchun ustuvor).
- **#77** Account: "via Paddle" → "via Lemon Squeezy".

⚠️ **Migratsiya kutilmoqda:** `20260730160000_ls_subscription_billing` (prod'ga QO'LLANMAGAN).
`npm run build -w apps/api` ✓ · `npm run studio:sync` + CF Pages build ✓
