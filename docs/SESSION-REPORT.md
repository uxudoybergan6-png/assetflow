# SESSION REPORT — 2026-07-01 — Google Vertex AI (Veo) to'g'ridan-to'g'ri integratsiya

Foydalanuvchi so'rovi: fal.ai orqali emas, TO'G'RIDAN-TO'G'RI Google Cloud/Vertex AI ($300 GCP kredit sarflash uchun), video (Veo) bilan boshlab.

- **Qo'shildi:** `apps/api/src/lib/ai/vertex.ts` — ADC (API key yo'q) orqali `@google/genai` (v2.10.0) SDK adapter: `vertexSubmitVideo`, `vertexPollVideo`, `vertexGcsUriToKey`. Usul nomlari (`generateVideos`, `operations.getVideosOperation`) HAQIQIY `.d.ts` fayldan tasdiqlangan.
- **Qo'shildi:** `s3.ts` → `downloadS3ToBuffer()` — Vertex natijasi (GCS'da, mavjud S3-moslik bucket) xotiraga yuklanadi, alohida GCS auth kerak emas.
- **Qo'shildi:** `gen-processor.ts` → `runVertexVideo()` + `"vertex-video"` job persistence variant + dispatcher branch + `VERTEX_TIMEOUT` + `stuckTimeoutMs` (20 daq, fal bilan bir xil).
- **Katalog (gen-models.ts):** id 3002 "Veo 3.1 Fast" → `provider:"vertex"`, `key:"veo-3.1-fast-generate-001"` (yagona tasdiqlangan model ID), cost ≈8 kredit/s (TAXMINIY — $0.10/s ~1kredit=$0.012-0.015 asosida). `enabled:false` — QASDAN o'chirilgan.
- 3001 (Lite)/3003 (Veo 3.1) model ID'lari TASDIQLANMAGAN — Model Garden'da tekshirish kerak.
- `npm run build -w apps/api` — TypeScript toza o'tdi.

**Kutilmoqda (foydalanuvchi qiladi, men qila olmayman — lokal gcloud yo'q):**
1. `gcloud services enable aiplatform.googleapis.com`
2. Cloud Run service account'ga `roles/aiplatform.user` berish
3. Cloud Run env: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` (masalan `us-central1`)
4. $300 kredit bilan qo'lda 1 video smoke-test, keyin `gen-models.ts`dagi 3002'dan `enabled:false` qatorini olib tashlash so'rash.
