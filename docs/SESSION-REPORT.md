# Sessiya hisoboti — 2026-07-30 (BATCH 5 — MIQYOS: ko'p shablon)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md` (BATCH 0/1/2/4 + T3.1-T3.2 + T9.1 oldingi commitlarda)

- **#19 (T5.1)** Katalog o'qish yo'lida S3 LIST **yo'q**: kesh-siz qator fon navbatiga tushadi
  (`asset-state.ts` — bounded 2 ta, restartga qarshi `reconcileMissingAssetKeys` har 10 daq).
  `resolveAssetKeyCached` — kesh + 1 HEAD (27 HEAD probe faqat fallback).
  Bir martalik `scripts/backfill-asset-keys.mjs` (DRY_RUN default) — **egasi prod'da ishga tushiradi**.
- **#57 (T5.2)** `perf-seed-assets.mjs` endi massiv yozadi (production shakli) — `docs/PERF-BASELINE.md` yangilandi.
- **#58/#59/#60 (T5.3)** Indekslar: `previewTranscodeStatus` qisman, `pg_trgm` GIN (name/description/
  catLabel/tags), `ORDER BY name`. Transcode supurishi cron'ga ko'chdi.
- **T5.4:** upload limiti Cloud Run realiga 32MiB (#61) · rate-limit `max` instans ulushiga bo'linadi
  (`API_MAX_INSTANCES`, Redis bo'lsa to'liq `max`) (#62) · upload-progress
  DB orqali instanslar aro (#63) · `INGEST_WORKER_INLINE` default `false` (#64) · `--concurrency=20` (#65) ·
  broadcast `createMany` (#66) · `/plugin-subscribers` take/skip + DB aggregat stats (#67) ·
  admin "All templates" server paginatsiya + real filtrlar (#68) · bulk upload parallel-3, presign har fayl oldidan (#69).
- `npm run build -w apps/api` ✓ · `npm run studio:sync` ✓ · `prisma validate` ✓

⚠️ **Migratsiya kutilmoqda** (prod'ga QO'LLANMAGAN): `20260730160000_ls_subscription_billing`,
`20260730180000_catalog_scale_indexes`, `20260730190000_upload_progress_shared`.
⏳ **AE testi kutilmoqda** (egasi): T9.1 zip import + plagin nashr oqimi.
