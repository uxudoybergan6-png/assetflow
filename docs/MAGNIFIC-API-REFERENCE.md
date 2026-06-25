# Magnific API — Integratsiya uchun to'liq reference

*Manba: docs.magnific.com (llms-full.txt + asosiy sahifalar), 2026-06 da ajratilgan.*
*Maqsad: Studio Gen AI ni butunlay Magnific bilan almashtirish + Stock content qo'shish.*

> **HOLAT:** Reja/reference. Implementatsiya bosqichma-bosqich (pastdagi rejaga qara).

---

## 0. Yuqori daraja

Magnific'da **2 ta mahsulot** bor:
1. **AI / B2B API** (`/v1/ai/...`) — AI tools (Mystic, upscaler, video, icon, classifier...). Job-asosli, status enum `CREATED / IN_PROGRESS / COMPLETED / FAILED`.
2. **Stock content / Resources API** (`/v1/resources`, `/v1/icons`) — Freepik bazasi, sinxron, paginatsiyali.
3. (Enterprise-only: `/v1/ai/apps` — bizga kerak emas.)

---

## 1. Auth & asoslar

- **Base URL:** `https://api.magnific.com` (hamma yo'l `/v1/...`)
- **Header:** `x-magnific-api-key: <KEY>` (faqat **server-to-server** — kalit hech qachon plaginga chiqmaydi)
- **Kalit:** `magnific.com/developers/dashboard`
- **Webhook secret:** alohida, `magnific.com/developers/dashboard/api-key`

```
curl -H "x-magnific-api-key: YOUR_API_KEY" https://api.magnific.com/v1/resources
```

---

## 2. Async/job model (deyarli barcha AI tools)

1. **POST** create endpoint → `{ "data": { "task_id": "<uuid>", "status": "CREATED" } }`
2. **Poll** `GET /v1/ai/{tool}/{task-id}` YOKI `webhook_url` ber
3. `status === "COMPLETED"` bo'lsa → `data.generated[]` (rasm URL'lar) yoki `video_url`

Status: `CREATED → IN_PROGRESS → COMPLETED → FAILED`
Natija URL'lari vaqtinchalik — darrov yuklab olib R2'ga saqlash kerak.

---

## 3. AI tools — endpointlar

### Mystic (text-to-image, flagman)
- `POST /v1/ai/mystic` · `GET /v1/ai/mystic/{task-id}` · `GET /v1/ai/mystic` · `GET /v1/ai/loras`
- Output: PNG, `resolution`: `1k`/`2k`(default)/`4k`
- Asosiy params: `prompt`, `webhook_url`, `aspect_ratio` (square_1_1, widescreen_16_9, social_story_9_16, ...), `model` (`realism`(default)/`fluid`/`zen`/`flexible`/`super_real`/`editorial_portraits`), `engine` (`automatic`/`magnific_illusio`/`magnific_sharpy`/`magnific_sparkle`), `creative_detailing` (0–100), `fixed_generation` (bool), `filter_nsfw` (default true), `structure_reference`/`style_reference` (base64), `styling` (styles/characters/colors)

### Creative Upscaler (PREMIUM)
- `POST /v1/ai/image-upscaler` (+ GET by-id/list)
- `image` (base64, req), `scale_factor` `2x`/`4x`/`8x`/`16x`, `optimized_for` (standard/soft_portraits/...), `creativity`/`hdr`/`resemblance`/`fractality` (−10..10), `engine`
- Cheklov: output ≤ 25.3M piksel. Narx: piksel maydoni bo'yicha (masalan 640×480→2x = €0.10)
- Variantlar: Precision V1/V2 (sodiq super-res), Video Upscaler

### Image-to-Video
- Pattern: `POST /v1/ai/image-to-video/{model}` → `video_url`
- **Kling v2:** `POST /v1/ai/image-to-video/kling-v2` — `image` (req, ≤10MB, ≥300×300, aspect 1:2.5–2.5:1), `duration` `5`/`10` (req), `prompt`, `negative_prompt`, `cfg_scale` (0–1, def 0.5). **3 concurrent/user.**
- Boshqa modellar: Kling v2.1/2.5/3/O1, Veo 3.1, Runway Gen4, WAN 2.5/2.6, LTX 2.0, MiniMax, PixVerse, Seedance...

### Icon generation
- `POST /v1/ai/text-to-icon` · `/preview` · `/{task-id}/render/{png|svg}`
- `prompt` (req), `webhook_url` (req), `style` (solid/outline/color/flat/sticker), `format` (png/svg)

### Boshqa AI tools
- **Relight** `POST /v1/ai/image-relight` (€0.10/op)
- **Style Transfer** `POST /v1/ai/image-style-transfer` (€0.10/op)
- **Expand/outpaint** `POST /v1/ai/image-expand/{flux-pro|ideogram|seedream-v4-5}`
- **Change Camera** `POST /v1/ai/image-change-camera`
- **Ideogram Inpainting** `POST /v1/ai/ideogram-image-edit`
- **Remove Background** `POST /v1/ai/...remove-background`
- **Image-to-Prompt** `POST /v1/ai/image-to-prompt`
- **Improve Prompt** `POST /v1/ai/improve-prompt`
- **Sound Effects** `POST /v1/ai/sound-effects`
- **AI Classifier** `POST /v1/ai/classifier/image` (SINXRON, no poll) → `{class_name: ai|not_ai, probability}`

---

## 4. Stock content / Resources API (assets muammosi)

### Resources search — `GET /v1/resources` (sinxron, paginatsiyali)
- Query: `term` (qidiruv), `page` (1–100), `limit`, `order` (relevance/recent)
- `filters` (deepObject): `orientation`, `content_type` (photo/psd/vector), `license` (freemium/premium), `color`, `period`, `ai-generated`, `vector.{type,style}`, `psd.type`, `people.{...}`, `ids`
- Response: `data[]` (har biri `id`, `title`, `url`, `licenses[]`, `image.source.url`, `author`, `meta.available_formats{jpg,png,svg,ai,eps,psd,zip,...}`) + `meta` (pagination)
- Qo'shimcha: `GET /v1/resources/{id}`, download endpoint, **videos** va **templates** kataloglari

### Icons (stock, AI emas)
- `GET /v1/icons` (qidiruv) · `GET /v1/icons/{id}` · `GET /v1/icons/{id}/download`

---

## 5. Webhooks (polling o'rniga, tavsiya etiladi)

- Ro'yxatga olish: har so'rovda `webhook_url` (global endpoint yo'q)
- Payload: GET javobi kabi, lekin `data` field'siz
- Xavfsizlik headerlari: `webhook-id`, `webhook-timestamp`, `webhook-signature`
- Imzo: `"{webhook_id}.{webhook_timestamp}.{body}"` → **HMAC-SHA256 → base64**
- Header format: `v1,sig1 v2,sig2` (rotatsiya uchun ko'p imzo)

---

## 6. Narx / kredit / rate limit

- **Model:** pay-per-use (EUR), oylik billing, budjet cap dashboard'da. Invoice keyingi oy 5-sanasida.
- **Ma'lum narxlar:** Relight €0.10, Style Transfer €0.10, Upscaler piksel bo'yicha (640×480→2x €0.10, →8x €0.50)
- **Premium tier:** upscaler kabi tools faqat premium (bizda bor)
- **Rate limit (Free/Premium RPD):** mystic 125/6000, upscaler 125/30000, kling-v2 5/50, videos 100/2500, icons 25/2500, images-templates 50/1000
- **Per-IP:** 50/s (5s burst), 10/s (2 min sustained)
- **Concurrency:** Kling 3/user

---

## 7. Xatolar

- `{ "message": "..." }` yoki RFC-7807 `{message, invalid_params[]}`
- 400 (validatsiya), 401 (kalit), 403 (premium gating), 404, 429 (rate), 500, 503
- **Tavsiya:** 503'da exponential backoff retry

---

## 8. Integratsiya uchun muhim

- **Fayl kiritish:** ko'p tools — HTTPS URL **yoki** base64 (`format: byte`). Sifat uchun: original rasmni URL bilan yubor (re-encode qilma)
- **Max o'lcham:** Ideogram/Seedream input 10MB; Kling image ≤10MB
- **Output:** Mystic→PNG, Upscaler→URL, Icon→PNG/SVG, Video→mp4 URL
- **Determinizm:** `seed` yoki Mystic `fixed_generation:true`. Idempotency key YO'Q (dublikat POST = dublikat job)
- **SDK yo'q** — plain HTTP (axios). OpenAPI spec yuklab olinadi
- **MCP server** (`mcp.magnific.com`, OAuth) — bu AI assistantlar uchun; bizning integratsiya REST API orqali

---

## 9. Web-app tools → API mosligi (qaysi tool ko'chiriladi)

> Tekshirilgan: `docs.magnific.com/api-reference` (REST endpoint bor) vs `magnific.com/ai/docs` (faqat web UX).

### ✅ To'liq API-ko'chiriladigan (to'g'ridan chaqiriladi)
| Tool | Endpoint |
|---|---|
| Image Generator | `POST /v1/ai/mystic` (+ Flux/Seedream/Z-Image/RunWay) |
| Image Upscaler | `POST /v1/ai/image-upscaler` (Creative + Precision) |
| Skin Enhancer | `POST /v1/ai/skin-enhancer/{creative\|faithful\|flexible}` |
| Change Camera | `POST /v1/ai/image-change-camera` |
| Remove Background | `POST /v1/ai/beta/remove-background` |
| Relight (image) | `POST /v1/ai/image-relight` |
| Video Generator | `POST /v1/ai/image-to-video/{model}` & `/text-to-video/{model}` |
| Video Upscaler | `POST /v1/ai/video-upscaler` |
| Speak (talking video) | `POST /v1/ai/lip-sync/latent-sync` (+ OmniHuman, RunWay Act Two) |

Bonus (ro'yxatda yo'q, lekin bor): Style Transfer, Image Expand, Reimagine Flux, Image-to-Prompt, Improve Prompt, Sound Effects, Music Generation, Audio Isolation, Classifier, Stock (resources/icons/videos).

### 🟡 Qisman — operatsiyalar API'да, lekin "tool" composite/canvas UX
- **Image Editor** — inpaint/Seedream edit/Flux Kontext/expand alohida endpointlar; bitta "editor" chaqiruvi yo'q
- **Assistant** — bir nechta endpoint ustidagi chat qobig'i; MCP orqali agentlarга, lekin bitta REST endpoint emas

### ⛔ Faqat web (API endpoint YO'Q — bitta chaqiruv bilan ko'chirib bo'lmaydi)
- **Cinematic Shot** — Mystic + kinematik prompt bilan taqlid qilinadi
- **Variations** — Mystic + structure/style reference yoki seed bilan
- **Mockup Generator** — template/canvas editor, endpoint yo'q
- **Clip Editor** — video trim/cut UX, endpoint yo'q
- **Video Project Editor** — multi-clip timeline, endpoint yo'q (assembly klient tomonда)
- **Video Relight** — noaniq (faqat image-relight bor; VFX qoplashi mumkin)

### Asosiy xulosa
Web app'ning **per-rasm/video AI operatsiyalari** (generate, upscale, skin, relight, remove-bg, change-camera, lip-sync) — hammasi **toza bitta-chaqiruvli REST endpoint** → to'liq quriladi. Ko'chirib **bo'lmaydigani** — **editor/canvas/timeline/chat UX** (Image Editor, Clip Editor, Video Project Editor, Mockup Generator, Assistant) va ba'zi **preset'lar** (Cinematic Shot, Variations) — bularni plagin o'zi workflow sifatida qayta qurishi kerak.
