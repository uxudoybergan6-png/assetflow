> **STATUS:** PARTIAL — backend (OpenRouter/ElevenLabs/Workers AI + kredit) REAL va ishlaydi; bu reja kelajak yaxshilashlar uchun, joriy holat EMAS. Joriy holat: `docs/PROJECT-STATUS.md`. — 2026-06-20

# AI TOOLS — 100% bitirish rejasi (Claude Code uchun)

*Yozildi: 2026-06-15. Asos: kod tahlili + deep-research (OpenRouter reality check, provayder solishtirish, Higgsfield/Freepik/Runway UX).*
*Maqsad: AI Tools panelini "chala" holatdan to'liq ishlaydigan professional suite'ga yetkazish.*

> **Eng muhim xulosa:** Backend yondashuvi (OpenRouter) ASOSAN to'g'ri — rasm, rasm-edit,
> video, embeddings AYNAN kod yozilganidek ishlaydi (rasmiy docs bilan tasdiqlangan). Faqat
> **3 ta aniq muammo** "hech narsa ishlamaydi" hissini beradi. Qayta yozish KERAK EMAS.

---

## 0. ILDIZ SABABLAR (nega hozir ishlamaydi)

Deep-research natijasi (OpenRouter rasmiy docs, 2026-iyun) — har bittasi tasdiqlangan:

| # | Muammo | Holat | Ta'sir |
|---|--------|-------|--------|
| **1** | **`OPENROUTER_API_KEY` productionda yo'q** | render.yaml'da `sync:false` — qo'lda qo'yiladi. SESSION-REPORT: "kalit qo'shilgach…" | **HAMMA gen 503 `AI_NOT_CONFIGURED`** — bu asosiy blocker |
| **2** | **TTS (ovoz) kodi butunlay xato** | `modalities:["audio","text"]` + `openai/gpt-4o-audio-preview` (model **mavjud emas**) | Ovoz hech qachon ishlamaydi |
| **3** | **Plugin'da video gen bo'limi YO'Q** | `AI_CFG`'da faqat rasm/ovoz/sfx/qidiruv. Backend'da video bor, UI'da yo'q | Foydalanuvchi videoni umuman ko'rmaydi |
| **4** | **SFX = `aiSoon()` (stub)** | `aiGenerate()`: `if(media==='sfx'){aiSoon();return;}` | SFX "tez orada" |
| **5** | OpenRouter SFX/music'ni qamramaydi | OpenRouter: rasm/video/edit/embed/TTS bor, **SFX va musiqa YO'Q** | SFX uchun boshqa provayder kerak |

**Ikkita parallel tizim chalkashlik beradi** (tozalansin):
- Eski: `routes/ai.ts` (`/api/plugin/ai`) — Workers AI (rasm/ovoz/qidiruv). Faqat `/search` ishlatiladi.
- Yangi: `routes/studio-gen.ts` (`/api/studio`) — OpenRouter (asosiy oqim). Bu yetuk: session, model katalog, imzolangan cost-quote, job, polling, enhance.

---

## 1. PROVAYDER STRATEGIYASI (qaror)

Research asosida **gibrid** (eng tez "100% ishlaydi" yo'li):

| Imkoniyat | Provayder | Sabab |
|---|---|---|
| Rasm (text-to-image) | **OpenRouter** | Allaqachon ishlaydi (`gemini-3.1-flash-image-preview`, `flux.2-pro` — REAL) |
| Rasm EDIT (reference) | **OpenRouter** | Ishlaydi (chat/completions + image_url) |
| Video (t2v + i2v) | **OpenRouter** | `/videos` async — `kling-v3.0-std/pro`, `veo-3.1` REAL |
| Embeddings (qidiruv) | **OpenRouter** | `qwen/qwen3-embedding-4b` REAL |
| Ovoz (TTS) | **OpenRouter — TUZATILGAN** | `/audio/speech` + `gpt-4o-mini-tts-2025-12-15` |
| **SFX** | **Freepik** `/v1/ai/sound-effects` | OpenRouter'da yo'q. Freepik async+webhook |
| **Musiqa** (kelajak) | **Freepik** `/v1/ai/music-generation` (ElevenLabs) | OpenRouter'da yo'q |

> **Muqobil (keyin):** hammani **Freepik**'ga ko'chirish mumkin (bitta kalit, bitta async+webhook
> naqsh, SFX+musiqa ham qamraydi, B2B tijoriy litsenziya). Lekin hozir OpenRouter ishlab turibdi —
> uni buzmang. Freepik'ni faqat SFX/music uchun `ProviderAdapter` sifatida qo'shing.

**Arxitektura tavsiyasi:** `lib/ai/providers/` — `ProviderAdapter` interfeysi
(`createJob(kind,params)→{taskId}`, `parseWebhook(req)→{taskId,status,assets}`). OpenRouter +
Freepik ikkita impl. Keyin model registrida `provider` maydoni qaysi adapterga yo'naltiradi.

---

## 2. BOSQICHLAR (har biri commit + AE test + tsc/parse toza)

### 🔴 BOSQICH 1 — BLOKERNI OCHISH (eng oldin, 30 daqiqa)

**1.1 — OpenRouter kalitni productionga qo'shish**
- Render dashboard → `assetflow-api` → Environment → `OPENROUTER_API_KEY` = haqiqiy kalit.
- Tekshir: `GET /api/studio/gen/models?mode=image` → `{configured: true}`.
- Busiz quyidagilarning HECH BIRI ishlamaydi.

**1.2 — Diagnostika endpoint (ixtiyoriy, lekin tavsiya)**
- `GET /api/studio/gen/health` → `{openrouter: bool, freepik: bool, s3: bool}`. Admin tez tekshiradi.

**Qabul mezoni:** AE plugin → Rasm → prompt → Generate → **haqiqiy rasm chiqadi**.

> ⚠️ **Diagnostika eslatmasi (kod-review):** Agar Render'da kalit ALLAQACHON qo'yilgan bo'lsa,
> "hech narsa ishlamaydi" sababi boshqa joyda — qayta diagnostika qil: `/gen/models` `configured`
> qiymati, brauzer konsol/Network xatolari, `studioPost` 503/401/CORS. Kalitni birinchi gumon qil,
> lekin yagona deb hisoblama.

---

### 🔴 BOSQICH 2 — TTS (ovoz) TUZATISH

**Fayl:** `apps/api/src/lib/ai/openrouter.ts` — `orSpeech()` (128–149 qator).

Hozirgi (XATO):
```ts
// modalities:["audio","text"] + choices[0].message.audio.data — OpenRouter'da bunday emas
```

To'g'ri (rasmiy `/api/v1/audio/speech` — RAW bayt qaytaradi, JSON emas):
```ts
export async function orSpeech(
  model: string, text: string, voice = "alloy"
): Promise<OrResult<Buffer>> {
  if (!isOpenRouterConfigured()) return NOT_CONFIGURED;
  const res = await fetch(BASE + "/audio/speech", {
    method: "POST",
    headers: orHeaders(),
    body: JSON.stringify({ model, input: text, voice, response_format: "mp3" }),
  });
  if (!res.ok) return { ok: false, error: await errText(res), status: res.status };
  const buf = Buffer.from(await res.arrayBuffer()); // RAW audio — JSON EMAS
  if (!buf.length) return { ok: false, error: "Bo'sh audio" };
  return { ok: true, data: buf };
}
```

**Fayl:** `apps/api/src/lib/gen-models.ts` — TTS model (52–60 qator):
```ts
key: "openai/gpt-4o-mini-tts-2025-12-15",   // gpt-4o-audio-preview EMAS (mavjud emas)
label: "GPT-4o Mini TTS",
```
> ✅ **JONLI API'dan TASDIQLANDI (2026-06-15, `GET /api/v1/models?output_modalities=speech`):**
> `/api/v1/audio/speech` bor (OpenAI-mos, **raw bayt**, JSON emas). `openai/gpt-4o-mini-tts-2025-12-15`
> REAL ($0.60/M, eng arzon). Boshqa real: `hexgrad/kokoro-82m` ($0.62/M, 8 til),
> `google/gemini-3.1-flash-tts-preview` ($1/M), `mistralai/voxtral-mini-tts-2603` ($16/M, cloning).
> `gpt-4o-audio-preview` jonli ro'yxatda **YO'Q** — tasdiqlandi.

**A — Ovoz params mos kelmasligi (kod-review bug):** Plugin `aiGenParams('ovoz')` → `{lang:'en'}`
qaytaradi (`AssetFlow_Plugin.html:4144`), lekin processor `params.voice`'ni o'qiydi
(`gen-processor.ts:121`). Ya'ni ovoz **har doim `alloy`** — tanlov ishlamaydi. TTS tuzatilganda:
- Plugin: `aiGenParams('ovoz')` → `{voice:'<tanlangan>'}` (model voice ro'yxatidan; `lang` emas).
- Voice selektorni `settings` o'rniga real voice ID'larga ulang.
- ⚠️ `voice` quote VA generate'da bir xil bo'lsin (imzo hash mos kelishi shart — §studio-gen.ts:111).

**Qabul mezoni:** Ovoz → matn → voice tanla → Generate → **tanlangan ovozda mp3 chiqadi**.

---

### 🟠 BOSQICH 3 — VIDEO GEN BO'LIMI (eng katta yangi qism)

Backend video TAYYOR (`gen-processor.ts` `runVideo`, `openrouter.ts` `orVideoCreate/Status`,
`gen-models.ts` 3001/3002/3003). Faqat **plugin UI yo'q**. Quyidagilar kerak:

**3.1 — `AI_CFG`'ga video qo'shish** (`AssetFlow_Plugin.html` ~4103):
```js
video:{label:'Video',ico:'film',sub:'AI video generatsiya',cost:60,
  models:['Kling v3.0','Veo 3.1'],
  settings:['16:9 · 1080p · 5s','9:16 · 1080p · 5s','16:9 · 1080p · 10s'],
  ph:'Video sahnani tasvirlang…'},
```
- `aiIco()`'ga `film` ikonkasi qo'sh.

**3.2 — `aiStudioMode()`'ga video** (~4125):
```js
function aiStudioMode(media){
  return media==='rasm'?'image':media==='ovoz'?'voice':media==='video'?'video':null;
}
```

**3.3 — Video composer kontrollar** (Higgsfield/Runway naqshi — research §5):
- **Rejim toggle:** Text-to-video ↔ Image-to-video (reference bo'lsa avto i2v).
- **Davomiylik:** 5s / 10s tugmalar.
- **Aspect ratio:** 16:9 / 9:16 / 1:1.
- **Resolution:** 720p / 1080p.
- **Reference rasm:** Timeline'dan (`aiTimelineRef` bor) yoki fayldan → `params.referenceUrl`.
- Bu qiymatlar `aiGenParams('video')`'da `{resolution, aspectRatio, duration, referenceUrl}` bo'lib
  cost-quote VA generate'da BIR XIL yuborilsin (imzo hash mos kelishi shart!).

**3.4 — `aiGenParams()` kengaytirish** (~4143) — video uchun params qaytarsin.

**3.5 — Video natija ko'rsatish** (`aiRenderResult` ~4495) — `<video controls>` + "AE'ga import".
- `aiRunStudioGen` video uchun ham ishlaydi (polling bor), lekin video uzoq (~5 daqiqa) →
  polling `max` ni oshir (hozir 40×3.5s=2.3daq → video uchun 100×5s=8daq) yoki SSE (bosqich 6).

**3.6 — `gen-models.ts` video marshrutlash (B — kod-review):**
✅ **JONLI TASDIQ (2026-06-15, sayt):** `kwaivgi/kling-v3.0-std/pro` OpenRouter'da **BOR va to'g'ri**.
OpenRouter'da **14 ta** video model (Kling, Veo, Seedance, Wan, Hailuo, Grok, Sora). To'liq: `docs/OPENROUTER-katalog-yakuniy.md`.
- **default → `google/veo-3.1-lite`** (arzon $0.05/s, audio, t2v — reference shart emas).
- i2v (reference) uchun → `kwaivgi/kling-v3.0-std` yoki `bytedance/seedance-2.0` (first/last frame).
- Reference yo'q + i2v model = avto-t2v (veo) ga o'tsin yoki ogohlantir.
- Katalogni kengaytir (rejada Kling bor edi — saqla, Veo/Seedance/Wan qo'sh).

**3.7 — ⚠️ Render'da video job yo'qolishi (C — kod-review, MUHIM):**
`runVideo` fon process ichida ~5 daqiqagacha poll qilib bloklab turadi (`gen-processor.ts:67`).
Render free/ephemeral'da process restart bo'lsa → job **"running"da qotib qoladi** (refund ham yo'q).
Yechim (video uchun SFX'dagidek webhook/qayta-tiklanadigan, B6'ni KUTMA):
- Video ham async-job sifatida: `Generation.params.videoJobId` (OpenRouter video id) saqlansin.
- "running" + eski (masalan >10 daq) job'larni **qayta tekshiruvchi** reconciler (cron yoki
  keyingi polling'da `orVideoStatus(videoJobId)` bilan davom ettir) — process qaytsa tiklansin.
- Yoki OpenRouter video webhook'i bo'lsa, Freepik naqshidagidek webhook ishlat.
- Minimal: "running" job >N daqiqa bo'lsa → `failed` + refund (qotib qolmasin).

**Qabul mezoni:** Video → prompt → 5s/16:9 → Generate → ~daqiqalardan keyin **video chiqadi va AE'ga import bo'ladi**; process restart bo'lsa job qotib qolmaydi.

---

### 🟠 BOSQICH 4 — SFX (Freepik adapter)

OpenRouter SFX'ni qamramaydi → **Freepik** `/v1/ai/sound-effects` (async + webhook).

**4.1 — Freepik klient** `apps/api/src/lib/ai/freepik.ts`:
```ts
const BASE = "https://api.freepik.com";
const KEY = process.env.FREEPIK_API_KEY ?? "";
export function isFreepikConfigured(){ return Boolean(KEY); }
function fpHeaders(){ return {"Content-Type":"application/json","x-freepik-api-key":KEY}; }

export async function fpSoundEffects(prompt:string, webhookUrl:string){
  const r = await fetch(BASE+"/v1/ai/sound-effects",{method:"POST",headers:fpHeaders(),
    body:JSON.stringify({prompt, webhook_url:webhookUrl})});
  const j = await r.json();           // { data:{ task_id, status:"CREATED" } }
  return j?.data?.task_id as string;
}
```

**4.2 — Webhook handler** `POST /api/ai/freepik-webhook` (express.raw + HMAC-SHA256 imzo tekshir):
- Imzo: `webhook-id.webhook-timestamp.rawBody` → HMAC-SHA256 (`FREEPIK_WEBHOOK_SECRET`).
- `status==="COMPLETED"` → `generated[0]` URL'ni **darhol R2'ga ko'chir** (URL vaqtinchalik) →
  `GenAsset` yarat → `Generation.status="done"`. `FAILED` → refund.
- ⚠️ Render ephemeral → **polling EMAS, webhook**. `task_id`'ni `Generation`'ga sakla
  (`params.freepikTaskId` yoki yangi maydon).

**4.3 — Model registr:** `gen-models.ts`'ga `provider:"freepik"` maydoni + SFX modeli (mode `sfx`).
- `gen-processor.ts`: `model.provider==="freepik"` bo'lsa Freepik adapter, aks holda OpenRouter.

**4.4 — Plugin SFX:** `aiGenerate()`'dan `if(media==='sfx'){aiSoon();return;}` ni OLIB TASHLA →
`aiStudioMode`'ga `sfx` qo'sh → Studio Gen oqimiga ulasin (davomiylik 3s/5s/10s param).

**Qabul mezoni:** SFX → "portlash ovozi" → Generate → **audio chiqadi**.

---

### 🟡 BOSQICH 5 — UI YETUKLIK (professional his — research §6 must-have)

- **Generatsiya tarixi (gallery):** `StudioGenHistory` bor (`gen/sessions/:id/generations`) —
  sidebar grid: har natija Download / Sevimli / Qayta / "Input qilib ishlatish".
- **Cost-before-generate:** allaqachon bor (`aiCostQuote` → "Generatsiya · N kredit"). Video/SFX
  uchun ham param o'zgarsa qayta hisoblansin.
- **Enhance prompt tugmasi:** backend bor (`/gen/prompt/enhance`). UI tugma qo'sh (composer'da ✨).
- **Job holatlari:** queued→running→done aniq ko'rsatilsin (bor, video uchun progress matni yaxshilansin).
- **Model selektor:** funksional (bor) — video/sfx kataloglari ham yuklansin (`aiLoadModels`).
- **D — ikki tizim chalkashligini tozalash (kod-review, ustuvorlikni oshir):** Plugin'da hali
  `AI_ENDPOINT={rasm:'image',ovoz:'voiceover',...}` (`AssetFlow_Plugin.html:4110`) eski
  `routes/ai.ts` (`/api/plugin/ai`)'ga ishora qiladi — faqat `/search` ishlatiladi, qolgani live
  kodda chalkashlik manbai. `/search`'ni `studio-gen`'ga ko'chir, `AI_ENDPOINT`'dan keraksiz
  yo'llarni olib tashla, eski `routes/ai.ts`'ni qisqart. (Bu B6 emas, B5'da qil.)

---

### 🟢 BOSQICH 6 — POLISH (keyin, ixtiyoriy)

- **SSE job status** (polling o'rniga) — video uzoq bo'lgani uchun. Mavjud SSE infra ustiga.
- **First/last frame** (i2v keyframe), **kamera preset'lari** (Higgsfield naqshi).
- **Image upscale / remove-bg** (Freepik `/v1/ai/image-upscaler`, `/beta/remove-background`).
- **Template-grounded AI** (AssetFlow ustunligi — `archive/ANALIZ-higgsfield-ai-tools.md` §3): "shu shablon uchun" gen.
- *(Eski `routes/ai.ts` tozalash B5'ga ko'chirildi — D nuqtasi.)*

---

## 3. ENV — qo'shilishi kerak

```bash
# render.yaml + Render dashboard (sync:false — qo'lda)
OPENROUTER_API_KEY=sk-or-...          # BOSQICH 1 — eng muhim
FREEPIK_API_KEY=FPSX...               # BOSQICH 4 (SFX/music)
FREEPIK_WEBHOOK_SECRET=...            # webhook imzo tekshirish
```

---

## 4. MODEL ID'LAR (tasdiqlangan — 2026-iyun)

| Model | OpenRouter ID | Holat |
|---|---|---|
| Rasm (Gemini) | `google/gemini-3.1-flash-image-preview` | ✅ REAL |
| Rasm (Flux) | `black-forest-labs/flux.2-pro` | ✅ REAL (Flux uchun `modalities:["image"]`, `"text"` shart emas) |
| Video (Kling std) | `kwaivgi/kling-v3.0-std` | ✅ REAL |
| Video (Kling pro) | `kwaivgi/kling-v3.0-pro` | ✅ REAL |
| Video (Veo) | `google/veo-3.1` | ✅ REAL (t2v) |
| Embed | `qwen/qwen3-embedding-4b` | ✅ REAL (`dimensions` param YUBORMA) |
| **TTS** | ~~`openai/gpt-4o-audio-preview`~~ | ❌ **MAVJUD EMAS** → `openai/gpt-4o-mini-tts-2025-12-15` |

> ⚠️ Video ZDR (Zero-Data-Retention) bilan ishlamaydi — agar OpenRouter hisobida ZDR yoqilgan bo'lsa, video so'rovlari rad etiladi.

---

## 5. TEKSHIRUV (har bosqichdan keyin)

1. `tsc -p apps/api` → EXIT 0.
2. `node --check` plugin HTML inline JS + `catalog.js` + `host.jsx`.
3. `bash plugins/after-effects-cep/scripts/install-cep.sh` → AE'da real test.
4. End-to-end: login → har media (rasm/video/ovoz/sfx/qidiruv) → Generate → natija → AE import.
5. Xato yo'li: kredit yetmaganda 402; gen fail bo'lganda **kredit qaytariladi** (refund) — tekshir.
6. `npm run studio:sync` (agar studio js o'zgargan bo'lsa).
7. `docs/SESSION-REPORT.md` yangilash (CLAUDE.md qoidasi — maks 15 qator).

---

## 6. USTUVORLIK (TL;DR)

```
1. OPENROUTER_API_KEY productionga qo'y        ← bittasi 90% muammoni hal qiladi
   (kalit bor bo'lsa → qayta diagnostika: configured/konsol/CORS)
2. TTS tuzat (/audio/speech ✅tasdiq + real model + voice param fix [A])
3. Video gen UI bo'limi (AI_CFG + composer + natija)
   + default model t2v [B] + Render job-yo'qolish himoyasi [C]
4. SFX (Freepik adapter + webhook)
5. UI yetuklik (tarix, enhance tugma, job holat) + ikki-tizim tozalash [D]
6. Polish (SSE, upscale, template-grounded)
```

*Yangilandi 2026-06-15 (kod-review v2): A/B/C/D nuqtalari qo'shildi, TTS web bilan tasdiqlandi.*

> **Eng katta tushuncha:** kod sifati yaxshi va backend deyarli to'liq. "Hech narsa ishlamaydi"
> hissi asosan **kalit qo'yilmagani (1)** + **TTS xatosi (2)** + **video UI yo'qligi (3)** dan.
> Bularni tuzatsang — Tools darhol "tirik" bo'ladi. Qayta yozish shart emas.

---

## Manbalar (deep-research, rasmiy docs)
- OpenRouter: image-generation, tts, video-generation, embeddings docs + live `/api/v1/models`.
- Freepik: `docs.freepik.com` — sound-effects, music-generation, webhooks (HMAC).
- UX: Runway Gen-4.5, Higgsfield 2026, Freepik/Magnific, Krea, Artlist AI Toolkit.
- Batafsil: `docs/archive/RESEARCH-natija-ai-sfx-gemini.md`, `docs/archive/FREEPIK-API-ANALYSIS.md`, `docs/archive/ANALIZ-higgsfield-ai-tools.md`.

*Tayyor: 2026-06-15. Claude Code bu rejani bosqichma-bosqich bajaradi.*
