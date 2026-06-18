# Freepik API — to'liq tahlil (AssetFlow uchun)

*Manba: docs.freepik.com (Mintlify). Jonli tahlil — Claude in Chrome + web_fetch, 2026-06-15.*
*Eslatma: Freepik Magnific'ni sotib olgan — ba'zi hujjatlar/endpointlar `api.magnific.com` ga ham yo'naltiriladi, lekin asosiy B2B API `api.freepik.com`.*
*Fokus: AssetFlow'ga to'g'ridan-to'g'ri keraklilari chuqur, qolganlari qisqa (foydalanuvchi tanlovi bo'yicha).*

---

## 0. Skrinshotdagi menyu = Freepik API kategoriyalari

Image generation · Image editing · Video generation · Icon generation · AI image classifier · Stock content · Lip Sync · Image To Prompt · Improve Prompt · Audio generation · Analytics (NEW).

---

## 1. GLOBAL naqshlar (hammasiga umumiy)

| Narsa | Qiymat |
|-------|--------|
| Base URL | `https://api.freepik.com` (barcha yo'llar `/v1/...`) |
| Auth | Header: `x-freepik-api-key: <API_KEY>` |
| Pricing | Kredit asosli; tafsilot `/pricing`. Ba'zi narxlar belgilangan (Relight, Style Transfer = €0.10/op) |
| Rate limit | Obuna darajasiga bog'liq (`/ratelimits`). 503 da exponential backoff tavsiya |

### Async task naqsh (deyarli barcha AI endpoint)
```
1. POST /v1/ai/<service>            → { data: { task_id, status:"CREATED", generated:[] } }
2. Holatni olish:
   - GET  /v1/ai/<service>/{task_id}   (polling)   YOKI
   - webhook_url parametri → tugaganda avtomatik callback
3. status: CREATED → IN_PROGRESS → COMPLETED (generated[] = URL lar) | FAILED
```
- `webhook_url` payloadi = GET javobi, lekin `data` maydonisiz.
- Natija URL'lari vaqtinchalik (yuklab oling).
- **Istisno:** AI Image Classifier — sinxron (task yo'q, darhol javob).

---

## 2. CHUQUR — AssetFlow uchun asosiy API'lar

### 2.1 IMAGE GENERATION

#### Mystic (tavsiya etilgan, ultra-realistik) — `POST /v1/ai/mystic`
Freepik'ning eksklyuziv workflow'i. Webhook'ni har so'rovda o'rnatish tavsiya.

| Parametr | Tur | Default | Cheklov / qiymatlar |
|----------|-----|---------|---------------------|
| `prompt` | string | — | Tavsif. `@character_name::strength` sintaksisi bilan LoRA personaj |
| `webhook_url` | uri | — | Async callback |
| `structure_reference` | base64 | — | Shakl referensi (sketch→rasm, 3D→tekstura) |
| `structure_strength` | int | 50 | 0–100 (faqat structure_reference bilan) |
| `style_reference` | base64 | — | Estetika referensi (Mystic'ning eng kuchli vositasi) |
| `adherence` | int | 50 | 0–100 (faqat style_reference bilan) |
| `hdr` | int | 50 | 0–100 (faqat style_reference bilan) |
| `resolution` | enum | `2k` | `1k`, `2k`, `4k` |
| `aspect_ratio` | enum | `square_1_1` | `square_1_1`, `classic_4_3`, `traditional_3_4`, `widescreen_16_9`, `social_story_9_16`, `smartphone_horizontal_20_9`, `smartphone_vertical_9_20`, `standard_3_2`, `portrait_2_3`, `horizontal_2_1`, `vertical_1_2`, `social_5_4`, `social_post_4_5` |
| `model` | enum | `realism` | `realism`, `fluid`, `zen`, `flexible`, `super_real`, `editorial_portraits` |
| `creative_detailing` | int | 33 | 0–100 |
| `engine` | enum | `automatic` | `automatic`, `magnific_illusio`, `magnific_sharpy`, `magnific_sparkle` |
| `fixed_generation` | bool | false | true = bir xil sozlama → bir xil rasm |
| `filter_nsfw` | bool | true | Standart API'da o'chirib bo'lmaydi |
| `styling` | object | — | `styles[]`, `characters[]`, `colors[]` (LoRA + rang palitra) |

**Model tanlovi qisqacha:** `realism` (fotorealistik), `fluid` (eng yaxshi prompt adherence, Google Imagen 3, lekin over-moderated), `flexible` (illyustratsiya/fantastika), `zen` (yumshoq/sodda), `super_real` (medium shot realizm), `editorial_portraits` (close-up portret — bozordagi eng yaxshisi).

**Mystic boshqa endpointlari:** `GET /v1/ai/mystic/{task-id}` (holat), `GET /v1/ai/mystic` (ro'yxat), `GET .../loras` (LoRA ro'yxati), `POST .../loras/styles` va `POST .../loras/characters` (custom LoRA yaratish).

#### Boshqa image modellari (submenu)
Flux oilasi (Kontext Pro, Flux 2 Pro/Turbo/Klein, Flux Pro 1.1, Flux Dev, Hyperflux), Seedream 4/4.5/V5 Lite (+Edit), Google (Imagen/Nano Banana), RunWay text-to-image, Z-Image Turbo, Classic Fast. Hammasi bir xil async naqsh, har birida o'z parametrlari (resolution/aspect_ratio/seed). Tezlik↔sifat bo'yicha tanlanadi (Hyperflux/Turbo = tez/arzon; Flux 2 Pro/Mystic = sifat).

### 2.2 VIDEO GENERATION

AssetFlow video shablon platformasi bo'lgani uchun bu eng muhim blok. Menyu: **Kling** (3, 3 Omni, 3 Motion Control, O1, 2.6, 2.5, 2.1, 2.0, 1.6, Elements), **MiniMax/Hailuo**, **WAN**, **Seedance**, **LTX**, **Runway**, **Google (Veo)**, **PixVerse**, **OmniHuman**, **VFX**, **Video Upscaler**.

#### Kling 2.6 Pro — `POST /v1/ai/image-to-video/kling-v2-6-pro`
| Parametr | Tur | Default | Cheklov |
|----------|-----|---------|---------|
| `prompt` | string | — (majburiy) | ≤2500 belgi |
| `duration` | enum | — (majburiy) | `5`, `10` (soniya) |
| `negative_prompt` | string | — | ≤2500 belgi |
| `cfg_scale` | float | 0.5 | 0–1 (yuqori = promptga sodiqlik) |
| `aspect_ratio` | enum | `widescreen_16_9` | `widescreen_16_9`, `social_story_9_16`, `square_1_1` |
| `generate_audio` | bool | — | Video uchun audio ham generatsiya |
| `webhook_url` | uri | — | Callback |

> Image-to-video uchun rasm input qo'shiladi (Option 2). Endpoint matn yoki rasmdan video qiladi.

#### Happy Horse 1.0 (text-to-video, Alibaba) — `POST /v1/ai/text-to-video/happy-horse-1`
| Parametr | Default | Qiymatlar |
|----------|---------|-----------|
| `prompt` (majburiy) | — | 1–2500 belgi |
| `aspect_ratio` | `16:9` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` |
| `resolution` | `1080P` | `720P`, `1080P` |
| `duration` | `5` | 3–15 (har butun son) |
| `seed` | random | 0–2147483647 |
| `webhook_url` | — | — |

Boshqa video modellari ham shu naqshda, faqat duration/aspect_ratio/resolution qiymatlari farq qiladi. **Video Upscaler** ham bor (mavjud videoni sifatini oshirish).

### 2.3 IMAGE EDITING

| Endpoint | Yo'l | Asosiy parametrlar |
|----------|------|--------------------|
| Upscaler Creative | `POST /v1/ai/image-upscaler` | AI detal qo'shib kattalashtirish |
| Upscaler Precision | `POST /v1/ai/image-upscaler-precision` | Sodiq kattalashtirish |
| Relight | `POST /v1/ai/image-relight` | Yorug'likni o'zgartirish (Magnific). **€0.10/op**, premium |
| Style Transfer | `POST /v1/ai/image-style-transfer` | Badiiy uslub (Magnific). **€0.10/op**, premium |
| Remove Background | `POST /v1/ai/beta/remove-background` | Fon olib tashlash |
| Image Expand (outpaint) | `POST /v1/ai/image-expand/{flux-pro\|ideogram\|seedream-v4-5}` | `left/right/top/bottom` 0–2048; Flux Pro=base64, Seedream=URL/base64 |
| Ideogram Edit (inpaint) | `POST /v1/ai/ideogram-image-edit` | `image`+`mask`(B&W, qora=tahrir)+`prompt`; `rendering_speed`: TURBO/DEFAULT/QUALITY |
| Seedream 4.5 Edit | `POST /v1/ai/text-to-image/post-seedream-v4-5-edit` | Matn bilan rasm tahrirlash |
| Change Camera | `POST /v1/ai/image-change-camera` | `horizontal_angle` 0–360, `vertical_angle` -30..90, `zoom` 0–10 |

**Sifat eslatmasi (Magnific tools):** rasmni original URL yoki xom base64 da yuboring. `canvas.toDataURL('image/jpeg')` ≈8% yo'qotish, `...0.8` ≈20%. PNG→JPEG yoki resize = sifat yo'qoladi.

### 2.4 AUDIO GENERATION

#### Music Generation (ElevenLabs) — `POST /v1/ai/music-generation`
| Parametr | Tur | Majburiy | Cheklov |
|----------|-----|----------|---------|
| `prompt` | string | ✅ | ≤2500 belgi. Janr+kayfiyat+cholg'u+temp |
| `music_length_seconds` | int | ✅ | 10–240 (4 daqiqagacha) |
| `webhook_url` | uri | ❌ | — |

`GET /v1/ai/music-generation` (ro'yxat), `GET .../{task-id}` (holat). Video produksiya, o'yin, podkast uchun.

#### Sound Effects — `POST /v1/ai/sound-effects`
Matndan ovoz effekti. List + task-by-id bilan.

#### Audio Isolation (SAM Audio) — `POST /v1/ai/audio-isolation`
| Parametr | Default | Izoh |
|----------|---------|------|
| `description` (majburiy) | — | Ajratiladigan ovoz, masalan "A person speaking" |
| `audio` YOKI `video` | — | URL/base64 (audio: WAV/MP3/FLAC/OGG/M4A; video: MP4/MOV/WEBM/AVI) |
| `x1,y1,x2,y2` | 0 | Video bbox (0=to'liq kadr) |
| `sample_fps` | 2 | 1–5 |
| `reranking_candidates` | 1 | 1–8 (sifat↔kechikish) |
| `predict_spans` | false | Hodisaviy ovozlar uchun yaxshiroq |

Chiqish: WAV.

### 2.5 ICON GENERATION — `POST /v1/ai/text-to-icon`
| Parametr | Default | Qiymatlar |
|----------|---------|-----------|
| `prompt` (majburiy) | — | Ikona tavsifi |
| `webhook_url` (majburiy!) | — | Bu endpointda majburiy |
| `style` | `solid` | `solid`, `outline`, `color`, `flat`, `sticker` |
| `format` | `png` | `png`, `svg` |
| `num_inference_steps` | 10 | 10–50 |
| `guidance_scale` | 7 | 0–10 |

`POST .../preview` (tez ko'rish), `POST .../{task-id}/render/{format}` (png/svg yuklab olish).

---

## 3. QISQA — qolgan API'lar

- **AI Image Classifier** — `POST /v1/ai/classifier/image` (`image`: base64/URL/binary). **Sinxron**, darhol `{class_name:"ai"|"not_ai", probability}` qaytaradi. AssetFlow'da contributor yuklagan rasm AI-generatsiyami yo'qmi tekshirishga foydali.
- **Image To Prompt** — `POST /v1/ai/image-to-prompt` (`image`). Rasmdan prompt chiqaradi. Auto-tagging/qidiruv uchun foydali.
- **Improve Prompt** — `POST /v1/ai/improve-prompt`. Promptni yaxshilaydi (Artlist'dagi "Enhance prompt"ga o'xshash).
- **Stock Content** — `GET /v1/icons`, `GET /v1/images...`, `GET /v1/videos...` (qidiruv + yuklab olish). Tayyor stok kontent katalogi.
- **Lip Sync** — audio bilan video lab sinxronizatsiyasi (OmniHuman/Latent Sync).
- **Analytics (NEW)** — foydalanish statistikasi.
- **Apps (Enterprise)** — `POST /v1/ai/apps/{id}/run` workflow pipeline; natija URL'lari 12 soat amal qiladi; narx `tool_metadata.total_cost`.

---

## 4. AssetFlow uchun tavsiyalar

AssetFlow AI Tools 1-bosqichi (Rasm/Ovoz/Qidiruv) allaqachon bor. Freepik bularni quvvatlantirishi mumkin:

1. **Rasm generatsiya** → Mystic (sifat) yoki Hyperflux/Z-Image Turbo (tez/arzon). Contributor thumbnail/preview uchun.
2. **Ovoz generatsiya** → Music Generation (10–240s) — shablon demo musiqasi. `music_length_seconds` AssetFlow "duration" ga mos.
3. **Video generatsiya** → Kling 2.6 Pro yoki Happy Horse — shablon preview/demo render.
4. **Image editing** → Remove Background, Upscaler — contributor asset tozalash/sifat oshirish.
5. **Icon generation** → UI/shablon ikonalari (svg chiqishi bilan).
6. **AI Classifier + Image-to-Prompt** → moderatsiya (AI-rasmlarni aniqlash) + auto-tagging (CLAUDE.md "auto-tagging" rejasi bilan mos).

### Integratsiya naqshi (AssetFlow Express uslubida)
```
apps/api: FreepikClient
  - POST https://api.freepik.com/v1/ai/<service>  (x-freepik-api-key)
  - webhook_url = https://assetflow-rqbq.onrender.com/api/ai/freepik/webhook
  - webhook handler: task_id bo'yicha GenJob status yangilash, generated[] ni R2 ga saqlash
  - status: CREATED→IN_PROGRESS→COMPLETED|FAILED  (AssetFlow GenJob statusiga map)
```
**Muhim:** Render ephemeral disk uchun **webhook** afzal (polling o'rniga) — Freepik webhook_url ni qo'llaydi. Natija URL'lari vaqtinchalik, shuning uchun webhook kelganda darhol R2/`CDN_BASE_URL` ga ko'chiring.

### Xavfsizlik / xarajat
- API kalitni faqat serverda saqlang (`FREEPIK_API_KEY` env), hech qachon klientga bermang.
- Har generatsiya kredit yeydi → AssetFlow kredit/limit tizimi bilan bog'lang (Free/Pro), Artlist'dagi `getCostQuote` + imzolangan narx naqshiga o'xshatib.
- `filter_nsfw: true` ni saqlang (moderatsiya).

---

## 5. Manba endpointlar (asosiy)
| Servis | POST yo'li |
|--------|-----------|
| Mystic | `/v1/ai/mystic` |
| Happy Horse T2V | `/v1/ai/text-to-video/happy-horse-1` |
| Kling 2.6 Pro | `/v1/ai/image-to-video/kling-v2-6-pro` |
| Music | `/v1/ai/music-generation` |
| Sound Effects | `/v1/ai/sound-effects` |
| Audio Isolation | `/v1/ai/audio-isolation` |
| Icon | `/v1/ai/text-to-icon` |
| Remove BG | `/v1/ai/beta/remove-background` |
| Relight | `/v1/ai/image-relight` |
| Classifier (sync) | `/v1/ai/classifier/image` |
| Image-to-Prompt | `/v1/ai/image-to-prompt` |
| Improve Prompt | `/v1/ai/improve-prompt` |

---
*Tahlil: Claude in Chrome + web_fetch (docs.freepik.com llms.txt + sahifalar), 2026-06-15. Faqat ochiq hujjat kuzatildi.*
