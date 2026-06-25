# Magnific API — to'liq tahlil + AssetFlow mapping

*Manba: docs.magnific.com (llms-full.txt + jonli docs), 2026-06-19. Maqsad: AssetFlow'ni OpenRouter'dan Magnific API'ga ko'chirish ("Hammasi Magnific'ga").*

> **Asosiy xulosa:** Magnific API async kontrakti (POST → `task_id` → poll `GET /{task-id}` → `status:"COMPLETED"` → `data.generated[]`) AssetFlow'ning mavjud **job + polling** arxitekturasiga aynan mos. Ya'ni `openrouter.ts` → `magnific.ts` adapter almashadi, gen-processor/quote/credit/UI o'zgarmaydi.

---

## 0. GLOBAL (migratsiya uchun eng muhim)

| Narsa | Qiymat |
|------|--------|
| **Base URL** | `https://api.magnific.com` |
| **Auth** | header `x-magnific-api-key: YOUR_API_KEY` — **server-to-server only** (CEP plugin'da EMAS, faqat `apps/api` Render env'da). Kalit: magnific.com/developers/dashboard |
| **Async naqsh** | `POST` → `task_id` qaytadi → `GET /{path}/{task-id}` poll, yoki `webhook_url` |
| **Status maydoni** | `status` — enum: `CREATED` · `IN_PROGRESS` · `COMPLETED` · `FAILED` |
| **Natija** | `data.generated[]` (URL massivi); video'da `video_url`/`generated[0]` |
| **Javob konverti** | `{ "data": { "task_id", "status", "generated": [...] } }` |
| **Asset URL** | vaqtinchalik (≈12 soat) → R2'ga yuklab qayta-host qilish (AssetFlow allaqachon `persist`/`materializeRefUrl` qiladi) |
| **Polling** | 1-chi poll'dan oldin 2-3s, keyin har 3-5s |
| **Xato** | 400/401/500/503 — 503'da exponential backoff |

**Webhook:** POST → `webhook_url`; payload = GET javobi (`data` wrappersiz: `task_id`,`status`,`generated`). Xavfsizlik header'lari: `webhook-id`, `webhook-timestamp`, `webhook-signature` (HMAC-SHA256, base64; string = `"{id}.{timestamp}.{body}"`).

**Narx:** pay-per-use, kredit; har generatsiya model+rezolyutsiya+(video)davomiylik bo'yicha. Aniq raqamlar: magnific.com/api/pricing. **COGS — tannarx**, AssetFlow foydalanuvchi kreditlari bilan solishtirib marja tekshirilsin.

**Rate limit:** 50 req/s burst (5s), 10 req/s avg (2-min). Per-service kunlik (Free/Premium): Mystic 125/6000, image-to-prompt 125/30000, improve-prompt 125/30000, **lip-sync 20/300 (past — navbatga qo'y)**, Kling O1 5/50, Seedream 4.5 500/500.

---

## 1. IMAGE GENERATION — Mystic (flagman) + Flux/Seedream/Z-Image/Runway

**Endpoint:** `POST /v1/ai/mystic` · `GET /v1/ai/mystic/{task-id}` · `GET /v1/ai/loras` (style/character ro'yxati)

**Asosiy paramlar (Mystic):**
- `prompt` (inline `@character_name::strength` qo'llaydi)
- `model` — `realism`(def) · `fluid` · `zen` · `flexible` · `super_real` · `editorial_portraits`
- `resolution` — `1k` · `2k`(def) · `4k`
- `aspect_ratio` — `square_1_1`, `classic_4_3`, `traditional_3_4`, `widescreen_16_9`, `social_story_9_16`, `standard_3_2`, `portrait_2_3`, `social_5_4`, `social_post_4_5` ... (fluid cheklangan)
- `structure_reference` (base64) + `structure_strength` (0-100)
- `style_reference` (base64) + `adherence`, `hdr` (0-100)
- `creative_detailing` (0-100), `engine` (`automatic`/`magnific_illusio`/`magnific_sharpy`/`magnific_sparkle`)
- `styling`: `styles[]` (LoRA, `/v1/ai/loras`'dan), `characters[]`, `colors[]` (≤5 hex+weight)
- `fixed_generation` (seed-like), `filter_nsfw`(def true), `webhook_url`
- ⚠️ reference'ni **URL yoki raw base64** sifatida yubor — `canvas.toDataURL` 8-20% sifat yo'qotadi.

**Modellar:** Mystic sub-modellar + Flux (Kontext Pro, 2 Pro/Turbo/Klein≤4ref, Pro 1.1, Dev, Hyperflux), Seedream 4/4.5, Z-Image Turbo, Runway T2I, Google Imagen 3.

**AssetFlow uchun:** asosiy **rasm generatsiya** — Mystic `realism`/`super_real` + reference (structure/style) = G1 "rangini o'zgartir"/reference oqimining to'g'ridan ekvivalenti. `aspect_ratio` AssetFlow nisbatlariga, `resolution` 1k/2k/4k Sifat tugmasiga mos.

---

## 2. IMAGE EDITING — inpaint / expand / relight / style-transfer / change-camera / upscale / remove-bg

**Endpointlar (har biri async):**
- Inpaint: `POST /v1/ai/ideogram-image-edit` (`image`,`mask`,`prompt`,`rendering_speed`,`style_type`...)
- Expand (outpaint): `POST /v1/ai/image-expand/ideogram|flux-pro|seedream-v4-5` (`image`,`left/right/top/bottom` 0-2048)
- Change camera: `POST /v1/ai/image-change-camera` (`horizontal_angle`,`vertical_angle`,`zoom`)
- Relight: `POST /v1/ai/image-relight`
- Style transfer: `POST /v1/ai/image-style-transfer`
- Upscaler: `/v1/ai/image-upscaler-creative` · `-precision` · `-precision-v2`
- Remove BG: `POST /v1/ai/remove-background`
- Seedream 4.5 Edit (matn-boshqaruvli tahrir)

**AssetFlow uchun (BONUS — magnific spec'da o'chiq qoldirgan "Use ▾" amallari endi haqiqiy):**
- **Upscale** → image-upscaler (Creative/Precision) — natija kartasidagi "Upscale" tugmasi.
- **Extend** → image-expand — "Extend".
- **Relight / Style transfer / Remove BG / Change camera** — yangi qudratli edit funksiyalari (AE kontekstida juda qadrli).
- **Inpaint** → mask bilan qism-tahrirlash.

---

## 3. VIDEO GENERATION — Kling/Veo/MiniMax/WAN/Runway/LTX/Seedance/PixVerse/OmniHuman

**Endpointlar (per-model, async):** `POST /v1/ai/image-to-video/<model>` + `GET .../{task-id}`. Masalan:
- `kling-o1-pro` / `kling-o1-std` / `kling-o1-pro-video-reference`
- `veo-3-1` / `veo-3-1-fast`
- `kling-elements-pro/std` (max 3 concurrent)
- Kling 3/3-Omni/2.6/2.5/2.1, Hailuo 02 (1080p/768p)/2.3, WAN 2.5/2.6, Runway Gen4-Turbo/Gen4.5/Act-Two, LTX 2.0, Seedance Pro, PixVerse V5, OmniHuman 1.5 (audio-driven), VFX.

**Asosiy paramlar:** `prompt`(≤2500), `image_url`/`image_list` (I2V), `aspect_ratio` (`16:9`def/`9:16`/`1:1`), `duration` (Kling O1: `5`|`10`s), `first_frame`+`last_frame` (URL/base64, ≥300×300, ≤10MB — **kamida bittasi**), `reference_images[]` (≤7, character/style izchillik), `webhook_url`. *Paramlar har modelda farq qiladi.*

**AssetFlow uchun:** to'g'ridan-to'g'ri AssetFlow video oqimi. **Kling O1 `first_frame`/`last_frame`** = V5 Start/End kadr ishining aynan ekvivalenti (OpenRouter'da murakkab edi, bu yerda tabiiy). `reference_images[]` ≤7 = kuchli reference. `duration` Quick/Short tugmalariga mos.

---

## 4. IMAGE TO PROMPT — "Tasvirdan" (to'g'ridan ekvivalent!)

**Endpoint:** `POST /v1/ai/image-to-prompt` (`image`: URL yoki base64 data-URI) · `GET .../{task-id}`. Natija: `generated[0]` = prompt matni. ~bir necha soniya. RPD 125/30000.

**AssetFlow uchun:** "Tasvirdan" (rasm) — hozir gemini-2.5-flash o'rniga Magnific'ning maxsus image-to-prompt'i. **Eslatma:** bu faqat RASM; video-to-prompt (H1) uchun Magnific'da to'g'ridan endpoint yo'q → video'ni kadrga ajratib image-to-prompt, yoki Gemini'ni "Tasvirdan-video" uchun saqlash mumkin.

---

## 5. IMPROVE PROMPT — "Yaxshilash" (to'g'ridan ekvivalent!)

**Endpoint:** `POST /v1/ai/improve-prompt` (`prompt` bo'sh bo'lishi mumkin ≤2500, `type`:`"image"`|`"video"`, `language` ISO 639-1 def `en`) · `GET .../{task-id}`. RPD 125/30000.

**AssetFlow uchun:** "Yaxshilash" tugmasi — to'g'ridan shu endpoint. `type` tanlangan rejimga (image/video), `language` UI tiliga (uz/en) mos. Bo'sh prompt → noldan ijodiy g'oya.

---

## 6. AUDIO — music / sound-effects / audio-isolation

**Endpointlar:** `POST /v1/ai/music-generation` (ElevenLabs) · `POST /v1/ai/sound-effects` · `POST /v1/ai/audio-isolation` (SAM Audio: `description`+`audio|video`, bbox, `sample_fps`) — hammasi async + GET task.

**AssetFlow uchun:** ovoz/musiqa/SFX generatsiya — hozirgi ElevenLabs SFX + Workers AI o'rniga konsolidatsiya. Audio-isolation = video'dan ovoz ajratish (AE uchun foydali bonus).

---

## 7. LIP SYNC — Latent Sync / Veed Fabric

**Endpoint:** `POST /v1/ai/lip-sync/latent-sync` (`video_url`+`audio_url` majburiy, `seed`,`guidance_scale`) · GET task. **RPD past: 20/300 → navbatga.**

**AssetFlow uchun:** yangi funksiya — talking-avatar / dublyaj (video lab harakatini ovozga moslash). AE kontekstida qiziqarli kengaytma (hozir shart emas, kelajak).

---

## 8. ICON GENERATION

**Endpoint:** `POST /v1/ai/text-to-icon` (`prompt`,`style`:solid/outline/color/flat/sticker, `format`:png/svg) · render `POST .../{task-id}/render/{format}`.

**AssetFlow uchun:** matn→ikona (PNG/SVG). Motion-graphics uchun ikona aktivlari — yangi mini-funksiya (ixtiyoriy).

---

## 9. AI IMAGE CLASSIFIER — AI-detection

**Endpoint:** `POST /v1/ai/classifier/image` — **sinxron** (`image`). Javob: `[{class_name:"not_ai",probability},{class_name:"ai",probability}]`.

**AssetFlow uchun:** contributor yuklagan shablon AI-generatsiyami yoki yo'qligini aniqlash — **moderatsiya/admin uchun foydali** (kontent siyosati). Bonus.

---

## 10. STOCK CONTENT — images/templates/icons/videos

**Endpointlar:** Images&Templates, `GET /v1/icons`, `GET /v1/videos`. Qidiruv+yuklab olish.

**AssetFlow uchun:** ichki stok katalog (reference/aktiv manbasi). Ixtiyoriy kengaytma.

---

## 11. ANALYTICS — team kredit sarfi

**Endpointlar:** `POST /v1/analytics/team-credit-usage`, `GET /v1/analytics/team-members|team-api-keys|team-projects`.

**AssetFlow uchun:** **COGS kuzatuvi** — Magnific kredit sarfini vaqt bo'yicha olib, AssetFlow biznes-paneliga (har foydalanuvchi/model tannarxi) ulash. Marja hisobi uchun qimmatli.

---

## 12. MCP (NEW) — chat orqali (kalitsiz, OAuth)

Server `https://mcp.magnific.com`. AssetFlow REST ishlatadi (MCP app-emas), lekin bilib qo'yish foydali.

---

## MIGRATSIYA REJASI (AssetFlow → Magnific)

**Arxitektura saqlanadi** (job+poll+quote+credit+UI). Faqat provider qatlami:

1. **`apps/api/src/lib/ai/magnific.ts`** (yangi adapter) — `openrouter.ts` o'rniga: `mgPost(path, body)` → `task_id`; `mgPoll(path, taskId)` → `COMPLETED`/`generated[]`. Bitta umumiy poller barcha endpoint uchun (image/video/audio/prompt — bir xil kontrakt).
2. **`gen-models.ts`** — model katalogini Magnific endpoint/param'lariga moslash (Mystic, Kling O1, Veo 3.1, Seedance, Flux, Seedream... + endFrame=first/last_frame, reference_images).
3. **`gen-processor.ts`** — `runImage`/`runVideo`/`runAudio` Magnific adapter'ga (router o'zgaradi, mantiq emas).
4. **describe/enhance** — "Tasvirdan"→`image-to-prompt`, "Yaxshilash"→`improve-prompt` (Magnific). Video-to-prompt — kadr→image-to-prompt yoki Gemini saqlanadi.
5. **Webhook (ixtiyoriy)** — polling o'rniga `webhook_url` (Render endpoint + HMAC tekshiruv) — barqarorroq.
6. **Env** — `MAGNIFIC_API_KEY` Render'da (CEP'da EMAS). `OPENROUTER_API_KEY` saqlanadi (fallback yoki video-to-prompt uchun).
7. **BONUS funksiyalar** — Upscale/Extend/Relight/Remove-BG/Lip-sync/Icon/AI-classifier — "Use ▾" va admin moderatsiyaga.

**Bosqich:** (a) adapter + image + video (asosiy) → (b) audio + describe/enhance → (c) bonus edit/upscale → (d) webhook + analytics.

**⚠️ Avval:** Magnific kredit narxini (COGS) AssetFlow foydalanuvchi narxi bilan solishtirib marja tasdiqlash. Kalit `apps/api`'da, hech qachon CEP/chatda emas.

**💡 Migratsiya paytida aniq spec olish:** har docs sahifani `.md` qo'shib markdown sifatida olish mumkin — Claude Code har model paramini taxmin qilmasdan tasdiqlasin:
- `https://docs.magnific.com/api-reference/mystic/post-mystic.md` (Mystic)
- `https://docs.magnific.com/api-reference/image-to-video/kling-v2/post-kling-v2.md` (Kling)
- `https://docs.magnific.com/api-reference/image-to-prompt/...md`, `improve-prompt/...md`, `classifier/post-ai-classifier.md` va h.k.
- Indeks: `https://docs.magnific.com/llms.txt` (barcha sahifa yo'llari).

---

*Yangilangan: 2026-06-19 — Magnific API to'liq tahlil. Subagent docs.magnific.com (2003 qator + jonli sahifalar) asosida.*
