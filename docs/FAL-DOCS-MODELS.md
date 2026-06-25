# fal.ai — Model API Schema Ma'lumotnomasi (faza 2 adapter uchun)

> **Maqsad:** AssetFlow plagini (faza 2) Studio Gen AI tool'lari uchun fal.ai'da
> tasdiqlangan HAR model'ning API schema'si — bitta joyda.
> **Manba:** `docs/FAL-AI-CATALOG.md` (verdict) + `docs/FAL-API-NOTES.md` §9 (model ID'lar).
> **Metod:** har model `https://fal.ai/models/<id>` (+ `/api`) WebFetch bilan HAQIQATAN ochildi (2026-06-24).
> Faqat sahifada KO'RILGAN ma'lumot yozildi — taxmin yo'q. Topilmaganlar **❓ topilmadi**.

## Chaqirish mexanikasi (universal — barcha modellarga taalluqli)

- **Endpoint:** `https://queue.fal.run/<model-id>` (async, tavsiya) yoki `https://fal.run/<model-id>` (sinxron).
- **Auth:** header `Authorization: Key $FAL_KEY` (server-side, Render env).
- **Oqim (faza 2):** `submit` (async) → poll YOKI `webhook_url` (sekin video'lar uchun).
- **Output:** JSON + media **CDN URL** (`*.fal.media` / `storage.googleapis.com`). Natija darrov R2'ga yuklanadi (`getPublicOrSignedUrl`).
- **Input format:** deyarli barcha modellar `image_url`/`video_url`/`audio_url` ni qabul qiladi: **URL string · base64 data-URI · drag-drop/clipboard/file-upload**. Qabul qilinadigan kengaytmalar (rasm): jpg, jpeg, png, webp, gif, avif; (video): mp4, mov, webm, m4v, gif; (audio): mp3, ogg, wav, m4a, aac.
- ⚠️ **Output shakli nomuvofiqligi:** ko'p video model `{ "video": { "url": ... } }` qaytaradi, LEKIN `fal-ai/lightx/relight` `{ "video": "<url-string>" }` qaytaradi (string, obyekt emas). Parser'da hisobga ol.

> **Narx eslatma:** narxlar 2026-06-24 holatiga. fal narxi o'zgaradi — integratsiyadan oldin qayta tasdiqlа.
> **Litsenziya:** "Partner" = fal sherikligi orqali Commercial; "Commercial use" (Partner'siz) ham resell uchun yaroqli.

---

## 1. Image Generate (text-to-image)

| Model id | Majburiy | Rasm kirish | Asosiy ixtiyoriy params | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/nano-banana-2` | `prompt` | yo'q (t2i) | `aspect_ratio` (auto,21:9,16:9,3:2,4:3,5:4,1:1,4:5,3:4,2:3,9:16), `resolution` (1K/2K/4K/512), `num_images` 1-4, `enable_web_search`, `enable_google_search` | `images[].url` (PNG/JPEG/WebP) | **$0.08/img** (2K ×1.5, 4K ×2, 512 ×0.75; web search +$0.015; high thinking +$0.002) | Commercial · Partner | fal.ai/models/fal-ai/nano-banana-2 |
| `fal-ai/nano-banana-pro` | `prompt` | yo'q (t2i) | `aspect_ratio` (xuddi yuqoridagi ro'yxat), `resolution` (1K/2K/4K), `num_images` | `images[].url` | **$0.15/img** (4K ×2; web search +$0.015) | Commercial · Partner | fal.ai/models/fal-ai/nano-banana-pro |
| `fal-ai/flux-2-flex` | `prompt` | optional (@ref) | `image_size` (1K/2K/2.3K), `num_inference_steps` (10-50), `guidance_scale`, `seed`, `output_format` (jpeg/png) | `images[].url` | **$0.05/MP** (input+output side, MP ga yaxlitlanadi; 1920×1080 = $0.10) | Commercial · Partner | fal.ai/models/fal-ai/flux-2-flex |
| `fal-ai/bytedance/seedream/v4.5/text-to-image` | `prompt` | yo'q (t2i) | `aspect_ratio` (masalan `auto_2K`, 1920-4096px), `max_images` 1-6, `seed`, `enable_safety_checker`, `sync_mode` | `images[].url` + `seed` | **$0.04/img** (max 4MP / 2048²) | Commercial · Partner | fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image |
| `fal-ai/recraft/v4/pro/text-to-image` | `prompt` | yo'q (t2i) | ❓ topilmadi (collapsed; color palette / aspect / text-render mavjud deyilgan, aniq kalit ko'rinmadi) | `images[].url` (WebP) | **$0.25/img** | Commercial · Partner | fal.ai/models/fal-ai/recraft/v4/pro/text-to-image |

**Tavsiya (verdict KEEP):** asosiy = `seedream/v4.5` ($0.04) yoki `flux-2-flex` ($0.05/MP); arzon/tez = `nano-banana-2` ($0.08); premium reasoning = `nano-banana-pro` ($0.15). `recraft/v4/pro` ($0.25) eng qimmat — faqat vektor/typografiya premium.

> Eslatma: §9'dagi `fal-ai/flux-2-flex` tasdiqlandi (FLUX.2 [flex]). Katalog §2'dagi `flux-2`/`flux-2-pro` boshqa variantlar — flex bu yerda asosiy.

---

## 2. Image Edit (reference-asosli)

| Model id | Majburiy | Rasm kirish | Asosiy ixtiyoriy params | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/nano-banana-2/edit` | `prompt` + **`image_urls`** (1-14 rasm) | image_url list / base64 / upload | `aspect_ratio` (auto,21:9…9:16), `resolution` (1K/2K/4K), `num_images` 1-4, `enable_web_search` | `images[].url` | **$0.08/img** (2K ×1.5, 4K ×2, 512 ×0.75) | Commercial · Partner | fal.ai/models/fal-ai/nano-banana-2/edit |
| `fal-ai/flux-pro/kontext` | `prompt` + **`image_url`** | image_url / base64 / upload | `guidance_scale`, `num_inference_steps`, `seed` (aspect_ratio formada ko'rinmadi) | `images[].url` (+seed, width, height, has_nsfw_concepts) | **$0.04/img** | Commercial · Partner | fal.ai/models/fal-ai/flux-pro/kontext |

**Tavsiya:** ko'p-referensli kompozit/style-transfer = `nano-banana-2/edit` (14 rasmgacha); oddiy single-image edit = `flux-pro/kontext` ($0.04, arzon).

---

## 3. Video Generate (i2v + t2v)

### Image-to-Video (i2v)

| Model id | Majburiy | Start-image | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | `prompt`, `image_url` | image_url / base64 / upload | `tail_image_url` (oxirgi kadr), duration 5/10 | `video.url` | **$0.35 / 5s**, +$0.07/s | Commercial · Partner | fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video |
| `fal-ai/bytedance/seedance/v1/pro/image-to-video` | `prompt`, `image_url` | image_url / base64 / upload | resolution (1080p/720p), duration | `video.url` + `seed` | **≈$0.62 / 1080p 5s** ($2.5/1M token: `(h×w×fps×dur)/1024`) | Commercial · Partner | fal.ai/models/fal-ai/bytedance/seedance/v1/pro/image-to-video |
| `fal-ai/veo3.1/image-to-video` | `prompt`, `image_url` | image_url / base64 / upload | `aspect_ratio` (auto/16:9/9:16), `resolution` (720p/1080p/4K), `audio` (bool) | `video.url` | **$0.20/s** (audio off), **$0.40/s** (audio on) 720p/1080p; 4K $0.40/$0.60 | Commercial · Partner | fal.ai/models/fal-ai/veo3.1/image-to-video |
| `fal-ai/ltx-2-19b/image-to-video` | `prompt`, `image_url` | image_url / base64 / upload | `end_image_url`, `num_frames`, `video_size` (w×h), `generate_audio` (bool), `use_multi_scale`, `interpolation_direction` | `video.url` (+ width/height/fps/num_frames/duration) | **$0.0018/MP** (w×h×frames; 121f 1280×720 ≈ $0.20) | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/ltx-2-19b/image-to-video |

### Text-to-Video (t2v)

| Model id | Majburiy | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|
| `fal-ai/bytedance/seedance/v1/pro/text-to-video` | `prompt` | `aspect_ratio` (16:9), `duration` (5), resolution | `video.url` + `seed` | **≈$0.62 / 1080p 5s** ($2.5/1M token) | Commercial · Partner | fal.ai/models/fal-ai/bytedance/seedance/v1/pro/text-to-video |
| `fal-ai/veo3.1` | `prompt` | `resolution` (720p/1080p/4K), `audio` (bool), `aspect_ratio` (16:9/9:16), ≤8s @24fps | `video.url` (+file_name/size) | **$0.20/s** (no audio), **$0.40/s** (audio); 4K $0.40/$0.60. Fast tier: $0.10 / $0.15 | Commercial · Partner | fal.ai/models/fal-ai/veo3.1 |
| `fal-ai/kling-video/v2.1/master/text-to-video` | `prompt` | `duration` (5), `aspect_ratio` (16:9) | `video.url` | **$1.40 / 5s**, +$0.28/s | Commercial · Partner | fal.ai/models/fal-ai/kling-video/v2.1/master/text-to-video |
| `fal-ai/sora-2/text-to-video` | `prompt` | `resolution`, `aspect_ratio` (16:9), `duration` (4), `delete_video`, `model` (sora-2) | `video.url` + `video_id` | **$0.10/s** | Commercial · Partner | fal.ai/models/fal-ai/sora-2/text-to-video |

**Tavsiya (verdict KEEP):**
- **i2v default arzon:** `kling-video/v2.5-turbo/pro` ($0.07/s) yoki `seedance/v1/pro` (≈$0.12/s).
- **i2v audioli premium:** `veo3.1/image-to-video` (audio bilan $0.40/s) yoki `ltx-2-19b` (audioli, eng arzon ≈$0.20/5s).
- **t2v default:** `seedance/v1/pro/text-to-video` (≈$0.62/5s) yoki `sora-2` ($0.10/s).
- **t2v sinematik premium:** `kling-video/v2.1/master` ($1.40/5s) yoki `veo3.1` (audio).

> ⚠️ §9'dagi `fal-ai/kling-video/o3/standard/image-to-video` (start+end frame) bu yig'imda ALOHIDA tasdiqlanmadi — kerak bo'lsa keyin fetch qil.

---

## 4. Remove Background

### Rasm

| Model id | Majburiy | Kirish | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|
| `fal-ai/bria/background/remove` | `image_url` | image_url / base64 / upload | `image.url` (PNG + alpha) | **$0.018/generation** | Commercial · Partner (100% litsenziyalangan data) | fal.ai/models/fal-ai/bria/background/remove |

### Video

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `bria/video/background-removal` ⚠️(`fal-ai/` prefiksisiz) | `video_url` | video_url / base64 / upload | `background_color` (default Black), `output_container_and_codec` (default webm_vp9) | `video.url` | **$0.14/second** | Commercial · Partner | fal.ai/models/bria/video/background-removal |

> ⚠️ Bria video narxi sahifada **$0.14/s** ko'rsatildi (katalog §4'dagi $0.0042/s eski qiymat — joriy sahifa ustun). Endpoint id'da `fal-ai/` prefiksi YO'Q.

---

## 5. Upscale

### Rasm

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/clarity-upscaler` | `image_url` | image_url / base64 / upload | `upscale_factor` (def 2), `creativity` (0.35), `resemblance` (0.6), `guidance_scale` (4), `num_inference_steps` (18), `prompt`, `negative_prompt`, `seed`, `enable_safety_checker` | `image.url` (+seed, w, h) | **$0.03/megapixel** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/clarity-upscaler |

### Video

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/topaz/upscale/video` | `video_url` | video_url / base64 / upload | `scale` (def 2); qolgani "Additional Settings" ichida ❓ | `video.url` | **$0.01/s ≤720p · $0.02/s 720→1080p · $0.08/s >1080p** (60fps ×2; Gaia 2 yarmiga) | Commercial · Partner | fal.ai/models/fal-ai/topaz/upscale/video |

---

## 6. Reframe / Outpaint

### Rasm

| Model id | Majburiy | Kirish | Aspect/expand param | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/bria/expand` | `image_url`, **`canvas_size`** (list [w,h]) | image_url / base64 / upload | `canvas_size`; (original_image_location/aspect_ratio "Additional Settings" ichida ❓) | `image.url` (+w/h/size) | **$0.04/generation** | Commercial · Partner | fal.ai/models/fal-ai/bria/expand |
| `fal-ai/image-editing/reframe` | `image_url` | image_url / base64 / upload | `aspect_ratio` (default 16:9) | `images[].url` | **$0.04/image** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/image-editing/reframe |

### Video

| Model id | Majburiy | Kirish | Aspect param | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/luma-dream-machine/ray-2/reframe` | `video_url`, **`aspect_ratio`** (def 9:16) | video_url / base64 / upload | "Additional Settings" ichida ❓ | `video.url` | **$0.2/second** | Commercial · Partner | fal.ai/models/fal-ai/luma-dream-machine/ray-2/reframe |

> **Param nomi farqi:** bria → `canvas_size` (list); image-editing/reframe → `aspect_ratio`; luma video → `aspect_ratio`.

---

## 7. Relight

### Rasm

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/iclight-v2` | `image_url`, `prompt` | image_url / base64 / upload | `initial_latent` (None/Left/Right/Top/Bottom), `num_inference_steps` (28), `cfg` (1), `guidance_scale` (5), `lowres_denoise` (0.98), `highres_denoise` (0.95), `num_images`, `output_format` (jpeg) | `images[].url` | **$0.1/megapixel** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/iclight-v2 |

> ⚠️ `iclight-v2` da raqamli `light_direction` param YO'Q — yorug'lik prompt orqali (+`initial_latent` yo'nalishi bilan) boshqariladi.

### Video

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/lightx/relight` | `video_url` | video_url / upload | `relit_cond_img_url` (optional conditioning rasm) | ⚠️ `video` = **string URL** (obyekt emas) | **$0.1/output video second** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/lightx/relight |

---

## 8. Skin (retouch)

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/image-editing/retouch` | `image_url` | image_url / base64 / upload | "Additional Settings" ichida ❓ | `images[].url` | **$0.04/image** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/image-editing/retouch |

---

## 9. Motion Control

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/kling-video/v2.6/standard/motion-control` | `image_url`, `video_url`, `character_orientation` | image_url + video_url (URL/base64/upload) | `prompt` (default bor), `character_orientation` (default "video") | `video.url` | **$0.07/second** | Commercial · Partner | fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control |

> Pro/premium variantlar (katalog §9): `v2.6/pro` ($0.112/s), `v3/pro` ($0.168/s) — bu yig'imda aynan fetch qilinmadi, katalogdan olingan.

---

## 10. Lip-sync

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/sync-lipsync/v2` | `video_url`, `audio_url` | video_url + audio_url (URL/upload) | `model` (lipsync-2 / lipsync-2-pro), `sync_mode` (cut_off/loop/bounce/silence/remap) | `video.url` | **$3/min** (lipsync-2); $5/min (pro) | Commercial · Partner | fal.ai/models/fal-ai/sync-lipsync/v2 |
| `fal-ai/latentsync` | `video_url`, `audio_url` | video_url + audio_url | "Additional settings" ❓ | `video.url` (+meta) | **$0.2 / ≤40s**, keyin **$0.005/s** | Commercial (Partner badge yo'q; ByteDance OSS) | fal.ai/models/fal-ai/latentsync |

**Tavsiya:** qisqa klip arzon = `latentsync` ($0.2 flat ≤40s); premium sifat = `sync-lipsync/v2` ($3/min).

---

## 11. Video → SFX/Audio

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/mmaudio-v2` | `video_url`, `prompt` | video_url (+ matn; text-only ham) | `duration` (1-30s), `num_inference_steps` (4-50, def 25), `cfg_strength` (0-20, def 4.5), `negative_prompt` | `video.url` (audio bilan birga video) | **$0.001/second** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/mmaudio-v2 |

---

## 12. Frame Interpolation

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/rife/video` | `video_url` | video_url / upload | `num_frames` | `video.url` | **$0.0013/compute-second** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/rife/video |
| `fal-ai/film` | `start_image_url`, `end_image_url` | 2× image_url / upload | `num_frames` | `images[].url` | **$0.0013/compute-second** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/film |

> `rife` = videoni interpolatsiya (slow-mo / FPS↑); `film` = 2 keyframe orasini to'ldirish.

---

## 13. TTS (Text-to-Speech)

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/chatterbox/text-to-speech` | `text` | text (+ optional `audio_url` ovoz referens) | `audio_url` (voice clone), `exaggeration`, `cfg` | `audio.url` (wav) | **$0.025 / 1000 belgi** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/chatterbox/text-to-speech |
| `fal-ai/minimax/speech-02-hd` | `text` | text | `voice_setting` (`voice_id` masalan Wise_Woman, `speed` 0.5-2, `vol`, `pitch`), `output_format` (mp3/wav/flac/pcm), emotion, 30+ til | `audio.url` (mp3) | **$0.1 / 1000 belgi** | Commercial · Partner | fal.ai/models/fal-ai/minimax/speech-02-hd |
| `fal-ai/dia-tts/voice-clone` | `text` | text + ovoz namuna (referens-audio kaliti ❓) | ❓ topilmadi (collapsed) | `audio.url` (wav) | **$0.04 / 1000 belgi** | Commercial (Partner badge yo'q) | fal.ai/models/fal-ai/dia-tts/voice-clone |

---

## 14. Music / SFX (generativ audio)

| Model id | Majburiy | Kirish | Asosiy ixtiyoriy | Output | Narx | Litsenziya | Manba |
|---|---|---|---|---|---|---|---|
| `fal-ai/elevenlabs/music` | `prompt` YOKI `composition_plan` | text / structured plan | `composition_plan` (`positive_global_styles[]`, `negative_global_styles[]`, `sections[]`) | `audio.url` (mp3) | **$0.8 / output audio daqiqa** (daqiqaga yaxlitlanadi) | Commercial · Partner | fal.ai/models/fal-ai/elevenlabs/music |
| `fal-ai/beatoven/sound-effect-generation` | ❓ topilmadi | ❓ | ❓ | ❓ | ❓ | ❓ | **sahifa bo'sh/yetib bo'lmadi** (base + /api + openapi.json hammasi bo'sh — model o'chirilgan/nomi o'zgargan bo'lishi mumkin) |
| `fal-ai/beatoven/music-generation` | ❓ topilmadi | ❓ | ❓ | ❓ | ❓ | ❓ | **sahifa bo'sh/yetib bo'lmadi** (xuddi shu — qo'lda brauzerda tekshirish kerak) |

> ⚠️ **Beatoven (ikkala endpoint)** WebFetch'da bo'sh javob qaytardi (base, /api, openapi.json — barchasi). Model deprecated/renamed bo'lishi mumkin. Music/SFX uchun hozircha **`fal-ai/elevenlabs/music`** ($0.8/min) yagona tasdiqlangan generativ audio. SFX uchun video→audio = `fal-ai/mmaudio-v2` (§11), va mavjud ElevenLabs SFX integratsiyasi.

---

## Qisqa litsenziya/narx xulosasi

- **Commercial use** — barcha tasdiqlangan modellar resell uchun yaroqli. **Partner** badge: nano-banana-2/pro, flux-2-flex, seedream/4.5, recraft/v4/pro, flux-pro/kontext, bria (barcha), topaz, luma ray-2, kling (2.5/2.1/2.6/sora/veo3.1), minimax/speech-02, elevenlabs/music, sync-lipsync. **Partner'siz Commercial:** clarity-upscaler, image-editing/reframe & retouch, iclight-v2, lightx/relight, latentsync, mmaudio-v2, rife, film, ltx-2-19b, chatterbox, dia-tts.
- **Narx birliklari (cost-quote uchun MUHIM):**
  - **per-image / per-generation** (deterministik — eng oson quote): seedream $0.04, kontext $0.04, bria/remove $0.018, bria/expand $0.04, reframe $0.04, retouch $0.04, nano-banana-2 $0.08, nano-banana-pro $0.15, recraft $0.25.
  - **per-megapixel:** flux-2-flex $0.05, clarity $0.03, iclight $0.1, ltx-2-19b $0.0018, nano-banana (rate × resolution).
  - **per-second (video):** kling-2.5 $0.07, veo3.1 $0.20/$0.40, sora $0.10, motion-control $0.07, luma reframe $0.2, lightx $0.1, bria video $0.14, topaz $0.01-0.08, mmaudio $0.001.
  - **per-1000-belgi (TTS):** chatterbox $0.025, dia $0.04, minimax $0.1. **per-minute:** sync-lipsync $3, elevenlabs/music $0.8.
  - **per-compute-second (noaniq quote):** rife $0.0013, film $0.0013.

---

*Yangilangan: 2026-06-24 — fal.ai model sahifalari WebFetch bilan tasdiqlandi.*
