# Sessiya hisoboti — 2026-07-04

**Vazifa:** AI gen pipeline statik auditi — enabled 13 modelning parametrlari (plagin→/gen→quote→processor→adapter) real provider kontraktiga mosligi. Pul zonasi (kredit/refund/imzo) TEGILMADI.

**Natija:** `docs/AI-API-AUDIT.md` (per-model matritsa): 9 PASS · 4 FIXED · 1 NEEDS-CONFIRMATION.

**Tuzatilgan (2 fix, alohida commitlar):**
1. `ea031c5` — Yakuniy kadr boshlang'ich kadrsiz: processor indamay tashlab yuborardi (Veo lastFrame i2v-only) → /gen 400 `END_FRAME_REQUIRES_START` (kreditdan OLDIN) + plagin guard.
2. `88bf250` — Nano Banana 2 Lite `resolutions:["1K"]` (2K=400; stale quality merosi tuzatildi).

**NEEDS-CONFIRMATION:** Kokoro TTS — OpenRouter kaliti jonliligi env'da (statik tasdiqlanmaydi).

**AE jonli tekshiruv kutilmoqda:** Veo 9:16×1080p, Veo Lite ID, start+end interpolatsiya, Nano Pro 4K, Kokoro, Omni video-ref, Seedance (fal zaxira), yangi end-kadr guard toast.

**Kutilmoqda:** push + Cloud Run deploy (API o'zgardi), `npm run build -w apps/api` toza o'tdi.
