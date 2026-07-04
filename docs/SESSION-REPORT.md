# SESSION-REPORT — Bosqich 3: Lemon Squeezy (MoR) to'lov integratsiyasi

**Sana:** 2026-07-05 · **Ko'lam:** billing backend (LS) + STUDIO tarif. 4 mantiqiy commit, push YO'Q.

## Nima qilindi
- **STUDIO tarifi**: `PluginPlanTier` enum (additive migration), allotment 6000
  (FREE=50/PRO=1000 saqlandi), planLimits=Pro falsafasi; `isPaidPlan()` gate fix (Pro shablon PRO+STUDIO'ga ochiq).
- **LS klient** (`lib/lemonsqueezy.ts`): Bearer API, variant→plan/kredit xarita (nomdan, ID hardcode yo'q, 5-daq kesh), createCheckout, HMAC imzo verify.
- **Checkout** `POST /api/billing/checkout` (auth) → hosted URL; platforma "Kredit qo'shish"/plan CTA ulandi.
- **Webhook** `POST /api/lemonsqueezy/webhook`: HMAC verify + claim-first dedup (order=`ls:order:<id>`, sub=body-hash) → topup exactly-once; subscription_*→plan+ulush (grace-aware), order_created→additive topup + CreditLedger(topup). Stripe saqlandi, LS faol yo'l.
- `npm run build` (db + api) toza.

## Money guard
- consumeAiCredits/refundAiCredits/cost-quote TEGILMADI (diff: 0 deletion). ADMIN exempt saqlandi.

## Kutilmoqda
- Env: `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` (deploy). LS dashboard'da webhook URL + mahsulot nomlari (Pro/Studio/N Credits).
- ⚠️ Frontend "1,500 kredit/oy" (Pro) vs backend 1000 — moslashtirish qarori.
