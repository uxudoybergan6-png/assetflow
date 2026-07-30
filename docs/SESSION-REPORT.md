# Sessiya hisoboti — 2026-07-30 (BATCH 3 — ZANJIR YAXLITLIGI)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md` (BATCH 0/1/2/4/5 + T9.1 oldingi commitlarda)

- **T3.3 (#17/Z8)** Yangi pack yuklanganda **boshqa kengaytmali eski obyektlar o'chiriladi**;
  `resolveS3AssetKey(preferFileName)` DB `fileName` kengaytmasini ustun qo'yadi (eski baytlar serve qilinmaydi).
  Bir martalik `scripts/cleanup-stale-pack-variants.mjs` (DRY_RUN default) — **egasi prod'da ishga tushiradi**.
- **T3.4:** `incoming/` yetim zip tozalash (job yakunida + retention supurish) + `scripts/cleanup-orphan-incoming.mjs` (#50) ·
  `reclaimStuck` **fencing token** (`attempts` bilan shartli yozuv, eski worker natijasi e'tiborsiz) (#51) ·
  contributor o'z `DRAFT`/`REJECTED` yozuvini o'chira oladi (API + Studio tugma/modal) (#52) ·
  katalog tartibi `updatedAt` dan ajratildi → `reviewedAt/createdAt/id` (kursor barqaror) (#53) ·
  thumb/preview AYNI kalitda almashsa `updatedAt` bump (`?v=` cache-bust ishlaydi) (#54) ·
  imzolangan rejimda `Cache-Control: private` + vaqt-paqirli ETag (#55) ·
  klient versiya yubormasa `updateAvailable=true` fail-safe (#56) · admin review joriy holat gate'i (#126) ·
  `restore` `published` ni aniq ko'rsatadi/tiklaydi (`republish`) (#127).
- **T3.1 (4-band)** Admin navbat + detal panelida **Re-review** bayrog'i (tasdiqdan keyin kontent almashtirilgan).
- `npm run build -w apps/api` ✓ · `npm run studio:sync` ✓ · plugin-release kontrakt testi 110/110 ✓

⚠️ **Migratsiya kutilmoqda** (prod'ga QO'LLANMAGAN): `20260730160000_ls_subscription_billing`,
`20260730180000_catalog_scale_indexes`, `20260730190000_upload_progress_shared`,
`20260730200000_catalog_stable_order_index`.
⏳ **Egasi:** `backfill-asset-keys.mjs`, `cleanup-stale-pack-variants.mjs`, `cleanup-orphan-incoming.mjs` · T9.1 AE testi.
