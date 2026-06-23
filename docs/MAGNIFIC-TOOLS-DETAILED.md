# Magnific tools — HAR TOOL kontrollari (live recon, 100%)

*Manba: Claude in Chrome bilan `magnific.com/app` da HAR tool alohida ochib, HAQIQIY
kontrollar ko'rildi (taxmin emas). 2026-06-23.*
*API map: `docs/MAGNIFIC-API-REFERENCE.md` (docs.magnific.com).*
*UX/dizayn referensi: `docs/MAGNIFIC-TOOLS-UX.md`. Mockup: `design-preview/magnific-tools-composer.html`.*

> **MUHIM:** bu fayl faqat **tadqiqot + dizayn spetsifikatsiyasi**. Kod o'zgartirilmadi.
> Har kontrol yonida: **default qiymat**, **variantlar** (dropdown ochib olingan), va
> **→ API param** yoki **[web-only]** (API'да yo'q, klient/UI qatlamida).

## Arxitektura kashfiyoti (avval o'qi)

- Tool URL'lari **2 xil**: `/app/tools/{slug}` (alohida tool-form) va `/app/{generator}`
  (Image/Video Generator), va **`/app/image-editor`** — yagona canvas muharrir, ichida
  **10 ta tool-rail rejimi**.
- Ko'p "image tool"lar (Extend, Relight, Change Camera, Remove BG, Skin Enhancer, Upscale)
  **ham** alohida `/app/tools/...`да, **ham** Image Editor tool-rail rejimi sifatida bor.
- Image-input tool kontrollari **rasm tanlanmaguncha disabled (kulrang) ko'rinadi** —
  nomlar/defaultlar o'qiladi, lekin **dropdown variantlarini ochish uchun rasm kerak**
  (Creations'dan tanlandi, kredit sarflanmadi — final Generate hech bosilmadi).

---

# 1-QISM — IMAGE TOOLS (10)

## 1.1 Image Generator — `/app/ai-image-generator`
Text-to-image (Mystic oilasi). **Prompt-asosli.**

| Kontrol | Default | Variantlar / diapazon | API |
|---|---|---|---|
| **MODEL** ▾ | `✦ Auto` | Auto(∞), Cinematic(∞), **Multiple** (4 modelni birlashtir), **All models — 46 ta**; Featured: Seedream 5 Lite(∞), Google Nano Banana 2(∞), GPT 2 (metered 15–1200 kr)… | `model` (mystic: realism/fluid/zen/flexible/super_real/editorial_portraits; + Flux/Seedream/Nano/GPT) |
| **REFERENCES** | 0/8 | **Style**, **Character**, **Add** — multi, max **8** | `style_reference`, `styling.characters`, `structure_reference` |
| **PROMPT** | — | textarea + **AI prompt** toggle (ON) + improve + describe + clear | `prompt`; improve→`/v1/ai/improve-prompt`, describe→`/v1/ai/image-to-prompt` |
| **count** | `4` | stepper −/+ | klient: N marta job **[web-only orchestration]** |
| **aspect** ▾ | `1:1` | 1:1 Square, 16:9 Widescreen, 9:16 Social story, 2:3 Portrait, 3:4 Traditional, 1:2 Vertical, 2:1 Horizontal, 4:5 Social post, 3:2 Standard, 4:3 Classic | `aspect_ratio` (square_1_1, widescreen_16_9, social_story_9_16, …) |
| **∞ ON** | ON | unlimited rejim | **[web-only]** (billing/plan) |
| **Generate** | — | "Unlimited generations" | `POST /v1/ai/mystic` |

**Web-only:** AI-prompt toggle, ∞ unlimited, "Multiple" model birlashtirish, count fan-out.
*Skrinshot: ss_7902tszsq (panel), ss_8132hima2 (MODEL ochiq), ss_7916a3gfq (aspect ochiq).*

## 1.2 Image Editor — `/app/image-editor`
**Yagona canvas muharrir.** Yuqorida AI-edit prompt-bar + pastda **10-tool rail**.
Rasm `Upload / Select from creations` orqali yuklanadi.

**Prompt-bar (AI-edit, instruct):** `Prompt | Visual` rejim · **Model** ▾ (Auto) ·
**Images** −/+ (default **2**) · reference biriktirish (📎).

**Tool-rail (chapdan o'ngga, 10 ta):**

| # | Rejim | Kontrollar | API |
|---|---|---|---|
| 1 | **AI Edit** (instruct) | prompt + Prompt/Visual + Auto model + Images(2) | edit endpointlari (Seedream edit / Flux Kontext) |
| 2 | **Inpaint** | **Replace \| Erase** + brush-size slider (def **20**) + Auto model | `/v1/ai/ideogram-image-edit` (inpaint) |
| 3 | **Expand / Extend** *(= Image Extender)* | **Custom** aspect ▾ + **Width** px (2752) + **Height** px (1536) + optional prompt + Auto model | `POST /v1/ai/image-expand/{flux-pro\|ideogram\|seedream-v4-5}` |
| 4 | **Restyle** | **Style \| Color** + Upload ref + **presets**: #classic, #vector, #3D-Char, #dotted, #holographic, #risoprint, #neoclassic, #fantasy, #whimsy, #moodybw, #classical, ••• | `POST /v1/ai/image-style-transfer` (€0.10) |
| 5 | **Background Remover** | bir-bosishli (parametrsiz) | `POST /v1/ai/beta/remove-background` |
| 6 | **Change Camera** | **Camera Preview** (3D orbit viz) + **Rotate** (45°) + **Vertical** (0°) + **Zoom** (initial) + Images(2) | `POST /v1/ai/image-change-camera` |
| 7 | **Relight** | **LIGHT PREVIEW** drag-to-position + **QUICK SELECT** Top/Front/Right/Left/Back/Bottom + light count(1)+add + **color** (white/yellow/orange/blue/rainbow) + **Rotate**(0°) + **Elevation**(0°) + **Intensity**(5) + **2K** + count + ∞ | `POST /v1/ai/image-relight` (€0.10) |
| 8 | **Upscale** *(= Image Upscaler)* | → 1.3 ga qara | `POST /v1/ai/image-upscaler` |
| 9 | **Skin Enhancer** | **Version** ▾ (Flexible) + **Optimized For** ▾ (Enhance skin) + **Sharpen** (0%) + **Smart Grain** (2%) | `POST /v1/ai/skin-enhancer/{creative\|faithful\|flexible}` |
| 10 | **Adjust** *(non-AI)* | **Light/Color/Tint🦋/Grain🦋/Rotate** + filtr presetlar: vintage, retrofilm, duotone, vibrant, warmtone, coolbreeze, redtint, coldtone | **[web-only]** — klient-side rang/filtr, API yo'q |

**Web-only:** butun canvas/composite; Adjust (#10) filtrlar; Prompt/Visual UI; multi-tool orkestratsiya.
*Skrinshot: ss_5598ewhbh (canvas+rail), ss_3026gzlk9 (Inpaint), ss_3496m4kbv (Expand),
ss_4711blf5d (Restyle), ss_5909uhgug (Remove BG), ss_6677aghg2 (Change Camera), ss_7860lr1hk (Relight),
ss_952541m6i (Upscale), ss_2442i3a0l (Skin Enhancer), ss_36107ipsr (Adjust), ss_114228q5t (Change Camera kontrollar).*

## 1.3 Image Upscaler — `/app/tools/upscaler` (= Editor #8)
Image-input. **PREMIUM.**

| Kontrol | Default | Variantlar | API param |
|---|---|---|---|
| **rejim** | Creative | **Creative \| Precision** | endpoint variant (Creative vs Precision V1/V2) |
| **MODEL** ▾ | Magnific | **Classic**, **Magnific** | `engine`/model variant |
| **PRESETS** ▾ | Subtle | Subtle (+ boshqalar) | preset → params to'plami |
| **SCALE FACTOR** ▾ | 2x | **2x, 4x, 8x**(ⓘ premium), **16x**(ⓘ premium) | `scale_factor` |
| **OPTIMIZED FOR** ▾ | Standard Ultra | Standard Ultra, Portrait (Soft), Portrait (Hard), Art & Illustration, Videogame Assets, Nature & Landscapes, Films & Photography, 3D Renders, Science Fiction & Horror | `optimized_for` |
| **CREATIVITY** | −3 | slider (−10..10) | `creativity` |
| **HDR** | 0 | slider | `hdr` |
| **RESEMBLANCE** | 3 | slider | `resemblance` |
| **FRACTALITY** | 0 | slider | `fractality` |
| **ENGINE** ▾ | Automatic | Automatic (+ boshqalar) | `engine` |
| **PROMPT** | (auto) | textarea | `prompt` |
| Final size | — | "5504×3072" hisoblanadi | **[web-only]** readout |

`POST /v1/ai/image-upscaler` · output ≤ 25.3M px · narx piksel bo'yicha.
*Skrinshot: ss_0159uc2x3 (panel), ss_2291bl5ev (Scale Factor), ss_2558avkii (Optimized For), ss_8191leldw (Model).*

## 1.4 Image Extender — **standalone yo'q**, faqat Editor "Expand" rejimi (1.2 #3)
`POST /v1/ai/image-expand/{flux-pro|ideogram|seedream-v4-5}` · Custom aspect / Width px / Height px / optional prompt / model.

## 1.5 Variations — `/app/tools/variations` *(Experimental)*
Image-input. **Multi-perspektiv** generatsiya.

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **Select image** | — | rasm | input |
| **MODE** ▾ | Reframe | Reframe (+ boshqalar) | rejim |
| **PERSPECTIVES** | 9/9 faol | **16 ta** multi-select: Ext. long shot, Long shot, Closeup, Medium long, Extreme closeup, Low angle, Back view, Med. closeup, OTS, High angle, Wide, POV, Aerial, Eye level, Profile, 3/4 view | **[web-only fan-out]** — har rakurs uchun alohida job |
| **aspect / grid / res** | 1:1 / 3x3 / 4K | — | `aspect_ratio` + klient grid |

**API:** bitta endpoint **yo'q** — Mystic + structure/style reference + rakurs-prompt bilan taqlid.
*Skrinshot: ss_8073wgfos.*

## 1.6 Cinematic Shot — `/app/tools/cinematic-shot`
Text-to-image + **kamera preset**.

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **CAMERA** ▾ | "Standard, 50mm, f/4" | shot type + focal length (mm) + aperture (f/) preset | **[web-only]** — promptga injection |
| **REFERENCES** | 0/8 | **Character, Add** (Style yo'q) | `styling.characters` |
| **PROMPT** | — | + AI-prompt toggle + improve/describe | `prompt` |
| count / aspect / res / ∞ | 1 / 1:1 / 1K / ON | — | `aspect_ratio`, `resolution` |

**API:** bitta endpoint **yo'q** — Mystic + kinematik prompt (kamera preset prompt ichiga).
*Skrinshot: ss_4023f0ddm.*

## 1.7 Skin Enhancer — `/app/tools/skin-enhancer` (= Editor #9)
`POST /v1/ai/skin-enhancer/{creative|faithful|flexible}` · Version(Flexible/…) → path · Optimized For(Enhance skin/…) · Sharpen(0%) · Smart Grain(2%).

## 1.8 Relight — standalone + Editor #7
`POST /v1/ai/image-relight` · light-position pad → rotate/elevation; QUICK SELECT 6 yo'nalish; color; Intensity(5). **[web-only]:** 3D light-preview drag UI.

## 1.9 Change Camera — `/app/tools/change-camera` (= Editor #6)
`POST /v1/ai/image-change-camera` · Rotate(45°)/Vertical(0°)/Zoom(initial) + Images count. **[web-only]:** 3D orbit-preview viz.

## 1.10 Background Remover — `/app/tools/remove-background` (grid: "Remove Background", = Editor #5)
`POST /v1/ai/beta/remove-background` · bir-bosishli, parametrsiz.

---

# 2-QISM — VIDEO TOOLS (6)

## 2.1 Video Generator — `/app/ai-video-generator`
i2v / t2v. **Hammasi metered (kredit oralig'i ko'rsatiladi).**

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **MODEL** ▾ | `⚙ Auto` (100–2800 kr) | Multiple, All models; Featured: **Seedance 2.0 Fast** (480–3525), **Seedance 2.0** (580–21k), **Kling 3.0** (210–6000), **Kling 3.0 Omni** (210–6000), **Kling 3.0 Turbo** (630–3900) + Veo/Runway/WAN… | `POST /v1/ai/image-to-video/{model}` yoki `/text-to-video/{model}` |
| **REFERENCES** | — | **Start image** + **End image** (i2v birinchi/oxirgi kadr) + **Add media** (image/video/audio/character/+) | `image` (start), end-frame (model-dependent; Kling) |
| **SHOT** (+) | Manual | Manual ▾ + multi-shot qo'shish | **[web-only]** multi-shot orkestratsiya |
| **PROMPT** | — | 0/**1999** char, `@image` refs | `prompt`, `negative_prompt`, `cfg_scale` |
| **duration** | 5-6" | — | `duration` (5/10) |
| **aspect** | 16:9 | — | inputdan |
| **🔊 ON** | ON | audio bilan generatsiya | audio-rejim (Veo/Kling Omni) |

**Web-only:** Add-media multimodal qator, Shot/Manual multi-shot, model-kredit ko'rsatkichi.
*Skrinshot: ss_2852xybii (panel), ss_5685x5yle (MODEL ochiq).*

## 2.2 Clip Editor — `/app/video-clip-editor`
**Bitta klipni** tahrir (trim/cut). Klip konteksti bo'lmasa cheksiz yuklanadi (standalone ochilmaydi).
**API: YO'Q** — web-only video trim/cut UX. Asset-gen plagin uchun scope'dan tashqari.
*Skrinshot: ss_0731yu0w0 (loading), ss_9074f56nk.*

## 2.3 Video Upscaler — `/app/tools/video-upscaler`
Video-input.

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **Select Video** | — | video | input |
| **rejim** | Creative | Creative \| **Precision** (New) | variant |
| **MODEL** ▾ | Magnific | Magnific (+ boshqalar) | model |
| **PRESETS** ▾ | Animation & 3D | (+ boshqalar) | preset |
| **OUTPUT RESOLUTION** ▾ | 1440p (2K) | (+ 4K…) | `resolution` |
| **FPS BOOST** | off | toggle | `fps_boost` |
| **TURBO MODE** | off | toggle | `turbo` |
| **12-frame preview** | — | tugma | preview-job |
| **Upscale** | — | — | `POST /v1/ai/video-upscaler` |

*Skrinshot: ss_9082bi6eq. (O'ng panelda video modellar: runway gen 4.5, kling 3.0 omni — sec/aspect/fps bilan.)*

## 2.4 Video Project Editor — `/app/video-editor`
**Timeline/loyiha NLE** (My Projects, New video project, "No video projects yet").
Ko'p-klipli kompozitsiya. **API: YO'Q** — assembly klient tomonда. Scope'dan tashqari.
*Skrinshot: ss_9645dcj7u.*

## 2.5 Speak — `/app/tools/speak`
Lip-sync / gapiruvchi avatar. "Turn images and videos into speaking clips with AI".

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **CUSTOMIZE** | — | **Start image** + **Video** (baza input) | `image`/`video` |
| rejim | Script | **Script \| Add audio** | TTS yoki yuklangan audio |
| **Script** | — | textarea + **Select a voice** + **Preview voice** | matn→TTS, voice id |
| **Generate** | — | — | `POST /v1/ai/lip-sync/latent-sync` (+ OmniHuman, Runway Act Two) |

*Skrinshot: ss_94943i1ai.*

## 2.6 Video Relight — `/app/tools/video-relight`
Video-input. "Relight your footage with precise AI lighting control".

| Kontrol | Default | Variantlar | API |
|---|---|---|---|
| **Upload a video** | — | video | input |
| rejim | Relight | **Relight \| Light transfer** | rejim |
| **LIGHT PREVIEW** | — | drag-to-position (3D) | → rotate/elevation params |
| **QUICK SELECT** | Front | Top/Front/Right/Left/Back/Bottom | yo'nalish |
| **LIGHT SETTINGS** | 1 ta | light count+add + color (white/yellow/orange/blue/rainbow) | color/count |
| **Rotate / Elevation / Intensity** | 0° / 0° / 5 | sliderlar | params |
| **res** | 1080 | — | `resolution` |

**API:** **noaniq** — docs'da faqat `image-relight` bor; video-relight endpointi tasdiqlanmagan
(VFX/undocumented bo'lishi mumkin). **Tekshirish kerak.**
*Skrinshot: ss_9532eo250.*

---

# 3-QISM — WEB-ONLY (API'да YO'Q) — plaginда qayta qurish kerak

| Element | Sabab |
|---|---|
| **Image Editor** canvas (composite) | Operatsiyalar alohida endpoint; "bitta editor chaqiruvi" yo'q |
| **Adjust** (#10) filtrlar | Klient-side rang/grain/rotate, AI emas |
| **Clip Editor** / **Video Project Editor** | Video trim / timeline NLE — endpoint yo'q |
| **Variations** perspektiv fan-out | Mystic + reference bilan, har rakurs alohida job |
| **Cinematic Shot** kamera preset | Mystic + prompt injection |
| **Multiple** model + **count** fan-out + **multi-shot** | Klient orkestratsiya |
| 3D light/camera **preview** vizlar | UI; faqat rotate/elevation/zoom/intensity params chiqaradi |
| **∞ unlimited**, model-kredit badge | Billing/plan UI |
| **Video Relight** | API endpointi tasdiqlanmagan |

---

# 4-QISM — Mockup yangilash spetsifikatsiyasi
*(`design-preview/magnific-tools-composer.html` ni shu real kontrollarga moslash)*

**Tool-picker:** Generate · Upscale · Extend · Relight · Change Camera · Remove BG · Skin · Variations · Video · Video Upscale · Speak · Video Relight. *(Mockup'dagi "SFX/Music" — Audio bo'limi, alohida.)*

- **Generate** — MODEL "Auto (Mystic)" (46-model eslatma); REFERENCE = Style/Character/Add (0/8, max 8); aspect = **10 ta** (1:1,16:9,9:16,2:3,3:4,1:2,2:1,4:5,3:2,4:3); count stepper; ∞; AI-prompt toggle + improve/describe.
- **Upscale** — Creative|Precision; Model Classic|Magnific; Presets; Scale **2x/4x/8x/16x**; Optimized-For **9 ta**; Creativity/HDR/Resemblance/Fractality sliderlar; Engine; "Final size" readout.
- **Extend** (yangi pane) — Custom aspect + Width px + Height px + optional prompt.
- **Relight** (yangi) — light-position pad + 6 quick-dir + color swatch + Rotate/Elevation/Intensity + res.
- **Change Camera** (yangi) — orbit viz + Rotate/Vertical/Zoom.
- **Skin** (yangi) — Version + Optimized-For + Sharpen + Smart Grain.
- **Remove BG** — bir tugma.
- **Variations** — Mode + **16 perspektiv** multi-select chip + grid + res.
- **Video** — model (Kling 3.0 / Seedance) + **Start+End image** + duration (5-6") + aspect + **🔊 audio toggle** + prompt (1999).
- **Video Upscale** — Creative|Precision + Output res (1440p/4K) + **FPS Boost** + **Turbo** + 12-frame preview.
- **Speak** — image/video baza + **Script|Add-audio** + voice select + preview.
- **Video Relight** — Relight|Light-transfer + light pad + 6 dir + sliderlar + res.
- **Web-only** (Adjust filtrlar, Clip/Project editor, multi-shot) — plaginда **ko'rsatilmaydi**.

---

## Skrinshot ro'yxati (ID → tool)
- ss_7902tszsq, ss_8132hima2, ss_7916a3gfq — Image Generator
- ss_5598ewhbh + (ss_3026gzlk9, ss_3496m4kbv, ss_4711blf5d, ss_5909uhgug, ss_6677aghg2, ss_7860lr1hk, ss_952541m6i, ss_2442i3a0l, ss_36107ipsr, ss_114228q5t) — Image Editor rail
- ss_0159uc2x3, ss_2291bl5ev, ss_2558avkii, ss_8191leldw — Image Upscaler
- ss_8073wgfos — Variations · ss_4023f0ddm — Cinematic Shot
- ss_2852xybii, ss_5685x5yle — Video Generator
- ss_9082bi6eq — Video Upscaler · ss_9532eo250 — Video Relight
- ss_94943i1ai — Speak · ss_9645dcj7u — Video Project Editor · ss_0731yu0w0 — Clip Editor
