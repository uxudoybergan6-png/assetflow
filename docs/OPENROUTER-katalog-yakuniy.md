# OpenRouter ∩ Artlist — AssetFlow yakuniy model katalogi

*Manba: OpenRouter jonli API `/api/v1/models?output_modalities=image|video` (2026-06-15) + Artlist toolkit ro'yxati.*
*Qoida: OpenRouter'da JONLI bor + Artlist'da ham bor → kiritamiz. OpenRouter'da yo'q → Artlist ro'yxatidan chiqaramiz (keyin Freepik/fal bilan qo'shiladi).*

---

## 0. TUZATISH — Kling OpenRouter'da BOR ✅ (avvalgi xato tuzatildi)

> Avvalgi versiyada "Kling yo'q" deb yozilgandi — bu **xato edi**. Sabab: `/api/v1/models` API
> chaqirig'i kesilib qolib, atigi 8 ta model qaytargan. Sayt (`openrouter.ai/models?output_modalities=video`)
> **14 ta** video modelni ko'rsatadi. `kwaivgi/kling-v3.0-std/pro` **JONLI va to'g'ri** —
> hozirgi `gen-models.ts` video modellari **o'zgartirishsiz ishlaydi**. (Manba: brauzerdan to'g'ridan o'qildi, 2026-06-15.)

OpenRouter jonli **video** modellari — **14 ta**, deyarli butun Artlist video katalogi:
Grok Imagine Video, Kling v3.0 Pro/Standard/O1, Veo 3.1 / 3.1 Fast / 3.1 Lite, Hailuo 2.3,
Seedance 2.0 / 2.0 Fast / 1.5 Pro, Wan 2.7 / 2.6, Sora 2 Pro.

---

## 1. RASM — AssetFlow katalogi (OpenRouter jonli, chat/completions + modalities:["image"])

| Label | OpenRouter model ID | Izoh | Artlist'da |
|---|---|---|---|
| **Nano Banana 2** (default) | `google/gemini-3.1-flash-image-preview` | Image arena **#1**, arzon ($0.0005/$0.003) | ✅ |
| Nano Banana Pro | `google/gemini-3-pro-image-preview` | Image arena #2, sifat | ✅ |
| Nano Banana | `google/gemini-2.5-flash-image` | eski, arzonroq | ✅ |
| Seedream 4.5 | `bytedance-seed/seedream-4.5` | edit-consistency kuchli | ✅ (Artlist'da 4.5 + 5.0; OR'da 4.5) |
| Flux 2.0 Pro | `black-forest-labs/flux.2-pro` | frontier sifat | ✅ |
| Flux 2.0 Max | `black-forest-labs/flux.2-max` | top-tier | ✅ (Flux oilasi) |
| GPT-5 Image | `openai/gpt-5-image` | OpenAI (moderated) | ✅ (GPT Image) |
| Grok Imagine | `x-ai/grok-imagine-image-quality` | 1K/2K, $0.01/rasm | ✅ |
| Recraft V4.1 (vector!) | `recraft/recraft-v4.1-vector` | **SVG chiqaradi** — ikona/logo uchun | 🟡 (Artlist'da yo'q, lekin AssetFlow uchun foydali) |

**Artlist'da bor, OpenRouter'da YO'Q (rasmдан chiqaramiz / keyin Freepik):** Imagen 4.0/Ultra, Ideogram v3, Krea 2, Hunyuan V3, Z-Image Turbo, ImagineArt 2.0, Seedream 5.0.

## 2. VIDEO — AssetFlow katalogi (OpenRouter jonli, POST /api/v1/videos → poll) — 14 ta

| Label | OpenRouter model ID | Narx/s | Imkoniyat | Artlist'da |
|---|---|---|---|---|
| **Veo 3.1 Lite** (default — arzon) | `google/veo-3.1-lite` | $0.05 | 720p/1080p, 4–8s, audio | ✅ |
| Veo 3.1 Fast | `google/veo-3.1-fast` | $0.10 | t2v/i2v, audio, first/last | ✅ |
| Veo 3.1 | `google/veo-3.1` | $0.40 | 1080p, audio, scene-extend, 4K | ✅ |
| Kling v3.0 Standard | `kwaivgi/kling-v3.0-std` | $0.126 | 3–15s, first/last, audio | ✅ |
| Kling v3.0 Pro | `kwaivgi/kling-v3.0-pro` | $0.168 | premium sifat | ✅ |
| Kling O1 | `kwaivgi/kling-video-o1` *(slug tasdiqla)* | $0.112 | 5/10s, kinematik | ✅ |
| Grok Imagine Video | `x-ai/grok-imagine-video` | $0.05 | 1–15s, 480/720p, 7 aspect, ref | ✅ |
| Hailuo 2.3 | `minimax/hailuo-2.3` | $0.082 | t2v/i2v, realistik harakat | ✅ |
| Seedance 2.0 | `bytedance/seedance-2.0` | $0.067 | first/last frame, ref-to-video | ✅ |
| Seedance 2.0 Fast | `bytedance/seedance-2.0-fast` | $0.054 | tez/arzon | ✅ |
| Seedance 1.5 Pro | `bytedance/seedance-1-5-pro` | $0.023 | video+audio, lip-sync | ✅ |
| Wan 2.7 | `alibaba/wan-2.7` | $0.10 | first/last, ref | ✅ |
| Wan 2.6 | `alibaba/wan-2.6` | $0.04 | 1080p 24fps, audio | ✅ |
| Sora 2 Pro | `openai/sora-2-pro` | $0.30 | premium, multi-shot (moderated) | 🟡 |

> ⚠️ Slug'larni implementatsiyada `/api/v1/models/<id>/endpoints` bilan tasdiqla (ayniqsa Kling O1, Hailuo aniq slug). Kling/Veo/Seedance/Wan asosiy slug'lar tasdiqlangan.

**Artlist'da bor, OpenRouter'da YO'Q (keyin fal/Freepik):** LTX 2.3, PixVerse, Happy Horse, Kling Motion Control / O3 Video Edit, Veo Extend (alohida).

## 3. OVOZ (TTS) — OpenRouter jonli
- `hexgrad/kokoro-82m` (arzon, ochiq, default) yoki `google/gemini-3.1-flash-tts-preview`
- ❌ OpenAI TTS jonli emas (avval aniqlangan)

## 4. SFX + Musiqa — OpenRouter'da YO'Q
- Freepik kerak (`/v1/ai/sound-effects`, `/v1/ai/music-generation`) — Bosqich 4, kalit kelganda.

---

## 5. HAR MODEL O'Z PARAMETRLARIGA EGA (muhim)

Har OpenRouter model sahifasining pastida o'z instruksiyasi/parametrlari bor (`/api/v1/models/<id>/endpoints`). Misol (skrinshotdan, video):
```
POST https://openrouter.ai/api/v1/videos
Authorization: Bearer $OPENROUTER_API_KEY
{ "model": "<id>", "prompt": "...", ... }
→ { id, polling_url, status:"pending" }
poll GET polling_url → status "completed" → unsigned_urls[]
```
- **Rasm:** `POST /chat/completions` + `modalities:["image"]` (Flux) yoki `["image","text"]` (Gemini). Aspect/seed param modelga qarab.
- **Video:** `POST /videos` + `model` + `prompt` (+ aspect_ratio, resolution, frame_images i2v uchun). Har model qo'llaydigan param `/<id>/endpoints` da.
- ⚠️ **Implementatsiyada:** har model `supported_parameters` ni hisobga olib, faqat qo'llaydiganini yubor (aks holda xato).

---

## 6. CLAUDE CODE PROMPTI — model registrini to'g'rilash

```
gen-models.ts model registrini OpenRouter JONLI katalogiga kengaytir
(manba: docs/OPENROUTER-katalog-yakuniy.md §1, §2). Mavjud Kling/Veo modellari TO'G'RI —
o'chirma, faqat kengaytir va narxlarni jonli qiymatga moslab to'g'rila.

RASM (feature text-to-image / image-edit; chat/completions + modalities):
- google/gemini-3.1-flash-image-preview  "Nano Banana 2" (default, arena #1)
- google/gemini-3-pro-image-preview       "Nano Banana Pro"
- bytedance-seed/seedream-4.5             "Seedream 4.5"
- black-forest-labs/flux.2-pro            "Flux 2.0 Pro"
- x-ai/grok-imagine-image-quality         "Grok Imagine"

VIDEO (feature text-to-video / image-to-video; POST /videos):
- google/veo-3.1-lite       "Veo 3.1 Lite" (default — arzon $0.05/s, audio)
- google/veo-3.1-fast       "Veo 3.1 Fast"
- kwaivgi/kling-v3.0-std    "Kling v3.0" (i2v first/last — mavjud, saqla)
- kwaivgi/kling-v3.0-pro    "Kling v3.0 Pro"
- bytedance/seedance-2.0    "Seedance 2.0"
- alibaba/wan-2.6           "Wan 2.6" (arzon, 1080p)
- (ixtiyoriy) openai/sora-2-pro "Sora 2 Pro" (premium, moderated)

OVOZ: hexgrad/kokoro-82m (Bosqich 2'da o'rnatilgan — saqla).

⚠️ Slug'larni /api/v1/models/<id>/endpoints bilan tasdiqla. Narxlar /s asosida (video) —
kredit-narxni davomiylik×model qiymatiga moslab hisobla. isDefault video = veo-3.1-lite.
openrouter.ts: har model supported_parameters'ini hisobga ol; faqat qo'llaydigan param yubor.

Tekshiruv: tsc EXIT 0; AE'da Video → model → Generate → video chiqsin.
SESSION-REPORT yangila. Commit qilma.
```

---

## 7. XULOSA
- **OpenRouter bilan AssetFlow:** Rasm (6+ model, Nano Banana #1), Video (**14 model** — Kling/Veo/Seedance/Wan/Hailuo/Grok/Sora), Ovoz (kokoro). Artlist video katalogining deyarli HAMMASI qoplanadi.
- **Mavjud kod TO'G'RI:** Kling video modellari ishlaydi — almashtirish shart emas, faqat kengaytirish.
- **OpenRouter'da yo'q (keyin Freepik/fal):** Imagen, Ideogram, Krea, Hunyuan, Z-Image (rasm); LTX, PixVerse (video); SFX, Musiqa.

*Jonli API tahlili: 2026-06-15.*
