> **STATUS:** PLANNED — composer dizayn rejasi (model-driven UI), joriy holat EMAS. Joriy holat: `docs/PROJECT-STATUS.md`. — 2026-06-20

# Studio Gen composer v2 — MODEL-ASOSLI dinamik composer (Artlist naqshi)

*Manba: Artlist toolkit composer skrinshotlari (6 rejim/model, 2026-06-15).*
*ASOSIY TALAB: har model tanlanganda o'ziga xos funksiyalar/sozlamalar chiqadi — composer dinamik.*

---

## 0. ASOSIY G'OYA — composer model-driven bo'lsin

Artlist'da bitta composer, lekin **tanlangan model o'z imkoniyatlarini "e'lon qiladi"** va composer shunga qarab kontrollarni ko'rsatadi. Misol:
- **Kling 3.0** → input: Start Frame + End Frame; settings: "Auto / **Pro** / 5 Seconds".
- **Seedance 2.0** → input: @mention (image/video/audio); settings: "Auto / **720p** / 5 Seconds".
- **Voiceover (Eleven v3)** → ovoz personasi ("Suburb") + "English / American / No Effect".
- **Music (Lyria 3 Pro)** → "Auto Lyrics" + "Auto Duration / Auto Genre / Auto Mood".

→ Demak `gen-models.ts` da har model **capabilities metadata**ga ega bo'lishi, plagin esa shu metadatadan kontrollarni **dinamik render** qilishi kerak.

---

## 1. HAR REJIM/MODEL COMPOSER — ✅ JONLI TASDIQLANGAN (skrinshot, 2026-06-15)

Umumiy shell (hamma rejimда bir xil): `[▦ Standard][💬 Agent]` … `[⌄ collapse]` / `[+] input options` / prompt + `[✦ enhance]` / pastki panel: `[Mode ▾] | [Model ▾] | [Settings ▾] | [Unlimited?] | [Generate]`.

### 1.1 IMAGE (Nano Banana 2) ✅
- Input: **+ Image Reference**
- Placeholder: "Describe the image you want to create"
- Artlist'da settings: Aspect (10 ta) · Quality (512px/1K/2K/4K) · Number of Images (1–5).

> ✅ **OpenRouter REALITY — TO'G'RILANGAN (rasmiy docs: image-generation, image_config):**
> OpenRouter rasm uchun **`image_config`** obyektini qo'llaydi (chat/completions body ichida).
> Aspect VA Quality **NATIVE ishlaydi** (supported_parameters'da ko'rinmaydi, lekin image_config alohida):
> - **Aspect Ratio:** `image_config.aspect_ratio` → 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 (Gemini'da +1:4,4:1,1:8,8:1). **To'liq ishlaydi**, Artlist'dagi 10 ta bilan bir xil. capabilities `aspects[]`.
> - **Quality:** `image_config.image_size` → **1K, 2K, 4K** (Gemini'da +0.5K). **To'liq ishlaydi.** capabilities `quality[]` (image_size qiymatlari: "1K"/"2K"/"4K").
> - **Number of Images:** OpenRouter'da `n` param YO'Q → N marta chaqirish, **narx = base × N**. capabilities `count[]`.
>
> So'rov: `{ ..., "modalities":["image","text"], "image_config":{"aspect_ratio":"16:9","image_size":"4K"} }`.
> Video sozlamalari (duration/resolution/aspect/audio) — `/videos` API'da to'liq ishlaydi.
> Recraft/Riverflow modellarида qo'shimcha image_config opsiyalari ham bor (style, rgb_colors, text_layout...).

### 1.2 VIDEO (Kling 3.0) ✅ — settings model'ga xos
- Input: **+ Start Frame** + **End Frame** (ikki rasm sloti — first/last frame)
- Placeholder: "Describe the video you want to create"
- Pastki: `[▷ Video ▾] | [⊘ Kling 3.0 ▾] | [⚙ Auto / Pro / 5 Seconds ▾] | [○ Unlimited] | Generate`
- Settings (tasdiqlangan):
  - **Aspect Ratio:** Auto, 16:9, 9:16, 1:1
  - **Audio:** toggle (ON/OFF — Kling native audio)
  - **Duration:** 3,4,5,6 — **View All:** 7,8,9,10,11,12,13,14,15 sek (jami **3–15s**)
  - **Resolution:** 720p, 1080p, **4K**

### 1.3 VIDEO (Seedance 2.0) ✅ — Kling'dan FARQLI (model-driven isboti)
- Input: **+** menyu (dropdown): **Start & End Frame · Image Reference · Video Reference · Audio File**
- Placeholder: "Use @ to mention your images, videos or audio (e.g., 'hat from @img1', 'motion from @vid1')"
- Pastki: `[▷ Video ▾] | [📊 Seedance 2.0 ▾] | [⚙ Auto / 720p / 5 Seconds ▾] | [○ Unlimited New] | Generate`
- Settings (tasdiqlangan — Kling'dan farqi):
  - **Resolution:** **480p**, 720p, 1080p (Kling'da 4K bor, 480p yo'q — Seedance'da teskari!)
  - **Aspect Ratio:** Auto, 16:9, 9:16, 1:1, **21:9** (+View All) — Kling'da 21:9 yo'q edi
  - **Duration:** 4,5,6,7 (+View All)
  - **Audio:** toggle

> 🔑 **ASOSIY ISBOT:** bir xil "Video" rejimida Kling va Seedance settings'lari TURLI
> (resolution variantlari, aspect, duration, input turlari). Demak composer model'ga qarab
> dinamik bo'lishi SHART — statik bo'lsa noto'g'ri.

### 1.4 VOICEOVER (Eleven v3) ✅
- Input: faqat **+**
- Placeholder: "Enter your text in English to create a voiceover"
- Pastki: `[🎙 Voiceover ▾] | [⏸ Eleven v3 ▾] | [🟠 Suburb ▾] | [⚙ English / American / No Effect ▾] | Generate`
- **Unlimited toggle YO'Q.** Maxsus: **Voice persona** (avatar + nom, masalan "Suburb") · **Language / Accent / Effect**.

### 1.5 MUSIC (Lyria 3 Pro) ✅
- Input: **+**
- Placeholder: "Describe the song you want to create. Add details like instruments or vocal style."
- Pastki: `[♪ Music ▾] | [G Lyria 3 Pro ▾] | [♫ Auto Lyrics ▾] | [⚙ Auto Duration / Auto Genre / Auto Mood ▾] | Generate`
- Settings (tasdiqlangan):
  - **Duration:** Auto, 1 min, 1:30 min (+View All)
  - **Artlist Sound:** toggle (sifat/uslub)
  - **Genre** › · **Mood** › · **Theme** › · **Tempo** › (submenu)
  - **Lyrics mode:** Auto Lyrics (alohida dropdown — Custom/Instrumental ham)

---

## 2. MODEL CAPABILITIES SCHEMA (gen-models.ts kengaytmasi)

Har model o'z kontrollarini e'lon qiladi. Composer shu obyektdan render qiladi:

```ts
type GenModel = {
  id: number; mode: "image"|"video"|"voice"|"music";
  key: string;            // OpenRouter model ID
  label: string; provider?: "openrouter"|"freepik";
  feature: "text-to-image"|"image-edit"|"text-to-video"|"image-to-video"|"text-to-speech"|"text-to-music";
  cost: number;           // base kredit (yoki /s video uchun)
  isDefault?: boolean;

  // ── MODEL-ASOSIY KONTROLLAR (composer shularni ko'rsatadi) ──
  inputs?: ("image-ref"|"start-end-frame"|"video-ref"|"audio-file"|"mention")[];
  aspects?: string[];                       // ["16:9","9:16","1:1"] yoki ["auto",...]
  resolutions?: { value:string; label:string }[];  // Kling:[{value:"pro",label:"Pro"}], Seedance:[{value:"720p",label:"720p"}]
  durations?: number[];                     // [5,10]
  quality?: string[];                       // image: ["1k","2k","4k"]
  count?: number[];                         // image: [1,2,3,4]

  // voice modeli uchun:
  voices?: { id:string; label:string; avatar?:string }[];
  languages?: string[]; accents?: string[]; effects?: string[];

  // music modeli uchun:
  lyricsModes?: ("auto"|"custom"|"instrumental")[];
  genres?: string[]; moods?: string[]; tempos?: string[];
};
```

Misollar:
```ts
// Kling 3.0
{ mode:"video", key:"kwaivgi/kling-v3.0-std", label:"Kling 3.0", feature:"image-to-video",
  inputs:["start-end-frame"], aspects:["auto","16:9","9:16","1:1"],
  resolutions:[{value:"std",label:"Std"},{value:"pro",label:"Pro"}], durations:[5,10] }

// Seedance 2.0
{ mode:"video", key:"bytedance/seedance-2.0", label:"Seedance 2.0", feature:"image-to-video",
  inputs:["start-end-frame","image-ref","video-ref","audio-file","mention"],
  aspects:["auto","16:9","9:16","1:1"], resolutions:[{value:"720p",label:"720p"},{value:"1080p",label:"1080p"}], durations:[5,10] }

// Voiceover (kokoro / eleven)
{ mode:"voice", key:"hexgrad/kokoro-82m", label:"Kokoro", feature:"text-to-speech",
  voices:[{id:"af_bella",label:"Bella"},{id:"am_onyx",label:"Onyx"}], languages:["English"], effects:["No Effect"] }
```

---

## 3. COMPOSER DINAMIK RENDER (plagin mantig'i)

```
Model tanlanganda (aiSetModelCat):
  1. inputs[] → "+" menyu/tugmalarini qur (Start/End Frame, Image Ref, @mention...).
  2. settings dropdown → faqat shu model qo'llaydiganini ko'rsat:
       video → aspects + resolutions + durations
       image → aspects + quality + count
       voice → voices + languages + effects
       music → lyricsModes + genres + moods
  3. settings labelini yangila ("Auto / Pro / 5 Seconds" yoki "16:9 / 2K / 1 Images").
  4. placeholder'ni rejimga moslab o'zgartir.
  5. aiGenParams() shu model kontrollaridan yig'iladi → cost-quote + generate (imzo hash mos).
```

⚠️ **MUHIM:** `aiGenParams` faqat **shu model qo'llaydigan** param'larni yuborsin. Aks holda imzo hash buziladi yoki API xato beradi. Model o'zgarsa → quote qayta imzolanadi (Bosqich 2'dagi naqsh).

---

## 4. CLAUDE CODE PROMPTI (model-asosli composer)

```
Composer'ni MODEL-ASOSLI dinamik qil (Artlist naqshi). Reja: docs/STUDIO-GEN-composer-v2.md.
ASOSIY: har model tanlanganda o'ziga xos input/settings kontrollari chiqsin (Kling→Start/End
Frame+Pro; Seedance→@mention+720p; Voice→persona+til; Music→lyrics+genre).

1. gen-models.ts: GenModel'ga capabilities metadata qo'sh (schema §2):
   inputs[], aspects[], resolutions[], durations[], quality[], count[], voices[], languages[],
   effects[], lyricsModes[], genres[], moods[]. Har mavjud modelni shu bilan to'ldir
   (Kling, Veo, Seedance, Wan, image modellari, kokoro voice).

2. Plugin (AssetFlow_Plugin.html #aiPage): composer dinamik render (§3):
   - aiSetModelCat → model.inputs/settings'dan "+" menyu + settings dropdown qur.
   - Settings label model qiymatidan ("Auto / Pro / 5 Seconds" / "16:9 / 2K / 1 Images").
   - placeholder rejimga qarab.
   - aiGenParams() faqat shu model param'larini yig'sin; model/param o'zgarsa quote qayta imzolansin.

3. Backend (gen-processor.ts / openrouter.ts): yangi param'larni (duration, resolution,
   start/end frame, references) /videos yoki /chat/completions'ga model qo'llasa yubor.

Tekshiruv: tsc EXIT 0; node --check; install-cep; AE'da har model tanlab kontrollar
o'zgarishini ko'r → Generate. SESSION-REPORT yangila. Commit qilma.
```

---

## 5. Eslatma
- "Standard / AI Agent" toggle, "Unlimited" toggle — AssetFlow'da kerak emas (bizda kredit modeli). Lekin dizayn (dark/glass) ko'chiriladi.
- "All Models" submenu — keyin (v2), katalog kengayganda.
- Voiceover/Music — OpenRouter (kokoro TTS) bor; to'liq music/persona Freepik bilan keyin.
- Bu hujjat eski faqat-rasm composer spetsifikatsiyasini almashtiradi — barcha rejim + model-asosli (eski versiya o'chirildi).

*Skrinshot tahlili: 2026-06-15.*
