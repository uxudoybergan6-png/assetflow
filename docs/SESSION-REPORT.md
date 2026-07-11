# Sessiya hisoboti — 2026-07-11 (BATCH5 Prompt #1)

**Nima qilindi:** BytePlus ModelArk adapter (`apps/api/src/lib/ai/byteplus.ts`) yozildi va
Seedance 3101/3102 fal'dan BytePlus'ga ko'chirildi (Topaz 3201 fal'da qoldi).
- Adapter: Bearer auth, task submit/poll, semafor (3 parallel / 4k=1), 429 backoff (refund YO'Q,
  job queued'ga qaytadi), input-moderation (real yuz) → aniq English xato + oddiy refund yo'li.
- gen-processor: `byteplus-video` provider-job (restart resume), BYTEPLUS_TIMEOUT = FAL_TIMEOUT semantika.
- 3101 Fast `enabled:false` (pack olinmagan); 3102 label "Seedance 2.0 R2V" → "Seedance 2.0".
- provider-cost: 3101/3102 BytePlus tarifiga yangilandi (birinchi invoice bilan tasdiqlansin).
- `/gen/health`ga fal+byteplus boolean qo'shildi; `.env.example` BYTEPLUS_* qo'shildi.

**Tekshirildi:** `npm run build -w apps/api` yashil (validator 0 muammo). JONLI test: 3102 t2v
480p/4s → task `cgt-20260712010818-d6w72` SUCCEEDED (~70s), usage 40 594 token, video yuklab olindi.

**Kutilmoqda:** push + Cloud Run deploy (BYTEPLUS_API_KEY env), AE/platforma E2E, Fast pack olingach 3101 yoqish.
