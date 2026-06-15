# SESSION REPORT — 2026-06-15 — Studio Gen / 1e-2: Generate → job → polling ✅

## 1e-2 — image/voice Generate yangi Studio Gen oqimida
- `aiGenerate` dispatcher: sfx→soon; qidiruv→eski `/plugin/ai/search` (sinxron); image/voice→`aiRunStudioGen`.
- `aiRunStudioGen(media,val)`: `aiEnsureSession` (POST /gen/sessions, lazily) → `aiEnsureQuote`
  (imzolangan cost-quote, model uchun) → `POST /studio/gen {sessionId,mode,modelId,prompt,params,
  price,costQuoteSignature}` → `{jobId}` (kredit zaxira, creditsLeft yangilanadi).
- `aiPollJob` — `GET /studio/gen/:jobId` har 3.5s (maks ~2.5 daq), glow holatda "Navbatda…/
  Generatsiya qilinmoqda…". done/failed da to'xtaydi.
- done → GenAsset URL → `aiRenderResult` (rasm grid / audio pleyer) → "AE‘ga import" (importMediaFromPath).
  ext asset URL'dan ajratiladi.
- failed → toast "muvaffaqiyatsiz — kredit qaytarildi" + `aiRefreshCredits` (server balansidan).
- `aiResetResult` poll timer'ni tozalaydi (stray polling yo'q).

## Tekshirildi
- HTML inline JS `node --check` TOZA ✅
- `install-cep.sh` AE 2026 restart, Build: 2026-06-15 12:56 · 892dba3 ✅
- End-to-end (queued→done+asset→import) Render'da CF_* bilan; oqim/polling/refund mantig'i
  1b/1c lokal smoke + tsc bilan tasdiqlangan.

## Holat
1e-2 tugadi — Generate endi real job+polling. Keyingi: 1e-3 — generatsiya tarixi grid + session
sidebar (GET /gen/sessions/:id/generations).
