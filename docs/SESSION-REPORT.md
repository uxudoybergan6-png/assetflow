# SESSION REPORT — 2026-06-15 — Studio Gen / 1c: Workers AI job processor ✅

## 1c — lib/gen-processor.ts (queued → done/failed)
- `processGeneration(genId)`: status=running → model.feature bo'yicha Workers AI:
  - `text-to-image` → `aiGenerateImage(prompt, model.key)` (Flux/SDXL — model tanlanadi),
  - `text-to-speech` → `aiGenerateSpeech(prompt, lang, model.key)`.
- Natija: `detectMediaFormat` → R2 `gen/<userId>/<genId>.<ext>` (signed URL) yoki dev'da data-URL →
  `GenAsset` (type 130/120, url, resultKey, thumbUrl, aspectRatio) → Generation status=done.
- **failed → `refundAiCredits(userId, cost)`** (kredit yo'qolmaydi) + status=failed + error.
- `processGenerationInBackground` — POST /gen javobini bloklamaydi (fire-and-forget).

## workers-ai
`aiGenerateImage`/`aiGenerateSpeech` endi ixtiyoriy `model` parametri qabul qiladi (katalog
model.key — Flux/SDXL/MeloTTS tanlovi).

## studio-gen.ts
- POST /gen queued yaratgach `processGenerationInBackground(gen.id)`.
- GET /gen/:jobId — assets'ni qaytaradi; signed URL `resultKey`dan HAR so'rovda qayta imzolanadi
  (1h muddat o'tmasin).

## Tekshirildi (lokal, CF kalit yo'q)
- `tsc -p apps/api` EXIT 0 ✅
- Server smoke: GET /gen/<fakeid>→404 (route+prisma); /gen/models?mode=voice→MeloTTS;
  /gen/prompt/enhance→503 ✅
- End-to-end (queued→done+asset) Render'da CF_* bilan; failed→refund yo'li implement + tsc-tekshirildi.

## Holat
1c tugadi. Keyingi: 1d — imzolangan cost-quote (allaqachon 1b'da bor; 1d qattiqlashtirish/tekshiruv)
yoki 1e — UI (Artlist composer).
