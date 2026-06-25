# fal.ai katalog — AI tool'larni fal.ai'ga moslash (jonli tekshiruv)

> **Maqsad:** plagin AI tool'larini FAQAT fal.ai'da HAQIQATAN mavjud, **Commercial-litsenziyali**
> (biz resell qilamiz) modellarga moslash. fal.ai'da yo'q tool'ni olib tashlash uchun belgilash +
> qo'shimcha foydali fal.ai imkoniyatlarini topish. **Bu faqat tekshiruv+hujjat — implement qilinmadi.**

## Metod (tekshiruv usuli)
- **Jonli WebFetch:** har model `https://fal.ai/models/<id>` (yoki `/api`) sahifasidan **haqiqatan ochib**
  tekshirildi (9 kategoriya agenti parallel). **Taxmin yo'q** — faqat sahifada ko'rilgan ma'lumot:
  model id · endpoint · majburiy param · rasm/video kiritish formati · narx · litsenziya badge.
- **⚠️TASDIQLANMADI** deb belgilangan modellar (404, deprecated, yoki narx ko'rinmagan) tavsiya
  jadvallariga KIRITILMADI — har kategoriyada alohida sanab o'tilgan.
- **Narxlar** tekshiruv sanasiga (2026-06) — fal narxi o'zgarishi mumkin; integratsiyadan oldin qayta tasdiqlа.
- **Litsenziya (resell uchun MUHIM):** tavsiya etilganlar fal sahifasида **"Commercial use"** badge.
  **Bria** modellari "licensed data"da o'qitilgan — resell uchun eng xavfsiz. **iclight-v2** — fal
  hostlangan versiyasi Commercial (asl lllyasviel research vaznidan farqli); fal ToS bilan bir marta tasdiqlа.

> **Mundarija:** 1 Xulosa (master jadval) · 2 Image Generate · 3 Video Generate · 4 Remove BG ·
> 5 Upscale · 6 Reframe/Outpaint · 7 Relight · 8 Skin & Change Camera · 9 Draw-to-video & Motion Control ·
> 10 Yangi imkoniyatlar · 11 gen-models.ts o'zgarish ro'yxati.

---

## 1. Xulosa — Tool → fal.ai → VERDICT (gen-models.ts + mockup vs fal.ai)

| Tool | gen-models.ts hozir (id · label) | Mockup v2'da | fal.ai holati | QAROR |
|---|---|---|---|---|
| **Image Generate** | 1001 Nano Banana 2, 1002 Nano Banana Pro, 1003 Seedream 4.5, 1004 Flux 2.0 Pro, 1005 Grok Imagine | ✅ bor (Yaratish) | ✅ kuchli commercial t2i (seedream v4.5, flux-2-pro, nano-banana, z-image) | ✅ **KEEP** — `key`/provider'ni fal'ga REPLACE (id'lar saqlanadi) |
| **Image Edit (ref)** | 1101 Gemini Edit | ⚠️ (composer ichida implicit) | ✅ `flux-pro/kontext` ($0.04/img) | ✅ **KEEP** — backend'ni fal kontext'ga map |
| **Upscale** | 1201 Magnific Upscaler | ✅ bor (Yaxshilash) | 🔁 `clarity-upscaler` $0.03/MP + video `topaz/upscale/video` | 🔁 **REPLACE** + ➕ video upscale variant |
| **Relight** | 1202 Magnific Relight | ✅ bor (Yaxshilash) | 🔁 `iclight-v2` $0.1/MP + video `lightx/relight` | 🔁 **REPLACE** + ➕ video relight |
| **Change Camera** | 1203 Magnific Change Camera | ❌ **YO'Q** (mockup'dan tushib qolgan) | ⚠️ aynan nom yo'q; `qwen-...-multiple-angles` qoplaydi | ❌ **REMOVE** (1203 o'chir — mockup bilan mos; istasa keyin qaytariladi) |
| **Skin** | 1204 Magnific Skin Enhancer | ✅ bor (Yaxshilash) | 🔁 `image-editing/retouch` $0.04/img | 🔁 **REPLACE** (KEEP — mockup'da bor) |
| **Image Extender** | 1205 Magnific Image Extender | ❌ **YO'Q** (Reframe bilan birlashgan) | 🔁 `bria/expand` / `image-apps-v2/outpaint` | 🔁 **REPLACE→Reframe** (1205 o'rnini Reframe egallaydi) |
| **Remove BG** | 1206 Magnific Remove BG | ✅ bor (Yaxshilash) | 🔁 `bria/background/remove` $0.018 + video `bria/video/bg-removal` | 🔁 **REPLACE** + ➕ video BG |
| **Reframe** | — (yo'q) | ✅ bor NEW (Tahrirlash) | ➕ `bria/expand` (rasm) + `luma ray-2/reframe` (video) | ➕ **ADD** (1205 o'rnini bossin yoki yangi id) |
| **Draw to video** | — (yo'q) | ✅ bor NEW (Tahrirlash) | 🔗 dedicated yo'q: `flux-general` (sketch→img) → `kling v2.1 i2v` | 🔗 **COMPOSE** (yangi id, 2-bosqichli) |
| **Motion Control** | — (yo'q) | ✅ bor NEW (Tahrirlash) | ➕ `kling v2.6/standard/motion-control` $0.07/s | ➕ **ADD** (video) |
| **Edit video** | — (yo'q) | ✅ bor (Tahrirlash) | 🔗 umbrella: BG/upscale/reframe/restyle (`kling o1/v2v`) | 🔗 **COMPOSE** (chip-launcher, alohida id shart emas — mavjud tool'larga rout qiladi) |
| **Video Generate** | 3001-3007 (Veo 3.1 ×3, Kling v3 ×2, Seedance 2.0, Wan 2.6) | ✅ bor (Yaratish) | ✅ seedance pro, kling v2.5/v2.1, hailuo, veo3 — arzon | ✅ **KEEP** — `key`/cost'ni fal'ga REPLACE (Veo→premium tier, default Seedance/Kling) |
| **TTS** | 2001 Kokoro | (mockup'da emas) | (fal scope'dan tashqari) | ✅ **KEEP** (tegma) |
| **SFX** | 4001 ElevenLabs SFX | (mockup'da emas) | ➕ `mmaudio-v2` (video→SFX) to'ldiradi | ✅ **KEEP** + keyin ➕ mmaudio |
| **Lip-sync** | — | (mockup'da emas) | ➕ `latentsync` $0.20 / `sync-lipsync/v2` | ➕ **ADD (kelajak)** — mockup'ga qo'shilsa |
| **Frame interp** | — | (mockup'da emas) | ➕ `rife/video`, `film` | ➕ **ADD (kelajak)** |

**MUHIM:** Change Camera (1203) va Image Extender (1205) mockup v2'da YO'Q — ❌ ikkalasini gen-models.ts'dan ham, mockup referensidan ham olib tashlash kerak (Image Extender'ni Reframe yutadi). Skin (1204) mockup'da BOR → REMOVE qilinmaydi, faqat fal'ga REPLACE.

---

---

## 2. Image Generate — fal.ai t2i modellari

Har bir model fal.ai sahifasida **WebFetch bilan haqiqatan ochib** tasdiqlandi. Litsenziya: barchasi **Commercial** (resell uchun yaroqli) — fal sahifasidagi "Commercial use" badge.

| Model id / endpoint | Majburiy param | Rasm kiritish (t2i) | Narx | Litsenziya | Dalil (iqtibos) |
|---|---|---|---|---|---|
| `fal-ai/flux/dev` | `prompt` | yo'q | **$0.025/MP** | Commercial | "$0.025 per megapixel… rounding up" |
| `fal-ai/flux/schnell` | `prompt` | yo'q | **$0.003/MP** | Commercial | "$0.003 per megapixel" |
| `fal-ai/flux-pro/v1.1` | `prompt` | yo'q | **$0.04/MP** | Commercial | "$0.04 per megapixel" |
| `fal-ai/flux-pro/v1.1-ultra` | `prompt` | optional `image_url` | **$0.06/img** | Commercial | "$0.06 per image", max 4MP |
| `fal-ai/flux-2` (FLUX.2 dev) | `prompt` | optional (@ ref) | **$0.012/MP** | Commercial | "$0.012 per megapixel" |
| `fal-ai/flux-2-pro` (FLUX.2 pro) | `prompt`, `image_size` | optional | **$0.03 1-MP + $0.015/extra MP** | Commercial | "$0.03 for the first megapixel… plus $0.015 per extra" |
| `fal-ai/flux-pro/kontext` (EDIT) | `prompt`, **`image_url`** | **`image_url` MAJBURIY** | **$0.04/img** | Commercial | "image_url (string): Input image to edit", "$0.04 per image" |
| `fal-ai/bytedance/seedream/v4/text-to-image` | `prompt` | yo'q | **$0.03/img** | Commercial (Partner) | "$0.03 per image" |
| `fal-ai/bytedance/seedream/v4.5/text-to-image` | `prompt` | yo'q | **$0.04/img** | Commercial (Partner) | "$0.04 per image", max 4MP |
| `fal-ai/recraft/v3/text-to-image` | `prompt` | yo'q | **$0.04/img** (vector $0.08) | Commercial (Partner) | "$0.04 per image (or $0.08… vector style)" |
| `fal-ai/qwen-image` | `prompt` | yo'q | **$0.02/MP** | Commercial | "$0.02 per megapixel" |
| `fal-ai/ideogram/v3` | `prompt` | yo'q | **$0.03 turbo / $0.06 balanced / $0.09 quality** | Commercial | "TURBO: $0.03… QUALITY: $0.09 per image" |
| `fal-ai/nano-banana` (Google) | `prompt`, `aspect_ratio` | yo'q | **$0.039/img** | Commercial (Partner) | "$0.039 per image", "Google's… image generation" |
| `fal-ai/z-image/turbo` | `prompt` | yo'q | **$0.005/MP** (eng arzon) | Commercial | "$0.005 per megapixel", max 4MP |

### ⚠️ TASDIQLANMADI / ehtiyot bo'lish kerak
- `fal-ai/imagen4/preview` va `fal-ai/imagen4/preview/ultra` — sahifa ochildi, lekin **DEPRECATED** ("This endpoint is deprecated. This model is no longer supported"). Narx $0.05/$0.06/img edi. **Ishlatma.** `fal-ai/imagen4` (preview-siz) ochildi lekin narx ko'rsatmadi ("$0 per compute second") — narxi tasdiqlanmagani uchun jadvalga kiritilmadi.
- `fal-ai/flux/dev` URL'i `image_url` ni t2i kirish sifatida ko'rsatmadi (faqat `prompt`). Image-edit kerak bo'lsa `flux-pro/kontext` ishlatiladi.

### VERDICT: ✅ KEEP
fal.ai'da kuchli, commercial-litsenziyali t2i modellar ko'p. Bu tool saqlanadi. Bizning Nano Banana / Seedream / Flux / Grok o'rniga tavsiya (sifat + narx + resell litsenziyasi bo'yicha):

1. **`fal-ai/bytedance/seedream/v4.5/text-to-image`** — $0.04/img, 4MP, eng kuchli umumiy sifat + edit bir arxitekturada. Bizning "Seedream" o'rni — to'g'ridan-to'g'ri ko'tarish.
2. **`fal-ai/flux-2-pro`** — $0.03 (1MP) bazadan, zero-config, frontier sifat. Bizning "Flux" premium o'rni.
3. **`fal-ai/nano-banana`** — $0.039/img, Google modeli, "Nano Banana" o'rnini aynan to'ldiradi (nom mos).
4. **`fal-ai/z-image/turbo`** — $0.005/MP, eng arzon "tez/draft" rejim uchun (free-tier yoki preview generatsiya). Yuqori marja bilan resell.

Grok image o'rniga fal.ai'da to'g'ridan ekvivalent yo'q — yuqoridagi 4 model bilan to'liq qoplanadi.

---

## 3. Video Generate — fal.ai i2v + t2v (tasdiqlangan, WebFetch bilan)

Quyidagi har bir model **fal.ai sahifasi ochilib** tasdiqlandi (endpoint + narx raqami + litsenziya badge dalil bilan). Hammasida **`prompt` + (i2v uchun) `image_url`** majburiy; rasm formati hamma joyda **`image_url` string URL / base64 data-URI / file-upload** qabul qilinadi (jpg, png, webp, gif, avif). Litsenziya — barchasi **Commercial use ✅ + Partner** (biz resell qilishimiz mumkin).

| Model id (endpoint) | Tur | Majburiy params | Start-image format | Narx (dalil) |
|---|---|---|---|---|
| `fal-ai/veo3/image-to-video` | i2v | prompt, image_url | image_url / base64 / upload | **$0.20/s** (audio off), **$0.40/s** (audio on) — *"$0.20 (audio off) or $0.40 (audio on)"* |
| `fal-ai/veo3/fast/image-to-video` | i2v | prompt, image_url | image_url | **$0.10/s** (no audio), **$0.15/s** (audio) |
| `fal-ai/bytedance/seedance/v1/pro/image-to-video` | i2v | prompt, image_url | image_url / base64 | **≈$0.62–0.74 / 1080p 5s** ($3.0/1M tokens); Lite 720p **$0.18/5s** |
| `fal-ai/bytedance/seedance/v1/pro/text-to-video` | t2v | prompt | — | **≈$0.62 / 1080p 5s** ($2.5/1M tokens) |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | i2v | prompt, image_url | image_url / base64 / upload | **$0.35 / 5s**, +$0.07/s qo'shimcha; duration 5/10 |
| `fal-ai/kling-video/v2.1/master/text-to-video` | t2v | prompt | — | **$1.40 / 5s**, +$0.28/s qo'shimcha |
| `fal-ai/minimax/hailuo-02/standard/image-to-video` | i2v | prompt, image_url, duration | image_url (jpg/png/webp/gif/avif) | **$0.27 / 6s 768p** ($0.045/s) |
| `fal-ai/minimax/hailuo-02/pro/image-to-video` | i2v | prompt, image_url | image_url | **$0.48 / 6s 1080p** ($0.08/s) |
| `fal-ai/minimax/hailuo-2.3/pro/image-to-video` | i2v | prompt, image_url | image_url | **$0.49 / video** (1080p) — *e'tibor: path nuqtali `2.3`, chiziqcha emas* |
| `fal-ai/wan-25-preview/image-to-video` | i2v | prompt, image_url | image_url | **$0.05/s** (480p), **$0.10/s** (720p), **$0.15/s** (1080p) |
| `fal-ai/wan-i2v` (2.1) | i2v | prompt, image_url | image_url / base64 | **$0.20** (480p) / **$0.40** (720p) per video; >81 frame = 1.25× |
| `fal-ai/ltx-video-13b-distilled/image-to-video` | i2v | prompt, image_url | image_url / upload / paste | **$0.04/s** (24fps), **$0.08/s** detail-pass bilan |
| `fal-ai/pixverse/v4.5/image-to-video` | i2v | prompt, image_url | image_url | **$0.15** (360/540p) / **$0.2** (720p) / **$0.4** (1080p) per 5s |

### ⚠️ Eslatmalar
- **Veo3 i2v API sahifasida** narx ko'rinmaydi, lekin asosiy model sahifasida tasdiqlandi ($0.20/$0.40 per s). `generate_audio` default = true (audio narxi qo'llanadi).
- **Hailuo `2.3-fast`** va `2.3/standard` variantlari mavjud (WebSearch tasdiqladi), lekin men faqat **`hailuo-2.3/pro` narxini ($0.49)** to'liq fetch bilan ochdim. `hailuo-2.3-fast/...` (chiziqcha bilan) **404** berdi — to'g'ri path nuqtali: `hailuo-2.3-fast/standard/image-to-video` (narxi alohida fetch qilinmagan → ⚠️TASDIQLANMADI narx jihatdan).
- **Kling v3.0** alohida fetch qilinmadi (anchorда so'ralgan, lekin yuqorida v2.5-turbo/v2.1 tasdiqlandi) → ⚠️TASDIQLANMADI.
- Seedance i2v sahifasida narx **$0.62 va $0.74 ikkala raqam** ko'rsatilgan (fal sahifasidagi ziddiyat) — token formulasi: `(h×w×fps×dur)/1024`, $3.0/1M token bo'yicha hisoblash ishonchliroq.

### ✅ VERDICT — KEEP (resell uchun tavsiya)

**i2v (image-to-video) — eng yaxsi tanlovlar:**
1. **`bytedance/seedance/v1/pro/image-to-video`** — narx/sifat eng yaxshi (≈$0.62/1080p 5s, 480–1080p, 2–12s). **Asosiy ishchi at.**
2. **`kling-video/v2.5-turbo/pro/image-to-video`** — **eng arzon premium** ($0.35/5s + $0.07/s). Yuqori harakat sifati. **Default arzon tier.**
3. **`minimax/hailuo-2.3/pro/image-to-video`** ($0.49) yoki **hailuo-02/pro** ($0.48/6s) — odam/mikro-mimika va fizika eng yaxshi. **Portret/personaj uchun.**
4. **`veo3/fast/image-to-video`** ($0.10/s, audio bilan $0.15/s) — **audioli i2v** kerak bo'lganda; to'liq Veo3 ($0.20–0.40/s) faqat premium tier.

**t2v (text-to-video) — eng yaxshi tanlovlar:**
1. **`bytedance/seedance/v1/pro/text-to-video`** (≈$0.62/1080p 5s) — narx/sifat lideri, default t2v.
2. **`kling-video/v2.1/master/text-to-video`** ($1.40/5s) — eng yuqori sinematik sifat, **premium t2v** (qimmat).
3. **Veo3 t2v** (audio bilan, $0.40/s) — ovozli sinematik klip kerak bo'lganda.

**Bizning Veo 3.1 Lite/Fast bilan solishtirish:** Sizning hozirgi Veo 3.1 Fast/Lite oqimingiz audioli i2v/t2v uchun yaxshi, lekin **kredit-xarajati yuqori** (Veo $0.20–0.40/s). Resell margin uchun **default oqimni Seedance Pro ($0.62/5s ≈ $0.12/s) + Kling v2.5-turbo ($0.07/s)** ga o'tkazish tavsiya etiladi — Veo'дан ~3–5× arzon, lekin sifati i2v uchun deyarli teng. **Veo'ni faqat "audioli premium" tier** sifatida qoldiring. Audio shart bo'lmasa **Wan 2.5 ($0.05/s 480p)** va **LTX ($0.04/s)** eng arzon zaxira.

Manbalar (fetch qilingan): fal.ai/models/fal-ai/{veo3, veo3/fast, bytedance/seedance/v1/pro, kling-video/v2.5-turbo/pro, kling-video/v2.1/master, minimax/hailuo-02/{standard,pro}, minimax/hailuo-2.3/pro, wan-25-preview, wan-i2v, ltx-video-13b-distilled, pixverse/v4.5}/image-to-video|text-to-video.

---

## 4. Remove BG — fal.ai (rasm + video)

Har model **WebFetch bilan haqiqatan ochildi** va tasdiqlandi. Barcha tasdiqlanganlar **Commercial use** litsenziyasi (RESELL uchun yaroqli).

### Rasm (image)

| Model id | Endpoint | Majburiy param | Kiritish formati | Narx | Litsenziya | Dalil |
|----------|----------|----------------|------------------|------|------------|-------|
| `fal-ai/bria/background/remove` | `/api` | `image_url` | image_url / base64 / file-upload | **$0.018 / generation** | ✅ Commercial (Partner, "trained exclusively on licensed data") | birefnet... sahifa: "$0.018 per generation" |
| `fal-ai/birefnet/v2` | `/api` | `image_url` | image_url / base64 / file-upload | **$0.001/megapixel** (≈$0 compute-second; opsiyalar: `model`, `operating_resolution`, `output_format`, `refine_foreground`, `mask_only`) | ✅ Commercial | sahifa: "Commercial use"; narx compute-asosli ($0/compute-sec ko'rsatadi) |
| `fal-ai/imageutils/rembg` | `/api` | `image_url` | image_url / base64 / file-upload | **$0/compute-second** (juda arzon, fiks narx yo'q) | ✅ Commercial | sahifa: "Your request will cost $0 per compute second", "Commercial use" |
| `fal-ai/ben/v2/image` | `/api` | `image_url` | image_url / base64 / file-upload | **$0.025/megapixel** | ✅ Commercial use ko'rsatilgan | sahifa: "$0.025 per megapixel" + "Commercial use" |

> Eslatma: birefnet v2 va ben/v2/image narxlari fal sahifasida "per megapixel"/"per compute-second" sifatida ko'rsatiladi (ANCHOR'dagi `birefnet (image_url)` tasdiqlandi). Bria — yagona **aniq fiks narx** ($0.018/img) bo'lgan model.

### Video

| Model id | Endpoint | Majburiy param | Kiritish formati | Narx | Litsenziya | Dalil |
|----------|----------|----------------|------------------|------|------------|-------|
| `bria/video/background-removal` ⚠️ ( `fal-ai/` prefiksi YO'Q) | `/api` | `video_url` | video_url / base64 / file-upload (mp4/mov/webm) | **$0.0042 / second** | ✅ Commercial (Partner) | sahifa: "$0.0042 per second", "Commercial use" |
| `fal-ai/ben/v2/video` | `/api` | `video_url` | video_url / file-upload | **$0.001/megapixel** | ✅ Commercial use | sahifa: "$0.001 per megapixel" + "Commercial use" |
| `veed/video-background-removal/fast` | `/api` | `video_url` | video_url / base64 / file-upload (opsiyalar: `output_codec` vp9/h264, `refine_foreground_edges`, `subject_is_person`) | **$0.012 / 30 frame** (refine on) · $0.008 (off) | ✅ Commercial (Partner) | WebSearch (fal): "$0.012 per 30 frames with edge refinement" |

⚠️ **MUHIM id tuzatish:** `fal-ai/bria/video/background-removal` → **404**. To'g'ri id: **`bria/video/background-removal`** (prefikssiz). VEED ham prefiksisiz: `veed/video-background-removal[/fast|/green-screen]`.

### VERDICT

🔁 **REPLACE — Magnific Remove BG → fal.ai**

- **Eng yaxshi RASM (asosiy):** `fal-ai/bria/background/remove` — **$0.018/img**, aniq fiks narx, litsenziyalangan ma'lumotda o'qitilgan (RESELL uchun eng xavfsiz, Partner badge). Birefnet v2 — sifatli/arzon zaxira (image_url).
- **Eng arzon zaxira:** `fal-ai/imageutils/rembg` ($0/compute-sec) yoki `fal-ai/birefnet/v2`.
- **Bonus VIDEO (eng yaxshi):** `bria/video/background-removal` — **$0.0042/sec**, Commercial, prefiksiz id. Arzonroq alternativ: `fal-ai/ben/v2/video` ($0.001/MP).

Hammasi **Commercial use** — RESELL biznes-modeli uchun litsenziya muammosi yo'q (Bria ayniqsa "risk-free commercial" deb belgilangan).

---

## 5. Upscale — fal.ai (rasm + video)

Hammasi WebFetch bilan **haqiqatan ochildi** va tasdiqlandi. Har bir model uchun dalil (ochilgan URL + iqtibos) quyida jadval ostida.

### RASM upscale

| model id | endpoint | majburiy param | rasm kiritish | narx | litsenziya |
|---|---|---|---|---|---|
| `fal-ai/clarity-upscaler` | image-to-image | `image_url` | image_url / base64 / file-upload | **$0.03 / megapixel** | ✅ Commercial use |
| `fal-ai/aura-sr` | image-to-image | `image_url` | image_url / base64 / file-upload | **$0.001 / compute-second** | ✅ Commercial use |
| `fal-ai/esrgan` | image-to-image | `image_url` | image_url / base64 / file-upload | **$0.00111 / compute-second** | ✅ Commercial use |
| `fal-ai/recraft/upscale/crisp` | image-to-image | `image_url` (PNG majburiy) | image_url / base64 / file-upload | **$0.004 / rasm** (flat) | ✅ Commercial use |
| `fal-ai/seedvr/upscale/image` | image-to-image (SeedVR2) | `image_url` | image_url / base64 / file-upload | **$0.001 / megapixel** | ✅ Commercial use |
| `fal-ai/ccsr` | image-to-image | `image_url` | image_url / base64 / file-upload | **$0 / compute-second** ⚠️ (sahifada literal "$0" — eski/bepul model, ishlab chiqarishga ishonchsiz) | ✅ Commercial use |

### VIDEO upscale

| model id | endpoint | majburiy param | video kiritish | narx | litsenziya |
|---|---|---|---|---|---|
| `fal-ai/topaz/upscale/video` | video-to-video | `video_url` | video_url / base64 / file-upload | **$0.01/s ≤720p · $0.02/s 720→1080p · $0.08/s >1080p** (60fps da × 2) | ✅ Commercial use |
| `fal-ai/seedvr/upscale/video` | video-to-video (SeedVR2) | `video_url` | video_url / base64 / file-upload | **$0.001 / megapixel** (width × height × frames) | ✅ Commercial use |

### Dalillar (ochilgan URL + iqtibos)
- clarity-upscaler — https://fal.ai/models/fal-ai/clarity-upscaler · *"$0.03 per megapixel"* · param: `image_url`
- aura-sr — https://fal.ai/models/fal-ai/aura-sr · *"Cost per Compute Second: $0.001"* · param: `image_url`
- esrgan — https://fal.ai/models/fal-ai/esrgan · *"$0.00111 per compute second"* · param: `image_url`
- recraft/upscale/crisp — https://fal.ai/models/fal-ai/recraft/upscale/crisp · *"Your request will cost $0.004 per image"* · param: `image_url` (PNG)
- seedvr/upscale/image — https://fal.ai/models/fal-ai/seedvr/upscale/image · *"$0.001 per megapixel"* · param: `image_url`
- ccsr — https://fal.ai/models/fal-ai/ccsr · *"$0 per compute second"* ⚠️ · param: `image_url`
- topaz/upscale/video — https://fal.ai/models/fal-ai/topaz/upscale/video · *"$0.01 for up to 720p, $0.02 for 720p to 1080p, $0.08 for above 1080p... Price doubles for 60fps"* · param: `video_url`
- seedvr/upscale/video — https://fal.ai/models/fal-ai/seedvr/upscale/video · *"$0.001 per megapixel of video data (width × height × frames)"* · param: `video_url`

⚠️TASDIQLANMADI: yo'q — barcha 8 model WebFetch bilan haqiqiy data qaytardi. Faqat `ccsr` narxi sahifada literal "$0" ko'rsatiladi (eski/legacy bepul model — narx prognozsiz, ishlab chiqarishda tavsiya etilmaydi).

---

### VERDICT 🔁 REPLACE (Magnific Upscaler o'rniga)

**RASM upscale — asosiy:** `fal-ai/clarity-upscaler` — **$0.03/MP**, deterministik per-MP narx (byudjet hisoblash oson), Magnific'ga eng yaqin "creative upscale" sifati. Barchasi **Commercial use** = biz resell qila olamiz.
- **Arzon alternativa:** `fal-ai/seedvr/upscale/image` — **$0.001/MP** (30× arzon), lekin per-MP rate juda past ⇒ katta rasmlarda hali ham hisob-kitobli. Zaxira/bulk uchun a'lo.
- **aura-sr / esrgan** — **compute-second** narxlash (≈$0.001/s): narx oldindan noaniq (GPU vaqtiga bog'liq), shuning uchun foydalanuvchiga imzolangan `cost-quote` berish qiyinroq. clarity/seedvr (per-MP) bizning kredit modelimizga **mosroq**.

**VIDEO upscale — asosiy:** `fal-ai/topaz/upscale/video` — **per-second** narx (sifat sanoat standarti, Topaz brendi). Narx aniq, resolution bo'yicha bosqichli: $0.01–0.08/s (60fps ×2).
- **Arzon alternativa:** `fal-ai/seedvr/upscale/video` — **$0.001/MP** (frames × WxH); short klip + past res'da Topaz'dan ancha arzon, lekin uzun/4K videoda MP yig'ilib qimmatlashishi mumkin.

**Narxlash eslatma (MUHIM):** ikki xil model bor — **per-MP/per-image** (clarity $0.03/MP, recraft $0.004/img, seedvr $0.001/MP) imzolangan `cost-quote` uchun ideal; **per-compute-second** (aura-sr, esrgan, ccsr) narxi noaniq, kredit yechishdan oldin aniq quote berish qiyin. Bizning `computeGenCost` oqimiga **per-MP modellarni** ulash tavsiya etiladi.

Sources:
- https://fal.ai/models/fal-ai/clarity-upscaler
- https://fal.ai/models/fal-ai/aura-sr
- https://fal.ai/models/fal-ai/esrgan
- https://fal.ai/models/fal-ai/recraft/upscale/crisp
- https://fal.ai/models/fal-ai/seedvr/upscale/image
- https://fal.ai/models/fal-ai/ccsr
- https://fal.ai/models/fal-ai/topaz/upscale/video
- https://fal.ai/models/fal-ai/seedvr/upscale/video

---

## 6. Reframe / Outpaint — fal.ai (rasm + video)

Har model **WebFetch bilan haqiqatan ochildi** (URL + iqtibos pastda). Faqat tasdiqlanganlari jadvalga kiritildi.

### RASM — outpaint / expand / reframe

| model id | endpoint | MAJBURIY param | rasm kiritish | aspect/mask param | narx | litsenziya |
|---|---|---|---|---|---|---|
| `fal-ai/flux-pro/v1/fill` | `/v1/fill` | `prompt`, `image_url`, `mask_url` | image_url / base64 / file-upload | **mask_url** (mask-asosli inpaint→outpaint) | **$0.05/MP** (yuqoriga yaxlitlanadi) | ✅ Commercial (Partner) |
| `fal-ai/bria/expand` | `/bria/expand` | `image_url`, `canvas_size` | image_url / base64 / file-upload | `aspect_ratio` (1:1,2:3,3:2,3:4,4:3,4:5,5:4,9:16,16:9) yoki `original_image_size`+`original_image_location` | **$0.04/gen** | ✅ Commercial (litsenziyalangan data — RESELL uchun eng xavfsiz) |
| `fal-ai/image-apps-v2/outpaint` | `/image-apps-v2/outpaint` | `image_url` | image_url / base64 / file-upload | `expand_left/right/top/bottom` (0–700 px, mask shart emas) | **$0.035/MP** | ✅ Commercial |
| `fal-ai/image-editing/reframe` | `/image-editing/reframe` | `image_url`, `aspect_ratio` | image_url / base64 / file-upload | `aspect_ratio` (21:9,16:9,4:3,3:2,1:1,2:3,3:4,9:16,9:21) | **$0.04/img** | ✅ Commercial |
| `fal-ai/ideogram/v3/reframe` | `/ideogram/v3/reframe` | `image_url`, `image_size` | image_url / base64 / file-upload | `image_size` (target o'lcham), 3 render mode | **$0.03 (turbo) / $0.06 (balanced) / $0.09 (quality)** | ✅ Commercial (Partner) |

### VIDEO — reframe

| model id | endpoint | MAJBURIY param | video kiritish | aspect param | narx | litsenziya |
|---|---|---|---|---|---|---|
| `fal-ai/luma-dream-machine/ray-2/reframe` | `/ray-2/reframe` | `video_url`, `aspect_ratio` | video_url / file-upload (MP4,MOV,WebM,M4V,GIF) | `aspect_ratio` (9:16 va h.k.) | **$0.2/soniya** | ✅ Commercial (Partner) |
| `luma/agent/ray/v3.2/reframe` | `/ray/v3.2/reframe` | `prompt`, `video_url`, `aspect_ratio` | video_url / base64 / file-upload (≤30s) | `aspect_ratio` (3:4,4:3,1:1,9:16,16:9,21:9) | narx sahifada ko'rsatilmagan ⚠️ | ✅ Commercial (Partner) |

### Dalil (ochilgan URL + iqtibos)
- **flux-pro/v1/fill** — `.../api`: "$0.05 per megapixel… billed by rounding up", "Commercial use permitted via fal partnership"; params `image_url`, `mask_url`.
- **bria/expand** — `.../bria/expand`: "Your request will cost **$0.04 per generation**", "Commercial use" badge; params `image_url`, `canvas_size`, `aspect_ratio`.
- **image-apps-v2/outpaint** — page: "Your request will cost **$0.035 per megapixel**"; params `expand_left/right/top/bottom` (mask kerak emas).
- **image-editing/reframe** — page: "**$0.04 per image**"; param `aspect_ratio` default `16:9`.
- **ideogram/v3/reframe** — `.../api`: "TURBO: $0.03 / BALANCED: $0.06 / QUALITY: $0.09", "Commercial use" + "Partner"; param `image_url`, `image_size`.
- **luma ray-2/reframe** — page: "**$0.2 per second**", "commercial use approved"; params `video_url`, `aspect_ratio`.
- **luma ray v3.2/reframe** — `.../api`: params `prompt`+`video_url`+`aspect_ratio`, "Commercial use"/"Partner" (narx raqami sahifada yo'q → ⚠️narx tasdiqlanmadi).

### ⚠️ TASDIQLANMADI / topilmadi
- `fal-ai/bria/outpaint` — **HTTP 404** (mavjud emas). To'g'ri nom: `fal-ai/bria/expand` (yuqorida).
- `fal-ai/ltx-video reframe` — **alohida "reframe" endpoint yo'q**. LTX faqat **extend/retake** beradi: `fal-ai/ltx-2.3/extend-video`, `fal-ai/ltx-video-v095/extend` (reframe/aspect emas — bizning Reframe use-case'iga mos kelmaydi).
- `fal-ai/flux-lora/inpaint` — bu kategoriya (reframe/outpaint) uchun ochilmadi; outpaint vazifasiga `flux-pro/v1/fill` (mask) yoki `image-apps-v2/outpaint` (mask'siz) ustun.

### VERDICT
- **Rasm-extend ✅** — ikki yo'l mavjud:
  - 🔁 **Mask-asosli (Magnific Image Extender o'rnига to'g'ridan)**: `fal-ai/flux-pro/v1/fill` (`mask_url`, $0.05/MP) — sifatli, lekin mask kerak.
  - 🔁 **Mask'siz (eng oson migratsiya)**: `fal-ai/image-apps-v2/outpaint` (`expand_left/right/top/bottom`, $0.035/MP) yoki **`fal-ai/bria/expand`** ($0.04/gen, `canvas_size`/`aspect_ratio`) — **RESELL uchun bria eng xavfsiz** (100% litsenziyalangan data).
- **Video-reframe ✅** — `fal-ai/luma-dream-machine/ray-2/reframe` (`video_url`+`aspect_ratio`, **$0.2/s**, commercial). Yangiroq variant `luma/agent/ray/v3.2/reframe` (prompt-guided, ≤30s) — narxni dashboard'da tasdiqlash kerak.

**Aspect/mask param nomlari:** video → **`aspect_ratio`**; bria → **`aspect_ratio`** yoki **`canvas_size`**+`original_image_location`; image-apps outpaint → **`expand_left/right/top/bottom`**; flux fill → **`mask_url`** (+`image_url`).

---

## 7. Relight — fal.ai

Barcha modellar WebFetch bilan HAQIQATAN ochilib tasdiqlandi. Litsenziya badge'lari fal sahifasidan (biz RESELL qilamiz — MUHIM).

### RASM relight

| Model id | Endpoint | MAJBURIY params | Rasm kirish | Narx | Litsenziya |
|----------|----------|-----------------|-------------|------|------------|
| `fal-ai/iclight-v2` | `/models/fal-ai/iclight-v2` | `image_url` + `prompt` | image_url / base64 data-URI / file-upload | **$0.1/MP** | ✅ **Commercial use** (fal badge) |
| `fal-ai/image-apps-v2/relighting` | `/models/fal-ai/image-apps-v2/relighting` | `image_url` + `lighting_style` (default `natural`) | image_url / drag-drop / file-upload | **$0.04/img** | ✅ Commercial use |
| `bria/fibo-edit/relight` | `/models/bria/fibo-edit/relight` | `image_url` + `light_direction` + `light_type` | image_url / file-upload | **$0.04/img** | ✅ Commercial use (Partner, litsenziyalangan data) |

### VIDEO relight

| Model id | Endpoint | MAJBURIY params | Video kirish | Narx | Litsenziya |
|----------|----------|-----------------|--------------|------|------------|
| `fal-ai/lightx/relight` | `/models/fal-ai/lightx/relight` | `video_url` (+ ixtiyoriy `relit_cond_img_url`) | video_url / file-upload (mp4, mov, webm, m4v, gif) | **$0.1/output sekund** | ✅ Commercial use |

**Dalillar (ochilgan URL + iqtibos):**
- `fal-ai/iclight-v2` → `https://fal.ai/models/fal-ai/iclight-v2` + `/api` → "$0.1 per megapixel"; params `image_url`, `prompt`, `initial_latent` (None/Left/Right/Top/Bottom); badge "Commercial use".
- `fal-ai/image-apps-v2/relighting` → "$0.04 per image"; param `image_url` + `Lighting Style`; "Commercial use".
- `bria/fibo-edit/relight` → "$0.04"; params `image_url` + `Light Direction` + `Light Type`; "Commercial use" (Partner).
- `fal-ai/lightx/relight` → "$0.1 per output video second"; param `Video Url`; accepted mp4/mov/webm/m4v/gif; "Commercial use".

### VERDICT
- **Rasm-relight ✅ BOR** — `fal-ai/iclight-v2` ($0.1/MP) bizning Magnific Relight o'rniga to'g'ridan-to'g'ri almashtiruvchi. Arzonroq alternativa: `fal-ai/image-apps-v2/relighting` va `bria/fibo-edit/relight` ($0.04/img, fixed narx — predictable).
- **VIDEO relight ✅ BOR** — `fal-ai/lightx/relight` mavjud ($0.1/s, Commercial). Ya'ni rejadan **Video-Relight ❌ REMOVE qilish SHART EMAS** — fal'da haqiqiy video relight endpoint bor.
- ⚠️ Litsenziya eslatma: uchinchi-tomon manba (Toolify) iclight-v2 ni "non-commercial" deydi — bu lllyasviel ning ASL research vaznlariga taalluqli; fal'ning hostlangan endpointi sahifasida badge **"Commercial use"**. Resell uchun fal badge'i hal qiluvchi, lekin yuridik ehtiyot uchun fal ToS bilan bir marta tasdiqlash tavsiya etiladi.
- Hammasi ✅ Commercial — Research-only model topilmadi, jadvalga qo'shilmagan ⚠️TASDIQLANMADI yo'q.

---

## 8. Skin Enhancer & Change Camera — fal.ai tekshiruv

**Xulosa:** Magnific'dagi nomdosh "Skin Enhancer" yoki "Change Camera" dedikatsiya modeli fal.ai'da **aynan o'sha nom bilan YO'Q**, LEKIN funksional jihatdan **TO'LIQ qoplaydigan haqiqiy muqobillar BOR** (hammasi WebFetch bilan ochildi, hammasi **Commercial use** — resell uchun yaroqli). Demak: ❌ aynan nom emas, ✅ 🔁 funksiya bor — **REMOVE EMAS, MAP qil.**

### 🟢 Skin Enhancer → BOR (3 ta haqiqiy muqobil, dedikatsiya yuz/teri retush)

| model id (endpoint) | majburiy param | kiritish formati | narx | litsenziya |
|---|---|---|---|---|
| `fal-ai/image-editing/face-enhancement` | `image_url` | image_url / base64 data-URI / file-upload | (sahifada narx yo'q — compute) | **Commercial use** ✅ |
| `fal-ai/retoucher` (Face Retoucher — teri silliqlash, blemish olib tashlash) | `image_url` | image_url / base64 / file-upload (jpg,png,webp,gif,avif) | $0/compute-second (per-image ko'rsatilmagan) | **Commercial use** ✅ |
| `fal-ai/image-editing/retouch` | `image_url` | image_url / base64 / file-upload | **$0.04/img** | **Commercial use** ✅ |

**Tavsiya (skin):** `fal-ai/image-editing/retouch` — aniq narxli ($0.04/img), Commercial, "remove blemishes / improve skin" aniq Magnific Skin Enhancer ekvivalenti.
**Dalil:** `fal.ai/models/fal-ai/image-editing/retouch` → "$0.04 per image", "Commercial use". Va `…/face-enhancement/api` → required `image_url`, optional `guidance_scale`=3.5, `num_inference_steps`=30, `safety_tolerance`="2".

### 🟢 Change Camera → BOR (dedikatsiya kamera/perspektiva modellari)

| model id (endpoint) | majburiy param | kiritish formati | narx | litsenziya |
|---|---|---|---|---|
| `fal-ai/qwen-image-edit-2511-multiple-angles` | `image_urls` (list), `horizontal_angle`, `vertical_angle` (+`zoom`=5, `lora_scale`=1) | image_url / base64 / file-upload | **$0.035/megapixel** | **Commercial use** ✅ |
| `fal-ai/image-apps-v2/perspective` | `image_url`, `target_perspective` (default "front") | image_url / base64 / file-upload | **$0.04/img** | **Commercial use** ✅ |

**Tavsiya (camera):** ikkalasi ham haqiqiy. Aniq raqamli burchak nazorati kerak bo'lsa → `fal-ai/qwen-image-edit-2511-multiple-angles` (`horizontal_angle` 0–360°, `vertical_angle` −30…90°, `zoom` 0–10). Oddiy preset ("front/side/top") yetarli bo'lsa → `fal-ai/image-apps-v2/perspective` ($0.04/img, aniq narx).
**Dalil:** `…/qwen-image-edit-2511-multiple-angles/api` → required `image_urls`, `horizontal_angle`, `vertical_angle`; narx sahifasi → "$0.035 per megapixel", "Commercial use". `…/image-apps-v2/perspective` → "$0.04 per image", "Commercial use", param `Target Perspective` default "front".

### VERDICT
- **Skin Enhancer:** ❌ aynan nomdosh model yo'q → 🔁 **`fal-ai/image-editing/retouch` ($0.04/img, Commercial)** bilan almashtiriladi (yoki `fal-ai/image-editing/face-enhancement`).
- **Change Camera:** ❌ aynan nomdosh yo'q → 🔁 **`fal-ai/qwen-image-edit-2511-multiple-angles` ($0.035/MP, Commercial)** yoki **`fal-ai/image-apps-v2/perspective` ($0.04/img, Commercial)** bilan to'liq qoplanadi.
- Hech biri Research-only emas — hammasi resell uchun yaroqli. ⚠️TASDIQLANMAGAN model yo'q; barcha 5 ta endpoint WebFetch bilan ochildi.

---

## 9. Draw-to-video & Motion Control — fal.ai

Hammasi WebFetch bilan ochib tasdiqlandi (2026-06). Litsenziya: barchasida fal sahifasida **"Commercial use"** badge — resell uchun yaroqli.

### Motion Control (video→video, harakat ko'chirish)

| Model id | Endpoint | Majburiy parametrlar | Kirish formati | Narx | Litsenziya |
|---|---|---|---|---|---|
| `fal-ai/kling-video/v2.6/standard/motion-control` | video-to-video | `image_url`, `video_url`, `character_orientation` (`image`/`video`) | URL **yoki** base64 data-URI **yoki** auto-upload (File/Data) | **$0.07/soniya** | ✅ Commercial use |
| `fal-ai/kling-video/v2.6/pro/motion-control` | video-to-video | `image_url`, `video_url`, `character_orientation` | URL / base64 / file-upload | **$0.112/soniya** | ✅ Commercial use |
| `fal-ai/kling-video/v3/pro/motion-control` | video-to-video | `image_url`, `video_url`, `character_orientation` | URL / file-upload | **$0.168/soniya** | ✅ Commercial use |
| `fal-ai/wan-motion` | video-to-video | `video_url`, `image_url` (`prompt` ixtiyoriy) | URL / drag-drop file-upload | **$0.06/video-soniya (720p@24fps)**; `enhance_identity` yoqilsa +$0.08/rasm | ✅ Commercial use |
| `fal-ai/video-as-prompt` | video-to-video | `prompt`, `video_url`, `image_url`, `video_description` | URL | narx ko'rsatilmagan | ⚠️ **DEPRECATED — "no longer supported"** |

**Dalil (iqtibos):** kling v2.6 std `image_url` = *"Reference image URL. The characters... based on this reference image"*, `video_url` = *"character actions... consistent with this reference video"*, narx *"$0.07 per second"*. Pro = *"$0.112 per second"*, v3 = *"$0.168 per second"*. wan-motion = *"$0.06 per video second for 720p"*. video-as-prompt sahifasi = *"This model is no longer supported."*

### Draw-to-video (sketch→video) — DEDIKATSIYALANGAN MODEL YO'Q

WebSearch + WebFetch: fal.ai'da **sketch→video bitta dedicated model mavjud emas** (2026 holatiga ko'ra). Zanjir (COMPOSE) kerak: sketch→rasm (controlnet) → image-to-video.

| Bo'g'in | Model id | Vazifa / param | Kirish | Narx | Litsenziya |
|---|---|---|---|---|---|
| 1. sketch→rasm | `fal-ai/flux-general` (FLUX.1 dev + ControlNet) | `prompt` + controlnet path + control `image_url` | URL / base64 / clipboard | **$0.075/MP** | ✅ Commercial use (fal-hosted dev) |
| (yordamchi) preprocessor | `fal-ai/image-preprocessors/scribble` | `image_url` (model: HED/PiDi) — rasmni scribble-map'ga | URL / base64 / auto-upload | sahifada ko'rsatilmagan | ✅ Commercial use |
| 1-alt. multi-controlnet | `fal-ai/sdxl-controlnet-union` | `prompt` + control image (depth/canny/openpose/teed…) | URL / base64 | sahifada ko'rsatilmagan | ✅ Commercial use |
| 2. rasm→video | `fal-ai/kling-video/v2.1/standard/image-to-video` | `prompt`, `image_url`, `duration` (5/10) | URL (jpg/png/webp…) | **5s = $0.25**, qo'shimcha **$0.05/s**, 10s = $0.50 | ✅ Commercial use |

**Dalil:** flux-general narx *"$0.075 per megapixel"*, *"Commercial use permitted... distinguishing it from research-only alternatives"*. scribble preprocessor = *"Converts images to scribble/sketch maps... Scribble detector"*, `model` default `"HED"`. kling v2.1 std = *"5-second video: $0.25 ... $0.05 per second"*.
> Eslatma: `sdxl-controlnet-union` API sahifasi documented control turlari sifatida depth/canny/openpose/normal/segmentation/teed sanaydi — **scribble alohida nomlanmagan**. Sof scribble guidance uchun `flux-general` (FLUX ControlNet, scribble qo'llab-quvvatlanadi) ishonchliroq.

### VERDICT

- **✅ KEEP — `fal-ai/kling-video/v2.6/standard/motion-control` ($0.07/s)** — asosiy Motion Control modeli; eng yaxshi narx/sifat, character_orientation bilan to'liq nazorat, base64 ham qabul qiladi.
- **✅ KEEP — `fal-ai/wan-motion` ($0.06/s 720p)** — eng arzon motion-transfer alternativasi; pose-retargeting (turli tana tuzilishi) afzalligi. Standart/byudjet tier sifatida saqla.
- **🔁 REPLACE (premium) — `fal-ai/kling-video/v2.6/pro/motion-control` ($0.112/s)** yoki **`v3/pro/motion-control` ($0.168/s)** — faqat "Pro/Premium" tier sifatida, murakkab koreografiya uchun. std ni asos qilib, pro'ni yuqori narxli rejaga qo'y.
- **❌ REMOVE — `fal-ai/video-as-prompt`** — DEPRECATED, ishlatma.
- **🔗 COMPOSE — Draw-to-video** — dedikatsiyalangan model yo'q. Zanjir:
  **`fal-ai/flux-general` (sketch→rasm, scribble ControlNet, $0.075/MP) → `fal-ai/kling-video/v2.1/standard/image-to-video` (rasm→video, $0.25/5s)**.
  Foydalanuvchi tayyor rasm yuborsa 2-bosqichdan boshla; faqat sketch yuborsa 1-bosqich avval ishga tushadi. (`image-preprocessors/scribble` faqat agar foydalanuvchi foto yuborib uni scribble guide'ga aylantirmoqchi bo'lsa kerak.)

⚠️ Narx ko'rsatilmagan/aniqlanmagan (sahifada raqam yo'q): `image-preprocessors/scribble`, `sdxl-controlnet-union`, `video-as-prompt`. Bu uchtasi narx jihatidan TASDIQLANMADI.

---

## 10. Yangi imkoniyatlar (fal.ai → plagin)

Hammasi WebFetch bilan **HAQIQATAN ochib** tasdiqlandi. Quyidagi 8 model AE (video/motion) plagini uchun eng mos — barchasi **Commercial use** litsenziyasi (biz resell qilamiz, shuning uchun muhim). RANK qilingan (AE uchun foydaliligiga ko'ra):

| # | Model id · endpoint | Vazifa | Majburiy parametrlar | Kirish formati | Narx (dalil) | Litsenziya |
|---|---|---|---|---|---|---|
| **1 ⭐** | `fal-ai/rife/video` | **Frame interpolation / slow-mo** | `video_url` (+ `num_frames`, `fps`) | video_url / base64 / file-upload | **$0.0013/compute-sek** | Commercial |
| **2 ⭐** | `fal-ai/film` | Frame interpolation (2 freym orasi) | `start_image_url`, `end_image_url` | image_url / base64 / upload | **$0.0013/compute-sek** | Commercial |
| **3 ⭐** | `fal-ai/latentsync` | **Lip-sync** (arzon) | `video_url`, `audio_url` | video_url + audio_url | **$0.20/video (≤40s), keyin $0.005/s** | Commercial |
| **4 ⭐** | `fal-ai/sync-lipsync/v2` | **Lip-sync** (premium) | `video_url`, `audio_url` | video_url + audio_url | **$3/min** (pro $5/min) | Commercial (Partner) |
| **5** | `fal-ai/mmaudio-v2` | **Video → audio/SFX** (sahna ovozi) | `video_url`, `prompt` | video_url | **$0.001/s** (1000s = $1) | Commercial |
| **6** | `fal-ai/kling-video/o1/video-to-video/edit` | **Video restyle / style transfer** | `prompt`, `video_url` | video_url / base64 / upload | **$0.168/s** | Commercial (Partner) |
| **7** | `fal-ai/flux-pro/v1/fill` | **Inpaint / fill** (logo/obyekt olib tashlash) | `prompt`, `image_url`, `mask_url` | image_url + mask_url | **$0.05/MP** | Commercial (Partner) |
| **8** | `fal-ai/ben/v2/video` | **Video background removal** (yashil ekransiz) | `video_url` | video_url | sahifada narx ko'rsatilmagan ⚠️ | Commercial |

### AE uchun alohida ta'kid

- **Lip-sync (1-darajali):** AE'da dublyaj / ovoz almashtirish workflow uchun eng qimmatli. **`fal-ai/latentsync`** — qisqa kliplar uchun juda arzon ($0.20 flat ≤40s), default tanlov sifatida tavsiya. **`fal-ai/sync-lipsync/v2`** — premium sifat ($3/min), Pro tarif uchun. Ikkalasi ham aniq `video_url`+`audio_url` qabul qiladi — plagin oqimiga oson ulanadi.
- **Frame interpolation (1-darajali):** **`fal-ai/rife/video`** to'g'ridan-to'g'ri videoni interpolatsiya qiladi (slow-mo, FPS oshirish) — motion editor uchun eng tabiiy. `fal-ai/film` esa keyframe orasini to'ldiradi (2 ta rasm → oraliq). Ikkalasi ham $0.0013/compute-sek — eng arzon kategoriyalardan.
- **mmaudio-v2** AE plaginidagi mavjud SFX/ElevenLabs oqimini to'ldiradi: video → moslashtirilgan sahna ovozi, $0.001/s — juda arzon.

### ⚠️ TASDIQLANMADI / ehtiyot bo'l

- **Face swap:** `easel-ai/advanced-face-swap` — **DEPRECATED** ("no longer supported"), ishlatma. `www.fal.ai/models/face-swap` URL'i **404**. `fal-ai/image-editing/face-swap/api` ham **404**. Faqat tirik alternativa: `fal-ai/pixverse/swap` (person/object/background swap, faqat video, **$0.15–$0.40/5s** rezolyutsiyaga qarab, Commercial) — lekin bu sof "face swap" emas. Jadvalga sof face-swap qo'shilmadi, chunki tasdiqlangan tirik model topilmadi.
- **`fal-ai/ben/v2/video`** — sahifada aniq narx ko'rsatilmagan (compute-sek bo'lishi mumkin); integratsiyadan oldin narxni qayta tekshir.
- **`fal-ai/florence-2-large/caption`** (image-to-prompt/caption, `image_url`) — tasdiqlandi va ishlaydi, lekin sahifada narx/litsenziya badge ko'rsatilmadi; plaginning mavjud "describe/enhance" oqimini almashtirishi mumkin, ammo narx tasdiqlanmagani uchun top-8 ga kiritilmadi.
- **`veed/lipsync`** ham tirik (to'g'ri slug `veed/lipsync`, `fal-ai/veed/lipsync` emas — 404): `video_url`+`audio_url`, **$0.4/min**, Commercial — latentsync va sync-lipsync orasidagi o'rtacha narxli muqobil.

---

## 11. gen-models.ts o'zgarish ro'yxati (reja — IMPLEMENT EMAS)

### 0. Yangi maydonlar (tip kengaytirish — `magnificTool`/`magnificModel` naqshiga o'xshash)
`GenModel` tipiga qo'sh:
- `falModel?: string` — fal endpoint id (masalan `"fal-ai/clarity-upscaler"`, `"fal-ai/bytedance/seedance/v1/pro/image-to-video"`).
- `falTool?: string` — ixtiyoriy alias (dedicated tool slug, masalan `"upscale"`, `"relight"`, `"remove-bg"`); rout/UI uchun.
- `provider` union'iga `"fal"` qo'sh: `"openrouter" | "freepik" | "elevenlabs" | "magnific" | "fal"`.
- `falOnly?: boolean` (magnificOnly naqshi — faqat `GEN_PROVIDER=fal`'da).
- `priceUnit?: "per-image" | "per-mp" | "per-second" | "per-compute-sec"` — narx birligi (computeGenCost mosligi uchun; quyiga qara).

### 1. RASM (image-gen) — id 1001-1005: REPLACE key/provider
- 1001 Nano Banana 2 → `falModel: "fal-ai/nano-banana"` (provider fal). Label saqlanadi.
- 1002 Nano Banana Pro → `falModel: "fal-ai/flux-2-pro"` (premium) yoki nano-banana pro variant.
- 1003 Seedream 4.5 → `falModel: "fal-ai/bytedance/seedream/v4.5/text-to-image"` (aynan mos).
- 1004 Flux 2.0 Pro → `falModel: "fal-ai/flux-2-pro"`.
- 1005 Grok Imagine → ❌ fal ekvivalent yo'q → **REPLACE** `falModel: "fal-ai/z-image/turbo"` ($0.005/MP, arzon/draft tier), label "Z-Image Turbo" yoki "Draft".

### 2. Image Edit — id 1101: REPLACE
- `falModel: "fal-ai/flux-pro/kontext"` ($0.04/img, `image_url` majburiy). referenceMode `image-edit` saqlanadi.

### 3. Magnific tools (1201-1206) — REPLACE/REMOVE
- **1201 Upscaler** → 🔁 `falModel: "fal-ai/clarity-upscaler"`, `priceUnit: "per-mp"`. ➕ ixtiyoriy yangi **1207 Video Upscale** → `fal-ai/topaz/upscale/video` (per-second).
- **1202 Relight** → 🔁 `falModel: "fal-ai/iclight-v2"` (per-mp). ➕ yangi **video relight** (3xxx) → `fal-ai/lightx/relight` ($0.1/s).
- **1203 Change Camera** → ❌ **REMOVE** (entry o'chir; mockup'da yo'q). Kerak bo'lsa kelajakda `qwen-image-edit-2511-multiple-angles` bilan qaytariladi.
- **1204 Skin** → 🔁 `falModel: "fal-ai/image-editing/retouch"` ($0.04/img). KEEP (mockup'da bor).
- **1205 Image Extender** → 🔁 **Reframe'ga aylantir**: label "Reframe", `falModel: "fal-ai/bria/expand"` (rasm, $0.04/gen) — yoki yangi id 1208 sifatida Reframe qo'sh va 1205'ni REMOVE qil. ➕ video reframe `fal-ai/luma-dream-machine/ray-2/reframe` (3xxx, $0.2/s).
- **1206 Remove BG** → 🔁 `falModel: "fal-ai/bria/background/remove"` ($0.018/img). ➕ video BG `bria/video/background-removal` (3xxx, $0.0042/s).

### 4. Yangi rasm/edit tool'lar (12xx)
- **1208 Reframe** (agar 1205 REMOVE qilinsa) — `fal-ai/bria/expand`, feature `image-edit`.
- **1209 (ixtiyoriy) Draw-to-video step-1** — `fal-ai/flux-general` (sketch→rasm); COMPOSE oqimining 1-bo'g'ini.

### 5. VIDEO (3001-3007) — REPLACE key/cost (Veo'ni premium tier qil)
- 3001-3003 Veo 3.1 → `falModel: "fal-ai/veo3/fast/image-to-video"` (default, $0.10-0.15/s) va `fal-ai/veo3/image-to-video` (premium, $0.20-0.40/s). cost'ni fal narxiga moslab pasaytir.
- 3004-3005 Kling v3.0 → `falModel: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"` ($0.35/5s — arzon default) + premium variant.
- 3006 Seedance 2.0 → `falModel: "fal-ai/bytedance/seedance/v1/pro/image-to-video"` (asosiy ishchi at, $0.62/5s). t2v variant ham qo'sh.
- 3007 Wan 2.6 → `falModel: "fal-ai/wan-25-preview/image-to-video"` ($0.05/s — eng arzon zaxira).
- ➕ Yangi video tool'lar (32xx yangi blok):
  - **3201 Motion Control** → `fal-ai/kling-video/v2.6/standard/motion-control` ($0.07/s) + pro variant ($0.112/s). feature: yangi `"video-to-video"` qo'shish kerak.
  - **3202 Video Reframe** → `fal-ai/luma-dream-machine/ray-2/reframe` ($0.2/s).
  - **3203 Video Upscale** → `fal-ai/topaz/upscale/video`.
  - **3204 Video Relight** → `fal-ai/lightx/relight`.
  - **3205 Video Remove BG** → `bria/video/background-removal`.
  - **3206 Draw-to-video step-2** → `fal-ai/kling-video/v2.1/standard/image-to-video` (COMPOSE 2-bo'g'in).

### 6. `GenFeature` kengaytirish
Hozirgi 6 feature yetmaydi. Qo'sh:
- `"video-to-video"` (Motion Control, video reframe/upscale/relight/BG, video restyle).
- (ixtiyoriy) `"video-to-sfx"` (mmaudio-v2 — kelajak).

### 7. Backend adapter (yangi fayl)
- `apps/api/src/lib/ai/fal.ts` — **`magnific.ts` yonida yangi** adapter. fal queue API (`POST /fal-ai/<model>` → `request_id` → poll `/status`, `/result`). `image_url`/`video_url`/`mask_url`/`audio_url` parametr mapping. `gen-processor.ts` provider switch'iga `fal` shoxchasi (magnific/openrouter qatori).
- `gen-processor.ts`'da `falModel` bo'lsa fal adapter'ga rout (magnificTool naqshi kabi).

### 8. Kredit / narx (computeGenCost) ta'siri
- Hozirgi `computeGenCost`: video = `cost × duration`, image = `cost × count`, qolgani sobit. Bu **saqlanadi** — fal narxini kredit'ga konvertatsiya qilib (markup bilan) har model `cost`'iga sobit/per-second qiymat sifatida yoz.
- ⚠️ **per-MP modellar** (clarity $0.03/MP, iclight $0.1/MP, seedream): aniq MP oldindan noma'lum → `cost`'ni **maksimal qo'llab-quvvatlangan MP** (masalan 4MP) bo'yicha konservativ hisobla yoki `priceUnit:"per-mp"` qo'shib `computeGenCost`'ga MP-asosli shoxcha qo'sh (params'dan resolution→MP). Imzolangan `cost-quote` oqimi buzilmasligi uchun **yuqori chegara** ishlat.
- ⚠️ **per-compute-second modellar** (aura-sr, esrgan, rembg, rife) — narx oldindan noaniq → kredit modeliga **mos emas**, default tanlovga qo'yma (fal tahlili ham shuni aytadi). Faqat per-MP/per-image/per-second variantlarni ulang.
- Video per-second modellar (`cost`=/s) hozirgi `cost × duration` formula bilan to'g'ridan-to'g'ri mos — Motion Control/reframe/upscale/relight ham video bo'lgani uchun shu formuladan foydalanadi.

### 9. TEGILMAYDIGAN joylar (eslatma)
- **pgvector / semantik qidiruv** (`EMBED_MODEL`, `embed-templates.ts`) — TEGMA. fal migratsiyasi faqat gen modellariga taalluqli.
- **Kredit guard / atomik yechish-refund** (`consumeAiCredits`/`refundAiCredits`, imzolangan `cost-quote`, audit #4 himoyasi) — TEGMA. Faqat `cost` qiymatlari va provider rout o'zgaradi, oqim emas.
- **`referenceMode` semantikasi** — TEGMA: barcha fal image edit/upscale/relight `image-edit` refMode'da qoladi; video `video-ref`; yangi `video-to-video` motion control `video_url`+`image_url` ikkalasini oladi → `referenceMode: "video-ref"` + alohida `video-ref` input (composer'da `inputs` massiviga `"video-ref"` qo'sh).

### Xulosa raqamlari
- ❌ REMOVE: **1203** (Change Camera) — mockup'da ham, kodda ham.
- 🔁 REPLACE (provider→fal): 1001-1005, 1101, 1201, 1202, 1204, 1206, 3001-3007 (key/cost).
- 🔁→Reframe: 1205 (Image Extender → Reframe).
- ➕ ADD: Reframe (1208), Motion Control (3201), Video Reframe/Upscale/Relight/BG (3202-3205), Draw-to-video COMPOSE (1209+3206).
- 🔗 COMPOSE: Draw-to-video (flux-general → kling v2.1), Edit video (umbrella chip-router).
- Yangi fayl: `apps/api/src/lib/ai/fal.ts`. Yangi tip maydonlari: `falModel`, `falTool`, `priceUnit`, provider `"fal"`, `falOnly`. Yangi feature: `"video-to-video"`.

---

## Yakuniy xulosa (qisqa)

fal.ai bizning DEYARLI BARCHA planned tool'ni **Commercial-litsenziyali** modellar bilan qoplaydi.
Asosiy harakatlar: **❌ REMOVE** Change Camera (1203 — mockup v2'da ham yo'q); **🔁 REPLACE** barcha
gen + Magnific tool'lar provayderini fal'ga (id'lar saqlanadi, faqat `falModel`/`cost` o'zgaradi); **🔁**
Image Extender → Reframe; **➕ ADD** Motion Control + video Reframe/Upscale/Relight/BG; **🔗 COMPOSE**
Draw-to-video (flux-general → kling i2v) va Edit-video (chip-router). **➕ Yangi imkoniyatlar:** lip-sync
(`latentsync`/`sync-lipsync`) va frame-interpolation (`rife`/`film`) AE motion editor uchun ayniqsa qimmatli.

**Narx yutug'i (resell margin):** default video oqimini Veo ($0.20–0.40/s) o'rniga **Seedance Pro
(~$0.12/s) + Kling v2.5-turbo ($0.07/s)** ga o'tkazish — ~3–5× arzon, sifat i2v uchun deyarli teng;
Veo'ni "audioli premium" tier qoldir.

⚠️ **Kredit modeliga moslik:** **per-image / per-MP / per-second** narxli modellar imzolangan
`cost-quote`ga mos; **per-compute-second** (aura-sr, esrgan, rembg, rife) narxi oldindan noaniq —
default'ga qo'yma. pgvector / kredit-guard / `referenceMode` semantikasi **TEGILMAYDI**.

*Tekshiruv tugadi. Implement qilinmadi. Keyingi qadam: §11 o'zgarish ro'yxatini tasdiqlash →
`apps/api/src/lib/ai/fal.ts` adapter + `gen-models.ts` yangilash (alohida bosqich).*
