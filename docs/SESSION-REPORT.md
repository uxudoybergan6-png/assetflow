# Sessiya hisoboti — 2026-07-30 (BATCH 6 — OMMAVIY WEB)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md`, 7-bosqich (BATCH 0–5, 7, 8 + T9.1 oldingi commitlarda)

- **Bajarildi 11/13.** #21 CF Pages build `_*` fayl/papkani chiqarib tashlaydi (17 ichki mockup + ops sahifasi
  ommaviy edi; `_headers`/`_redirects` allowlist'da) · #23 checkout xatosi `payErrMsg()` orqali tarjima qilinadi
  (xom `NETWORK`/HTTP kodlari yo'q) · #75 shrift yo'llari root-absolute → 2+ segmentli SPA route'da 404 yo'q.
- **#76** `POST /api/auth/logout` (`tokenVersion++`) — chiqishdan keyin nusxa ko'chirilgan JWT o'lik. AE `PluginToken`
  ataylab TEGILMAYDI (brauzerdan chiqish AE sessiyasini o'ldirmasin).
- **#79 (a11y)** yagona `:focus-visible` halqa (platforma + `app.css` + `admin.css`), 122 semantik bo'lmagan
  bosiladigan element `role="button" tabindex="0"`, Enter/Space delegatsiyasi, 12 input `aria-label`, 6 ikonkali
  tugmaga nom. Brauzerda tekshirildi: Tab → 2px halqa, Enter → click, konsol toza.
- **#80** tema kaliti YAGONA: `ff-theme` ∈ {noir,neon,cold,light}; eski `af-theme` bir marta ko'chiriladi;
  `AssetFlowTheme.hasPreference()` (admin "dark-first" gate ilgari o'lik kod edi).
- **#81** bo'sh katalog 3 holatga bo'lindi (qidiruv / filtr / chindan bo'sh) — "Clear filters" endi hech qachon
  no-op emas; filtr yo'q bo'lsa "Refresh", qidiruv+filtr birga bo'lsa ikkinchi tugma.
- **#82** Free = 1 loyiha, server majburlaydi (`projects.ts`, 403 `PROJECT_LIMIT`) · **#129** `_payBusy` 8 s timeout +
  qayta urinish · **#130** `<html lang="en">` · **#132** Studio tarifi 6 bullet · **#133** "Jump back in" faqat tarix bo'lsa.
- **Bajarilmadi (egasi):** #22 obunani bekor qilish URL'i · #131 ommaviy webni o'zbekchaga o'girish (alohida reja).
- `npm run build -w apps/api` ✓ · `verify-public-copy` 67/67 ✓ · `studio:sync` ✓ · CF Pages build ✓ (`dist/`da `_*` yo'q).

⚠️ **Migratsiya kutilmoqda** (prod'ga QO'LLANMAGAN, 8 ta): `20260730160000_ls_subscription_billing`,
`20260730180000_catalog_scale_indexes`, `20260730190000_upload_progress_shared`,
`20260730200000_catalog_stable_order_index`, `20260730210000_user_bio`, `20260730220000_template_reject_kind`,
`20260730230000_system_log`, `20260730240000_user_suspension`.
⏳ **Egasi:** `backfill-asset-keys.mjs`, `cleanup-stale-pack-variants.mjs`, `cleanup-orphan-incoming.mjs` · T9.1 AE testi.
