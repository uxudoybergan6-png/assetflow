# AssetFlow AI Tools prototip — REVIEW (implement'дан oldin)

> **Maqsad:** `design-preview/ai-tools-prototype.html` ни fal.ai HAQIQATига solishtirib tekshirish —
> implement'дан OLDIN. **Hech narsa implement qilinmadi** — faqat tahlil + xatolar ro'yxati.

## Metod
- **Jonli tekshiruv:** prototipдagi BARCHA model ro'yxati (IMG 10 · VID 12 · IEDIT 8 · VEDIT 8 · I3D 8 ·
  OPS 18 · VTT/ITP/PA LLM) — har model `https://fal.ai/models/<id>` sahifasidan **WebFetch/WebSearch**
  bilan ochib tasdiqlandi (2026-06-24). Manba: `docs/FAL-AI-CATALOG.md`, `FAL-DOCS-MODELS.md`,
  `FAL-API-NOTES.md`, `FAL-DOCS-CORE.md` + jonli fal sahifalari. **Taxmin yo'q** — ⚠️TASDIQLANMADI belgilangan.
- HOLAT belgilari: ✅ to'g'ri · ❌ fal'да yo'q/noto'g'ri nom · ⚠️ deprecated/tasdiqlanmadi · 🔁 eskirgan (yangiroq bor).

## Top-line xulosa
- **Prototip KUCHLI:** ~64 modeldan aksariyati fal'да HAQIQATAN mavjud; ko'p narx/param fal sahifalaridan
  to'g'ridan olingan (Bernini 576/848/1280, Editto 480/580/720, Seedream ref:10, Nano Banana ref:14 — aynan mos).
- **3 BLOCKER:** (1) **LLM router (VTT/ITP/PA) butunlay DEPRECATED endpoint'да** (`any-llm`+`vision` "no longer
  supported") + 3 xayoliy nom (Gemini 3/3.1 Pro, Claude Sonnet 4.6 — fal'да yo'q); (2) UX: `run()` natijani
  **HIST'ga qo'shмайди** (gen→tarix oqimi uzilgan); (3) UX: **estimate haqiqiy narxга ulanмаган** (indeks formula).
- **~10 naming/versiya tuzatish:** id prefikslari aralash (`openai/`, `bytedance/`, `decart/`, `xai/`,
  `bria/video/...` — `fal-ai/` siz); versiya (`veo3.1`, `wan-25-preview`, `ltx-2-19b`); Lucy Fast deprecated;
  Seedance "edit" id yo'q; Tripo H3.1 yo'q (→P1); Rodin 2.0→2.5; "Seedance Pro" tier fal'да yo'q.
- **Eng katta STRUKTURAL bo'shliq:** **AUDIO** (TTS · Musiqa · STT · text-SFX) va **Talking-avatar**
  (OmniHuman/Kling-avatar) UMUMAN yo'q — fal'нинг eng "viral" 2026 kategoriyaси. Lip-sync presetлari real TTS'га ulanмаган.

---

## A) Model xatolar jadvali (prototip vs fal.ai)

## A.1 · IMG (text-to-image) — prototip 10 modeli fal.ai bilan solishtiruv

Manba: prototip `design-preview/ai-tools-prototype.html` (288–297-qatorlar). Har bir fal id `https://fal.ai/models/...` sahifasidan JONLI (WebFetch/WebSearch, 2026-06-24) tasdiqlandi.

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya (t2i) | Param / eslatma (prototip vs fal) | TAVSIYA |
|---|---|---|---|---|---|
| **Auto · tavsiya** | (yo'q — router) | ✅ | t2i meta | Backend o'zi model tanlaydi, fal id shart emas | KEEP — server-side routing |
| **GPT Image 2** | `openai/gpt-image-2` ⚠️(`openai/` namespace, `fal-ai/` EMAS) | ✅ | ✅ t2i | fal'da BOR: low 1024×768 **$0.005** → high 1024² **$0.211** → high 4K **$0.401**. Params: `quality` (low/med/high), `image_size`, `num_images`, `output_format`. Prototip "Sifat/O'lcham/Soni" mos. **Diqqat:** id `fal-ai/gpt-image-2` EMAS — `openai/gpt-image-2`. Muqobil: `fal-ai/gpt-image-1` ($0.011–0.25) yoki `fal-ai/gpt-image-1.5` | KEEP — id `openai/gpt-image-2` yoz. (Eslatma: docs §1/§9'da GPT Image YO'Q edi — bu YANGI tasdiq) |
| **Seedream 4.5** | `fal-ai/bytedance/seedream/v4.5/text-to-image` | ✅ | ✅ t2i | **$0.04/img**, max 4MP. Params: `aspect_ratio`, `max_images` 1-6, `seed`. Prototip "Nisbat/Soni(1-6)/Seed" to'liq mos | KEEP — to'g'ridan ulanadi |
| **Flux 2 Pro** | `fal-ai/flux-2-pro` | ✅ (id), ⚠️ (param) | ✅ t2i | fal'da BOR: **$0.03 (1-MP) + $0.015/qo'shimcha MP**. fal sahifasi "**zero-config** — steps/guidance YO'Q". **AMMO prototip adv'da Steps=56 + Guidance=35 ko'rsatadi** → bu `flux-2-pro`'ga MOS EMAS; bu paramlar `fal-ai/flux-2-flex`'da bor ($0.05/MP). Prototip narxi "$0.03/MP" ham noaniq (aslida 1-MP $0.03 + extra $0.015) | KEEP id, AMMO: Steps/Guidance kerak bo'lsa → **`fal-ai/flux-2-flex`**'ga o'tkaz; yoki `flux-2-pro` qoldirib adv'dan Steps/Guidance'ni olib tashla |
| **Nano Banana 2** | `fal-ai/nano-banana-2` | ✅ | ✅ t2i | **$0.08/img** (2K ×1.5, 4K ×2, 512 ×0.75). Params: `aspect_ratio`, `resolution` (512/1K/2K/4K), `num_images` 1-4, `enable_web_search`. Prototip "Nisbat/Sifat(512-4K)/Soni/Web qidiruv" to'liq mos. (Google modeli; "ref:14" t2i'da emas, edit variantda) | KEEP |
| **Nano Banana Pro** | `fal-ai/nano-banana-pro` | ✅ | ✅ t2i | **$0.15/img** (4K ×2). Params: `aspect_ratio`, `resolution` (1K/2K/4K), `num_images`. Prototip mos | KEEP |
| **Ideogram V3** | `fal-ai/ideogram/v3` | ✅ | ✅ t2i | fal'da BOR: **turbo $0.03 / balanced $0.06 / quality $0.09**. Prototip "Tezlik(Turbo/Balanced/Quality)/Style/Magic prompt" mos (param nomi `rendering_speed`) | KEEP |
| **Qwen Image** | `fal-ai/qwen-image` | ✅ | ✅ t2i | fal'da BOR: **$0.02/MP**. Params: `image_size`, `num_images`, `num_inference_steps`, **Turbo** (acceleration), Loras. Prototip "O'lcham/Soni/Steps/Turbo" to'liq mos | KEEP |
| **Z-Image Turbo** | `fal-ai/z-image/turbo` | ✅ | ✅ t2i | fal'da BOR: **$0.005/MP** (eng arzon), max 4MP. Params: `num_images` 1-4, `num_inference_steps` 1-8 (def 8). Prototip "O'lcham/Soni/Steps=8" mos (Tongyi-MAI 6B) | KEEP |
| **Recraft V4 Pro** | `fal-ai/recraft/v4/pro/text-to-image` | ✅ | ✅ t2i | fal'da BOR (V3 EMAS — **V4 haqiqatan mavjud**): **$0.25/img** (eng qimmat). Params collapsed — color palette/aspect/text-render bor deyilgan, aniq kalit ko'rinmadi | KEEP — premium vektor/typografiya tier |

### Qisqa xulosa
- **10/10 model fal.ai'da TASDIQLANDI** — ❌ yo'q, ⚠️ deprecated yo'q. Hammasi to'g'ri t2i kategoriyasida.
- **2 ta MUHIM tuzatish kerak:**
  1. **GPT Image 2** → fal id `fal-ai/gpt-image-2` EMAS, balki **`openai/gpt-image-2`** (OpenAI namespace). Bu docs §1/§9'da YO'Q edi — yangi tasdiqlangan model, narx low $0.005 → high 4K $0.401.
  2. **Flux 2 Pro** → id `fal-ai/flux-2-pro` to'g'ri, LEKIN u **zero-config** (Steps/Guidance YO'Q). Prototip adv'dagi **Steps=56 + Guidance=35** bu modelga mos emas — bu paramlar `fal-ai/flux-2-flex`'niki. Yechim: yo `flux-2-flex`'ga o'tkaz, yo prototipdan Steps/Guidance'ni olib tashla. Narx ham aniqlashtir: "$0.03/MP" emas, **$0.03 birinchi MP + $0.015/qo'shimcha MP**.
- **Recraft V4 Pro** tasdiqlandi — V3 emas, haqiqatan **V4 Pro** sahifasi bor ($0.25/img).
- Qolgan 7 model (Seedream 4.5, Nano Banana 2/Pro, Ideogram V3, Qwen Image, Z-Image Turbo, Auto) id + narx + paramlar prototip bilan to'liq mos — o'zgartirishsiz KEEP.

---

## A.2 · VID (video gen) — fal.ai jonli tekshiruv (12 model)

Har model `https://fal.ai/models/<id>` sahifasi WebFetch/WebSearch bilan HAQIQATAN ochib tasdiqlandi (2026-06-24). "Taxmin" yo'q — faqat sahifada ko'rilgani yozildi.

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya | Param/eslatma (sahifadan) | TAVSIYA |
|---|---|---|---|---|---|
| **Auto · tavsiya** | — (fal id yo'q) | ⚠️ TASDIQLANMADI | router (t2v/i2v) | UI-router konsepsiyasi, fal modeli emas — backend o'zi tanlaydi | Saqlash mumkin (front-end router); aniq id Seedance/Kling'ga rout qil |
| **Seedance 2.0** | `bytedance/seedance-2.0/image-to-video` (+`/text-to-video`, `/reference-to-video`) | ✅ to'g'ri | i2v/t2v/ref ✅ | **`fal-ai/` prefiksi YO'Q**. Native audio (SFX+lip-sync) ✅, start+`end_image_url` ✅, davomiylik 4–15s ✅ (prototip 15s mos), Standard 1080p / Fast 720p. **Narx: Standard $0.30/s, Fast $0.24/s** | ✅ KEEP. Prototip "t2v/i2v/ref + audio + end" sahifaga TO'LIQ mos. Eslatma: docs'dagi eski `fal-ai/bytedance/seedance/v1/pro` o'rniga 2.0 yangiroq |
| **Seedance Pro** | `bytedance/seedance-2.0/fast/*` YOKI eski `fal-ai/bytedance/seedance/v1/pro` | ⚠️ TASDIQLANMADI (nom) | i2v/t2v ✅ | fal'da "Pro" tier nomi **YO'Q** — Seedance 2.0 tier'lari **Standard / Fast**. "Arzon · sifatli" ⇒ Fast tier ($0.24/s) | 🔁 Nomni "Seedance Fast"ga o'zgartir yoki `seedance/v1/pro`ga (eski) bog'la. "Pro" yorlig'i fal naming bilan mos emas |
| **Kling turbo** | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | ✅ to'g'ri | i2v ✅ | "Kling 2.5 Turbo Pro" ✅. **end frame = `tail_image_url`** ✅ (prototip "end frame" mos), duration 5/10s. **$0.35/5s + $0.07/s** ✅ (prototip "$0.07/s" mos). Audio sahifada YO'Q | ✅ KEEP. Prototip i2v+end+$0.07/s aniq mos |
| **Kling O3** | `fal-ai/kling-video/o3/standard/image-to-video` | ✅ to'g'ri | i2v ✅ | **start+`end_image_url` ✅, audio ✅ (CN/EN), 3–15s ✅** — prototip "start+end+audio · 3-15s" TO'LIQ mos. Narx: $0.084/s (audio off), $0.112/s (audio on) | ✅ KEEP. fal naming `o3` real (turbo emas, o3 alohida) |
| **Veo 3.1** | `fal-ai/veo3.1/image-to-video` (+`fal-ai/veo3.1` t2v) | ✅ to'g'ri | i2v ✅ (t2v alohida endpoint) | Google Veo 3.1 ✅. Audio ✅, 720p/1080p/4K ✅. **$0.20/s (off) / $0.40/s (on); 4K $0.40/$0.60**. Bu sahifa faqat i2v — t2v uchun `fal-ai/veo3.1` | ✅ KEEP. id `veo3.1` (nuqtali). Eslatma: docs §3'dagi eski `fal-ai/veo3/...` o'rniga `veo3.1` ishlat |
| **Veo 3.1 Fast** | `fal-ai/veo3.1/fast/*` (docs: veo3.1 "Fast tier $0.10/$0.15") | ⚠️ TASDIQLANMADI (alohida sahifa ochilmadi) | i2v/t2v | docs `FAL-DOCS-MODELS.md`'da "Fast tier: $0.10/$0.15" qayd etilgan, lekin men `/fast/` sahifasini alohida ochmadim | Integratsiyadan oldin `fal-ai/veo3.1/fast/image-to-video` sahifasini JONLI tasdiqla |
| **Hailuo 02 Pro** | `fal-ai/minimax/hailuo-02/pro/image-to-video` | ✅ to'g'ri | i2v ✅ | "Hailuo 02 Pro · 1080p" ✅. **start + `End Image Url` ✅** (prototip "start+end" mos), ~6s. **$0.08/s ($0.48/6s)**. Prompt optimizer sahifada ko'rsatilmadi (prototip toggle bor — ⚠️ kichik nomuvofiqlik) | ✅ KEEP. Prototip "i2v · start+end · 1080p" mos. Prompt-optimizer param'ini schema'da tekshir |
| **WAN 2.5** | `fal-ai/wan-25-preview/image-to-video` | ✅ to'g'ri | i2v ✅ | "Wan 2.5" ✅. **audio/musiqa kiritish ✅** (prototip "musiqa qo'shish" mos), 480/720/1080p ✅. **$0.05 / $0.10 / $0.15 /s** ✅ | ✅ KEEP. id `wan-25-preview` (preview suffiks shart). Prototip rezolyutsiya+musiqa mos |
| **PixVerse 4.5** | `fal-ai/pixverse/v4.5/image-to-video` | 🔁 eskirgan (v5.5 chiqdi) | i2v ✅ | "PixVerse v4.5" ✅. **Style (anime/3D/clay/comic/cyberpunk) ✅** (prototip "Anime/3D/Clay" mos), **camera movement param ✅** (prototip "camera" mos). $0.15/$0.2/$0.4 per 5s. ⚠️ prototip "8s" beradi — sahifa 1080p=5s cheklov | 🔁 Ishlaydi, lekin `fal-ai/pixverse/v5.5/image-to-video` yangiroq — yangilashni ko'rib chiq. Duration 8s'ni 5s'ga tekshir |
| **LTX-2** | `fal-ai/ltx-2-19b/image-to-video` | ✅ to'g'ri | i2v ✅ | "LTX-2" ✅. **`end_image_url` ✅** (prototip "end frame" mos), **`generate_audio` toggle ✅** (prototip "Audio" mos), `num_frames` param ✅ (prototip 97/121/161 — sahifa preset ko'rsatmadi, faqat "configurable"). **$0.0018/MP** (≈$0.20/121f) | ✅ KEEP. id `ltx-2-19b` (`ltx-video`/`ltx-2` EMAS — to'liq `ltx-2-19b`). Kadr presetlar param tekshir |
| **Sora 2** | `fal-ai/sora-2/text-to-video` (+`/pro`) | ✅ to'g'ri | t2v ✅ | OpenAI Sora 2 ✅ (fal HOSTLAYDI). audio ✅, 16:9, ~4s. **$0.10/s** ✅. Prototip faqat `modes:["t2v"]` — to'g'ri (i2v sahifada asosiy emas) | ✅ KEEP. fal Sora 2'ni HAQIQATAN hostlaydi — id `sora-2` |

### Qisqa xulosa

- **✅ to'g'ri (8):** Seedance 2.0, Kling turbo (v2.5-turbo/pro), Kling O3 (o3/standard), Veo 3.1 (veo3.1), Hailuo 02 Pro, WAN 2.5 (wan-25-preview), LTX-2 (ltx-2-19b), Sora 2 — hammasi fal'da JONLI mavjud, kategoriya (i2v/t2v) va modes/end-frame/audio/duration sahifaga mos.
- **⚠️ TASDIQLANMADI (3):** **Auto** (fal modeli emas, UI-router — saqlanadi, lekin id biriktirish kerak); **Seedance Pro** (fal'da "Pro" tier YO'Q — Standard/Fast; nomni to'g'rila); **Veo 3.1 Fast** (`/fast/` sahifasi alohida ochilmadi — integratsiyadan oldin tasdiqla).
- **🔁 eskirgan (1):** **PixVerse 4.5** — ishlaydi, lekin `pixverse/v5.5` yangiroq.
- **❌ fal'da yo'q:** YO'Q — barcha 12 nom ostidagi modellar fal'da real (faqat Auto router-konsepsiya).

**MUHIM naming tuzatishlar (id mos kelishi uchun):**
1. **Seedance 2.0/Pro** — `fal-ai/` prefiksi **YO'Q**: to'g'ri `bytedance/seedance-2.0/...`. Docs'dagi `fal-ai/bytedance/seedance/v1/pro` eskirgan — 2.0 yangiroq (native audio + reference-to-video). "Pro" → "Fast" yoki "Standard" deb nomla.
2. **Veo** — `fal-ai/veo3.1` (nuqtali), docs §3'dagi `fal-ai/veo3/...` o'rniga.
3. **LTX** — to'liq `fal-ai/ltx-2-19b` (`ltx-video` ham `ltx-2` ham yolg'iz emas).
4. **WAN** — `wan-25-preview` (`preview` suffiks majburiy).
5. **Kling turbo vs O3** — ikkalasi ham real va ALOHIDA: turbo = `v2.5-turbo/pro`, O3 = `o3/standard`.

Sources: [Seedance 2.0 i2v](https://fal.ai/models/bytedance/seedance-2.0/image-to-video), [Seedance 2.0 t2v](https://fal.ai/models/bytedance/seedance-2.0/text-to-video), [Kling O3](https://fal.ai/models/fal-ai/kling-video/o3/standard/image-to-video), [Kling 2.5 turbo](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video), [Veo 3.1](https://fal.ai/models/fal-ai/veo3.1/image-to-video), [Sora 2](https://fal.ai/models/fal-ai/sora-2/text-to-video), [LTX-2 19b](https://fal.ai/models/fal-ai/ltx-2-19b/image-to-video), [WAN 2.5](https://fal.ai/models/fal-ai/wan-25-preview/image-to-video), [Hailuo 02 Pro](https://fal.ai/models/fal-ai/minimax/hailuo-02/pro/image-to-video), [PixVerse v4.5](https://fal.ai/models/fal-ai/pixverse/v4.5/image-to-video)

---

## A.3 · IEDIT (image edit)

Prototip manbasi: `design-preview/ai-tools-prototype.html` (qator 313–321, `var IEDIT=[…]`). 8 modelning har biri fal.ai sahifasida **jonli WebFetch bilan** ochib tekshirildi (2026-06-24). fal limit kalit faktlar: `image_urls` (list) ko'p-referensni qo'llaydi; `image_url` (string) = bitta rasm.

| Prototip nomi | Taxminiy/tasdiqlangan fal id | HOLAT | Kategoriya to'g'rimi | Param / eslatma (jonli tekshiruv) | TAVSIYA |
|---|---|---|---|---|---|
| **Auto · tavsiya** (`ref:1`) | — (router, fal id yo'q) | — | i-edit router | UI-only: eng mos editni o'zi tanlaydi. Backend'da Kontext/Seedream'ga rout qil | KEEP (logika) |
| **GPT Image 2 edit** (`ref:1`, "multi-rasm") | `openai/gpt-image-2/edit` | ✅ to'g'ri | ✅ edit (i2i) | `prompt` + **`image_urls` (list)** — "One or more reference image URLs". To'liq hosted (ixtiyoriy BYOK `openai_api_key`). Narx ~**$0.219**/1024² high. ⚠️ prototip `ref:1` deydi, lekin fal **multi-image** beradi → `ref` ni oshir. `input_fidelity` param fal sahifasida TOPILMADI (UI'dagi "Input fidelity" advanced fal'da yo'q) | KEEP — `ref:1→≥4`; "Input fidelity" advanced'ni olib tashla yoki GPT-Image-1.5'ga o'tkaz |
| **Nano Banana 2 edit** (`ref:14`) | `fal-ai/nano-banana-2/edit` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_urls` 1–14**. Narx **$0.08/img** (2K×1.5, 4K×2). `ref:14` fal limitга **MOS** | KEEP — o'zgartirishsiz |
| **Nano Banana Pro edit** (`ref:14`) | `fal-ai/nano-banana-pro/edit` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_urls`** — "Combine up to **14** images". Narx **$0.15/img** (~7 edit/$1). `ref:14` MOS (Gemini 3 Pro arxitektura) | KEEP — premium tier |
| **Seedream 4.5 edit** (`ref:10`) | `fal-ai/bytedance/seedream/v4.5/edit` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_urls` "up to 10"**. Narx **$0.04/img** (eng arzon multi-ref). `ref:10` fal limitга **AYNAN MOS** | KEEP — default ishchi at |
| **Flux Kontext** (`ref:1`) | `fal-ai/flux-pro/kontext` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_url` (bitta)**. Narx **$0.04/img**. `ref:1` MOS. UI `Guidance/Steps` advanced — fal `guidance_scale`/`num_inference_steps` bilan mos | KEEP |
| **Flux Kontext Max** (`ref:1`) | `fal-ai/flux-pro/kontext/max` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_url` (bitta)**. Narx **$0.08/img** (prototip "$0.08" AYNAN mos). Partner · Commercial. `ref:1` MOS | KEEP — premium single-image |
| **Qwen Image Edit** (`ref:1`, "$0.03/MP") | `fal-ai/qwen-image-edit` | ✅ to'g'ri | ✅ edit | `prompt` + **`image_url` (bitta)**. Narx **$0.03/MP** (prototip AYNAN mos). "superior text editing". `ref:1` MOS. 🔁 Multi-rasm kerak bo'lsa `fal-ai/qwen-image-edit-plus` ham bor ($0.03/MP, 3+ rasm) | KEEP (yoki `-plus`ga 🔁 yangila) |

### Qisqa xulosa

- **8/8 model fal.ai'da HAQIQATAN mavjud** — ❌ yo'q model topilmadi, hammasi ✅. Narxlar prototipdagi belgilar bilan deyarli aynan mos (Flux Kontext Max $0.08, Qwen $0.03/MP, Seedream $0.04, Nano Banana $0.08/$0.15).
- **Ref-soni limitlari fal bilan TO'LIQ mos:** Nano Banana 14 → fal "up to 14" ✅; Seedream 10 → fal "up to 10" ✅. Bu ikkisida moslik xavfsiz.
- **Yagona nomuvofiqlik — GPT Image 2 edit:** prototip `ref:1` qo'yib "multi-rasm" deb yozadi, lekin fal `openai/gpt-image-2/edit` `image_urls` **list** (ko'p rasm) qabul qiladi — `ref` ni ≥4 ga oshirish kerak. Shuningdek prototipdagi "Input fidelity" advanced param fal GPT-Image-2 sahifasida ko'rinmadi (`input_fidelity` o'rniga GPT-Image-1.5 `fal-ai/gpt-image-1.5/edit`'da bor) — bu advanced'ni olib tashlash yoki 1.5'ga ko'chirish tavsiya. GPT Image 2 narxi yuqori (~$0.219/img) → premium tier sifatida belgila.
- **Qwen** uchun ixtiyoriy yaxshilash: bitta-rasm `fal-ai/qwen-image-edit` o'rniga **`fal-ai/qwen-image-edit-plus`** (multi-image, bir xil $0.03/MP) — agar IEDIT'da Qwen'ga ham ko'p-referens kerak bo'lsa.
- **Litsenziya:** hammasi **Commercial use** (Seedream/Nano Banana/Kontext = Partner) — resell uchun yaroqli.

Sources: [gpt-image-1/edit-image](https://fal.ai/models/fal-ai/gpt-image-1/edit-image), [openai/gpt-image-2/edit](https://fal.ai/models/openai/gpt-image-2/edit), [seedream v4.5 edit](https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit), [nano-banana-pro/edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit), [flux-pro/kontext/max](https://fal.ai/models/fal-ai/flux-pro/kontext/max), [qwen-image-edit](https://fal.ai/models/fal-ai/qwen-image-edit), [qwen-image-edit-plus](https://fal.ai/models/fal-ai/qwen-image-edit-plus)

---

## A.4 · VEDIT (video edit / video-to-video) — fal.ai jonli tekshiruv

8 prototip modeli `https://fal.ai/models/<id>` sahifalari WebFetch + WebSearch bilan HAQIQATAN ochib tekshirildi (2026-06-24).

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya to'g'rimi | Param / eslatma | TAVSIYA |
|---|---|---|---|---|---|
| **Auto · tavsiya** | — (router) | n/a | — | Bizning rout logikamiz, fal modeli emas | KEEP — rout: arzon=Editto/Lucy, kuchli=Kling O1 |
| **Seedance 2.0** | `bytedance/seedance-2.0/edit` ❌ → `bytedance/seedance-2.0/reference-to-video` ✅ | 🔁 (id noto'g'ri) | qisman — fal'da Seedance **video-EDIT** dedicated endpoint YO'Q; v2v faqat **reference-to-video** orqali (style/motion transfer, ≤12 ref) | `prompt`+ref fayllar (image/video/audio); audio bor | **REPLACE id** → `reference-to-video` (yoki bu modelni VEDIT'dan olib, faqat Video Generate'da qoldir) |
| **Kling O1 Edit** | `fal-ai/kling-video/o1/video-to-video/edit` | ✅ to'g'ri | ✅ video-to-video edit | `prompt` (@Element/@Image), `video_url`, `image_url`; `keep_audio`; 3–10s, ≤4 ref; **$0.168/s** | KEEP — "eng kuchli" tier sifatida. Narx mos |
| **Lucy Edit Fast** | `decart/lucy-edit/fast` | ⚠️ **DEPRECATED** ("no longer supported") | ✅ v2v edit | `prompt`,`video_url`; 720p; **$0.04/s**; ⚠️ prefiks `decart/` (`fal-ai/` EMAS) | **REPLACE** → `decart/lucy-edit/dev` (open-weight, arzon) yoki to'g'ridan Editto 480p ($0.04/s). Fast'ni ishlatma |
| **Lucy Edit Pro** | `decart/lucy-edit/pro` | ✅ to'g'ri (active) | ✅ v2v edit | `prompt`,`video_url`,`sync_mode`,`enhance_prompt`; **480p $0.10/s · 720p $0.15/s**; ⚠️ prefiks `decart/` | KEEP — prototip "$0.15/s" + 480p/720p selektori MOS. id prefiksini `decart/` qil |
| **Bernini-R Edit** | `fal-ai/bernini-r/edit-video` | ✅ to'g'ri | ✅ v2v edit (obyekt/ob-havo/fon/kamera) | `prompt`,`video_url`,`max_image_size` (def 848); **848px $0.08/s** (≤576px ×0.5, 1280px ×2); seed | KEEP — prototip 576/848/1280 + "$0.08/s" AYNAN mos. ByteDance Bernini |
| **Editto** | `fal-ai/editto` | ✅ to'g'ri | ✅ v2v instruction edit | `prompt`,`video_url`; **480p $0.04 · 580p $0.06 · 720p $0.08 /s** (16fps) | KEEP — prototip 480/580/720 + narx AYNAN mos. "arzon" tier to'g'ri |
| **Grok Video Edit** | `xai/grok-imagine-video/edit-video` | ✅ to'g'ri | ✅ v2v edit (xAI Grok Imagine, colorize) | `prompt`,`video_url`; **480p $0.06/s · 720p $0.08/s**; ⚠️ prefiks `xai/` (`fal-ai/` EMAS) | KEEP — prototip 480/720 + colorize MOS. id prefiksini `xai/` qil |

### Qisqa xulosa
- **6/8 model fal'da HAQIQATAN bor va to'g'ri** (Kling O1, Lucy Pro, Bernini-R, Editto, Grok). Prototipdagi narx/rezolyutsiya selektorlari (Bernini 576/848/1280, Editto 480/580/720, Grok 480/720, Lucy Pro 480/720) fal sahifalari bilan **aynan mos** — bu ro'yxat ehtimol fal'dan to'g'ridan olingan, sifatli.
- **Prefiks tuzatish (MUHIM):** Lucy = `decart/`, Grok = `xai/` — `fal-ai/` prefiksi YO'Q. Bernini, Editto, Kling = `fal-ai/`. Adapter id qurganda buni hisobga ol.
- **2 ta muammo:**
  1. ⚠️ **Lucy Edit Fast (`decart/lucy-edit/fast`) DEPRECATED** — ishlatma. O'rniga `decart/lucy-edit/dev` (open-weight) yoki Editto 480p ($0.04/s, xuddi shu narx) bilan almashtir.
  2. ❌ **Seedance 2.0 video-edit id YO'Q** — fal'da Seedance faqat *generate* (text/image/reference-to-video). v2v "edit" use-case'ini `bytedance/seedance-2.0/reference-to-video` qoplaydi (style/motion transfer), lekin bu sof "edit" emas. Tavsiya: prototip "Seedance 2.0" yorlig'ini `reference-to-video` ga rout qil yoki VEDIT'dan olib tashla (chalkashlikni oldini olish uchun).
- "Bernini-R Edit", "Editto", "Grok Video Edit", "Kling O1 Edit" — barchasi **fal'da HAQIQATAN mavjud** (dastlabki shubha asossiz chiqdi). Faqat Lucy Fast deprecated va Seedance edit id'i xato.

Tegishli fayllar: `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html` (VEDIT massivi: 323–332-qatorlar), `/Users/usmonov/Projects/creative-tools-saas/docs/FAL-AI-CATALOG.md` (§10 — Kling O1 v2v allaqachon hujjatlangan; Lucy/Bernini/Editto/Grok hali katalogga kiritilmagan — qo'shish kerak).

---

## A.5 · I3D (image-to-3D)

fal.ai'da kuchli, mustaqil **"Image-to-3D" / "3D" kategoriyasi** bor (`https://fal.ai/3d-models`). Prototipdagi 8 model'ning hammasi fal'da real holatda mavjud — faqat **versiya nomlari va id'lar aniqlashtirilishi** kerak. Quyidagi jadval har biri jonli fal sahifasidan (WebFetch + WebSearch, 2026-06-24) tasdiqlandi.

| Prototip nomi | Taxminiy/real fal id | HOLAT | Kategoriya | Param / eslatma | TAVSIYA |
|---|---|---|---|---|---|
| **Auto · "Hunyuan 3.1"** (default) | `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` | ✅ to'g'ri | i2d ✅ | PBR bor (+$0.15), narx $0.225 (PBR bilan $0.375). ⚠️ Chiqish **OBJ+MTL+PNG** — GLB ko'rsatilmagan; FBX/STL **yo'q**. "8K tekstura" tasdiqlanmadi | Auto default = `hunyuan-3d/v3.1/rapid` (arzon/tez). Format chiplarini real chiqishga moslang |
| **"Hunyuan 3D 3.1 Pro"** | `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | ✅ to'g'ri | i2d ✅ | `input_image_url` **majburiy** (128–5000px, ≤8MB, JPG/PNG/WEBP) + multi-view (back/left/right/top/...). `enable_pbr` (metallic/roughness/normal). Chiqish **GLB/OBJ/FBX/USDZ/MTL** — **STL yo'q** | KEEP. Premium tier. Format: GLB/OBJ/FBX ✅ (STL chipini olib tashla) |
| **"Trellis 2"** | `fal-ai/trellis-2` | ✅ to'g'ri | i2d ✅ | `image_url` majburiy (single yoki multi-view). `texture_size` 1024/2048/4096, `tex_slat_guidance_strength`. Chiqish **faqat GLB**. Narx ≈$0.25–0.35 (512/1024/1536p) | KEEP. ⚠️ Prototip "GLB/OBJ" deydi — fal **faqat GLB** → **OBJ chipini olib tashla**. "PBR · 1-3 daq" — tekstura bor, vaqt tasdiqlanmadi |
| **"Rodin 2.0 (Hyper3D)"** | `fal-ai/hyper3d/rodin/v2.5` (i2d) · `…/v2.5/text-to-3d` | 🔁 eskirgan (versiya) | i2d ✅ | fal'da joriy = **Rodin V2.5** (v2 ham bor). Chiqish **GLB/USDZ/FBX/OBJ/STL** (default GLB), `material` PBR/Shaded, `quality` high/med/low/extra-low | KEEP, lekin **"2.0" → "2.5"** ga yangila → `hyper3d/rodin/v2.5`. Format GLB/OBJ/FBX ✅ (hatto STL ham bor) |
| **"Tripo H3.1"** | `tripo3d/p1/image-to-3d` (yoki `tripo3d/tripo/v2.5/image-to-3d`) | ❌ nom noto'g'ri / 🔁 | i2d ✅ | fal'da **"Tripo 3.1 / H3.1" YO'Q**. Joriy: **Tripo P1** (`tripo3d/p1`, $0.40 / textura bilan $0.50, GLB + `pbr_model`) yoki **Tripo v2.5** (`tripo3d/tripo/v2.5`). ⚠️ Prototipdagi **auto-rig / quad / Cartoon-Voxel-LEGO style / FBX** P1 sahifasida **tasdiqlanmadi** | **Nomni tuzat**: "Tripo P1" → `tripo3d/p1/image-to-3d`. Auto-rig/style/FBX da'volarini API'ga moslab kamaytir yoki olib tashla |
| **"Meshy 6"** | `fal-ai/meshy/v6/image-to-3d` | ✅ to'g'ri | i2d ✅ | Chiqish **GLB/FBX/OBJ/USDZ/STL** (STL ✅ tasdiqlandi). `enable_pbr` (metallic/roughness/normal), `model_type` standard/lowpoly, `topology` quad/triangle, jpg/png/avif/heif kirish | KEEP — eng to'liq formatli. Format GLB/OBJ/STL ✅ (FBX/USDZ ham). "3D-print + PBR" ✅ to'g'ri |
| **"Trellis"** (eski) | `fal-ai/trellis` | ✅ to'g'ri | i2d ✅ | Chiqish **GLB** (`.glb`), SLAT arxitektura, single + `fal-ai/trellis/multi` | KEEP "arzon/eski iteratsiya" sifatida. ⚠️ Prototip "GLB/OBJ" deydi — fal **faqat GLB** → OBJ chipini olib tashla |
| **"SAM 3D"** | `fal-ai/sam-3/3d-objects` | ✅ to'g'ri | i2d ✅ | Meta SAM 3D, single-photo, segmentatsiya bilan (text/point/bbox). Chiqish **GLB + PLY (Gaussian splat)**, `export_textured_glb` (baked texture+UV). Narx **$0.02/gen** (eng arzon). ⚠️ **OBJ yo'q** | KEEP — "real obyektni qayta tiklash" ✅ aniq. Format: **GLB ✅, OBJ ❌** (PLY splat o'rniga). OBJ chipini olib tashla |

### Qisqa xulosa

- **8 model'ning hammasi fal'da REAL mavjud** — fal "Image-to-3D" kategoriyasi prototipni to'liq qoplaydi (hammasi i2d ✅, kategoriya to'g'ri). Faqat 2 ta nom/versiya tuzatish kerak:
  - 🔁 **"Rodin 2.0" → Rodin V2.5** (`fal-ai/hyper3d/rodin/v2.5`) — fal'da 2.0 yo'q, joriy v2.5.
  - ❌ **"Tripo H3.1" — fal'da bunday nom YO'Q** → **Tripo P1** (`tripo3d/p1/image-to-3d`) yoki **Tripo v2.5** (`tripo3d/tripo/v2.5/image-to-3d`) ga almashtir.
- **Format chiplari aniqlashtirilsin (eng muhim nomuvofiqlik):** prototip ko'p model'ga OBJ/FBX/STL beradi, lekin fal real chiqishi farq qiladi:
  - **Faqat GLB:** `trellis`, `trellis-2` (prototip "GLB/OBJ" — **OBJ ni olib tashla**).
  - **GLB + PLY (OBJ yo'q):** `sam-3/3d-objects`.
  - **GLB/OBJ/FBX/USDZ (STL yo'q):** Hunyuan 3.1 Pro.
  - **GLB/OBJ/FBX/STL/USDZ to'liq:** `meshy/v6` (yagona STL real), `hyper3d/rodin/v2.5`.
  - **OBJ+MTL (rapid):** Hunyuan 3.1 rapid.
- **PBR/tekstura realmi:** ✅ Ha — `enable_pbr` Hunyuan/Meshy'da, `material` PBR/Shaded Rodin'da, `texture_size` 1024/2048/4096 Trellis 2'da, baked-texture SAM 3D'da. Lekin **"8K tekstura" da'vosi tasdiqlanmadi** (Trellis 2 maks 4096, Hunyuan input maks 5000px) — prototipdagi "8K" chipni **4K** ga tushirish tavsiya etiladi.
- **Auto-rig / quad / style (Cartoon/Voxel/LEGO):** Tripo P1 sahifasida **tasdiqlanmadi** — prototipdagi bu da'volarni API schema'siga moslab kamaytir.
- **Narx (kredit modeli uchun):** hammasi **per-generation** (deterministik, `cost-quote`ga ideal): SAM 3D **$0.02** (eng arzon), Hunyuan rapid $0.225–0.375, Trellis 2 $0.25–0.35, Tripo P1 $0.40–0.50.
- **⚠️TASDIQLANMADI:** Trellis 2 / Hunyuan Pro aniq narxi (sahifada "contact sales" yoki pricing sahifasiga yo'naltirdi) — integratsiyadan oldin `GET https://api.fal.ai/v1/models/pricing?endpoint_id=…` bilan tasdiqlа.

Tegishli fayllar: prototip `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html` (333–342-qatorlar, `I3D` massivi). fal 3D katalogi `docs/FAL-AI-CATALOG.md`/`FAL-DOCS-MODELS.md`'da **yo'q** — bu kategoriya hujjatlarda qamralmagan, faqat shu jonli tekshiruvda tasdiqlandi.

---

## A.6 · OPS (operatsiyalar) — fal.ai model tekshiruvi

Har model `https://fal.ai/models/<id>` da JONLI ochib tasdiqlandi (WebFetch, 2026-06-24) + katalog (`FAL-AI-CATALOG.md`). TAXMIN yo'q — barchasi sahifada haqiqatan ko'rildi.

### Remove BG

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Bria (rasm $0.018) | `fal-ai/bria/background/remove` | ✅ | t→ remove-bg ✅ | `image_url`; $0.018/gen; Partner, litsenziyalangan data | KEEP — resell uchun eng xavfsiz default |
| BiRefNet v2 ($0.001/MP) | `fal-ai/birefnet/v2` | ✅ (narx 🔁) | remove-bg ✅ | Sahifada **"$0 per compute-second"** ko'rsatadi — prototipdagi "$0.001/MP" sahifada **ko'rinmadi**. Per-compute-sec → kredit quote'ga noaniq | Zaxira; narx yorlig'ini "compute-sek" qil yoki olib tashla |
| rembg (~$0) | `fal-ai/imageutils/rembg` | ✅ | remove-bg ✅ | $0/compute-sec; arzon zaxira | KEEP zaxira (default emas — narx noaniq) |
| Bria video ($0.0042/s) | `bria/video/background-removal` (⚠️`fal-ai/` prefiksisiz) | ✅ | video bg ✅ | JONLI sahifa **"$0.0042 per second"** — prototip TO'G'RI. (FAL-DOCS-MODELS.md'dagi $0.14/s eskirgan/xato) | KEEP; id prefiksini `fal-ai/` siz yoz |
| BEN v2 ($0.001/MP) | `fal-ai/ben/v2/video` | ✅ | video bg ✅ | JONLI: **"$0.001 per megapixel"** — prototip TO'G'RI | KEEP zaxira |

### Upscale

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Clarity ($0.03/MP) | `fal-ai/clarity-upscaler` | ✅ | rasm upscale ✅ | $0.03/MP; per-MP → cost-quote'ga mos | KEEP default (Magnific'ga eng yaqin) |
| SeedVR ($0.001/MP) | `fal-ai/seedvr/upscale/image` | ✅ | rasm upscale ✅ | JONLI: "$0.001 per megapixel" (SeedVR2). Prototip nomi qisqa "SeedVR" — fal id'da `seedvr/upscale/image` | KEEP; arzon zaxira |
| Recraft crisp ($0.004) | `fal-ai/recraft/upscale/crisp` | ✅ | rasm upscale ✅ | $0.004/img (flat, PNG kirish) | KEEP |
| Aura-SR ("tez") | `fal-ai/aura-sr` | ✅ (narx ⚠️) | rasm upscale ✅ | $0.001/compute-sec → narx oldindan noaniq, cost-quote'ga MOS EMAS | Faqat "tez" yorliq; default'ga qo'yma |
| Topaz ($0.01-0.08/s) | `fal-ai/topaz/upscale/video` | ✅ | video upscale ✅ | JONLI: $0.01 (≤720p)/$0.02/$0.08; 60fps ×2, Gaia2 ½ | KEEP default video |
| SeedVR video ($0.001/MP) | `fal-ai/seedvr/upscale/video` | ✅ | video upscale ✅ | $0.001/MP (w×h×frames); uzun 4K'da qimmatlashadi | KEEP zaxira |

### Relight

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| IC-Light v2 ($0.1/MP) | `fal-ai/iclight-v2` | ✅ | rasm relight ✅ | `image_url`+`prompt`; $0.1/MP. ⚠️Raqamli yorug'lik yo'q — prototipdagi "Yo'nalish" segmenti = `initial_latent` (None/Left/Right/Top/Bottom), CFG slider=`cfg`/`guidance_scale`. Litsenziya: fal badge Commercial (ToS bir marta tasdiqla) | KEEP — params'ni iclight'ga to'g'rila |
| LightX ($0.1/s) | `fal-ai/lightx/relight` | ✅ | video relight ✅ | JONLI: "0.1$ per output video second"; `video_url`(+opt `relit_cond_img_url`). ⚠️Output `video`=**string** (obyekt emas) — parserda hisobga ol | KEEP |

### Skin

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Retouch ($0.04) | `fal-ai/image-editing/retouch` | ✅ | skin/retush ✅ | JONLI: "$0.04 per image", "Remove blemishes and improve the skin" — Magnific Skin ekvivalenti aniq mos | KEEP |

### Reframe

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| image-editing/reframe ($0.04) | `fal-ai/image-editing/reframe` | ✅ | rasm reframe ✅ | `image_url`+`aspect_ratio` (def 16:9); $0.04/img | KEEP default |
| Bria expand ($0.04) | `fal-ai/bria/expand` | ✅ | rasm outpaint ✅ | `image_url`+`canvas_size`[w,h]; $0.04/gen; Partner litsenziyali data | KEEP (resell xavfsiz) |
| Ideogram reframe ($0.03-0.09) | `fal-ai/ideogram/v3/reframe` | ✅ | rasm reframe ✅ | `image_url`+`image_size`; Turbo $0.03/Bal $0.06/Qual $0.09 | KEEP |
| Luma Ray-2 ($0.2/s) | `fal-ai/luma-dream-machine/ray-2/reframe` | ✅ | video reframe ✅ | `video_url`+`aspect_ratio` (def 9:16); $0.2/s | KEEP |

### Inpaint

| Prototip nomi | fal id | HOLAT | Kategoriya | Param/narx eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Flux Fill (Mask · $0.05/MP) | `fal-ai/flux-pro/v1/fill` | ✅ | inpaint (mask) ✅ | `image_url`+`mask_url`+`prompt`; $0.05/MP (MP'ga yaxlitlanadi); Partner | KEEP default |
| Ideogram v3 edit (Mask · $0.03-0.09) | `fal-ai/ideogram/v3/edit` | ✅ | inpaint/edit (mask) ✅ | JONLI: model BOR; `prompt`+`image_url`+`mask_url` majburiy; Turbo $0.03/Bal $0.06/Qual $0.09 — prototip TO'G'RI | KEEP |

### Qisqa xulosa

- **HAMMA 18 OPS modeli ✅ fal.ai'da haqiqatan mavjud** — nom/id mos, kategoriya to'g'ri. ❌ (yo'q) yoki ⚠️deprecated model **yo'q**. Maxsus tekshirilgan shubhalilar tasdiqlandi: **SeedVR**=`seedvr/upscale/{image,video}`, **LightX**=`lightx/relight`, **Retouch**=`image-editing/retouch`, **BEN v2**=`ben/v2/video`. Prototip "Ideogram v3 edit" ham real (`ideogram/v3/edit`, mask bilan).
- **Yagona narx nomuvofiqligi (kodga emas, hujjatga tegishli):** `bria/video/background-removal` JONLI sahifada **$0.0042/s** — prototip TO'G'RI; `FAL-DOCS-MODELS.md`'dagi **$0.14/s** eskirgan/xato, hujjatni tuzatish kerak.
- **BiRefNet v2 narxi:** prototipda "$0.001/MP", lekin JONLI sahifa **"$0 per compute-second"** ko'rsatadi — yorliqni "compute-sek" deb yangilash yoki olib tashlash maqsadga muvofiq.
- **id prefiks ehtiyot:** `bria/video/background-removal` — `fal-ai/` prefiksisiz (boshqasini `fal-ai/...` bilan). Adapter id mapping'da shuni hisobga ol.
- **Kredit cost-quote moslik:** per-image/per-MP/per-second modellar (Clarity, IC-Light, Retouch, reframe'lar, Topaz, LightX, Bria) imzolangan quote'ga mos. **Per-compute-sec** (Aura-SR, BiRefNet, rembg) narxi oldindan noaniq — default tanlovga qo'yma, faqat "tez/zaxira" yorliq sifatida qoldir.

Tegishli fayllar: `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html` (OPS obyekti, satr 343-349, 214-237), `/Users/usmonov/Projects/creative-tools-saas/docs/FAL-AI-CATALOG.md`, `/Users/usmonov/Projects/creative-tools-saas/docs/FAL-DOCS-MODELS.md` (Bria video narxini $0.14/s → $0.0042/s tuzatish kerak).

---

## A.7 · VTT/ITP/PA (LLM router) — fal.ai jonli tekshiruv

> **Asosiy topilma:** Prototipdagi 3 ro'yxat (VTT/ITP/PA) **fal model id'lari emas** — ular **LLM provayder nomlari** (OpenRouter slug'lari orqali fal'ning `any-llm`/`vision` routeri qoplaydi). fal'da bu vazifa uchun **2 endpoint** bor: `fal-ai/any-llm` (matn) va `fal-ai/any-llm/vision` (rasm kirish bilan). **⚠️ IKKALASI HAM `fal.ai/models/...` sahifasida "This model is no longer supported" (DEPRECATED).** Tirik o'rinbosari — **`openrouter/router`** (aktiv, "Powered by OpenRouter, billed through fal", input/output token narxi). Vision (image-to-prompt) uchun dedikatsiya VLM = **`fal-ai/florence-2-large/caption`** ham bor. **fal'da dedikatsiya "video → prompt" (VTT) endpoint YO'Q** — video describe faqat ko'p-kadrli VLM (Gemini 2.5 / Qwen3-VL) orqali COMPOSE qilinadi.

### VTT — video-capable describe (prototip "Videoni tasvirlash")

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya to'g'rimi | Param/eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Gemini 2.5 Flash | `fal-ai/any-llm/vision` → `model:"google/gemini-2.5-flash"` | ⚠️ endpoint DEPRECATED · model ✅ enum'da bor | qisman (VLM rasm/kadr; sof video-LLM emas) | vision enum'da tasdiqlandi; video uchun kadrlarni rasm sifatida ber | `model` slug TO'G'RI, lekin endpoint'ni `openrouter/router`'ga ko'chir |
| Gemini 3 Pro (preview) | `…model:"google/gemini-3-pro"` | ❌ fal enum'da YO'Q | — | any-llm/vision enum'da eng yuqorisi `gemini-2.5-pro` | **olib tashla** yoki `gemini-2.5-pro`'ga almashtir |
| Gemini 3.1 Pro (preview) | `…model:"google/gemini-3.1-pro"` | ❌ fal enum'da YO'Q | — | mavjud emas (xayoliy/preview nom) | **olib tashla** → `gemini-2.5-pro` |
| Custom | — | ✅ (foydalanuvchi slug kiritadi) | — | OpenRouter'ning 200+ modeli | **KEEP** (faqat router enum'iga validatsiya qil) |

### ITP — vision/VLM (prototip "Rasm tasvirlash" / image-to-prompt)

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya to'g'rimi | Param/eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Gemini 2.5 Flash | `fal-ai/any-llm/vision` → `google/gemini-2.5-flash` | ⚠️ endpoint DEPRECATED · model ✅ | ✅ (vision/VLM) | vision llms.txt'da tasdiqlandi; `image_url` qabul qiladi, $0.01/req | model TO'G'RI → endpoint'ni `openrouter/router` yoki `florence-2`'ga ko'chir |
| Claude Sonnet 4.6 | `…anthropic/claude-sonnet-4.6` | ❌ fal'da YO'Q (noto'g'ri versiya) | — | fal enum maksimumi `anthropic/claude-sonnet-4.5` | **almashtir** → `anthropic/claude-sonnet-4.5` |
| GPT-4o | `…openai/gpt-4o` | ✅ fal enum'da bor | ✅ (vision) | vision llms.txt'da tasdiqlandi | **KEEP** (id to'g'ri) |
| Custom | — | ✅ | — | qwen3-vl / llama-4 / grok-4 ham bor | **KEEP** |
| *(yo'q — qo'shish mumkin)* | `fal-ai/florence-2-large/caption` | ✅ tirik (dedikatsiya caption) | ✅ image-to-prompt | `image_url`; ⚠️ narx/litsenziya badge sahifada ko'rsatilmagan | dedikatsiya/arzon describe uchun ➕ |

### PA — any-llm (prototip "Prompt yordamchisi", matn)

| Prototip nomi | Taxminiy fal id | HOLAT | Kategoriya to'g'rimi | Param/eslatma | TAVSIYA |
|---|---|---|---|---|---|
| Gemini 2.5 Flash | `fal-ai/any-llm` → `google/gemini-2.5-flash` | ⚠️ endpoint DEPRECATED · model ✅ | ✅ (text LLM) | any-llm enum'da tasdiqlandi, $0.001/req | model TO'G'RI → `openrouter/router`'ga ko'chir |
| Claude Sonnet 4.6 | `…anthropic/claude-sonnet-4.6` | ❌ fal'da YO'Q | — | enum maksimumi `claude-sonnet-4.5` | **almashtir** → `anthropic/claude-sonnet-4.5` |
| GPT-4o | `…openai/gpt-4o` | ✅ enum'da bor | ✅ | any-llm enum'da tasdiqlandi | **KEEP** |
| Custom | — | ✅ | — | gpt-5-chat, o3, deepseek, llama, kimi ham bor | **KEEP** |

### fal `any-llm` enum (JONLI tasdiqlangan — `/api` dan verbatim)
`deepseek-r1, deepseek-v3.1-terminus, anthropic/claude-sonnet-4.5, claude-haiku-4.5, claude-3.7-sonnet, claude-3.5-sonnet, claude-3-5-haiku, claude-3-haiku, google/gemini-pro-1.5, gemini-flash-1.5(-8b), gemini-2.0-flash-001, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro, meta-llama/llama-3.1/3.2/4-*, openai/gpt-4o(-mini), gpt-4.1, o3, gpt-5-chat/mini/nano, moonshotai/kimi-k2.5`. **Vision (llms.txt)** qo'shimcha: `qwen/qwen3-vl-*`, `llama-3.2-90b-vision`, `llama-4-maverick/scout`, `x-ai/grok-4-fast`.

### Qisqa xulosa
1. **3 ta noto'g'ri/xayoliy nom (DARHOL TUZAT):** `Gemini 3 Pro (preview)`, `Gemini 3.1 Pro (preview)` — fal'da **umuman yo'q** (eng yuqorisi `gemini-2.5-pro`); `Claude Sonnet 4.6` — **noto'g'ri versiya** (fal'da `claude-sonnet-4.5`). Bularni `gemini-2.5-pro` va `claude-sonnet-4.5`'ga almashtir.
2. **To'g'ri nomlar:** `Gemini 2.5 Flash` va `GPT-4o` — fal enum'da HAQIQATAN bor (text va vision ikkalasida).
3. **Endpoint xavfi:** `fal-ai/any-llm` va `any-llm/vision` ikkalasi ham **DEPRECATED**. Implement qilishdan oldin **`openrouter/router`** (tirik) endpoint'iga ko'chir — model slug'lar bir xil OpenRouter formatida.
4. **VTT (video describe) — fal'da dedikatsiya endpoint YO'Q.** Video → prompt'ni multimodal VLM (`gemini-2.5-flash`/`qwen3-vl`) orqali kadr/COMPOSE bilan qilish kerak; prototipdagi "🎥 video-capable" deb ko'rsatilgani fal'da real alohida model emas.
5. **ITP bonus:** image-to-prompt uchun `fal-ai/florence-2-large/caption` dedikatsiya VLM tirik (narx badge tasdiqlanmagan — integratsiyadan oldin tekshir).

Tegishli fayllar: `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html` (qatorlar 351-356: VTT/ITP/PA ro'yxatlari), `/Users/usmonov/Projects/creative-tools-saas/docs/FAL-AI-CATALOG.md` (qator 408: florence-2 eslatmasi).

---

## B) UX kamchiliklar (KRITIK / O'RTA / KICHIK)

Prototip yaxlit va izchil — narx/kredit, progress+cancel, batch, comp-import, empty/error, time-range, reference strip va prompt-yordamchi bir tizimga bog'langan. Quyida joriy navbatdagi kamchiliklar.

### KRITIK

1. **Kredit hisobi va `bal()` doimiy 606 — narx baholash demosi yolg'on.** Joy: `bal()` (282-qator) `lowDemo?5:606` qaytaradi; `estimate()` (370) `2+(o.cur%5)` formula bilan ishlaydi. Muammo: 5-kredit demo rejimida deyarli HAR model "kredit yetmaydi" holatiga tushadi (chunki eng arzon estimate ~2 kr, lekin video sekundga ko'paytiriladi → o'nlab kr), shu sababli "Kredit ol" tugmasi paydo bo'ladi — bu yaxshi. LEKIN model tanlangach narx `o.cur%5` ga bog'liq, ya'ni Z-Image Turbo ($0.005/MP, eng arzon) va Nano Banana Pro ($0.15, eng qimmat) bir xil yoki teskari narx ko'rsatishi mumkin. Foydalanuvchi narxni model tanlashda asosiy mezon qiladi — bu adashtiradi. Tavsiya: estimate'ni model indeksiga emas, model obyektidagi haqiqiy `$` qiymatiga bog'lang (har modelda `price` maydoni allaqachon `s` ichida matn sifatida bor — strukturali qiling).

2. **`run()` natijani HIST'ga qo'shmaydi — "So'nggi"/Tarix hech qachon yangilanmaydi.** Joy: `run()`→`finish()` (448-471) natija UI'sini chizadi, lekin `HIST.push(...)` yo'q; `renderRecent()` faqat dastlab bir marta chaqiriladi (550). Muammo: butun "So'nggi" strip va Tarix ekrani statik 7 ta soxta yozuvda qotadi — generatsiyadan keyin foydalanuvchi natijasini Tarixdan topa olmaydi, bu eng asosiy oqim uzilishi (gen → tarix → qayta tahrir). Tavsiya: `finish()` oxirida HIST boshiga yangi yozuv qo'shib `renderRecent()` chaqiring.

3. **`busy` badge generatsiya tugagach ham "ishlanmoqda" ko'rsatishi mumkin / cross-view holat oqishi.** Joy: `setBusy(true)` (443) global, `go()` (358) view almashganda proc'ni tozalaydi LEKIN `setBusy(false)` chaqirmaydi va `iv` intervalni to'xtatmaydi. Muammo: generatsiya davom etayotganda boshqa view'ga o'tilsa, fon intervali ishlashda davom etadi, tugagach yangi view'ning `.resultArea`siga natija chizishga urinadi (`triggerEl.closest('.view')` eski view'ni qaytaradi, lekin u `display:none`) — natija ko'rinmaydi, "busy" badge esa o'chmasligi mumkin. Tavsiya: `go()` ichida faol `iv` ni bekor qiling va `setBusy(false)`.

### O'RTA

4. **Model haddan ortiq ko'p, narx/sifat saralash yo'q (IMG 11, VID 12, IEDIT 8, VEDIT 8, I3D 8).** Joy: `IMG`/`VID`/`IEDIT`/`VEDIT`/`I3D` massivlari + `openSelect` (6 dan ortiq bo'lsa qidiruv chiqadi). Muammo: 392px CEP'da bottom-sheet'da 12 ta video modelini varaqlash og'ir; har birida `s` ichida narx aralash format ("$0.07/s", "Arzon · sifatли", "Premium") — taqqoslab bo'lmaydi. "Auto · tavsiya" birinchi bo'lgani yaxshi, lekin qolganlari saralanmagan. Tavsiya: modellarni "Tavsiya / Arzon / Premium" guruhlariga bo'ling yoki sheet'da narx-rangli badge qo'shing; default Auto'ni kuchaytiring.

5. **Til aralashmasi — o'zbekcha + inglizcha + buzilgan kirill-lotin.** Joy: bir nechta `data-ex` va model `s` matnlarida ruscha-ko'rinishli kirill harflari lotin ichida: "promtини" (174,188), "shaharда" (189,520), "Kadrдан"/"Reference'дан" (418), "Project'дан" (426), "boshlang'ich" to'g'ri lekin "Davomiy**лик**" emas. Muammo: "ини/да/дан" — bu lotin so'z + kirill qo'shimcha aralashmasi, professional emas va ekran o'qiydigan vositalar uchun buzuq. Tavsiya: barcha qo'shimchalarni lotinga o'tkazing ("promtini", "shaharda", "Kadrdan", "Project'dan"). Shuningdek UI'da "Remove BG / Upscale / Relight / Reframe / Inpaint / Lip-sync / Motion / SFX / Restyle / Slow-mo" inglizcha qolgan — atayin bo'lsa izchil, lekin "Yaratish/Tahrirlash" o'zbekcha bilan aralashadi; bitta lug'at tanlang.

6. **`<textarea>` qiymati hech qayerda o'qilmaydi — prompt run'ga ulanmagan.** Joy: `run()` faqat `opt.count`/`type` oladi; prompt matni e'tiborga olinmaydi, hatto bo'sh prompt bilan ham "Yaratish" ishlaydi va natija qaytaradi. Muammo: bo'sh-prompt validatsiyasi yo'q (gen ekranlari prompt majburiy bo'lishi kerak), bu real backendda darhol xato beradi. Tavsiya: gen/op ekranlarida prompt bo'sh bo'lsa `sendbtn` ni `.off` qiling yoki toast bilan ogohlantiring (ref-only modellar bundan mustasno).

7. **Reference strip "+" va `refPicker` tanlovni hech qayerga saqlamaydi — har doim soxta tanlangan.** Joy: `refPicker` (513) `data-toastmsg="Tanlandi: ..."` bilan faqat toast chiqaradi; tanlangan rasm ref-thumb'ga qo'shilmaydi, `src` banneri o'zgarmaydi. Muammo: foydalanuvchi "Almashtirish" bossa, yangi fayl tanlasa ham banner eski `warrior_01.png`da qoladi — interaktivlik yolg'on. Bu prototip uchun ataylab bo'lishi mumkin, lekin "tanladim, lekin ko'rinmadi" — eng ko'p shikoyat qilinadigan UX nuqtasi. Tavsiya: hech bo'lmasa banner matnini/thumb'ni tanlangan faylga yangilang.

8. **Time-range "Butun klip" vs "Work area" segmenti faqat toast — timeline'ni o'zgartirmaydi.** Joy: `initTR` (545) seg bosilganda toast chiqaradi, lekin "Butun klip" tanlansa ham `sel`/handle'lar 30–70% oraliqda qoladi. Muammo: "Butun klip" mantiqan butun (0–100%) bo'lishi yoki time-range'ni o'chirishi kerak. Tavsiya: "Butun klip"da timeline'ni disable qiling yoki to'liq tanlang.

### KICHIK

9. **`gen3d` ekranida prompt yo'q, lekin ba'zi 3D modellar text/multi-view qo'llaydi.** Joy: `v-gen3d` (196) faqat ref-strip + cbar; `I3D[1]` "text/multi-view" deydi, lekin matn kiritish joyi yo'q. Tavsiya: 3D'ga ixtiyoriy prompt textarea qo'shing (model qo'llasa).

10. **`gen3d` natijasida "Comp'ga 3D layer" — AE CEP 3D model importini haqiqatan qo'llamaydi (kontekst bilan ziddiyat).** Joy: `finish()` 3D shoxi (451) "AE comp'ga 3D model layer qo'shildi" toast. Eslatma: bu kelajak/dizayn — joriy plagin .glb→AE native 3D layer importini qo'llamaydi; prototip "AE native" deb va'da beradi. Tavsiya (hujjat): 3D import yo'lini (download .glb + qo'lda import vs avtomatik) aniqlashtiring, aks holda ortiqcha va'da.

11. **`describe`/prompt-yordamchi 3 router (VTT/ITP/PA) deyarli bir xil — `data-describe='genv'` PA'ga tushadi.** Joy: delegation (520) `k==='video'?VTT : k==='image'?ITP : PA`. `genv` va `geni` kalitlari ham PA'ga (default) tushadi — ya'ni gen ekranларидa har doim PA (umumiy LLM) ishlatiladi, video-tasvirlash (VTT) faqat editvideo'da. Bu mantiqan to'g'ri, lekin ITP/PA modellari aynan bir xil (`Gemini 2.5 Flash / Claude Sonnet 4.6 / GPT-4o / Custom`) — foydalanuvchi farqni sezmaydi. Tavsiya: agar farq yo'q bo'lsa bitta ro'yxatga birlashtiring; yoki har birining maqsadini sheet sarlavhasида aniq yozing (allaqachon qisman bor).

12. **Chip-overflow 392px'da ishlaydi, lekin `cbar-row` gradient-fade faqat `var(--card)` fonda to'g'ri.** Joy: `.scrollwrap::after` (53) `var(--card)`ga fade qiladi, lekin chip-bar `.pin` (`var(--card)`) ichida — mos. `op`/`opPin`da ham `.pin` — mos. Muammo yo'q, lekin gen ekranlarda chip-bar to'g'ridan-to'g'ri `.pin`да, edit-hub'da ham — izchil. Kichik: ko'p seg-chip (Seedream 4.5: Nisbat 6 + Soni 4) bo'lsa horizontal scroll uzun, "⚙" chipi oxirda ko'rinmay qolishi mumkin — fade bor, lekin scroll ipi ingichka. Tavsiya: muhim chiplarni (Soni/Davomiylik) boshiga, advanced "⚙"ni doim ko'rinadigan footer'ga ko'chiring.

13. **`data-soon` "Restyle"/"Slow-mo" dim qilingan, lekin `mm` model nomini ko'rsatadi ("RIFE") — mavjuddek tuyuladi.** Joy: editvideo acts (241-242). Kichik nomuvofiqlik: "Tez orada" yozuvi bilan birga model nomi — foydalanuvchini "nega bosilmaydi" deb adashtiradi. Tavsiya: dim holatда `mm`ni "Tez orada" bilan almashtiring (Restyle'da to'g'ri qilingan, Slow-mo'da "RIFE" qolgan — izchil emas).

### Izchillik (ijobiy)
gen/edit/op/3d/special ekranlari bir xil naqsh ishlatadi: `buildBar` chip-bar + model-select + price-footer hamma joyda bir xil — bu kuchli tomon. Crumb/back navigatsiya izchil (`go(parent)`), dead-end yo'q (har ekranда `‹` yoki `exit`/`bk`). Empty (`emptyDemo`), error (`errMode`), low-credit (`lowDemo`) holatlari Settings'dan demo-toggle bilan to'liq sinaladi — yaxshi qamrov.

**Asosiy 3 ta tuzatish ustuvor:** (1) estimate'ni haqiqiy model narxiga bog'lash, (2) `run()` natijasini HIST'ga qo'shish, (3) til aralashmasini (kirill-lotin qo'shimchalar) tozalash.

Fayl: `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html`

---

## C) Yetishmagan TOP modellar (fal.ai'да bor, prototipда yo'q)

Prototip (`design-preview/ai-tools-prototype.html`) inventarizatsiyasi tahlil qilindi. Quyidagi 12 model fal.ai'da **mashhur/kuchli va Commercial-litsenziyali**, lekin prototipда **YO'Q** (yoki faqat "Tez orada" / kategoriya umuman yo'q). Har biri jonli WebFetch/WebSearch bilan tasdiqlangan (2026-06-24).

| # | fal id | HOLAT | Kategoriya | Narx · param | Nega muhim · qaysi prototip bo'limiga | Manba |
|---|---|---|---|---|---|---|
| **1** ⭐ | `fal-ai/bytedance/omnihuman/v1.5` | ✅ to'g'ri | talking-avatar (image+audio→video) | $0.16/s · `image_url`+`audio_url` | **Eng katta bo'shliq.** Bitta portret + ovoz → to'liq gaplashayotgan avatar (lip+yuz+gestura+tana). Lip-sync (faqat og'iz)дан ancha kuchli. **YANGI bo'lim: "Avatar / Talking Head"** (Yaratish yoki Edit video). | fal.ai/models/fal-ai/bytedance/omnihuman/v1.5 |
| **2** ⭐ | `fal-ai/elevenlabs/music` | ✅ to'g'ri | music-gen (text→audio) | $0.8/min · `prompt`/`composition_plan` | Prototipда **musiqa generatsiyasi UMUMAN yo'q.** Studio-sifat trek (vokal+instrumental, seksiya nazorati). **YANGI bo'lim: "Audio › Musiqa"** (launcher "Yaratish"ga audio card). | fal.ai/models/fal-ai/elevenlabs/music |
| **3** ⭐ | `fal-ai/minimax/speech-02-hd` (yoki `speech-2.8-hd`) | ✅ to'g'ri | TTS (text→speech) | $0.1/1000 belgi · `text`+`voice_setting` | **TTS bo'limi yo'q.** Lip-sync sheetда "Ovoz: Aziz/Dilnoza" preset bor — lekin haqiqiy TTS endpoint ulanmagan. Voiceover/dublyaj uchun shart. **YANGI bo'lim: "Audio › Ovoz (TTS)"** + Lip-sync ovoz manbai. | fal.ai/models/fal-ai/minimax/speech-02-hd |
| **4** ⭐ | `fal-ai/elevenlabs/speech-to-text` | ✅ to'g'ri | STT/transkripsiya (audio→text) | $0.03/min · `audio_url` | **STT yo'q.** Subtitr/caption, audiodan matn — AE workflow (titrlash) uchun juda foydali. So'z-darajali timing qaytaradi. **YANGI bo'lim: "Audio › Transkripsiya"** yoki Edit video yordamchisi. | fal.ai/models/fal-ai/elevenlabs/speech-to-text |
| **5** | `fal-ai/film` | ✅ to'g'ri | frame-interpolation (2 keyframe→oraliq) | $0.0013/compute-s · `start_image_url`+`end_image_url` | Prototipда **RIFE "Slow-mo" faqat "Tez orada" (dim)**. `film` keyframe orasini to'ldiradi (morph/smooth) — RIFEни to'ldiradi. **Edit video › Slow-mo'ни faollashtir** (RIFE=video, film=2 rasm). | fal.ai/models/fal-ai/film |
| **6** | `fal-ai/cassetteai/music-generator` | ✅ to'g'ri | music-gen (text→audio, ultra-tez/arzon) | $0.02/min · `prompt`+`duration` | ElevenLabs music'нинг **40× arzon** muqobili (3-min trek <10s). Background bed/draft uchun ideal — yuqori resell marja. **Musiqa bo'limи "arzon tier".** | fal.ai/models/cassetteai/music-generator |
| **7** | `fal-ai/kling-video/ai-avatar/v2/pro` | ✅ to'g'ri | avatar (image+audio→video) | $0.115/s · `image_url`+`audio_url`(+prompt) | OmniHuman'нинг arzonroq muqobili; odam/hayvon/cartoon/stilизованный qo'llab-quvvatlaydi. Avatar bo'limида "arzon/Kling tier" sifatida (OmniHuman=premium). | fal.ai/models/fal-ai/kling-video/ai-avatar/v2/pro |
| **8** | `fal-ai/pixverse/swap` | ✅ to'g'ri | face/object/bg swap (video) | $0.15–0.40/5s · `video_url`+`image_url`+keyframe | Prototipда **face-swap/object-swap UMUMAN yo'q.** Videoда odam/obyekt/fonни almashtirish. **Edit video › yangi "Swap" amal** (Restyle yonida). | fal.ai/models/fal-ai/pixverse/swap |
| **9** | `fal-ai/musetalk` | ✅ to'g'ri | real-time lip-sync (faqat og'iz) | (compute) · `video_url`+`audio_url` | Mavjud video'нинг faqat og'iз hududини tahrir qiladi (real-time, arzon). sync-v2/LatentSync'га **arzon 3-tier** sifatida Lip-sync sheetга qo'shiladi. | fal.ai/models/fal-ai/musetalk |
| **10** | `fal-ai/trellis` | ✅ to'g'ri | image-to-3D (PBR, SLAT) | $/gen · `image_url` | 3D bo'limда prototip "Meshy 6 / SAM 3D"ни ko'rsatadi (fal'да noaniq), lekin **Trellis — fal'нинг flagman 3D modeli** va prototipда YO'Q. 3D model sheetга qo'sh (Hunyuan/Rodin yonida). | fal.ai/models/fal-ai/trellis |
| **11** | `fal-ai/elevenlabs/tts/eleven-v3` | ✅ to'g'ri | TTS premium (text→audio, dialog) | $/belgi · `text` (+audio tags) | MiniMax TTS'нинг premium muqobili; ko'p-spiker dialog + emotsional teglar. TTS bo'limда "premium tier" + Lip-sync/Avatar ovoz manbai. | fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3 |
| **12** | `fal-ai/cassetteai/sound-effects-generator` | ✅ to'g'ri | SFX (text→audio) | $/min · `prompt`+`duration` | Hozir SFX faqat **`mmaudio` (video→audio)**. Bu **matndan SFX** (videosiz) — Beatoven (FAL-DOCS §14да o'lik/bo'sh) o'rнини bosadi. SFX bo'limига "text→SFX" rejim. | fal.ai/models/cassetteai/sound-effects-generator |

### ❌ / ⚠️ Tekshiruvда aniqlanган muammolar
- `easel-ai/advanced-face-swap` — ⚠️ **DEPRECATED** ("no longer supported"). RASM face-swap uchun fal'да endi barqaror endpoint yo'q → video uchun `pixverse/swap` (#8) ishlat; sof rasm face-swap'ни qo'shма yoki Easel o'rнига boshqa partnerга kut.
- `https://www.fal.ai/models/face-swap` — ❌ **404** (umumiy "Swap Face" sahifa endi yo'q).
- Prototip 3D sheetидаги "**Meshy 6**", "**SAM 3D**", "**Rodin 2.0 (Hyper3D)**" nomlари fal'да aynan tasdiqlanмади (fal'да tasdiqlangan 3D: `fal-ai/trellis`, `fal-ai/hunyuan3d/v2` / `hunyuan3d-v21`, `fal-ai/triposr`, `hyper3d/rodin/v2.5/...`) — bu **alohida audit** mavzusi (bu vazifa "yetishmaган"га qaratилган).

### Qisqa xulosa (ustuvorlik)
1. **Eng katta yetishmaган kategoriya = AUDIO.** Prototipда t2i/t2v/edit/3d boy, lekin **TTS (#3, #11), Musiqa (#2, #6), STT (#4), text-SFX (#12) UMUMAN yo'q.** Launcher "Yaratish"ga yangi **"Audio"** card qo'shish kerak (Ovoz · Musiqa · Transkripsiya · SFX).
2. **Talking-avatar (#1 OmniHuman, #7 Kling avatar)** — fal'нинг eng "viral" 2026 kategoriyasi, prototipда butunlay yo'q. Lip-sync (faqat og'iz)дан bir pog'ona yuqori — alohida bo'lim bo'lishга arzийди.
3. **Tez g'alabalar (allaqachon yarим bor):** Slow-mo'ни `film`+RIFE bilan faollashtirish (#5), Lip-sync'га arzon `musetalk` (#9), SFX'га text-rejim (#12).
4. Hammasi **Commercial use** — resell biznes-modeliга mos.

---

## D) Implement'дан oldin hал qilinadigan savollar

**1. Noto'g'ri/xayoliy model nomlари — olib tashlaymizmi yoki to'g'rilaymizmi?**
Kontekst: bir nechta model nomi fal'да umuman yo'q yoki versiyasi xato — `Gemini 3 Pro`, `Gemini 3.1 Pro` (eng yuqorisi `gemini-2.5-pro`), `Claude Sonnet 4.6` (fal'да `claude-sonnet-4.5`), `Tripo H3.1` (fal'да yo'q → `tripo3d/p1`), `Rodin 2.0` (→ `v2.5`).
- A) Avtomatik mavjud eng yaqin versiyaga map qil (3 Pro→2.5 Pro, 4.6→4.5, Tripo H3.1→P1, Rodin 2.0→2.5).
- B) Xayoliy nomlarni butunlay olib tashla, faqat tasdiqlangan id qoldir.
- C) Aralash: LLM'да eng-yaqin map (A), 3D'да real nom (Tripo P1, Rodin 2.5) bilan almashtir.
> Tavsiya: **C**.

**2. Param nomuvofiqligi — prototip adv'и fal schemaga moslanadimi?**
Kontekst: `Flux 2 Pro` zero-config, lekin prototip Steps=56 + Guidance=35 ko'rsatadi (bu `flux-2-flex`'niki). `GPT Image 2 edit` "Input fidelity" advanced fal'да yo'q. `GPT Image 2 edit` `ref:1` deydi-yu multi-image qabul qiladi.
- A) `flux-2-pro` qoldir, Steps/Guidance'ni adv'дан olib tashla.
- B) Steps/Guidance kerak bo'lsa `flux-2-flex`'ga o'tkaz ($0.05/MP).
- GPT edit: `ref:1→≥4`, "Input fidelity" advanced'ni olib tashla (yoki `gpt-image-1.5/edit`'ga).
> Tavsiya: har model adv panelini fal schemasidan **avtomatik generatsiya qil** — qo'lda yozma. Bu butun sinfni hал qiladi.

**3. Deprecated endpoint/model — hozir almashtiramizmi?**
Kontekst: `fal-ai/any-llm` + `any-llm/vision` (BUTUN LLM router) DEPRECATED; `decart/lucy-edit/fast` DEPRECATED; `easel-ai/advanced-face-swap` DEPRECATED; PixVerse v4.5 superseded (v5.5 bor).
- LLM: `openrouter/router`'ga ko'chir (model slug bir xil) — **majburiy**, aks holda LLM ishlamайди.
- Lucy Fast → `decart/lucy-edit/dev` yoki Editto 480p.
- PixVerse → v4.5 ishlaydi, v5.5'ga keyin.
> Savol: deprecated'larни **launch'дан oldin** almashtiramizmi (tavsiya: ha, LLM router + Lucy Fast majburiy), PixVerse'ни keyingi iteratsiyaga qoldiramizmi?

**4. Auto-model routeri qanday ishlaydi?**
Kontekst: har kategoriyada "Auto · tavsiya" birinchi, lekin u fal modeli emas — backend tanlovi. Hozir routing logikasi aniqlanmagan.
- A) Narx asosida (eng arzon mos model).
- B) Sifat/use-case asosida (i2v+end+audio kerak bo'lsa Seedance/Kling O3).
- C) Statik default har kategoriyaga (IMG→Seedream 4.5, VID→Seedance Fast, ...).
> Savol: Auto MVP'да **statik default (C)** bo'ladimi yoki rule-based router (A/B)? Bu backend ishini belgilaydi.

**5. 3D bo'limi MVP'га kiradimi — va format chiplari real chiqishga moslanadimi?**
Kontekst: 8/8 model fal'да real, lekin (a) prototip OBJ/STL chiplari ko'p model'да real chiqishга mos emas (`trellis`/`trellis-2`/`sam-3` faqat GLB), (b) AE CEP hozir `.glb`→native 3D layer importни qo'llamaydi — prototip "AE native" deb va'da beradi.
- Savol A: 3D MVP'га kiradimi yoki v2'ga? (audio bo'limи MISSING'да undан muhimroq deb baholangan.)
- Savol B: kiритилса, import yo'li — avtomatik AE native (qo'llab-quvvatlanмайди) yoki "download .glb + qo'lда import"?
> Tavsiya: 3D'ни v2'ga, yoki MVP'да faqat "download .glb" oqimi bilan (native va'дани olib tashla).

**6. Audio + Talking-avatar bo'limи qo'shiladimi? (eng katta yetishmagan kategoriya)**
Kontekst: MISSING review — prototipда TTS, Musiqa, STT, text-SFX, talking-avatar UMUMAN yo'q. Hammasи Commercial-litsenziyали, fal'да real.
- A) MVP'га yangi "Audio" card qo'sh (TTS `minimax/speech-02-hd`, Musiqa `elevenlabs/music`+arzon `cassetteai`, STT `elevenlabs/speech-to-text`, text-SFX `cassetteai/sound-effects`).
- B) Talking-avatar alohida bo'lim (`omnihuman/v1.5` premium + `kling-ai-avatar` arzon).
- C) v2'ga qoldir, MVP faqat mavjud t2i/t2v/edit.
> Savol: Audio + Avatar MVP'га kiradimi (A+B) yoki keyingi bosqichга (C)? Lip-sync'даги "Ovoz: Aziz/Dilnoza" presetи hozir real TTS'га ulanмаган — agar lip-sync MVP'да bo'lsa, kamida TTS (#3) kerak.

**7. Narx/kredit modeli — per-compute-second modellarни nima qilamiz?**
Kontekst: imzolangан `cost-quote` deterministik narx talab qiladi. Lekin Aura-SR, BiRefNet v2, rembg, `any-llm` per-compute-second/per-token — narx oldindan noaniq.
- A) Bularни default tanlovga qo'yma, faqat "tez/zaxira" yorliq.
- B) Token/compute modellarга konservativ cap + post-hoc reconciliation.
> Tavsiya: **A** — cost-quote'га faqat per-image/per-MP/per-second modellar; compute-sec'lар "zaxira".

**8. Studio manba prototipи — qaysи kategoriyalar Stage-1'га kiради?**
Kontekst: prototip 7 data-massiv (IMG/VID/IEDIT/VEDIT/I3D/OPS/LLM) + MISSING'даги audio/avatar. Hammasини bир release'да qilish katta.
> Savol: Stage-1 scope = IMG+VID+IEDIT+OPS (eng tayyor, narx mos)? IEDIT/VEDIT/I3D/Audio keyingi stage'larга? Bu reja `docs/FIX-ROADMAP.md`'ga yozilsin.

---

### Eng kritik 5-7 issue (ustuvorlik bo'yicha)

**1. [BLOCKER] LLM router butunlay DEPRECATED endpoint'да.** `fal-ai/any-llm` + `any-llm/vision` ikkalasи ham "no longer supported". VTT/ITP/PA (describe, prompt-enhance, image-to-prompt) — barchasi shu ikki endpoint'га tayanади. `openrouter/router`'ga ko'chirилмаса, butun LLM-yordamчи sinfи ishlamайди. + 3 xayoliy model nomi (Gemini 3/3.1 Pro, Claude 4.6).

**2. [BLOCKER · UX] `run()` natijani HIST'га qo'shмайди.** Generatsiyadan keyин "So'nggi"/Tarix statик 7 soxта yozuvда qotади — gen → tarix → qayta tahrir asosий oqimi uziладi. `finish()` oxирида `HIST.unshift()` + `renderRecent()`. (UX review #2.)

**3. [KRITIK · UX] Estimate haqiqий model narxига bog'ланмаган.** `estimate()` `o.cur%5` indeks formula bilan — Z-Image Turbo ($0.005/MP) va Nano Banana Pro ($0.15) bir xil yoki teskari narx ko'rsатиши mumkin. Foydalanuvchи narxни asosий mezon qилади. Har model obyектида struktурали `price` maydonига bog'ла (hozir matn `s` ichида). (UX #1.)

**4. [KRITIK · model] Naming/prefix xatоlари adapter id'ни sindиради.** fal id prefiksлари aralash: `openai/gpt-image-2` (`fal-ai/` EMAS), `bytedance/seedance-2.0/*` (prefikssiz), `decart/lucy-*`, `xai/grok-*`, `bria/video/background-removal` (prefikssiz). + versiya: `veo3.1` (nuqтали), `wan-25-preview` (suffiks majburий), `ltx-2-19b` (to'liq). Adapter id-mapping shularни hisobга olмаса 404. + "Seedance Pro" tier fal'да yo'q (Standard/Fast).

**5. [KRITIK · model] Param/schema nomuvofiqлиги.** `Flux 2 Pro` zero-config-yu prototip Steps/Guidance beради (flex'niki); `GPT Image 2 edit` `ref:1`-yu multi-image; "Input fidelity" advanced fal'да yo'q; 3D format chiplari (OBJ/STL) ko'p model real chiqишига mos emas; "8K tekstura" → max 4K. Yechим: **adv panelни fal schemasidan auto-generatsiya qil**.

**6. [KRITIK · UX] Til aralашмаси (kirill-lotin qo'shimча).** "promtини", "shaharда", "Kadrдан", "Project'дан", "Reference'дан" — lotin so'z + kirill qo'shimча. Professional emas, ekран o'qувчи vositаларни sindiради. Hammани lotinга. (UX #5.)

**7. [O'RTA · UX+model] Bo'sh-prompt validatsiyаси yo'q + busy/interval cross-view oqади.** `run()` `<textarea>` qiymатини o'qiмайди — bo'sh prompt bilан ham "ishlайди" (real backend darhol xato). + `go()` view almashганда faol `iv` intervalни bekor qилмайди, `setBusy(false)` chaqирмайди — fonда natija ko'rinмас view'га chizилади. (UX #3, #6.)

---

**Eng katta struktурал topilma (MISSING):** prototip t2i/t2v/edit/3d'да boy, lekin **AUDIO kategoriyаси (TTS/Musiqa/STT/text-SFX) va Talking-avatar UMUMAN yo'q** — fal'нинг eng "viral" 2026 kategoriyаси. Lip-sync presetлари hozir real TTS'га ulanмаган. Savol #6 (scope qarori) bunи hал qилади.

Tegishли fayl: `/Users/usmonov/Projects/creative-tools-saas/design-preview/ai-tools-prototype.html` (data massivlar: IMG 288-297, VID, IEDIT 313-321, VEDIT 323-332, I3D 333-342, LLM 351-356; UX logika: `bal()` 282, `estimate()` 370, `run()`/`finish()` 448-471, `go()` 358).

---

*Tahlil tugadi. Kod o'zgartirilmadi. Keyingi qadam: D) bo'limдagi savollarni hал qilish → tuzatish rejasi (`docs/FIX-ROADMAP.md`).*
