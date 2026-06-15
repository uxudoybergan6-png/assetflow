# SESSION REPORT — 2026-06-15 — AI Tools Bosqich 2 tuzatish: TTS model Kokoro ✅

Sabab (jonli /endpoints): openai/gpt-4o-mini-tts OpenRouter'da endpoint YO'Q ("does not exist").
hexgrad/kokoro-82m jonli (DeepInfra, ochiq).

## Backend
- **gen-models.ts** TTS: key → "hexgrad/kokoro-82m", label "Kokoro TTS".
- **openrouter.ts orSpeech**: voice IXTIYORIY — bo'sh bo'lsa body'dan tushiriladi (model default
  ovoz; voice id noto'g'ri bo'lsa ham audio chiqsin). response_format "mp3" qoldi.
- **gen-processor.ts**: voice default "alloy" → "" (yo'q bo'lsa model default).

## Plugin (AssetFlow_Plugin.html)
- AI_CFG.ovoz: models ['Kokoro TTS']; settings do'stona label [Bella,Nova,Sarah,Adam,Onyx,Emma]
  (default Bella).
- AI_VOICE_MAP: label → Kokoro id (af_bella/af_nova/af_sarah/am_adam/am_onyx/bf_emma).
  aiGenParams('ovoz') → {voice: map||''} (mos kelmasa default).
- Quote re-sign (voice o'zgarsa) o'zgarmadi.

## Tekshirildi
- tsc EXIT 0 ✅ · plugin inline JS node --check (0 xato) ✅ · install-cep ✅
- Voice id'lar standart Kokoro voicepack nomlari; mos kelmasa default-voice fallback himoya qiladi.

## Holat
Commit + push qilinadi (Render deploy). Foydalanuvchi AE'da ovozni sinab ko'radi.
