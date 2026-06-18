# 3-bosqich — AI Tools (implementatsiya rejasi)

*Manba: Dizayn hisoboti §6 + Texnik strategiya modul 4. Kodda tasdiqlangan.*
*Holat: REJA — kod yozilmaydi.*

AssetFlow poydevori (PluginToken auth, FREE/PRO subscription, R2, SSE) ustiga AI **proxy-route** sifatida o'rnatiladi: provayder kalitlari faqat serverda, kreditlar subscription orqali nazoratlanadi.

---

## 🔄 PROVAYDER QARORI (2026-06-14): Cloudflare Workers AI

3 alohida provayder (OpenAI/ElevenLabs/fal.ai) O'RNIGA → bitta **Cloudflare Workers AI**.
Sabab: bitta token, R2/Pages bilan bir ekosistema, bepul tier (~10k neuron/kun), 163 model.

- **API:** `POST https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{model}`
  + `Authorization: Bearer {CF_AI_TOKEN}`.
- **Env:** `CF_ACCOUNT_ID` (888556c670b32b2345e16fcd1682e26f), `CF_AI_TOKEN` (Workers AI ruxsatli).
- **Model mapping** (aniq ID dashboard "Copy ID" dan):
  - Rasm → Text-to-Image (Flux `@cf/black-forest-labs/flux-1-schnell` yoki SDXL)
  - Ovoz → Text-to-Speech (grok-tts / MeloTTS)
  - Qidiruv → Embeddings (`@cf/baai/bge-m3` ko'p tilli)
  - Prompt yordam / auto-tag → Text Generation (Llama)
  - SFX → Audio model (dashboard Task Type=Audio bilan tekshirish)
- Bitta `lib/ai/workers-ai.ts` integratsiya; har tool shu funksiyani chaqiradi.
- Natija R2'ga → signed/public URL → AE import (mavjud pattern).

---

## ⚠️ HANDOFF.md bilan solishtiruv + strategiya qarori (2026-06-14)

**Strategiya: B — Differensiatsiya** (qaror muhrlangan, `docs/ANALIZ-higgsfield-ai-tools.md`). Higgsfield bilan xom generatsiyada bellashilmaydi; uning naqshlari (job/SSE, cost-estimate, timeline live-link) AssetFlow'ning katalog ustunligi bilan birlashtiriladi.

HANDOFF ko'rsatadiki, **AI bo'yicha hech narsa qilinmagan** (qator 413: to'liq OCHIQ) — lekin **poydevor men o'ylaganidan tayyorroq**:

| Poydevor komponenti | HANDOFF holati | AI uchun ahamiyati |
|---|---|---|
| R2 stream-upload (OOM-fix, 3GB) | 🟢 BAJARILGAN (qator 279, 349) | AI natijalarini R2'ga yozish tayyor |
| SSE progress (in-memory) | 🟢 BAJARILGAN (qator 351) | Job-status real-time uchun tayyor (Higgsfield polling'dan yaxshiroq) |
| PluginToken auth + `requireAuth` | 🟢 BAJARILGAN | AI route auth tayyor |
| Subscription gate (`checkDownloadAllowed`) | 🟢 BAJARILGAN (qator 290, 303) | Kredit-gate shu naqshga quriladi |
| `evalScript` 30s watchdog | 🟢 BAJARILGAN (qator 405) | AE import barqaror |
| **`ai.ts` route** | 🔴 OCHIQ | ✅ Dolzarb |
| **Prisma `AiGeneration` + `aiCredits`** | 🔴 OCHIQ | ✅ Dolzarb |
| **`evalJSX` typed wrapper** | 🔴 OCHIQ (2-bosqich) | ⚠️ Bog'liqlik — AE import xavfsizligi uchun |

**Xulosa:** poydevor (R2, SSE, auth, gate) tayyor — AI uchun "qayta yozish" yo'q, faqat ustiga qurish. SSE borligi job-status uchun ayniqsa qulay.

---

## Kod tahlilidan tasdiqlangan holat

| Da'vo | Kodda haqiqat |
|---|---|
| AI route yo'q | `apps/api/src/routes/ai.ts` mavjud emas |
| Prisma'da AI model yo'q | `schema.prisma`da `AiGeneration`/vector yo'q; `PluginProfile`da `aiCredits` yo'q |
| Auth poydevori bor | `auth.ts` → `requireAuth`, `requireActiveSubscription`; PluginToken modeli `schema.prisma`da bor |
| R2 + signed URL pattern bor | `lib/s3.ts`, `lib/serve-asset.ts` (stream-upload, signed URL TTL) |
| Subscription tizimi bor | `Subscription` modeli + `lib/plugin-profile.ts` gating |

> Eslatma: hisobotdagi kod misoli `requirePluginAuth`/`consumeAiCredits` deb yozgan — haqiqiy nomlar `requireAuth` va yangi yoziladigan `consumeAiCredits`. Reja shularga moslashtirilgan.

---

## Ustuvorlik (hisobot tavsiyasi: arzonidan boshla)

| Tool | Provayder | Murakkablik | Bosqich |
|---|---|---|---|
| AI semantik qidiruv | OpenAI embeddings + pgvector | Past | **3a — birinchi** |
| AI auto-tagging | Vision model (server) | Past | **3a — birinchi** |
| AI Ovoz (voiceover) | ElevenLabs | O'rta | **3b** |
| AI SFX | ElevenLabs / fal.ai | O'rta | **3b** |
| AI rasm | fal.ai (Flux) / Replicate | O'rta | keyin |
| AI video | fal.ai / Veo / Kling | Yuqori | oxirgi |

---

## Umumiy poydevor (3a va 3b'dan oldin)

### Prisma migratsiyasi
1. **`AiGeneration`** modeli: `id, userId, type(enum VOICEOVER|SFX|IMAGE|SEARCH), prompt, resultKey?, credits, createdAt, user@relation`.
2. **`PluginProfile`ga**: `aiCredits Int @default(50)`, `aiCreditsResetAt DateTime` (FREE: oyiga 50, PRO: 1000).
3. Migratsiya: `npm run migrate:deploy -w @creative-tools/database`.

### Kredit-gate kutubxonasi
- **`apps/api/src/lib/plugin-profile.ts`ga** `consumeAiCredits(userId, cost)`: oylik reset tekshiruvi → balans yetadimi → atomik kamaytirish → `{ ok, remaining }`.
- **Serverda tekshirish** — hech qachon frontend'da.

### Route skeleti
- **Yangi: `apps/api/src/routes/ai.ts`** + `index.ts` da `app.use("/api/plugin/ai", aiRouter)`.
- Har endpoint: `requireAuth` → `consumeAiCredits` → provayder-proxy (kalit `process.env`da) → R2 upload → signed URL → `AiGeneration` yozuvi.

---

## 3a — Semantik qidiruv + auto-tagging (arzon, backend-only)

- **Embeddings**: `ContributorTemplate`ga `embedding vector` (pgvector kengaytma) — title+tags+description'dan OpenAI embedding. Faqat `APPROVED+published` indekslanadi.
- **`POST /api/plugin/ai/search`**: prompt → embedding → pgvector cosine similarity → mos shablonlar. ("kosmik intro kerak" → mos natijalar.)
- **Auto-tagging**: contributor yuklaganda (`contributor.ts` submit oqimida) vision/LLM bilan avtomatik teg taklifi.
- **Nega birinchi**: UI minimal (mavjud qidiruv maydoniga ulanadi), provayder xarajati past, darhol qiymat. Bu §⑤ qidiruv muammosini ham qisman yopadi (pg_trgm o'rniga semantik).

---

## 3b — AI Ovoz + AI SFX (ElevenLabs proxy)

- **`POST /api/plugin/ai/voiceover`**: `{ text, voiceId, stability }` → kredit (1000 belgi ≈ 28 kredit, MF formulasi) → ElevenLabs proxy (`xi-api-key` serverda) → R2 (`ai/voice/<userId>/<ts>.mp3`) → signed URL → `{ url, creditsLeft }`.
- **`POST /api/plugin/ai/sfx`**: prompt + "prompt influence" → o'xshash oqim.
- **Rate limiting**: `middleware/rate-limit.ts`ni AI route'ga qo'llash (qimmat provayder).

---

## Frontend (AI Tools tab) — 1-bosqich qadam 4 skeletiga quriladi

- **`AssetFlow_Plugin.html`** — `#ai-tools` paneli: sub-tablar (Ovoz/SFX/Qidiruv), prompt textarea, ovoz `select`, parametr slayder, `✨ Generatsiya` CTA, kredit-pill, natija audio-pleyer (wavesurfer.js, MF naqshi).
- Higgsfield naqshi: model selektor (ikona+nom+tavsif), lime focus-ring, generatsiya glow.
- **AE'ga import**: natija signed URL → mavjud `downloadToTemp` (https.get pattern) → `evalJSX("importMediaFromPath", tmpPath)` (2-bosqich wrapper) → toast.

---

## Muhim qoidalar (xavfsizlik)
- API kalitlar **hech qachon panelda emas** — faqat server (MF'ning hardcoded kaliti = aks misol).
- Kredit-gate **serverda** — frontend'da chetlab o'tiladi.
- AI = PRO yoki kredit-asosli — mavjud subscription'ga ulanadi.
- Rate-limit har foydalanuvchiga.

---

## Bog'liqliklar
- **2-bosqich `evalJSX`** kerak (AE import xavfsizligi uchun).
- **0-bosqich Stripe-fix** kerak (kredit/PRO mantiqi to'g'ri ishlashi uchun).
- **1-bosqich AI-tab skeleti** kerak (UI uchun).

## Taklif qilinadigan ketma-ketlik
Poydevor (Prisma + kredit-gate + route skeleti) → 3a (qidiruv+tagging) → 3b (ovoz+SFX) → rasm/video keyin.
