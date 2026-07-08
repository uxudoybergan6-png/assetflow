# Sessiya hisoboti — 2026-07-08 (FAZA 4: Money/Finance)

**Nima qilindi (4 commit, A–D):**
1. **A** — `RevenueEvent` modeli: LS webhook endi to'lov SUMMASINI yozadi (obuna initial/renewal + kredit-paket); `/admin/finance` real gross/net/MRR/per-plan.
2. **B** — refund/chargeback/dunning: manfiy RevenueEvent + obuna refundida FREE downgrade + kredit-paket refundida SARFLANMAGAN top-up clawback (atomik, hech qachon manfiy emas, bepul ulushga tegilmaydi); `billingIssue` belgi + refund emaili.
3. **C** — POOL payout: `PAYOUT_MODE=pool` (default) | `per_download`; pool = (obuna net − AI xarajat) × `CONTRIBUTOR_POOL_SHARE` (0.50), legitim download ulushi bo'yicha; davr+contributor idempotent; GET/POST `/admin/payout/pool`.
4. **D** — `PlanChangeEvent` + `/admin/metrics` (churn/conversion/ARPU/LTV); Finance/Payouts ekranlari real raqamlarda + yangi "Business metrics" ekrani; `studio:sync` bajarildi.

**Tekshirildi:** lokal API + imzolangan webhook E2E — idempotentlik (replay=duplicate), clawback 500→0, downgrade, pool 2:1 taqsimot ($9.50 → $6.33/$3.16), UI jonli.
**Kutilmoqda:** git push + Cloud Run deploy + `migrate:deploy` (4 ta additive migratsiya); productionда PAYOUT_MODE/CONTRIBUTOR_POOL_SHARE env qarori; LS jonli webhook sinovi.
