# SESSION REPORT — 2026-06-15 — Studio Gen / 1e-1: model katalog + cost-quote (UI) ✅

## 1e-1 — AssetFlow_Plugin.html AI composer
- `aiStudioMode(media)`: rasm→image, ovoz→voice (yangi /studio/gen oqimi shu ikkisida).
- `studioGet`/`studioPost` — /api/studio uchun auth'li fetch helperlar.
- `aiLoadModels(media)` — `GET /studio/gen/models?mode=` → model dropdown'ni REAL katalog bilan
  to'ldiradi (Flux Schnell/SDXL/MeloTTS, har biri kredit narxi bilan). Default model tanlanadi.
- `aiBuildMenus` model bo'limi: katalog bo'lsa real modellar (label + "N kredit"), aks holda statik.
- `aiSetModelCat(id)` — katalogdan model tanlash → cost-quote qayta hisoblanadi.
- `aiCostQuote()` (debounce 350ms) — `POST /studio/gen/cost-quote` → imzolangan {price,signature}
  saqlanadi; Generate tugmasi ANIQ narxni ko'rsatadi ("Generatsiya · N kredit").
- `aiGenParams(media)` — quote VA generate uchun bir xil params (imzo hash mos kelsin).
- Trigger nuqtalari: aiInit, aiSetMedia(image/voice), AI sahifa ochilishi, prompt input.
- Login yo'q/API xato → statik fallback (UI buzilmaydi).

## Tekshirildi
- HTML inline JS `node --check` TOZA ✅
- `install-cep.sh` AE 2026 restart, Build: 2026-06-15 12:50 · 284e3be ✅
- (Backend /studio/gen/models + /cost-quote 1b'da lokal curl bilan tekshirilgan.)

## Holat
1e-1 tugadi — model dropdown real katalog + imzolangan narx. Generate hali eski /plugin/ai
oqimida (1e-2 da /studio/gen job+polling'ga ko'chiriladi). Keyingi: 1e-2.
