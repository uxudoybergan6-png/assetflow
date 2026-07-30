# Sessiya hisoboti — 2026-07-30 (BATCH 4 + T3.1/T3.2)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md` (BATCH 0 + 1 oldingi commitlarda)

## BATCH 3 (qisman)
- **#15** `/sync` mavjud shablon: pack almashsa HeadObject bilan tasdiqlanadi, APPROVED → `PENDING_REVIEW` + `published:false`, `packScanStatus:pending`, audit `template.sync-swap`.
- **#16** `pack-uploaded` tasdiqlangan shablonda qayta moderatsiyaga qaytaradi (audit `template.repack`).

## BATCH 4 — xavfsizlik
- **#18** `/api/contributor/catalog` → `requireAuth` + cursor sahifalash, `metaJson` SELECT'dan olib tashlandi.
- **#32** device-code: TTL 5 daq, 64-bit Crockford base32 kod, `?code=` URL'dan olib tashlandi (brauzerda QO'LDA kiritiladi), `/device/start` uchun alohida limit; plaginda "Kodni nusxalash".
- **#103** `/api/logs`: xotira keshi + 1s debounce yozuv (fayl I/O poygasi yo'q), `meta` 2KB'ga kesiladi, user-kalitli 60/min limit.
- **#20** `metaJson.promptPublic:false` → `prompt` katalog javobidan olib tashlanadi (`stripPrivatePrompt`).
- **#149** bloklangan contributorga JWT umuman yaratilmaydi (403 `signToken`dan oldin).
- **#150** `/2fa/disable` ishlatilgan backup kodni darhol yozadi (qolganlari saqlanadi + audit).
- **#151** DMCA `/report` uchun alohida limit (5/soat/IP).
- **#104** Google bilan kirishda TASDIQLANMAGAN parolli hisob bog'lansa — parol o'chiriladi + `tokenVersion++` (pre-hijacking).
- **#105** katalogdagi `externalId` faqat `gen:` bo'lsa qaytariladi (`incoming/<userId>/<fayl>` sizmaydi).
- **#106** avatar URL imzolangan (`<userId>.<hmac>` — enumeratsiya yo'q) + redirect faqat Google CDN hostlariga.
- **#107** sahna preview: `sceneKey()` sanitizatsiya + nashr etilmagan shablon faqat admin/muallifga; moderatsiya uchun yangi `GET /assets/:id/scene/:key/url` (auth) va AE Admin panel shu orqali yuklaydi.

`npm run build -w apps/api` ✓ · `npm run studio:sync` ✓ · migratsiya talab qilinmadi.
