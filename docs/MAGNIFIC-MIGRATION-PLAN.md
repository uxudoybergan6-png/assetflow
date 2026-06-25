# Magnific Migration Plan — Studio Gen AI to'liq almashtirish + Stock content

> **Holat:** REJA (1-bosqich tahlil) · kod o'zgartirilmagan · tasdiq kutilmoqda · sana 2026-06-21
> Manba: multi-agent read-only tahlil (A1 server arxitektura, A2 plugin UI, M1 Magnific spek + dimensiyalar B mapping, C kredit/narx, D stock, E webhook/polling, F xavf/olib-tashlash) + adversarial critic. Faqat kod- va spek-tasdiqlangan faktlar; noma'lumlar **ochiq savol** sifatida belgilangan (§9).
> **Bu hujjat reja referensi — joriy holat EMAS.** Kod-tasdiqlangan haqiqat manbai: `docs/PROJECT-STATUS.md`.

---

## 0. Qisqacha xulosa (TL;DR)

- **O'zgaradi:** AI gen provayder qatlami (`openrouter.ts` + ElevenLabs SFX) → yangi `magnific.ts` adapteri. Rasm (Mystic), video (Kling i2v), SFX (sound-effects), describe (image-to-prompt), enhance (improve-prompt) Magnific'ga ko'chadi. Yangi bonus funksiyalar: upscale, expand, relight, style-transfer, remove-bg, icon, music. Yangi **Stock content** tab (Magnific Resources/Icons/Videos).
- **Saqlanadi (TEGILMAYDI):** kredit infratuzilmasi (`consumeAiCredits`/`refundAiCredits`), cost-quote imzo (`gen-quote.ts`), job lifecycle skeleton (`gen-processor`), R2/signed-URL (`s3.ts`), auth, katalog (Contributor→Admin→AE), va — **KRITIK** — Workers AI embedding (`aiEmbed` bge-m3, 1024-dim) #11 semantik qidiruv uchun.
- **Eng katta 3 qaror/xavf:**
  1. **Magnific'da embedding YO'Q** → Workers AI'ni "to'liq o'chirish" #11 pgvector qidiruvni buzadi. **Tavsiya: Workers AI'ni embedding-only qisqartirish** (nol migratsiya, nol reindex).
  2. **Magnific'da TTS/voiceover YO'Q** → ElevenLabs (yoki OpenRouter kokoro) voiceover qatlamini saqlash. Migratsiya amalda **aralash-provayder** bo'ladi (Magnific = rasm/video/SFX/+, OR yoki ElevenLabs = TTS, Workers AI = embedding).
  3. **Aniq COGS narxlar noma'lum** (Mystic/video/audio) → marjani tasdiqlab bo'lmaydi; **video** va **upscale-8x** eng yuqori zarar xavfi. Jonli pricing + "1 kredit = ? EUR" (Stripe tarif) belgilanishi shart.

> **Migratsiya naqshi:** provayder qatlami `GEN_PROVIDER=openrouter|magnific` env-flag bilan blue-green almashadi (P0 dormant → P1 canary). Kredit/quote/job provayder-agnostik bo'lgani uchun rollback ~1 daqiqada (env qaytar + restart).

---

## 1. Mavjud Studio Gen arxitektura xaritasi

### 1.1 Operatsiyalar inventari

| Operatsiya | Provayder / model | Fayl → funksiya | Tashqi endpoint |
|---|---|---|---|
| Rasm gen (text-to-image) | OpenRouter (gemini/seedream/flux/grok) | `gen-processor.ts` → `orImage` | `POST /chat/completions` (modalities) |
| Image-edit (reference) | OpenRouter | `gen-processor.ts` → `orImageEdit` | `POST /chat/completions` |
| Text-to-video | OpenRouter (veo) | `runVideo` → `orVideoCreate`+poll | `POST /videos` → `GET /videos/:id` |
| Image-to-video | OpenRouter (kling/seedance/wan) | `runVideo` (`frame_images`) | `POST /videos` |
| Voiceover / TTS | OpenRouter (kokoro) | `orSpeech` | `POST /audio/speech` (RAW mp3) |
| SFX | **ElevenLabs** | `elSoundEffects` | `POST /v1/sound-generation` (RAW mp3) |
| describe (rasm/video→prompt) | OpenRouter (gemini-2.5-flash vision) | `studio-gen.ts /gen/describe` → `orImageToPrompt` | `POST /chat/completions` (vision) |
| enhance (prompt) | OpenRouter (gpt-4o-mini) | `/gen/prompt/enhance` → `orChatSys` | `POST /chat/completions` |
| **Semantik qidiruv** | **Workers AI** (`@cf/baai/bge-m3`) | `ai.ts /search` → `aiEmbed` + pgvector | `POST ai/run/@cf/baai/bge-m3` |
| **reindex/backfill** | **Workers AI** | `embed-templates.ts` → `aiEmbed` | `POST ai/run/@cf/baai/bge-m3` |
| (o'lik) plugin `/image`,`/voiceover` | Workers AI (zaxira) | `ai.ts` → `aiGenerateImage`/`aiGenerateSpeech` | flux-schnell / melotts |

### 1.2 Kredit/job oqimi

**Kredit oqimi (cost-quote → consume → refund):**
1. `/gen/cost-quote` → `computeGenCost` narx → `genParamsHash` (reference URL'lar hashdan chiqariladi) → `signCostQuote({modelId,mode,price,ph})` (JWT, 15 daq).
2. `/gen` → `verifyCostQuote` — mos kelmasa `400 BAD_QUOTE`, **kredit yechilmaydi**.
3. `consumeAiCredits(userId, price)` — atomik `updateMany WHERE aiCredits>=cost` (race-safe), oylik reset, ADMIN cheksiz. Yetmasa `402`.
4. Job xato → `fail()` → `status:"failed"` + `refundAiCredits`. Stuck joblar → `reconcileStuckGenerations` (10 daq) ham refund qiladi.

**Job lifecycle:** `POST /gen` → reconcile → guard'lar → `verifyCostQuote` → `consumeAiCredits` → `Generation.create(status:"queued")` → `processGenerationInBackground` (concurrency 2) → `processGeneration`: feature router → provayder chaqiruv → `persist()` (R2 + signed URL) → `GenAsset` → `status:"done"`. `GET /gen/:jobId` har safar signed URL qayta imzolaydi.

**Prisma modellari:** `GenSession`, `Generation` (id=jobId, modelId, params, status, cost), `GenAsset` (type 130 image / 120 audio / 140 video, resultKey), `AiGeneration` (eski `ai.ts` audit logi).

### 1.3 Provayder-bog'liq vs provayder-agnostik chegarasi

| ALMASHTIRILADI (provayder-spetsifik) | SAQLANADI (provayder-agnostik) |
|---|---|
| `openrouter.ts` (to'liq) | `plugin-profile.ts` (consume/refund) |
| `elevenlabs.ts` SFX (voiceover saqlanadi) | `gen-quote.ts` (signCost/verifyCost/paramsHash) |
| `gen-processor.ts` feature router chaqiruvlari (~192-255) | `gen-processor` skeleton (status mashina, persist, reconcile, concurrency) |
| `gen-models.ts` `key`/`cost`/`provider` qiymatlari | `computeGenCost`/`resolveVideoParams`/`resolveImageCount` |
| `studio-gen.ts` provayder guard'lari | `studio-gen.ts` route shakllari, zod, sessiya egalik, signed-URL |
| Workers AI gen/zaxira (`aiGenerateImage`/`aiGenerateSpeech`) | **Workers AI embedding** (`aiEmbed`, `detectMediaFormat`, `isAiConfigured`) |
| | `s3.ts` (upload/signed-URL/exists) |

---

## 2. Operatsiya → Magnific endpoint mapping

| # | Operatsiya | Hozirgi | Magnific endpoint | Moslik | Izoh |
|---|---|---|---|---|---|
| 1 | Rasm gen | OR `orImage` | `POST /v1/ai/mystic` → poll | ✅ | `aspect_ratio` enum remap (`16:9`→`widescreen_16_9`); `resolution` `1k/2k/4k`; `count` → **N parallel task** (Mystic 1 natija/chaqiruv); `filter_nsfw` majburiy true. ⚠️ **Partial-fail xavfi — pastdagi izoh.** |
| 2 | Image-edit / rang | OR `orImageEdit` | `POST /v1/ai/mystic` + `style_reference`/`structure_reference` | 🟡 | Ikki ref kanali (uslub: `style_reference`+`adherence`+`hdr`; shakl: `structure_reference`+`structure_strength`). Aniq instruct-edit yo'q → `image-style-transfer`/`image-relight` muqobil |
| 3 | Text-to-video | OR veo | `POST /v1/ai/text-to-video/{model}` (wan/ltx) | 🟡 | Paramlar TASDIQLANMAGAN. T2V kam → kerak bo'lsa Mystic→i2v ikki bosqich |
| 4 | Image-to-video (start) | OR kling/seedance | `POST /v1/ai/image-to-video/kling-v2-6-pro` → poll | ✅ start / 🟡 end | `duration` faqat `'5'/'10'` (string) klamp; `aspect_ratio` 3 enum. **End kadr: Kling v2.6'da `last_frame` YO'Q** → §3.2 da `endFrame:false` (QB-1) |
| 5 | Multi-shot | har shot → `/gen` | har shot → i2v task | ✅ | UI ketma-ketlik saqlanadi; duration/aspect klamp har shotga |
| 6 | **Voiceover/TTS** | OR kokoro | **❌ YO'Q** | ❌ | M1 §2 verbatim inkor. GAP-B → OR/ElevenLabs saqlanadi |
| 7 | SFX | ElevenLabs | `POST /v1/ai/sound-effects` → poll | ✅ | `text`/`duration_seconds` 0.5–22/`prompt_influence` 0.3. ⚠️ RAW → async task→`generated[url]` kontraktga o'tish |
| 8 | describe (rasm→prompt) | OR vision | `POST /v1/ai/image-to-prompt` → poll | ✅ | Faqat 1 rasm; strukturali STYLE:/SCENE: format yo'qoladi (textarea baribir ishlaydi) |
| 9 | describe (video→prompt) | OR vision (video_url) | **❌ YO'Q** | ❌ | GAP-C → OR vision saqlanadi |
| 10 | enhance (text) | OR gpt-4o-mini | `POST /v1/ai/improve-prompt` → poll | ✅ text / 🟡 json | `type`∈{image,video}; **JSON structured format YO'Q** → OR `orChatSys` jsonMode saqlanadi yoki JSON tugma o'chadi |
| 11 | **Semantik qidiruv** | Workers AI bge-m3 + pgvector | **❌ YO'Q** | ❌ | GAP-A (KRITIK). `/v1/resources` Magnific O'Z stokida, vektor bermaydi |
| 12 | Upscale (hozir disabled) | — | `POST /v1/ai/image-upscaler` | ✅ YANGI | `scale_factor` 2x/4x/8x/16x; param nomlari TASDIQLANMAGAN; PREMIUM |
| 13 | Extend (hozir disabled) | — | `POST /v1/ai/image-expand/flux-pro` → poll | ✅ YANGI | `image`+`left/right/top/bottom` 0–2048 px |
| 14 | Relight | — | `POST /v1/ai/image-relight` | ✅ YANGI | €0.10/op |
| 15 | Style-transfer | — | `POST /v1/ai/image-style-transfer` | ✅ YANGI | €0.10/op; #2 muqobili |
| 16 | Remove-BG | — | `POST /v1/ai/beta/remove-background` | 🟡 YANGI | ⚠️ SINXRON, task_id YO'Q, URL **5 daq** → darrov R2 |
| 17 | Text-to-Icon | — | `POST /v1/ai/text-to-icon` | ✅ YANGI | SVG export AE uchun qimmatli |
| 18 | Music | — | `POST /v1/ai/music-generation` | ✅ YANGI | `music_length_seconds` 10–240; bo'sh slot to'ldiriladi |
| 19 | (eski) plugin `/image`,`/voiceover` | Workers AI | image→Mystic; voiceover→❌ | 🟡/❌ | Asosan dead; olib tashlanadi |
| 20 | AI-detection (moderatsiya) | — | `POST /v1/ai/classifier/image` (SINXRON) | ✅ YANGI ixt. | Contributor shabloni AI-mi; admin oqimi, kreditsiz |

> ⚠️ **#1 Partial-success COGS xavfi (QB-3):** `count>1` bo'lsa N ta parallel Magnific task yuboriladi. Agar ba'zilari fail bo'lsa, mavjud `processGeneration` skeleton **butun job'ni fail + to'liq refund** qiladi — foydalanuvchi himoyalangan (0 natija → 0 kredit), LEKIN muvaffaqiyatli task'larning Magnific COGS'i AssetFlow zarariga yoziladi. Variantlar: **(a) MVP'da `count=1` ga qotirib qo'yish (eng xavfsiz, tavsiya)**, (b) qisman natija + proporsional refund (skeleton refaktori kerak). Ochiq savol #6 hal bo'lguncha **count=1**.

### ❌ KRITIK GAP'lar

**(a) Embeddings — KRITIK.** `embeddingVec Unsupported("vector(1024)")` + HNSW indeks bge-m3 1024-dim'ga **qattiq bog'langan**. Magnific embedding bermaydi.
- **Variantlar:** V1 — Workers AI'ni embedding-only saqlash (**0 migratsiya, 0 reindex**); V2 — OpenAI 1536-dim (ustun migratsiya + barcha force-reindex + downtime); V3 — Cohere 1024-dim (o'lcham mos, lekin vektor fazosi boshqa → baribir force-reindex).
- **Tavsiya: V1.** `workers-ai.ts`ni ikkiga bo'lish — `aiEmbed`+`detectMediaFormat`+`isAiConfigured` saqlanadi, gen/zaxira o'chadi. `ai.ts /search,/reindex` butunlay **tegilmaydi**.

**(b) Voiceover/TTS — Magnific'da YO'Q.**
- **Variantlar:** V1 — OpenRouter `orSpeech` (kokoro) saqlash (bitta klient qoladi); V2 — ElevenLabs TTS qatlamiga ko'chirish; V3 — music ≠ voiceover (qoplamaydi); V4 — voiceover'ni butunlay tashlash.
- **Tavsiya: V1 yoki V2** — funksiya yo'qolmaydi. Migratsiya amalda aralash-provayder bo'ladi.

**(c) Video-to-prompt — Magnific image-to-prompt faqat rasm.**
- **Variantlar:** V1 — vakil kadr → image-to-prompt (temporal kontekst yo'qoladi); V2 — OpenRouter vision saqlash (`kind:'video'` shoxi OR'da qoladi); V3 — video describe olib tashlash.
- **Tavsiya: V2** agar OR baribir voiceover uchun saqlansa — bepul qo'shimcha, temporal kontekst saqlanadi.

---

## 3. Kredit / narx dizayni

### 3.1 Mavjud langarlar (TEGILMAYDI)

| Langar | Qiymat |
|---|---|
| FREE oylik kredit | 50 |
| PRO oylik kredit | 1000 |
| ADMIN | cheksiz |
| Helper narx | enhance=1, describe-image=2, describe-video=3; kunlik cap=80 |

Joriy shkala: rasm 5–8 kr, TTS 3 kr, SFX 4 kr, video 10–40 kr/s. **Bu shkala saqlanadi** (kredit = ichki birlik, EUR emas).

### 3.2 `gen-models.ts` qayta dizayn

**ID sxemasi saqlanadi:** 1xxx rasm, 2xxx ovoz, 3xxx video, 4xxx audio, **5xxx yangi bonus edit**. Yangi maydonlar: `provider:"magnific"`, `endpoint`, `cogsEur?` (faqat marja paneli uchun, narxga kirmaydi), `costModel?:"fixed"|"perSecond"|"perScale"`.

| id | mode | endpoint | feature | cost (kr) | costModel | izoh |
|---|---|---|---|---|---|---|
| 1001 | image | `ai/mystic` (realism) | text-to-image | 6 | fixed×count | isDefault |
| 1002 | image | `ai/mystic` (super_real) | text-to-image | 8 | fixed×count | |
| 1003 | image | `ai/mystic` (fluid) | text-to-image | 6 | fixed×count | ⚠ fluid faqat 5 aspect |
| 1101 | image | `ai/mystic` (style_reference) | image-edit | 7 | fixed | reference oqimi |
| 2001 | voice | **ElevenLabs/OR (Magnific EMAS)** | text-to-speech | 3 | fixed | ⚠ TTS gap (b) |
| 4001 | sfx | `ai/sound-effects` | text-to-sfx | 4 | fixed | durations[3,5,10] |
| 4002 | music | `ai/music-generation` | text-to-music (yangi) | 8 | fixed/perSecond | 10–240s |
| 3001 | video | `ai/image-to-video/kling-v2-6-pro` | image-to-video | 12 | perSecond | TASDIQLANGAN; `'5'/'10'`; **`endFrame:false`** |
| 3002 | video | `ai/image-to-video/kling-o1-pro` | image-to-video | 18 | perSecond | ⚠ end-kadr TASDIQLANMAGAN → boshda `endFrame:false` |
| 3003 | video | `ai/.../veo-3-1` | text-to-video | 40 | perSecond | flagman |
| 3004 | video | `ai/.../veo-3-1-fast` | text-to-video | 20 | perSecond | |
| 5001 | image | `ai/image-upscaler` | image-upscale | 6/12/**≥25** | **perScale** | €0.10/0.20/**0.50** TASDIQLANGAN (8x marja — §3.3) |
| 5002 | image | `ai/image-expand/flux-pro` | image-expand | 6 | fixed | |
| 5003 | image | `ai/image-relight` | image-relight | 8 | fixed | €0.10 |
| 5004 | image | `ai/image-style-transfer` | image-style | 8 | fixed | €0.10 |
| 5005 | image | `ai/beta/remove-background` | remove-bg | 3 | fixed | ⚠ sinxron, 5-daq URL |
| 5006 | image | `ai/text-to-icon` | text-to-icon | 4 | fixed | |
| 5007 | (admin) | `ai/classifier/image` | ai-detect | 0 | sinxron | moderatsiya, kreditsiz |

> ⚠️ **QB-1 — End-kadr qarori:** P2 da BARCHA end-kadr qo'llaydigan video modellar (3001-3004) **`endFrame:false`** bilan boshlanadi. End-kadr funksiyasi faqat Kling O1 paramlari jonli OpenAPI'da tasdiqlangach (ochiq savol #5) alohida model entry sifatida yoqiladi. Oraliqda UI end-kadr slotini **ko'rsatmaydi** (`gen-models.ts` `endFrame` flagiga tayanadi — A2 `aiAttachRef`). Aks holda: foydalanuvchi end-kadr biriktiradi → cost-quote imzolanadi → kredit yechiladi → Magnific e'tiborsiz qoldiradi/fail → refund + yomon UX (kredit-aylanish).

**`computeGenCost` o'zgarishi:** video perSecond + image fixed×count **AYNAN saqlanadi**; yagona yangi shox — upscaler `perScale` (`{2:6, 4:12, 8:≥25}` jadval, §3.3 marja). `EMBED_MODEL` o'lik konstanta olib tashlanadi.

### 3.3 COGS → marja

Tasdiqlangan COGS: upscale 2x/4x/8x = €0.10/0.20/0.50, relight/style = €0.10. **Misol (1 kr ≈ €0.02 farazida):** relight 8 kr ≈ €0.16 vs €0.10 → marja +37% ✅; **upscale 8x 20 kr ≈ €0.40 vs €0.50 → MANFIY** ❌ → narx **≥25 kr** ko'tarilishi shart (jadvalda aks ettirilgan).

Noma'lum COGS (ochiq savol #4): Mystic 1k/2k/4k, barcha video (Kling/Veo/Seedance/Hailuo/Wan — **eng katta marja xavfi**), SFX/music/audio-isolation, image-to-prompt/improve-prompt/icon/remove-bg/expand. Stock download narx noma'lum; cap kuniga 100 (non-Enterprise).

### 3.4 cost-quote imzo — O'ZGARMAYDI

`signCostQuote`/`verifyCostQuote` mantig'i **1:1 saqlanadi** (`modelId`+`mode`+`price`+`ph` provayderdan mustaqil). `genParamsHash` ehtiyot:
- har yangi **reference-param** (`structureReference`, `styleReference`, `lightmap`, `referenceImage`) `genParamsHash` ichida `delete priced[...]` ro'yxatiga **QO'SHILISHI SHART** (narxga ta'sir qilmaydi, hashdan chiqarilishi kerak);
- har yangi **narx-param** (`scale_factor`, `music_length_seconds`) hashda **qoladi**.

> ❗ **QB-2 (eng xavfli tuzoq):** yangi reference-param `genParamsHash`ga qo'shilmasa, cost-quote (referencesiz hash) va `/gen` (reference bilan hash) **farq qiladi → har generatsiya `400 BAD_QUOTE`** → funksiya **butunlay ishlamaydi** ("rasm gen ishlamayapti, sababini topa olmayapman" debug tuzog'i). Bu §8 P1/P3 qabul mezonining **majburiy** qismi.

**Model ID'larni saqlash tavsiya etiladi** — eski imzolar TTL (15 daq) ichida buzilmasdan ishlaydi.

### 3.5 Admin marja paneli (tavsiya)

Magnific Analytics API (`team-credit-usage`) haqiqiy COGS manbai. Yangi `GET /api/admin/ai-margin`: `Generation.cost` DB yig'indisi (model bo'yicha) − Magnific COGS → marja; manfiy marjada qizil flag. Magnific balans past bo'lsa gen to'xtatuvchi guard (massa-refund oldini olish).

---

## 4. Stock content feature dizayni

**Asosiy qaror:** Stock = **download** (sinxron, kredit/job YO'Q), AI gen EMAS. Analog: mavjud katalog→pack download (`consumeDownload`), AI Studio emas. #11 embedding va gen provayderiga ortogonal.

### 4.1 Backend — yangi `apps/api/src/routes/stock.ts` → `/api/plugin/stock`

| Route | Vazifa | Magnific proxy |
|---|---|---|
| `GET /search` | qidiruv+filtr+pagination | `GET /v1/resources` (`kind=icon/video` → `/v1/icons`,`/v1/videos`) |
| `GET /:kind/:id` | metadata | `GET /v1/{...}/{id}` |
| `POST /:kind/:id/download` | litsenziya+limit gate → R2 → signed URL | `GET /v1/{...}/{id}/download[/{format}]` |

Barcha route `requireAuth` (USER). `MAGNIFIC_API_KEY` **faqat server** (M1: server-to-server only, CEP'ga hech qachon yuborilmaydi). Magnific maydon nomlari TASDIQLANMAGAN → bitta `mapMagnificResource()` adapterda izolyatsiya qilinadi (ochiq savol #11).

> **K-2 — auth merosi:** Stock route'lar mavjud `requireAuth` middleware'ini **aynan qayta ishlatadi** — u `tokenVersion`/token-revoke tekshiradi (full-audit #5), shuning uchun stock ham avtomatik meros oladi. Yangi auth mantig'i **yozilmaydi**.

### 4.2 Download oqimi
1. License **server tomonda** Magnific'dan qayta o'qiladi (klient `license`ga ishonilmaydi — paywall bypass himoyasi, full-audit #1 naqshi).
2. `premium` + FREE → `403 PRO_REQUIRED`; aks holda `consumeDownload` (FREE 15/oy, PRO cheksiz, ADMIN bypass).
3. Asset Magnific'dan olinadi → R2'ga deterministik kalit `stock/{kind}/{id}.{ext}` (idempotent `s3ObjectExists`, `CacheControl: immutable`).
4. `getSignedDownloadUrl(3600)` qaytariladi → klient `aiImportMedia` (mavjud import yo'li).

> ⚠️ Magnific ba'zi URL **5 daq** amal qiladi → URL klientga to'g'ridan BERILMAYDI, doim R2'ga ko'chiriladi.

### 4.3 UI — yangi `#stockPage` + sidebar "Stock" qatori
Mavjud composer/grid CSS (`cmp-searchbar`, `cmp-filterpanel`, katalog kartochka grid) qayta ishlatiladi. Qidiruv bar + filtr (orientation/color/license/order) + preview grid + pagination. Premium kartalarda "PRO" rozetka (FREE → upgrade toast). Import: `stockImport(item)` → download endpoint → signed URL → **mavjud** `aiImportMedia` → `importMediaFromPath` JSX. **Yangi JSX yo'q.**

> "Stock Footage" (Motion browse sub-kategoriya labeli) ≠ yangi "Stock" tab — adashtirmaslik.

### 4.4 Kredit/litsenziya
Stock **AI-kredit ishlatmaydi** — `consumeDownload`ga bog'lanadi (download semantikasi). FREE resurs → download yo'liga qo'shiladi; premium → faqat PRO. R2 kesh Magnific 100/kun cap'ni himoya qiladi. Atributsiya: `StockDownload` audit modeli (MVP+1). Bandwidth: faqat birinchi download Render orqali (server-to-server R2 ko'chirish, `uploadFileToS3` stream); keyin klient to'g'ridan R2/CDN.

> **K-4 — ikki marta hisoblash YO'Q:** Stock import FAQAT `consumeDownload` gate'idan o'tadi; `consumeImport` (katalog pack/MOGRT uchun) stock'ga **qo'llanilmaydi**. Bu P4 qabul mezonida tekshiriladi.

---

## 5. Webhook vs polling tavsiyasi

| Mezon | Polling (mavjud) | Webhook (HMAC) |
|---|---|---|
| Implementatsiya | Past (`orVideoStatus`→`magnificTaskStatus` almashtirish) | O'rta-yuqori (route+raw-mount+HMAC+`providerTaskId` migratsiya+persist refaktor) |
| Render cold-start | ⚠️ instance tirikligiga tayanadi | ✅ push uyg'otadi, lekin spin-up kechikishi |
| Resurs sarfi | Yuqori (poll loop band) | Past (push kelguncha uxlaydi) |
| Kod hajmi | Minimal | Katta |

**Render cold-start:** ~5 daq video poll'lari odatda 15 daq idle-oynadan kichik → polling **P1 uchun yetarli xavfsiz**; instance uzilsa `reconcileStuckGenerations` (10 daq) refund qiladi (natija yo'qoladi, kredit qaytadi). Webhook instance uxlashiga ruxsat beradi (push uyg'otadi), lekin klient baribir `GET /gen/:jobId` bilan tortadi.

**Tavsiya:**
- **P1-P4: pollingni saqla** — Magnific kontrakti (`POST`→`{task_id,status}`→poll→`generated[]`) mavjud skeletonga aynan mos. Schema/route o'zgarishsiz, eng kam diff.
- **P5 (ixtiyoriy): webhook additive qo'sh** — `providerTaskId` migratsiya + `POST /api/studio/gen/webhook` Stripe namunasiga 1:1 (raw-body mount `express.json`'dan oldin, `{webhook-id}.{ts}.{body}` HMAC-SHA256 base64 verify + `timingSafeEqual`, `webhook-id` dedup, `task_id→Generation` lookup, idempotent persist, har doim `200`). Poll zaxira bo'lib qoladi; persist idempotent (`status:"running"` shartli updateMany).

Sinxron istisnolar (har ikki bosqichda poll/webhook'siz): `remove-background` (5 daq URL), `classifier` (sinxron massiv).

> ⚠️ **K-3 — bitta Magnific kalit = global RPM byudjet:** barcha oqimlar (gen poll har 3s × concurrency 2, `count×N` parallel rasm task, stock `/search`, describe/enhance) **bitta** `MAGNIFIC_API_KEY`ni bo'lishadi → **50 RPM/key** (M1 §7) global cheklov. Mitigatsiya: server-tomon Magnific so'rovlariga umumiy throttle/queue (`p-limit`); `429` → eksponensial backoff retry; poll intervalini 3s'dan oshirmaslik. `GEN_CONCURRENCY` (default 2) + poll RPM birga hisoblanishi shart (ochiq savol #12).

---

## 6. Olib tashlash ro'yxati + Workers AI embeddings taqdiri (KRITIK)

| Element | Taqdir | Sabab |
|---|---|---|
| `openrouter.ts` (to'liq) | **O'CHIRILADI** (yoki TTS/json-enhance/video-describe niche saqlanadi) | gen chaqiruvlari → Magnific; `orEmbed` allaqachon o'lik |
| `elevenlabs.ts` | **SAQLANADI (voiceover)** yoki SFX→Magnific | Magnific TTS yo'q |
| `workers-ai.ts` gen qismi (`aiGenerateImage`, `aiGenerateSpeech`, `AI_MODELS.image/text/tts`) | **O'CHIRILADI** | faqat eski `ai.ts /image,/voiceover` ishlatadi |
| `workers-ai.ts` embedding (`aiEmbed`, `isAiConfigured`, `detectMediaFormat`, `AI_MODELS.embed`) | **❗ SAQLANADI** | #11 pgvector yagona manba; `detectMediaFormat` gen-processor ham ishlatadi |
| `ai.ts /image`,`/voiceover` | **O'CHIRILADI** | UI bormaydi |
| `ai.ts /search`,`/reindex`,`/estimate` | **SAQLANADI** | semantik qidiruv + kredit hisob |
| `AiGeneration` model | **SAQLANADI** | `/search` SEARCH-tipli yozuvlar uchun (K-6) |
| `gen-processor` chaqiruvlari | **ALMASHTIRILADI** (skeleton saqlanadi) | provayder qatlami |
| `gen-models.ts` `key`/`cost`/`provider` | **YANGILANADI** (ID saqlanadi) | `EMBED_MODEL` o'lik → olinadi |
| Env `OPENROUTER_API_KEY` | O'CHIRILADI (TTS/niche saqlanmasa) | |
| Env `ELEVENLABS_API_KEY` | SAQLANADI (voiceover qaroriga ko'ra) | |
| Env `CF_AI_TOKEN`, `CF_ACCOUNT_ID`, `AI_MODEL_EMBED` | **❗ SAQLANADI** | embedding guard; o'chsa `/search` 503 |
| Env `MAGNIFIC_API_KEY` (+webhook secret) | QO'SHILADI | server-only |

**Workers AI embeddings (tavsiya = V1 embedding-only qisqartirish):** `embeddingVec(1024)` bge-m3'ga qattiq bog'langan; saqlash = nol migratsiya, nol reindex. `detectMediaFormat` bonus. #11 ishlab turibdi (backfill qilingan). "Magnific'ga to'liq ko'chish" *gen provayderiga* taalluqli — embedding gen EMAS, alohida qatlam, qo'l tegmaydi. `isAiConfigured` umumiy guard bo'lgani uchun **o'chirilmaydi** — faqat gen funksiyalari olinadi.

> **K-6 — `AiGeneration` taqdiri:** model SAQLANADI (`/search` SEARCH-tipli yozuvlar uchun). `/image`,`/voiceover` o'chgach, eski IMAGE/VOICEOVER yozuvlari yetim qoladi (zararsiz, tarixiy log).

---

## 7. Migratsiya xavflari + production-buzilmaslik + rollback

### 7.1 Xavflar → mitigatsiya

| Xavf | Mitigatsiya |
|---|---|
| Deploy paytida `queued`/`running` joblar | `reconcileStuckGenerations` (mavjud) → failed+refund avtomatik |
| Kredit izchillik | TEGILMAYDI; **shart:** Magnific adapter xatoda `{ok:false}` qaytarishi (refund kontrakti) |
| Eski cost-quote imzolar (ID o'zgarsa) | Xavfsiz buziladi (`400 BAD_QUOTE`, kredit yechilmaydi). **Model ID saqlansa** TTL ichida ishlaydi |
| **`genParamsHash` yangi reference-param (QB-2)** | reference-param `delete priced[...]`ga qo'shilmasa → **har gen BAD_QUOTE**. P1/P3 majburiy tekshiruvi (§3.4, §8) |
| Plugin eski model ID | `getModelById`+`isModelEnabled` guard → `400` consume'dan OLDIN |
| Reference semantikasi (`referenceMode`/`endFrame`) | qiymatlar saqlanadi. ⚠️ Kling v2.6 end-kadr bermaydi → `endFrame:false` (QB-1) |
| **count>1 partial-fail COGS zarari (QB-3)** | MVP'da `count=1`; keyin proporsional refund (skeleton refaktori) |
| SFX duration clamp | Magnific 0.5–22 ≈ ElevenLabs; `prompt_influence` 0.4→0.3 kosmetik |
| remove-bg/classifier sinxron | poll-mashinani chetlab alohida adapter + darrov R2 |
| 50 RPM/key global limit (K-3) | server-tomon `p-limit` throttle + 429 backoff |

### 7.2 Production buzilmaslik kafolati

Pul (consume/refund), cost-quote imzo, guardDownloadable/signed-URL, auth (`requireAuth` USER/ADMIN + `tokenVersion` revoke, Magnific kalit server-only), CSP, **pgvector #11** (Variant 1 bilan), katalog (Contributor→Admin→AE), describe/enhance kredit+cap (audit #4) — **HECH BIRI buzilmaydi** (provayder qatlamidan mustaqil). Har deploy A smoke-test (`/health` + `/api/plugin/catalog`) bilan tasdiqlanadi.

### 7.3 Rollback — ENV-FLAG blue-green

`GEN_PROVIDER=openrouter|magnific` (default `openrouter`):
- **P0:** adapter yoziladi, flag dormant — deploy xavfi nol.
- **P1+ (canary):** `GEN_PROVIDER=magnific` — muammo → env qaytar + restart (~1 daq). Eng tez rollback.
- **P5:** N kun stabil → `openrouter.ts` o'chiriladi, flag olinadi.

Kredit/quote/job provayder-agnostik → almashganda kredit yo'qolmaydi/ikki marta yechilmaydi. Model ID barqarorligi imzo TTL oynasini himoya qiladi. Embedding saqlangani DB rollback'ni keraksiz qiladi.

---

## 8. Bosqichli implementatsiya rejasi

Har bosqich **mustaqil deploy + test**. Har bosqich oxirida smoke-test: **`/health` + `/api/plugin/catalog` + bitta real gen + kredit hisobi (consume/refund) + R2 saqlash**.

### P0 — Adapter skeleton + ENV-flag (dormant)
- **Maqsad:** `magnific.ts` adapter + `GEN_PROVIDER` flag (default `openrouter`), `isMagnificConfigured()` guard. Hech qaysi yo'l hali Magnific'ga o'tmaydi.
- **Fayllar:** yangi `apps/api/src/lib/ai/magnific.ts`; `gen-processor.ts` (flag o'qish); env `MAGNIFIC_API_KEY`.
- **Qabul mezoni:** flag `openrouter`'da barcha mavjud gen ishlaydi; `magnific`'da `isMagnificConfigured` tekshiriladi.
- **Test/rollback:** eski yo'l aktiv — regression nol. Rollback: yangi fayl olib tashlash.

### P1 — Mystic (rasm gen + image-edit) + polling
- **Maqsad:** rasm gen va image-edit Magnific Mystic'ga; polling skeleton saqlanadi.
- **Fayllar:** `magnific.ts` (`mystic` create+poll, `mapAspectRatio`), `gen-processor.ts` (text-to-image/image-edit shoxi), `gen-models.ts` (1001-1101 endpoint/provider, ID saqlanadi), `gen-quote.ts` (`genParamsHash` reference-param).
- **Qabul mezoni:**
  - `GEN_PROVIDER=magnific` da rasm gen → R2 saqlanadi, kredit yechiladi, xatoda refund;
  - **❗ (QB-2)** `gen-quote.ts:genParamsHash` `delete priced[...]` ro'yxatiga `styleReference`/`structureReference` qo'shildi. Tekshiruv: cost-quote so'rovi va keyingi `/gen` so'rovi (reference biriktirilgan holatda) **bir xil `ph`** beradi — `BAD_QUOTE` qaytmaydi;
  - **(QB-3)** `count=1` (MVP) — partial-fail COGS zarari yo'q.
- **Test:** canary flag → bitta real rasm gen + reference bilan gen (BAD_QUOTE yo'qligini tasdiqlash).
- **Rollback:** `GEN_PROVIDER=openrouter`.

### P2 — Video (image-to-video / Kling)
- **Maqsad:** i2v Kling v2-6-pro; `runVideo` poll → `magnificTaskStatus`.
- **Fayllar:** `magnific.ts` (video create+poll), `gen-processor.ts` `runVideo`, `gen-models.ts` (3001-3004; **`endFrame:false`** — QB-1).
- **Qabul mezoni:** i2v → mp4 R2'da, duration `'5'/'10'` klamp, perSecond narx to'g'ri; **end-kadr modellar `endFrame:false` — UI end-kadr slotini ko'rsatmaydi**; poll timeout → reconcile refund.
- **Test:** bitta real video (8s) + poll timeout + reconcile refund.
- **Rollback:** flag.

### P3 — describe/enhance + SFX/music + bonus edit
- **Maqsad:** describe→`image-to-prompt`, enhance→`improve-prompt`, SFX→`sound-effects`, music→`music-generation`; bonus: upscale/expand/relight/style/icon (5xxx). remove-bg/classifier sinxron shox.
- **Fayllar:** `magnific.ts` (yangi endpointlar + sinxron shox), `studio-gen.ts` (vision/enhance model), `gen-processor.ts` (sinxron router), `gen-models.ts` (4001-4002, 5001-5007), `computeGenCost` (perScale shox), `gen-quote.ts` (`lightmap`/`referenceImage` reference-param — QB-2).
- **Qaror:** video-describe va JSON-enhance → OpenRouter saqlanadi (GAP-C/B); voiceover ElevenLabs/OR saqlanadi.
- **Qabul mezoni:**
  - describe/enhance kredit+cap ishlaydi (audit #4 buzilmaydi); SFX async kontrakt;
  - **(QB-2)** P3 reference-param (`lightmap`/`referenceImage`) `genParamsHash`ga qo'shildi — BAD_QUOTE yo'q;
  - **(§3.3)** upscale 8x narx ≥COGS (ochiq savol #7 hal bo'lgach); remove-bg 5-daq URL darrov R2.
- **Test:** har yangi tool uchun bitta gen + kredit + R2.
- **Rollback:** flag (eski tool'lar OR'da).

### P4 — Stock content
- **Maqsad:** stock qidiruv/download/import.
- **Fayllar:** yangi `stock.ts` + `mapMagnificResource()`; `index.ts` mount; `AssetFlow_Plugin.html` (`#stockPage`, sidebar, `stockImport`).
- **Qabul mezoni:**
  - qidiruv→grid; download license **server-tomon** gate (premium→PRO) + `consumeDownload` + R2 kesh; import AE'ga; `MAGNIFIC_API_KEY` yo'q → `503` graceful;
  - **(K-4)** import FAQAT `consumeDownload` — `consumeImport` qo'llanilmaydi (ikki marta hisoblash yo'q);
  - **(K-2)** `requireAuth` revoke merosi tekshiriladi.
- **Test:** free + premium download, FREE bypass bloklangani, R2 idempotent kesh.
- **Rollback:** route mount olib tashlash (mustaqil prefiks, boshqa hech narsaga tegmaydi).

### P5 — Eski provayder tozalash + ixtiyoriy webhook
- **Maqsad:** N kun stabil → `openrouter.ts` gen qismi o'chadi, `OPENROUTER_API_KEY` (niche saqlanmasa) olinadi; Workers AI embedding-only; flag olinadi. Ixtiyoriy: webhook (§5 dizayn).
- **Fayllar:** `openrouter.ts` (o'chish), `workers-ai.ts` (gen funksiyalar o'chadi, embedding qoladi), `ai.ts` (`/image`,`/voiceover` o'chadi); (webhook) schema `providerTaskId`, `studio-gen.ts /gen/webhook`, `index.ts` raw-mount.
- **Qabul mezoni:**
  - **(K-1)** `workers-ai.ts`dan FAQAT `aiGenerateImage`/`aiGenerateSpeech` + `AI_MODELS.image/text/tts` o'chadi; `aiEmbed`/`isAiConfigured`/`detectMediaFormat`/`AI_MODELS.embed` **qoladi**. `tsc` build + `gen-processor` import zanjiri buzilmagani tekshiriladi; **`/search` smoke-test deploy'dan KEYIN majburiy**;
  - gen Magnific'da; semantik qidiruv (`/search`) ishlaydi (embedding tegilmagan);
  - **(K-5, webhook)** `providerTaskId String?` **nullable** qo'shiladi (mavjud qatorlarga ta'sir yo'q, backfill shart emas) + `@@index`; migratsiya polling'ni buzmaydi (polling bu maydonni o'qimaydi); HMAC verify + dedup + idempotent persist.
- **Test:** `/search` smoke + gen smoke + (webhook) test event.
- **Rollback:** git revert; embedding tegilmagani uchun DB rollback yo'q.

---

## 9. Ochiq savollar / foydalanuvchi qarori kerak

1. **Embeddings qarori** — V1 (Workers AI embedding-only saqlash) / V2 (boshqa provayder + migratsiya+reindex). **Tavsiya: V1** (nol migratsiya, #11 buzilmaydi).
2. **Voiceover taqdiri** — V1 OpenRouter kokoro saqlash / V2 ElevenLabs TTS / V4 butunlay tashlash. **Tavsiya: V1 yoki V2** (funksiya yo'qolmaydi).
3. **1 AssetFlow kredit = ? EUR** (Stripe tarif) — marjasiz hisob imkonsiz. **Eng muhim.**
4. **Aniq COGS** — Mystic (1k/2k/4k), video (Kling/Veo/Seedance/Hailuo/Wan), SFX/music. **Video eng katta marja xavfi.** Jonli pricing sahifasidan.
5. **Kling O1 first/last_frame (end-kadr)** — param/yo'l TASDIQLANMAGAN (404). End-kadr funksiyasini qaysi modelda yoqish jonli OpenAPI'dan. (Oraliqda `endFrame:false`.)
6. **Mystic `count` semantikasi** — bitta task ko'p natija beradimi yoki count×task (count×COGS)? Partial-fail uchun MVP `count=1`; narx to'g'riligi uchun tasdiq kerak.
7. **Upscale 8x marja** — €0.50 mavjud shkalada zarar; #3 hal bo'lgach narx ≥25 kr.
8. **Webhook vaqti** — P1-P4 polling yetarli; webhook qachon (instance free qolsa / video uzaysa / concurrency bottleneck / 50 RPM bosim)?
9. **Stock kredit narxi + limit** — `consumeDownload`ga bog'lash (tavsiya) + Magnific 100/kun cap'ni AssetFlow tomonda gate qilish.
10. **Video-to-prompt** — V2 (OR vision saqlash, temporal kontekst) / V1 (vakil kadr → Magnific) / V3 (olib tashlash). **Tavsiya: V2** agar OR saqlansa.
11. **Resources/Icons/Videos query+response field nomlari** + download oqimi (JSON-url vs redirect) — TASDIQLANMAGAN, jonli OpenAPI/Postman'dan (adapter `mapMagnificResource()`da izolyatsiya).
12. **Rate-limit jadval ziddiyati** — Magnific docs ichida `/ratelimits.md` (50 RPM/key + 3 servis kunlik cap) repo doc raqamlariga (per-servis kunlik) zid; `GEN_CONCURRENCY` va poll intervaliga ta'sir — implementatsiyadan oldin tasdiq.

---

*Bu reja multi-agent read-only tahlil + adversarial critic asosida tuzilgan. Implementatsiya boshlanishidan oldin §9 ochiq savollar (ayniqsa #1 embeddings, #2 voiceover, #3 kredit=EUR) hal qilinishi shart. Kod o'zgartirilmagan — tasdiq kutilmoqda.*
