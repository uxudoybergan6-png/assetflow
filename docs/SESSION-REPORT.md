# Sessiya hisoboti — 2026-07-30 (BATCH 8 — ADMIN PANEL)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md` (BATCH 0/1/2/3/4/5/7 + T9.1 oldingi commitlarda)

- **Bajarildi 8/8:** #27 bulk tanlov filtr o'zgarganda tozalanadi + tasdiq dialogi · #28 DMCA/takedown admin UI
  (backend allaqachon bor edi) · #91 Marketplace Settings soxta "Save" o'rniga HAQIQIY server limitlari (read-only) ·
  #93 "Clear logs" endi StudioApi (token) bilan va natija rostgo'y ko'rsatiladi.
- **#92** localStorage promo/chegirma OLIB TASHLANDI — chegirma faqat Lemon Squeezy Discounts'da amal qiladi;
  UI ilgari hech kimga yetib bormaydigan "chegirmali narx" ko'rsatib chalg'itardi.
- **#94** tizim loglari efemer JSON fayldan **DB**ga (`SystemLog`, retention 20k qator). Migratsiya qo'llanmaguncha
  API yiqilmaydi: GET/POST `degraded: true` qaytaradi.
- **#95** umumiy hisob to'xtatish (`User.suspendedAt`): har login yo'li (web/Google/plagin/device-code) + markaziy
  `isBlocked` + `tokenVersion++` va plagin tokenlarini o'chirish; o'zini va oxirgi faol adminni to'xtatish taqiqlangan.
- **#137** Subscriber Generations: qattiq 40 element o'rniga cursor sahifalash ("Load more") + per-item **Refund**
  (`POST /api/admin/users/:id/generations/:genId/refund`, `refundAiCredits` atomik claim → idempotent, audit log).
- Yon tuzatish: `toast(..., 'error')` noma'lum kind → TypeError, toast UMUMAN ko'rinmasdi (2FA ekranlari) — alias + zaxira.
- `npm run build -w apps/api` ✓ · `npx prisma generate` ✓ · `npm run studio:sync` ✓ · `node --check` ✓

⚠️ **Migratsiya kutilmoqda** (prod'ga QO'LLANMAGAN, 8 ta): `20260730160000_ls_subscription_billing`,
`20260730180000_catalog_scale_indexes`, `20260730190000_upload_progress_shared`,
`20260730200000_catalog_stable_order_index`, `20260730210000_user_bio`, `20260730220000_template_reject_kind`,
`20260730230000_system_log`, `20260730240000_user_suspension`.
⏳ **Egasi:** `backfill-asset-keys.mjs`, `cleanup-stale-pack-variants.mjs`, `cleanup-orphan-incoming.mjs` · T9.1 AE testi.
