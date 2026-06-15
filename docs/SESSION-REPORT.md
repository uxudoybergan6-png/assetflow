# SESSION REPORT — 2026-06-15 — TTS jonli test + Kokoro voice fallback ✅

## Topilma (jonli prod test)
- Kod+deploy+kalit ALLAQACHON to'g'ri: prod /gen/models voice → "hexgrad/kokoro-82m",
  /gen/health → openrouter:true, s3:true. Eski "gpt-4o-mini-tts does not exist" xatosi
  oldingi deploy'dan edi (push o'tgan, e838553 remote'da).
- Jonli test (plugin obunachi user@assetflow.uz):
  - voice=af_bella → ✅ DONE (R2 asset). Kokoro + af_bella TASDIQLANDI.
  - voice YO'Q → ❌ FAILED: Kokoro voice MAJBURIY ("expected string, received undefined").

## Tuzatish
- **gen-processor.ts**: voice yo'q/bo'sh → "af_bella" (default valid voice). Avval "" edi →
  kokoro xato berardi. Endi audio doim chiqadi (foydalanuvchi maqsadi).
- orSpeech voice-optional mantig'i saqlandi (zararsiz; processor doim voice yuboradi).
- Plugin o'zgarmadi (AI_VOICE_MAP barcha label'ni qoplaydi; backend default himoya qiladi).

## Tasdiqlangan Kokoro voice id'lari
af_bella ✅ (jonli). Boshqalar standart voicepack: af_nova/af_sarah/am_adam/am_onyx/bf_emma.

## Tekshirildi
- tsc -p apps/api EXIT 0 ✅. Commit + push → Render deploy → voice'siz keysni qayta test.
