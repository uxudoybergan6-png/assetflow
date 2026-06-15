# SESSION REPORT — 2026-06-15 — Batch A / 2a: Timeline reference ✅

## 2a — Timeline live-link (Higgsfield AEFT naqshi)
### host.jsx
- `getActiveTimelineVideoReference()` — aktiv comp'dagi tanlangan layer manbasining fayl yo'li
  (FootageItem `mainSource.file.fsName`/`file.fsName`), structured JSON {ok,name,mediaPath,
  mediaType,hasVideo,hasAudio,compName}. AEFT-only (Premiere yo'q).
- `getActiveTimelineClipDetails()` — tanlangan layer in/out/startTime/compTime/sourceDuration.

### Frontend (AssetFlow_Plugin.html)
- "Timeline'dan" tugmasi ("TEZ ORADA" olib tashlandi) → `aiTimelineRef()` → evalScript →
  reference `af_ai.reference={path,name,mediaType}` → composer'da **chip + thumbnail** (`#aiRefBar`).
  Rasm bo'lsa `file://` thumbnail, aks holda ikona. `aiClearRef()` ✕ bilan olib tashlanadi.
- CSS `.ai-refbar`/`.ai-ref-*` (tokenlar bilan).
- ⚠️ 2a: reference faqat OLINADI va ko'rsatiladi. Uni img2img' da ISHLATISH — 2b/3b sub-qadam.

## Tekshirildi
- host.jsx + HTML inline JS `node --check` TOZA ✅
- `install-cep.sh` o'rnatdi; getActiveTimelineVideoReference (host) + aiTimelineRef/aiRefBar (html) ✅

## Holat
2a tugadi — AE'da test: comp ochib, layer tanlab "Timeline'dan" bossangiz reference chip chiqadi.
Keyingi: 3a — funksional ko'p-model selektor.
