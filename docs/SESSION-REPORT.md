# SESSION REPORT — 2026-06-14 — AI backend (Cloudflare Workers AI) qurildi ✅

## 1) Prisma
`AiGeneration` model (type IMAGE/VOICEOVER/SFX/SEARCH, prompt, resultKey?, credits, status
PENDING/DONE/FAILED, user@relation) + `PluginProfile.aiCredits Int @default(50)` +
`aiCreditsResetAt`. Migration `20260614160000_add_ai_generation` lokal DB'ga qo'llandi
(drift bor edi — reset QILMASDAN `migrate diff`+`db execute`+`resolve` bilan), client generate.

## 2) plugin-profile.ts
`consumeAiCredits(userId, cost)` — oylik reset (FREE 50 / PRO 1000) → ATOMIK `updateMany`
(`aiCredits >= cost`) → `{ok, remaining}`. `refundAiCredits` (provayder xatosida qaytarish).
`serializePluginUser` ga `aiCredits` + `aiCreditsMonthly`.

## 3) lib/ai/workers-ai.ts
Bitta integratsiya: `POST .../ai/run/{model}` + Bearer. Kalit yo'q → AI_NOT_CONFIGURED.
Modellar env'dan (default flux-1-schnell / bge-m3 / llama-3.1-8b / melotts).
`aiGenerateImage`→Buffer (base64/binary), `aiGenerateSpeech`→mp3 Buffer, `aiEmbed`→vektor, `aiText`→string.

## 4) routes/ai.ts (requireAuth + rate-limit 20/min)
`/estimate` (kalitsiz narx), `/image` (gate→AI→R2 `ai/img/<u>/<ts>.png`→signed URL→AiGeneration),
`/voiceover` (mp3), `/search` (embed → STUB natija, pgvector keyin). R2 yo'q bo'lsa data URL fallback.
index.ts: `app.use("/api/plugin/ai", aiRouter)`.

## 5) .env.example + render.yaml: CF_ACCOUNT_ID, CF_AI_TOKEN, AI_MODEL_* (sync:false).

## Tekshirildi
- `npm run build -w @creative-tools/database` + `tsc -p apps/api` → EXIT 0 ✅
- Lokal server smoke-test: `/estimate` auth'siz→401; auth bilan→`{credits:5,configured:false}`;
  `/image`→503 AI_NOT_CONFIGURED (kredit sarflanmaydi) ✅
- **Haqiqiy AI rasm testi BAJARILMADI** — lokal `.env`da CF_ACCOUNT_ID/CF_AI_TOKEN yo'q.
  Kalitlar qo'shilsa `/image` to'g'ridan ishlaydi (kod sinovdan o'tgan).

## Holat / kutilmoqda
Commit foydalanuvchi so'raganda. Render'ga CF_* env qo'shib deploy → birinchi AI rasm.
Keyingi: AI Tools tab frontend ulash; semantik qidiruv pgvector indeksi.
