# Magnific Tools — UX recon + API map + plagin integratsiya dizayni

> **Manba:** Claude in Chrome bilan `magnific.com/ai` web-app JONLI ko'rib chiqildi (login —
> foydalanuvchi hisobi; faqat kuzatish, hech narsa sotib olinmadi/o'zgartirilmadi) + API
> reference (`docs/MAGNIFIC-API-REFERENCE.md`) + migratsiya rejasi (`docs/MAGNIFIC-MIGRATION-PLAN.md`).
> **Maqsad:** har tool'ning real UX'ini API'ga map qilib, plagin AI Tools panelига chiroyli
> integratsiya dizaynini chiqarish. **Holat:** dizayn referensi — kod o'zgartirilmagan.
> *Sana: 2026-06-23.*

---

## 0. Magnific app arxitekturasi (kuzatilgan)

`magnific.com/app/{slug}` (ba'zilari `/app/tools/{slug}`). 3 ustunli layout:

```
┌──────┬─────────────────────┬──────────────────────────────┐
│ icon │  TOOL COMPOSER       │  CANVAS / "Creations" feed   │
│ rail │  paneli              │  (natijalar tarixi)          │
│      │                      │                              │
│ M +  │  [Image|Video|Audio| │  Creations · My templates ·  │
│ Home │   Spaces|…] tab-row  │  Academy   + filtr/grid/qidir│
│ Srch │  ‹ Tools  ToolNomi   │                              │
│ Apps │  ── kontrollar ──    │  ┌── natija karta ──┐        │
│ pin  │  MODEL ▾             │  │ prompt + thumb    │        │
│ tools│  REFERENCES (0/8)    │  │ + vaqt            │        │
│      │  PROMPT [textarea]   │  └───────────────────┘        │
│      │  count · aspect · ON │                              │
│      │  [ Generate ]        │                              │
└──────┴─────────────────────┴──────────────────────────────┘
```

- **Chap icon-rail:** M-logo, **+** (yangi), Home, Search, **All tools** (grid — barcha toollar dialogi), Spaces, pin qilingan toollar (Image/Video/Voice/Assistant/Editor), Academy, Notifications.
- **Composer paneli** (chap, ~255px): tool-tab qatori (**Image / Video / Audio / Spaces / Design / 3D / Flows**) → `‹ Tools` + tool nomi + **Templates** tugma → tool-spetsifik kontrollar → **Generate**.
- **Canvas** (o'ng): **Creations** feedi (oldingi generatsiyalar — prompt + thumb + vaqt), **My templates**, **Academy**; tepada media-tur filtri + grid/list toggle + qidiruv.

**2 muhim UX-naqsh:**
1. **Prompt-asosli toollar** (Image/Video Generator, SFX, Music, Icon) — composer darrov to'liq (MODEL + REFERENCES + PROMPT + kontrollar + Generate).
2. **Rasm-input toollar** (Upscaler, Editor, Relight, Remove-BG, Change Camera, Skin Enhancer, Variations, Cinematic Shot, Mockup) — **rasm berilmaguncha panel BO'SH**; rasm yuklangach/tanlanban tool-spetsifik **sliderlar/kontrollar** chiqadi.

**Stock** — alohida `magnific.com/stock`: tepada qidiruv-bar (matn + **kamera = rasm bilan qidirish** + mic) → kontent-tur grid: **Photos · Vectors · Illustrations · Templates · PSDs · Mockups · Videos · Icons · Sound Effects · Music · 3D Models · Fonts** → kuratsiya kolleksiyalari.

---

## 1. Tool inventari (Creative Suite + "All tools" dialogidan)

| Tool | Kateg. | Maqsad (UX tavsifi) | API endpoint | Async | Rasm-input |
|---|---|---|---|---|---|
| **AI Image Generator** (Mystic) | Image | Promptdan rasm; model + references | `POST /v1/ai/mystic` | ✅ poll | ✗ (ref ixtiyoriy) |
| **Image Editor** | Image | Mavjud rasmni tahrir/o'zgartir | `mystic` + `style_reference`/`structure_reference` | ✅ | ✅ |
| **Image Upscaler** (PREMIUM) | Image | Rezolyutsiya oshirish + detal | `POST /v1/ai/image-upscaler` | ✅ | ✅ |
| **Image Extender** | Image | Outpaint/kengaytirish | `POST /v1/ai/image-expand/{flux-pro\|…}` | ✅ | ✅ |
| **Variations** | Image | Variatsiyalar yaratish | `mystic` (style_ref + seed o'zgartirish) | ✅ | ✅ |
| **Cinematic Shot** | Image | Kinematik kadr/kompozitsiya | `mystic` (model/styling preset) | ✅ | ✅ |
| **Background Remover** | Image | Fonni olib tashlash | `POST /v1/ai/…remove-background` | ⚠️ **SINXRON**, URL ~5 daq | ✅ |
| **Skin Enhancer** | Image | Teri retush/yaxshilash | `image-upscaler` (optimized_for: soft_portraits) yoki maxsus | ✅ | ✅ |
| **Relight** | Image | Yorug'lik o'zgartirish | `POST /v1/ai/image-relight` (€0.10) | ✅ | ✅ |
| **Change Camera** | Image | Kamera burchagi/rakursni o'zgartirish | `POST /v1/ai/image-change-camera` | ✅ | ✅ |
| **Mockup Generator** | Design | Dizaynni mahsulotга joylash | (Stock mockups + edit) — TASDIQLANMAGAN | 🟡 | ✅ |
| **Icon Generator** | Design | Promptdan ikona (PNG/SVG) | `POST /v1/ai/text-to-icon` (+`/render/{png\|svg}`) | ✅ | ✗ |
| **Video Generator** | Video | Promptdan/rasmdan video (model thumbnail picker) | `POST /v1/ai/image-to-video/{model}` / `text-to-video/{model}` | ✅ | i2v: ✅ |
| **Video Upscaler** | Video | Video rezolyutsiya oshirish | `image-upscaler` (Video Upscaler varianti) | ✅ | ✅ (video) |
| **Speak** (lip-sync) | Video | Rasm/video + ovoz → labdosh | TASDIQLANMAGAN (lip-sync endpoint) | 🟡 | ✅ |
| **Video Project / Clip Editor** | Video | Timeline/clip montaj (UX) | Mahalliy editor — API EMAS (kompozit) | — | ✅ |
| **Video Relight** | Video | Video yorug'lik | `image-relight` video varianti | 🟡 | ✅ |
| **Text to Speech** | Audio | Matndan ovoz | ⚠️ API ref'da Magnific TTS **YO'Q** → web'da bor (Freepik); endpoint TASDIQLANMAGAN | 🟡 | ✗ |
| **Sound Effect Generator** | Audio | Promptdan SFX | `POST /v1/ai/sound-effects` | ✅ | ✗ |
| **Music Generator** | Audio | Promptdan musiqa | `POST /v1/ai/music-generation` | ✅ | ✗ |
| **Audio Isolation** | Audio | Ovoz/shovqin ajratish | TASDIQLANMAGAN | 🟡 | ✅ (audio) |
| **AI Classifier** (admin) | — | Rasm AI-mi (moderatsiya) | `POST /v1/ai/classifier/image` | ⚠️ SINXRON | ✅ |
| **Stock: Photos/Vectors/Illustr./Videos/Icons/SFX/Music/Mockups/Templates/3D/Fonts** | Stock | Qidiruv + download | `GET /v1/resources` · `/v1/icons` · `/v1/videos` | sinxron paginatsiya | qidiruv: ✗ |

---

## 2. Per-tool: UX → API map → plagin integratsiya dizayni

### 2.1 AI Image Generator (Mystic) — flagman ✅ [P1 allaqachon yozilgan]

**Kuzatilgan UX (composer):**
- **MODEL** dropdown — "✦ Auto" (+ presetlar: realism/super_real/fluid/zen/flexible/editorial_portraits).
- **REFERENCES (0/8):** uchta tugma — **Style** (✦), **Character** (👤), **Add** (+). 8 tagacha reference.
- **PROMPT** textarea — "Describe your image—try **@** to add references" + **AI prompt** toggle (improve-prompt) + ikonlar: improve / image-to-prompt (describe) / edit / clear.
- Kontrol qatori: **− 4 +** (count) · **1:1** (aspect dropdown) · **∞ ON** (fixed/seed yoki "to'plam").
- **Generate** (✦) + plan ("Unlimited generations").

| UX kontrol | → API param (`/v1/ai/mystic`) |
|---|---|
| MODEL dropdown | `model` (realism/fluid/zen/super_real/…) |
| Style reference | `style_reference` (base64) + `adherence`/`hdr` |
| Character reference | `styling.characters` |
| Add reference | `structure_reference` (base64) + `structure_strength` |
| PROMPT | `prompt` |
| AI prompt toggle | `improve-prompt` oldindan (yoki `creative_detailing`) |
| count (−N+) | **N parallel task** (Mystic = 1 natija/chaqiruv) |
| aspect (1:1) | `aspect_ratio` (square_1_1, widescreen_16_9, …) |
| resolution (Templates/sozlama) | `resolution` 1k/2k/4k |

**Plagin integratsiya:** ✅ **bajarilgan** (P1: `magnific.ts:magnificImage`, `GEN_PROVIDER=magnific`).
Plagindagi Gen Studio composer (prompt + model + aspect + count) AYNI shu UX'ning ixcham versiyasi.
**Kengaytirish:** REFERENCES (Style/Structure) — `styleReference`/`structureReference` paramlari QB-2 da
allaqachon hash-himoyalangan; UI'da "Style ref" + "Structure ref" upload slotlari qo'shiladi.

### 2.2 Rasm-input toollar (Upscaler / Editor / Relight / Remove-BG / Change Camera / Skin Enhancer / Variations / Cinematic Shot)

**Umumiy UX-naqsh:** rasm berilmaguncha panel BO'SH → rasm yuklash/tanlash → tool-spetsifik **slider/kontrollar** → Generate. AE plaginда rasm-input = **AE comp/layer'дан eksport** yoki **Creations'дан tanlash**.

| Tool | Kontrollar (API param) | Endpoint | Narx |
|---|---|---|---|
| **Upscaler** | scale_factor 2x/4x/8x/16x · optimized_for · **creativity/hdr/resemblance/fractality** (−10..10) · engine | `image-upscaler` | piksel bo'yicha; 8x €0.50 → **≥25 kr** |
| **Editor** | prompt + style/structure_reference | `mystic` | 7 kr |
| **Relight** | lightmap/yo'nalish + intensivlik | `image-relight` | €0.10 → 8 kr |
| **Remove-BG** | (kontrolsiz, 1-bosqich) | `…remove-background` ⚠️SINXRON | 3 kr |
| **Change Camera** | kamera burchagi/harakat | `image-change-camera` | ? |
| **Skin Enhancer** | retush kuchi | `image-upscaler` (soft_portraits) | ? |
| **Variations** | variatsiya soni + adherence | `mystic` (style_ref) | 6 kr |
| **Cinematic Shot** | model/styling preset | `mystic` | 6 kr |

**Plagin integratsiya:** har biri **"rasm tanlash → sozlama → Generate → AE import"** oqimi. UI: rasm-upload slot (AE layer eksport / drag) + 1–4 ta slider/dropdown. Kredit: `cost-quote`→consume→refund AYNI. ⚠️ Remove-BG/Classifier **sinxron** → poll-mashinani chetlab darrov R2 (alohida adapter shox).

### 2.3 Image Extender (outpaint)

**UX:** rasm + kengaytirish yo'nalishi (left/right/top/bottom px). **API:** `image-expand/{flux-pro|ideogram|seedream}` — `image` + `left/right/top/bottom` 0–2048. **Plagin:** rasm + 4 ta yo'nalish input (yoki preset "kengaytir 2x"). 6 kr.

### 2.4 Video Generator + Video Upscaler + Speak

**Kuzatilgan UX (Video Generator composer):** **MODEL THUMBNAIL picker** (Kling/Veo/Seedance/Wan/LTX/… vizual kartalar) + prompt + rasm-input (i2v boshlang'ich kadr) + kontrollar (duration/aspect) + Generate.

| Tool | Kontrol → API | Endpoint |
|---|---|---|
| **Video Generator (i2v)** | model thumbnail → `{model}`; rasm → `image`; duration **'5'/'10'** (string); prompt; negative_prompt; cfg_scale | `POST /v1/ai/image-to-video/{kling-v2…}` |
| **Video Generator (t2v)** | model; prompt; aspect | `POST /v1/ai/text-to-video/{model}` |
| **Video Upscaler** | scale; video-input | `image-upscaler` (video) |
| **Speak (lip-sync)** | rasm/video + ovoz fayl | TASDIQLANMAGAN |

**Plagin integratsiya:** P2 — i2v Kling v2.6 (`endFrame:false` QB-1). Composer: model-tanlov (thumbnail) + boshlang'ich kadr (AE layer) + duration (5/10) + prompt. Narx perSecond. ⚠️ **3 concurrent/user** (Kling). Clip/Project Editor — mahalliy timeline (API EMAS) → plaginda **NOT integratsiya** (AE o'zi montaj qiladi).

### 2.5 Audio (SFX / Music / TTS / Isolation)

| Tool | Kontrol → API | Endpoint |
|---|---|---|
| **Sound Effect** | prompt + duration_seconds 0.5–22 + prompt_influence 0.3 | `POST /v1/ai/sound-effects` ✅ |
| **Music** | prompt + music_length_seconds 10–240 | `POST /v1/ai/music-generation` ✅ |
| **Text to Speech** | matn + ovoz | ⚠️ Magnific API'da **YO'Q** → OpenRouter kokoro / ElevenLabs SAQLANADI (GAP-B) |
| **Audio Isolation** | audio fayl | TASDIQLANMAGAN → ehtimol saqlanmaydi/keyin |

**Plagin integratsiya:** P3 — SFX (mavjud, ElevenLabs→Magnific) + Music (yangi slot). Composer: prompt + duration slider. **TTS Magnific'да yo'q** — voiceover OpenRouter/ElevenLabs'да qoladi (aralash-provayder).

### 2.6 Icon Generator

**UX:** prompt + style (solid/outline/color/flat/sticker) + format (png/svg). **API:** `POST /v1/ai/text-to-icon` → `/{task-id}/render/{png|svg}`. **Plagin:** prompt + style dropdown + **SVG eksport** (AE uchun qimmatli — vektor). 4 kr.

### 2.7 Stock content (Photos / Videos / Icons / …)

**Kuzatilgan UX:** `magnific.com/stock` — qidiruv-bar (matn + **rasm bilan qidirish** kamera) + tur grid (Photos/Vectors/Illustrations/Templates/PSDs/Mockups/Videos/Icons/SFX/Music/3D/Fonts) + kuratsiya kolleksiyalari.

| UX | → API |
|---|---|
| Qidiruv (matn) | `GET /v1/resources?term=&page=&order=` |
| Filtr (orientation/content_type/license/color) | `filters` deepObject |
| Tur (Icons/Videos) | `GET /v1/icons` · `/v1/videos` |
| Download | `GET /v1/{...}/{id}/download[/{format}]` |

**Plagin integratsiya:** P4 — yangi `#stockPage` (AI Tools yonida yoki alohida tab). Qidiruv + filtr + grid + download. **Kredit EMAS** → `consumeDownload` (FREE 15/oy, PRO cheksiz). Premium → PRO gate (server-side license tekshiruvi). R2 kesh (5-daq URL'ga ishonilmaydi). Import: mavjud `aiImportMedia`.

---

## 3. Plagin panel arxitekturasi (tor ~360px AE)

Mavjud **AI Tools** tab (alohida — `dedicated tab` allaqachon qilingan) ichида **tool-picker + dinamik inputlar**:

```
AI Tools tab (ai-mode)
 ├─ Tool picker (gorizontal chip-qator yoki dropdown):
 │   ✨ Rasm · ✏️ Tahrir · ⬆️ Upscale · 🎬 Video · 🔊 SFX · 🎵 Music · ⬡ Icon · 🖼 Stock
 ├─ Tanlangan tool'ga qarab DINAMIK inputlar:
 │   • Prompt-asosli (Rasm/Video/SFX/Music/Icon): prompt + model + sozlama + Generate
 │   • Rasm-input (Upscale/Tahrir/Relight/Remove-BG/Change-Camera/Extender):
 │       [AE layer eksport / rasm tanlash] + tool sliderlari + Generate
 │   • Stock: qidiruv-bar + filtr + grid + download
 ├─ Narx qatori ("~N kredit") — cost-quote signed (mavjud)
 └─ Natija → AE import (mavjud aiImportMedia → importMediaFromPath JSX)
```

**Tavsiya:** mavjud `#aiComposer` (Gen Studio bar) **tool-aware** qilinadi — yuqorida tool-picker chip-qatori, tanlovga qarab pastdagi inputlar almashadi (mavjud composer = "Rasm" tool'ining inputi). Rasm-input toollar uchun **rasm-slot** (AE faol comp/layer'ни PNG eksport → reference) qo'shiladi. **Yangi JSX yo'q** — natija doim `aiImportMedia` orqali. Brend: lime (`--accent-cta`), mavjud dizayn tizimi. Tor panelга: tool-picker ixcham chip/scroll; sliderlar 1 ustun.

**Backend:** har tool = `gen-models.ts` entry (`provider:"magnific"`, `endpoint`, `magnificModel`); `magnific.ts`'да har endpoint uchun funksiya (`submitAndPoll` skeletoni qayta ishlatiladi); sinxron toollar (Remove-BG/Classifier) alohida shox. Kredit/quote/job/import **o'zgarmaydi**.

---

## 4. Bosqichli integratsiya tartibi (qiymat / murakkablik)

| Bosqich | Tool(lar) | Qiymat | Murakkablik | Holat |
|---|---|---|---|---|
| **P1** | Mystic rasm gen + edit | Yuqori (asosiy) | O'rta | ✅ **bajarilgan** |
| **P2** | Video i2v (Kling v2.6) | Yuqori | O'rta-yuqori (perSecond, 3-concurrent, endFrame:false) | keyingi |
| **P3a** | Upscaler + Extender + Relight | Yuqori (AE uchun real qiymat) | O'rta (rasm-input + sliderlar) | keyin |
| **P3b** | SFX + Music + Icon | O'rta | Past-o'rta (prompt+duration) | keyin |
| **P3c** | Remove-BG + Change-Camera + Skin + Variations + Cinematic | O'rta | O'rta (sinxron shox + image-input) | keyin |
| **P4** | Stock (Photos/Videos/Icons qidiruv-download) | Yuqori (yangi kontent qatlami) | O'rta (`consumeDownload` + R2 kesh) | keyin |
| **P5** | Eski provayder tozalash + webhook (ixt.) | Past | Past | oxir |

**Birinchi tavsiya (qiymat/murakkablik):** P2 (video) → P3a (upscale/extend/relight — AE uchun eng foydali post-prod) → P4 (stock) → P3b/c → P5.

---

## 5. Ochiq savollar (noaniq param/UX — jonli OpenAPI/Postman kerak)

1. **Mystic `count`** — 1 task = ko'p natija yoki count×task (count×COGS)? (P1 MVP'da count=1 qotirilgan — QB-3.)
2. **REFERENCES `@` mention** semantikasi — Style vs Character vs Add (structure) aniq param mapping.
3. **Remove-BG / Change-Camera / Skin Enhancer / Variations** — aniq endpoint nomi + param (web'да ko'rinadi, API ref'да qisman).
4. **Speak (lip-sync) / Audio Isolation / Text-to-Speech** — Magnific API'да endpoint bor-yo'qligi (web'да bor, docs'да yo'q) — TASDIQ kerak.
5. **Mockup Generator** — Stock mockup + edit kombinatsiyasimi yoki alohida endpoint?
6. **Video model thumbnaillari** — qaysi modellar yoqiq (Kling/Veo/Seedance/Wan/LTX) + har birining duration/aspect/end-frame qo'llovi (QB-1).
7. **Aniq COGS** (Mystic 1k/2k/4k, video har model, audio) — marja hisobi uchun (eng muhim ochiq savol — reja §9).
8. **Stock field nomlari** (`/v1/resources` response) — `mapMagnificResource()`да izolyatsiya.

---

## 6. Screenshot ro'yxati (Claude in Chrome, jonli)

| # | Sahifa/Tool | URL | Nimaни ko'rsatadi |
|---|---|---|---|
| 1 | Landing | `magnific.com/ai` | Nav (Creative Suite/Stock/Resources) + login avatar |
| 2 | Creative Suite menu | (dropdown) | TO'LIQ tool katalogi (Image/Video/Audio/3D/Design/Tools) |
| 3 | **AI Image Generator** | `/app/ai-image-generator` | Composer: MODEL/REFERENCES/PROMPT/count/aspect/Generate |
| 4 | All-tools dialog | (dialog) | Image toollar grid + tavsiflar |
| 5 | **Image Upscaler** | `/app/tools/upscaler` | Rasm-input talab (bo'sh panel → rasm kerak) |
| 6 | **Video Generator** | `/app/ai-video-generator` | Model-thumbnail picker + prompt composer |
| 7 | **Stock** | `magnific.com/stock` | Qidiruv-bar + kontent turlari (Photos/Videos/Icons/…) |

*Screenshotlar suhbatда saqlangan (Claude in Chrome `save_to_disk`).*

---

*Bu doc jonli browser recon + API reference + migratsiya rejasi asosida. Kod o'zgartirilmagan.
Keyingi qadam: foydalanuvchi tasdig'i bilan P2 (video) yoki P3a (upscale/extend/relight) implementatsiyasi.*
