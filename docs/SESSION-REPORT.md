# SESSION-REPORT — NARX DVIGATELI + drift monitoring (Bosqich 3.4/3.5), backend, 2026-07-05

**Nima qilindi (4 commit main'da, push YO'Q, no Co-Authored-By):**
- PART 1: `ModelPricing` + `PricingConfig` + `ProviderInvoice` modellar + additive migratsiya
  `20260705170000_pricing_engine`. `model-pricing.ts` — cost-quote narxni DB'dan oladi
  (`resolvePricedModel`), qator yo'q → statik `gen-models.ts` fallback. Seed startup'da
  create-only (idempotent). `computeGenCost`/consume/refund/imzo TEGILMAGAN.
- PART 2: `model-margin.ts` — `computeMargins` (per-model + jami marja, maqsad/missing-cost bayroq),
  `spendByProvider`.
- PART 3: admin endpointlar — `GET /api/admin/pricing`, `PATCH /pricing/:modelId` (0/manfiy taqiq),
  `PATCH /pricing/config`; audited + cache bust. (config yo'li :modelId dan OLDIN.)
- PART 4: `pricing-reconcile.ts` — oylik reconciliation + marja alert (email + webhook env),
  `GET /pricing/reconcile`, `GET/POST /pricing/invoice`, env-gated scheduler (PRICING_RECON_SCHEDULE=on).

**Tekshirildi (lokal Postgres):** migratsiya qo'llandi; seed=38 model, narx BUGUNGI bilan bir xil
(304 round-trip + jonli parity img/vid); cost-quote DB narx imzolanadi+verify OK, tamper rad;
PATCH → keyingi quote yangi narx; low-margin fixture → belowTarget (0.356x); invoice \$14 vs est \$8
→ drift +75%; missing-cost bayroq ishladi. Build + prisma validate green.

**Kutilmoqda:** git push → deploy (migrate:deploy auto). estCostUsd hozir TAXMINIY seed — real
provider invoice bilan aniqlanadi. Admin UI = keyingi bosqich (backend tayyor).
