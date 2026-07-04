# AI generatsiya pipeline auditi — model↔provider parametr mosligi (statik)

> **Sana:** 2026-07-04 · **Metod:** STATIK kod+hujjat auditi (jonli provider chaqiruvi YO'Q).
> **Yo'l:** plagin param builder (`AssetFlow_Plugin.html`) → `POST /gen` (`studio-gen.ts`) →
> `gen-quote.ts` (imzolangan narx) → `gen-processor.ts` → provider adapter → provider so'rov tanasi.
> **Haqiqat manbalari:** fal — `docs/FAL-DOCS-MODELS.md`/`FAL-DOCS-CORE.md`/`FAL-API-NOTES.md`;
> Vertex — adapter kodi (`vertex-image.ts`, `vertex-omni.ts`, `vertex.ts`) + katalogdagi jonli-sinov izohlari.
> **Pul zonasi (consume/refund, signCostQuote, atomik decrement, webhook idempotency) O'ZGARTIRILMADI** — faqat o'qildi.

## Xulosa

| Verdict | Soni | Modellar |
|---|---|---|
| **PASS** | 9 | Nano Banana 2, Nano Banana Pro, Imagen 4, Imagen 4 Ultra, Gemini Omni Flash, Seedance 2.0 Fast, Seedance 2.0 R2V, ElevenLabs SFX, (Veo mapping'lari — pastdagi izoh bilan) |
| **FIXED** | 4 | Nano Banana 2 Lite (resolutions cap), Veo 3.1 Lite / Fast / Standard (end-kadr guard — umumiy fix) |
| **NEEDS-CONFIRMATION** | 1 | Kokoro TTS (OpenRouter kaliti jonlimi — env holati statik tekshirilmaydi) |

Enabled modellar: **13** (5 rasm vertex-image · 3 video Veo vertex · 1 video vertex-omni · 2 video fal Seedance · 1 ovoz OpenRouter · 1 SFX ElevenLabs).

**Topilgan va tuzatilgan mosliksizliklar:**
1. **End-kadr boshlang'ich kadrsiz indamay tashlanardi** (Veo `endFrame:true` modellar): plagin faqat
   Yakuniy kadr qo'yishga ruxsat berardi; `runVertexVideo` SDK cheklovi (lastFrame i2v-only) sabab uni
   tashlab yuborar, foydalanuvchi to'lab "end"siz video olardi. → `/gen` KREDITDAN OLDIN 400
   `END_FRAME_REQUIRES_START` + plagin guard (commit `ea031c5`).
2. **Nano Banana 2 Lite `resolutions` deklaratsiyasiz edi** — plagin `quality` qiymatini oldingi
   tanlangan modeldan meros qilardi (stale). Model faqat 1K (2K=400 jonli sinov). → `resolutions:["1K"]`
   (commit `88bf250`). (Adapter `cleanSize` himoyasi sabab provider xatosi chiqmasdi — endi deklarativ.)

---

## Umumiy oqim tekshiruvi (barcha modellar)

- **Imzo/hash:** plagin cost-quote va /gen ga AYNAN bir xil `params` yuboradi; `genParamsHash`
  `referenceUrl/referenceUrls/referenceEndUrl`ni chiqaradi (narxga ta'sir qilmaydi) — `imageUrls/videoUrls/audioUrls`
  hashda QOLADI (R2V ×0.6 videoref-multiplikator narxga ta'sir qiladi) ✅.
- **Param gigiyenasi:** `resolveVideoParams` duration/resolution/aspect'ni model ro'yxatiga klamplaydi —
  provider hech qachon ro'yxatdan tashqari qiymat olmaydi ✅.
- **Referens o'qilishi:** Vertex yo'llarida referens HAR DOIM inline base64 ga aylantiriladi
  (`refToInline`/`refUrlToInlineImage`) — signed URL muddati provider uchun ahamiyatsiz ✅. fal yo'lida
  data-URI → R2 public URL (`materializeRefUrl`) — fal tashqaridan yuklab oladi ✅.
- **Model o'chirilgan bo'lsa:** `isModelEnabled` guard /gen va cost-quote'da kreditdan OLDIN ✅.

---

## RASM (provider: vertex-image → `vertex-image.ts`)

Adapter kontrakti: Imagen → `generateImages({config:{numberOfImages:1, aspectRatio, imageSize}})`;
Nano Banana (gemini-*-image) → `generateContent({config:{responseModalities:["IMAGE"], imageConfig:{aspectRatio, imageSize}}})`,
edit → referenslar TARTIBDA inlineData part'lar + prompt. `cleanAspect` "auto"→tushiriladi; `cleanSize` faqat 1K/2K/4K o'tkazadi.
Plagin params: `{aspectRatio, quality, count, referenceUrl, referenceUrls}` → processor `imageConfig.aspect_ratio/image_size` → adapter.

| Model (id) | refKind/maxRefs | aspect → provider | quality → provider | count | Verdict |
|---|---|---|---|---|---|
| Nano Banana 2 (1010) `gemini-3.1-flash-image` | image-edit / 10 (plagin cheklaydi; server slice qilmaydi — pastda izoh) | 8 NANO nisbat → `imageConfig.aspectRatio` (jonli sinov 16:9→2752×1536) | 1K/2K/4K → `imageConfig.imageSize`; narx qualityCost 4/8/16 = imgSettings.cost ✅ | 1–4 → processor N×chaqiruv, narx unit×N ✅ | **PASS** |
| Nano Banana 2 Lite (1013) `gemini-3.1-flash-lite-image` | image-edit / 10 | 8 NANO nisbat ✅ | FAQAT 1K — `resolutions:["1K"]` QO'SHILDI (stale meros tuzatildi); narx tekis 2 ✅ | 1–4 ✅ | **FIXED** |
| Nano Banana Pro (1014) `gemini-3-pro-image` | image-edit / 10 | 8 NANO nisbat ✅ | 1K/2K/4K; narx 8/14/24 ("TAXMINIY" deb belgilangan — pul zonasi, tegilmadi) | 1–4 ✅ | **PASS** |
| Imagen 4 (1011) `imagen-4.0-generate-001` | **none** (t2i-only — to'g'ri: adapter edit'ni Imagen'ga yubormaydi; /gen referens bilan 400 REFERENCE_NOT_SUPPORTED, plagin ref-UI yashiradi `maxRefs=0→refOk=false`) ✅ | 5 IMAGEN nisbat → `config.aspectRatio` ✅ | 1K/2K → `config.imageSize` (Imagen 4 max 2K — to'g'ri cap) ✅ | 1–4 → `numberOfImages:1` × N ✅ | **PASS** |
| Imagen 4 Ultra (1012) `imagen-4.0-ultra-generate-001` | none ✅ | 5 nisbat ✅ | 1K/2K ✅ | 1–4 ✅ | **PASS** |

Izoh (fix EMAS): server `vertexRefUrls`ni `maxRefs`ga slice qilmaydi — UI 10 bilan cheklaydi, to'g'ridan
API chaqirig'ida ko'proq inline rasm o'tishi mumkin (Gemini kontrakti keng, xavf past).

## VIDEO — Veo (provider: vertex → `vertex.ts`)

Adapter kontrakti: `generateVideos({model, prompt, image?, config:{aspectRatio, durationSeconds, generateAudio, resolution, lastFrame?, outputGcsUri}})` → poll → GCS → bizning bucket (S3-moslik) ✅.
Plagin params: `{referenceUrl, referenceEndUrl, resolution, duration, aspectRatio, audio}`; kadrlar `/gen/ref-upload` → R2 URL → processor inline base64 → SDK `imageBytes` ✅ (provider o'qiy oladi).

| Model (id) | Katalog cap | Provider maydoni | Tekshiruv | Verdict |
|---|---|---|---|---|
| Veo 3.1 Lite (3001) `veo-3.1-lite-generate-001` | frames (derive), endFrame:true, 16:9/9:16, 720p, 4/6/8s, audio:false | aspectRatio/durationSeconds/resolution/generateAudio/lastFrame | duration "8"(string)→Number→klamp ✅; end-kadr endi startsiz bloklanadi (fix) | **FIXED** (guard) |
| Veo 3.1 Fast (3002) `veo-3.1-fast-generate-001` | + 1080p | xuddi shu | submit→poll→GCS smoke-test o'tgan (2026-07-01) | **FIXED** (guard) |
| Veo 3.1 (3003) `veo-3.1-generate-001` | + 1080p, audio:true (audioDefault) | xuddi shu | generateAudio:true default ✅ | **FIXED** (guard) |

Ochiq (jonli tasdiqlash kerak, pastdagi ro'yxatda): 9:16×1080p kombinatsiyasi; Lite model ID jonli gen.

## VIDEO — Gemini Omni Flash (3010, provider: vertex-omni → `vertex-omni.ts`)

Adapter kontrakti (jonli probe 2026-07-01): `POST .../locations/global/interactions`
`{model, input, response_format:{type:"video",aspect_ratio}?}`; rasm `{type:"image",data,mime_type}` inline;
video `{type:"video", uri:gs://|data:base64}`; **video input bilan response_format YUBORILMAYDI (400)** ✅ katalog `aspectIgnoredWithVideoRef:true` bilan halol.

| Cap | Provider haqiqati | Verdict |
|---|---|---|
| refKind media-refs {image:3, video:2, audio:0, total:3} | rasm inline base64 (slice 0..3); video inline ≤15MB (gs:// cross-loyiha ishlamaydi — adapter izohi); katta video aniq xato ✅; audio ref YO'Q — adapter qabul qilmaydi, limit 0 halol ✅ | PASS |
| 720p / 10s QAT'IY, audio DOIM | resolution/duration/audio API'ga YUBORILMAYDI (parametr yo'q) — katalog 720p/[10]/audioLocked shuni aks ettiradi ✅ | PASS |
| pricing per-generation 80 | computeGenCost flat 80 (duration×EMAS) ✅ | PASS |

Izoh (fix EMAS): server per-tur slice (3 rasm + 2 video) qiladi, lekin `total:3`ni alohida tekshirmaydi —
UI total'ni cheklaydi; total=3 provider limiti ekani tasdiqlanmagan (jonli tekshiruvsiz teginmadik).

**Verdict: PASS**

## VIDEO — fal Seedance (provider: fal → `fal.ts`; hozir ZAXIRA provider)

fal mexanikasi `FAL-DOCS-CORE`ga mos: queue.fal.run, `Authorization: Key`, webhook+poll, CDN→R2 ✅.
Seedance 2.0 sxemalari FAL-DOCS-MODELS (2026-06-24 yig'imi)da YO'Q — mapping 2026-06-27 jonli productionda tasdiqlangan (memory/sessiya hisobotlari), kod deklaratsiyadan quriladi (`buildFalVideoInput`).

| Model (id) | fal input kalitlari | Tekshiruv | Verdict |
|---|---|---|---|
| Seedance 2.0 Fast (3101) `bytedance/seedance-2.0/fast/image-to-video` | `image_url`(MAJBURIY — refMode:required + `videoRequiresStartFrame` ✅), `end_image_url`(endFrame ✅), `resolution`(480p/720p), `duration`(string), `aspect_ratio`("Auto"→klamp→"auto" ✅), `generate_audio` | perSec 8/12 res bo'yicha; kadr URL public R2 ✅ | **PASS** |
| Seedance 2.0 R2V (3102) `bytedance/seedance-2.0/reference-to-video` | `image_urls`≤9 / `video_urls`≤3 / `audio_urls`≤3, jami ≤12 (server tekshiradi ✅), audio-ref uchun ≥1 rasm/video invariant ✅, `bitrate_mode`, `end_user_id` | 480p/720p/1080p/4k perSec 8/15/34/60; video-ref ×0.6 multiplikator narx hashda ✅; 50MB xatosi foydalanuvchi tiliga o'giriladi ✅ | **PASS** |

Agar `FAL_KEY` env'dan olib tashlansa — /gen toza 503 `AI_NOT_CONFIGURED` (kredit yechilmaydi) ✅.

## OVOZ / SFX

| Model (id) | Yo'l | Tekshiruv | Verdict |
|---|---|---|---|
| Kokoro TTS (2001) `hexgrad/kokoro-82m` | plagin `{voice}` → `orSpeech` → OpenRouter `/audio/speech {model, input, voice, response_format:"mp3"}` | voice bo'sh bo'lsa default `af_bella` fallback ✅; LEKIN provider OpenRouter — infra endi Vertex-asosli, `OPENROUTER_API_KEY` jonliligi statik tasdiqlanmaydi (yo'q bo'lsa 503, kredit yechilmaydi) | **NEEDS-CONFIRMATION** |
| ElevenLabs SFX (4001) | plagin `{duration}` (3/5/10) → `elSoundEffects` → `POST /v1/sound-generation {text, prompt_influence, duration_seconds}` (0.5–22 klamp ✅) | maydon nomlari/diapazon adapter kontraktiga mos; narx flat 4 ✅ | **PASS** |

## Dormant (enabled:false) — audit qilinmadi, faqat qayd

fal/OpenRouter rasm avlodi (1001–1110), Magnific tool'lar (1201–1206), fal'ga ulanmagan video (3004–3007).
Bularga /gen 400 "Noma'lum yoki o'chirilgan model" — kredit yechilmaydi ✅. Qayta yoqishdan oldin
FAL-DOCS-MODELS bilan qayta tasdiqlash shart (narx/sxema eskirgan bo'lishi mumkin, doc 2026-06-24).

---

## Faqat AE'da JONLI tekshirish mumkin bo'lganlar (foydalanuvchi ro'yxati)

1. **Veo 9:16 + 1080p** kombinatsiyasi (Fast/Standard) — Google bu juftlikni rad etishi mumkin; katalog UI'da ochiq.
2. **Veo 3.1 Lite** (`veo-3.1-lite-generate-001`) — ID foydalanuvchi havolasi bilan tasdiqlangan, lekin jonli gen smoke-test faqat Fast'da o'tgan.
3. **Veo start+end kadr interpolatsiya** — lastFrame yo'li kod bo'yicha to'g'ri, jonli natija sifati/qabul qilinishi tekshirilmagan.
4. **Nano Banana Pro 4K** — katalog izohida "4K e2e'da tasdiqlanadi" deb qolgan.
5. **Kokoro TTS** — OPENROUTER_API_KEY jonliligi (bitta arzon TTS gen yetadi).
6. **Omni video-referens** (≤15MB inline) — jonli workflow 2026-07-01 tasdiqlagan, lekin Cloud Run'dagi joriy envda qayta tekshirish foydali.
7. **Seedance Fast/R2V** (fal zaxira) — FAL_KEY hali envda bo'lsa, har biriga 1 kichik gen (narx/sxema 2026-06-27 dan beri o'zgarmaganini tasdiqlash).
8. **END_FRAME_REQUIRES_START** yangi guard — AE'da faqat Yakuniy kadr qo'yib Generate bosilganda plagin toast ko'rsatishi.

*Yozildi: 2026-07-04 (statik audit, jonli chaqiruvsiz).*
