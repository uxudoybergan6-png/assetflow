# Claude Code promptlari — AI Tools 100% (har bosqich uchun)

*Har blokni alohida Claude Code sessiyasiga (yoki ketma-ket) copy-paste qil. Tartib muhim: 1→6.*
*Asos reja: `docs/REJA-AI-TOOLS-100.md`. Har prompt o'sha rejaning bir bosqichini bajaradi.*

**Har bir sessiyaga umumiy qoidalar (prompt ichida takrorlangan):**
- Avval tegishli fayllarni O'QI, keyin minimal diff bilan o'zgartir.
- `tsc -p apps/api` EXIT 0; plugin HTML inline JS + `jsx/host.jsx` `node --check` toza.
- Studio JS o'zgarsa: **manba** `packages/assetflow-studio/js/` ga yoz, so'ng `npm run studio:sync`.
- Plugin o'zgarsa: `bash plugins/after-effects-cep/scripts/install-cep.sh` + AE'da test.
- Tugagach `docs/SESSION-REPORT.md` ni YANGILA (maks 15 qator). Commit FAQAT so'ralganda.
- O'zbekcha UI matnlari. Production URL: `assetflow-rqbq.onrender.com`.

---

## 🔴 BOSQICH 1 — Diagnostika endpoint (kalit qo'lda qo'yiladi)

> ⚠️ `OPENROUTER_API_KEY` ni Render dashboard'ga QO'LDA qo'yish — bu prompt EMAS, foydalanuvchi qiladi.
> Bu prompt faqat diagnostika kodini qo'shadi.

```
Loyiha: AssetFlow monorepo. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 1.2).

Vazifa: AI sozlamalarini bitta so'rovda tekshiradigan diagnostika endpoint qo'sh.

1. apps/api/src/routes/studio-gen.ts ni o'qi. `/credits` route'idan keyin yangi qo'sh:
   GET /gen/health → JSON: { openrouter: <isOpenRouterConfigured()>, s3: <isS3Configured()> }.
   requireAuth allaqachon router'da bor. isOpenRouterConfigured va isS3Configured allaqachon
   import qilingan — tekshir. (FREEPIK keyin — Bosqich 4'da qo'shiladi, hozir QO'SHMA.)
2. Maxfiy ma'lumot QAYTARMA — faqat boolean holat.

Tekshiruv: tsc -p apps/api EXIT 0. So'ng (lokal) GET /api/studio/gen/health → {openrouter,...}.
Tugagach SESSION-REPORT.md yangila. Commit qilma.
```

**Foydalanuvchi qadami (kod emas):** openrouter.ai → Keys → kalit + kredit → Render env
`OPENROUTER_API_KEY` → Save. Tekshir: `/gen/health` `openrouter:true`.

---

## 🔴 BOSQICH 2 — TTS (ovoz) tuzatish + voice param fix [A]

```
Loyiha: AssetFlow. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 2). 
✅ JONLI TASDIQLANDI (2026-06-15, GET /api/v1/models?output_modalities=speech):
   - OpenRouter'da /api/v1/audio/speech bor (OpenAI-mos, RAW bayt qaytaradi, JSON emas).
   - "openai/gpt-4o-mini-tts-2025-12-15" REAL model (eng arzon, $0.60/M). Boshqa real variantlar:
     hexgrad/kokoro-82m ($0.62/M, 8 til), google/gemini-3.1-flash-tts-preview ($1/M),
     mistralai/voxtral-mini-tts-2603 ($16/M, voice cloning).

Vazifa: TTS to'liq ishlasin.

1. apps/api/src/lib/ai/openrouter.ts → orSpeech() (taxminan 128-149 qator) ni QAYTA YOZ:
   - Endpoint: POST {BASE}/audio/speech (chat/completions EMAS).
   - Body: { model, input: text, voice, response_format: "mp3" }.
   - Javob RAW audio: Buffer.from(await res.arrayBuffer()) — choices/message.audio EMAS.
   - Bo'sh bo'lsa xato; aks holda { ok:true, data:buf }.
2. apps/api/src/lib/gen-models.ts → TTS modeli (taxminan 52-60): key ni
   "openai/gpt-4o-mini-tts-2025-12-15" ga o'zgartir (gpt-4o-audio-preview MAVJUD EMAS — jonli ro'yxatda yo'q).
   Voice'lar OpenAI uslubida (alloy/echo/fable/onyx/nova/shimmer...) — modelga bog'liq.
3. [A] Ovoz param mosligini tuzat: plugins/after-effects-cep/AssetFlow_Plugin.html →
   aiGenParams('ovoz') (taxminan 4144) hozir {lang:'en'} qaytaradi, lekin processor params.voice
   o'qiydi (gen-processor.ts:121). Uni {voice:'<tanlangan voice id>'} qaytaradigan qil.
   MUHIM: voice cost-quote VA generate'da BIR XIL bo'lsin (imzo hash mos kelishi shart).
   Ovoz menyusini (settings) real voice ID'larga ulang.

Tekshiruv: tsc -p apps/api EXIT 0; node --check plugin HTML inline JS; install-cep; AE'da Ovoz →
matn → voice tanla → Generate → mp3 chiqib eshitilsin. SESSION-REPORT yangila. Commit qilma.
```

---

## 🟠 BOSQICH 3 — Video gen bo'limi (UI + marshrutlash [B] + job himoyasi [C])

```
Loyiha: AssetFlow. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 3, 3.6 [B], 3.7 [C]).
Backend video TAYYOR (gen-processor.ts runVideo, openrouter.ts orVideoCreate/Status,
gen-models.ts 3001/3002/3003). Faqat plugin UI yo'q + 2 ta tuzatish.

Vazifa: Plugin'ga to'liq video gen bo'limi qo'sh.

Plugin (plugins/after-effects-cep/AssetFlow_Plugin.html — avval #aiPage qismini o'qi):
1. AI_CFG (taxminan 4103) ga 'video' media qo'sh: {label:'Video',ico:'film',sub:'AI video
   generatsiya',cost:60,models:[...],settings:['16:9 · 1080p · 5s','9:16 · 1080p · 5s',
   '16:9 · 1080p · 10s'],ph:'Video sahnani tasvirlang…'}. aiIco() ga 'film' SVG qo'sh.
2. aiStudioMode() (4125) ga: media==='video' → 'video'.
3. Video composer kontrollar: t2v↔i2v toggle (reference bo'lsa avto i2v), davomiylik 5s/10s,
   aspect 16:9/9:16/1:1, resolution 720p/1080p, reference (Timeline'dan aiTimelineRef bor / fayldan).
4. aiGenParams() (4143) video uchun {resolution,aspectRatio,duration,referenceUrl} qaytarsin —
   cost-quote VA generate'da BIR XIL (imzo hash!).
5. aiRenderResult() (4495) video uchun <video controls> + "AE'ga import".
6. aiPollJob (4452) max ni video uchun oshir (~100×5s=8daq) yoki mode-asosli timeout.

Backend tuzatishlar:
7. [B] gen-models.ts: kling-v3.0-std isDefault:true VA image-to-video — reference yo'q default
   video = xato. Default video modelni veo-3.1 (text-to-video) qil, YOKI composer'da "reference
   yo'q → t2v modelga majburiy o'tish" mantiqini qo'sh.
8. [C] gen-processor.ts runVideo ~5 daq fon poll — Render restart'da job "running"da qotadi.
   Eng kami: "running" job belgilangan vaqtdan oshsa → failed + refundAiCredits (qotmasin).
   Yaxshiroq: Generation.params.videoJobId (OpenRouter video id) saqlab, keyingi polling/reconciler
   bilan davom ettir.

Tekshiruv: tsc EXIT 0; node --check; install-cep; AE'da Video → prompt → 5s/16:9 → Generate →
video chiqib AE'ga import bo'lsin. SESSION-REPORT yangila. Commit qilma.
```

---

## 🟠 BOSQICH 4 — SFX (Freepik adapter + webhook)

```
Loyiha: AssetFlow. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 4). Manba: docs/FREEPIK-API-ANALYSIS.md.
OpenRouter SFX/music'ni qamramaydi → Freepik /v1/ai/sound-effects (async + webhook).

Vazifa: SFX generatsiyasini Freepik orqali ishlat.

1. apps/api/src/lib/ai/freepik.ts yarat: BASE=https://api.freepik.com, KEY=FREEPIK_API_KEY,
   header x-freepik-api-key. isFreepikConfigured(). fpSoundEffects(prompt, webhookUrl) →
   POST /v1/ai/sound-effects {prompt, webhook_url} → data.task_id. Async naqsh
   (CREATED→IN_PROGRESS→COMPLETED|FAILED).
2. Webhook handler POST /api/ai/freepik-webhook (express.raw — HMAC-SHA256 imzo tekshir:
   webhook-id.webhook-timestamp.rawBody, secret=FREEPIK_WEBHOOK_SECRET).
   COMPLETED → generated[0] URL'ni DARHOL R2'ga ko'chir (vaqtinchalik URL) → GenAsset → 
   Generation.status="done". FAILED → refundAiCredits.
3. gen-models.ts: GenModel'ga provider?: "openrouter"|"freepik" maydoni qo'sh; SFX modeli
   (mode:"sfx", provider:"freepik"). gen-processor.ts: model.provider==="freepik" → Freepik
   adapter; task_id ni Generation.params.freepikTaskId ga sakla (webhook topishi uchun).
4. Plugin: aiGenerate() dan if(media==='sfx'){aiSoon();return;} OLIB TASHLA; aiStudioMode ga
   sfx qo'sh; SFX'ni Studio Gen oqimiga ula (davomiylik param: 3s/5s/10s).
5. render.yaml + .env.example: FREEPIK_API_KEY, FREEPIK_WEBHOOK_SECRET (sync:false).

Tekshiruv: tsc EXIT 0; node --check; install-cep; AE'da SFX → "portlash ovozi" → Generate →
audio chiqsin (Freepik kaliti env'da bo'lsa). SESSION-REPORT yangila. Commit qilma.
```

---

## 🟡 BOSQICH 5 — UI yetuklik + ikki-tizim tozalash [D]

```
Loyiha: AssetFlow. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 5).

Vazifa: Panelni professional darajaga yetkaz.

1. Enhance prompt tugmasi: backend bor (/api/studio/gen/prompt/enhance). Composer'ga ✨ tugma
   qo'sh → promptni boyitib textarea'ga qaytarsin (kreditsiz).
2. Generatsiya tarixi (gallery): /gen/sessions/:id/generations bor. Sidebar grid — har natija
   Download / Sevimli / Qayta / "Input qilib ishlatish".
3. Job holatlari aniq: queued→running→done; video uchun progress matni yaxshilansin.
4. Model selektor: video/sfx kataloglari ham yuklansin (aiLoadModels barcha studio mode'lar uchun).
5. [D] Ikki tizim tozalash: plugin'da AI_ENDPOINT (taxminan 4110) eski routes/ai.ts (/api/plugin/ai)'ga
   ishora qiladi — faqat /search ishlatiladi. /search'ni studio-gen'ga ko'chir, AI_ENDPOINT'dan
   keraksiz yo'llarni olib tashla, eski routes/ai.ts'ni qisqart (Workers AI qoldiqlari).

Tekshiruv: tsc EXIT 0; node --check; install-cep; har media end-to-end AE test;
fail bo'lganda kredit qaytishini tekshir. SESSION-REPORT yangila. Commit qilma.
```

---

## 🟢 BOSQICH 6 — Polish (ixtiyoriy, keyin)

```
Loyiha: AssetFlow. Reja: docs/REJA-AI-TOOLS-100.md (Bosqich 6). Har sub-band ALOHIDA sessiya/commit.

Tanlab bajariladigan ishlar (ustuvorlik bo'yicha):
1. SSE job status (polling o'rniga) — video uzun bo'lgani uchun. Mavjud SSE infra ustiga.
2. Image upscale + remove-bg (Freepik /v1/ai/image-upscaler, /beta/remove-background) — yangi mode.
3. Video first/last frame (i2v keyframe) + kamera preset'lari (Higgsfield naqshi).
4. Template-grounded AI (docs/ANALIZ-higgsfield-ai-tools.md §3): "shu shablon uchun" gen +
   placeholder auto-fill — AssetFlow ustunligi.

Har biri: o'qi → minimal diff → tsc/node --check → install-cep → AE test → SESSION-REPORT.
Commit FAQAT so'ralganda.
```

---

*Tartib: 1 (kalit+health) → 2 (TTS) → 3 (video) → 4 (SFX) → 5 (yetuklik+tozalash) → 6 (polish).*
*Har bosqich mustaqil test qilinadi va alohida commit bo'ladi.*
