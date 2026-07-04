# SESSION-REPORT — Bosqich 1 (Himoya · ko'rinuvchanlik · xavfsizlik)

**Sana:** 2026-07-04 · **Ko'lam:** backend-only, 9 item, har biri alohida commit. Pul zonasi TEGILMADI.

- **#1** provider USD cost: `lib/provider-cost.ts` → `writeProviderSpend.estimatedCostUsd` (best-effort, marja poydevori).
- **#2** spend himoya: `lib/spend-guard.ts` — GEN_KILL_SWITCH + kunlik/oylik USD ceiling + per-user GEN_DAILY_CAP (charge'dan oldin).
- **#3** PRO-without-Stripe: gate allaqachon fail-closed; `.env.cloud.example` =false + prod warning.
- **#4** COST_QUOTE_SECRET: cost-quote imzosi auth JWT_SECRET'dan ajratildi (JWT_SECRET'ga fallback).
- **#5** fail-closed anti-abuse: Turnstile + email-verify prod'da rad (dev fail-open, grandfather saqlandi).
- **#6** observability: `lib/sentry.ts` (dinamik, no-op) + real `/health` (DB SELECT 1 + HeadBucket) + `/livez`.
- **#7** SSRF: `lib/fetch-safe.ts` (data + bizning bucket, private IP blok) → 4 user-URL fetch marshrutlandi.
- **#8** DR: `scripts/db-backup.mjs` + `.github/workflows/db-backup.yml` + `docs/DR-RUNBOOK.md` + `npm run db:backup`.
- **#9** email: prod'da resend.dev sandbox LOUD warning + `EMAIL_FROM` DKIM/SPF hujjat.

**Build:** `npm run build` (api + database) toza. Migratsiya QO'SHILMADI (estimatedCostUsd allaqachon bor).
**Manual (env/tashqi):** COST_QUOTE_SECRET (prod), PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false, TURNSTILE_SECRET_KEY,
RESEND domen+DKIM/SPF, SENTRY_DSN (+`npm i @sentry/node`), backup bucket+versioning+BACKUP_GCS_BUCKET.
**Kutilmoqda:** deploy + AE end-to-end test. ⚠️ #5 prod'da Turnstile/RESEND sozlanmasa register/kredit bloklanadi (kutilgan).
