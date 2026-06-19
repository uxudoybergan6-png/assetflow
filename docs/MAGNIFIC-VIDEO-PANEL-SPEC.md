# Magnific Video Generator panel — to'liq spec (AssetFlow AI Tools uchun)

*Manba: https://www.magnific.com/app/ai-video-generator jonli tahlili.*
*Baseline: Cowork Claude (2026-06-19). To'liq qayta tahlil: Claude Code + Claude in Chrome (2026-06-19) — panel ipidan ignasigacha tekshirildi, har dropdown/modal/menyu/hover ochildi.*
*Maqsad: magnific video generator panelining UI/UX + funksiyalarini AssetFlow AI Tools'ga ko'chirish — FAQAT AssetFlow'da mavjud video modellari bilan (§8).*

> **Eslatma (Claude Code uchun):** modellarni o'ylab topma — faqat §8 dagi AssetFlow mavjud modellaridan foydalan. Magnific'ning model nomlari (Kling 3.0, Seedance 2.0, Happy Horse, Grok Imagine…) bu yerda FAQAT magnific anatomiyasini hujjatlash uchun; AssetFlow ularni ishlatmaydi.

---

## 1. Umumiy layout

Uch ustunli ish maydoni:

```
┌──────────┬─────────────────────┬──────────────────────────────────┐
│ Tool nav │  CONTROL COLUMN     │  CREATIONS (asosiy maydon)         │
│ (chap)   │  (panel)            │                                    │
│          │  • MODEL            │  [Creations | My templates | ...]  │
│ Image    │  • REFERENCES       │  filtrlar + view toggle            │
│ Video    │  • SHOTS            │  ┌── natija kartalari (grid/list) │
│ Voice    │  • [duration|ar|🔊] │  │   thumb + metadata teglari     │
│ Editor   │  • [ Generate ]     │  └──                               │
└──────────┴─────────────────────┴──────────────────────────────────┘
```

- Eng chap: tool nav (Create, Home, Search, Stock, Explore, Projects, Library, All tools, Spaces, Image/Video/Voice Generator, Assistant, Image Editor).
- Tepada loyiha selektori (`Dark Grunge Scratch Texture Backgrounds ▾`) + gen-tur tablar: **Image · Video · Audio · Spaces · ▸** (qo'shimcha: Design/3D/Flows).
- Control column tepasida sarlavha: **"Video Generator"** + ⓘ help + **Templates** tugmasi (yuqori-o'ng).
- Control column tartibi (yuqoridan pastga): **MODEL → REFERENCES → SHOTS → [davomiylik · aspect · 🔊] → Generate**.
- O'ngda **Creations** maydoni: tablar (Creations/My templates/Academy) + filtr-bar + natija kartalari.
- **AssetFlow'da:** control column allaqachon bor (composer). Bu spec uni magnific darajasiga ko'taradi. Creations = mavjud TARIX grid, kengaytiriladi (§7).

---

## 2. MODEL selektor

Ikki bosqichli: tezkor dropdown + to'liq modal.

### 2a. Tezkor dropdown (model nomi bosilganda)
Tartib (yuqoridan):
1. **⚙ Auto** — "AI picks what's best for you" + narx oralig'i chip `◇ 100 - 2800`.
2. **▦ Multiple** — "Combine your 4 favorite models" → submenu (`›`, 4 modelni birlashtirib parallel generatsiya).
3. **⚙ All models** — "Find the best model for you" → to'liq modal (`›`, 2b).
4. **FEATURED** ro'yxati (5 ta, har biri ikona + nom + narx oralig'i chip `◇`):
   - `📊 Seedance 2.0 Fast` ◇ 473 - 4571
   - `📊 Seedance 2.0` ◇ 559 - 13.1k
   - `◯ Kling 3.0` ◇ 210 - 6000
   - `◯ Kling 3.0 Omni` ◇ 210 - 6000
   - `◯ Kling 3.0 Turbo` ◇ 630 - 3900
   - *(narx ◇ = kredit oralig'i; ikona modelga xos: bar-chart=Seedance, loop=Kling)*

### 2b. To'liq "Models" modali ("All models")
Sarlavha: **Models**. Tepada filtr qatori + 🔍 Search. Pastida model qatorlari (uzun ro'yxat, scroll).

**Filtr qatori (har biri dropdown):**
| Filtr | Variantlar |
|-------|-----------|
| **All providers ▾** | All providers · Alibaba · ByteDance · Google · Grok · Kling · LTX · MiniMax · OpenAI · PixVerse · Runway · *(scroll)* |
| **Features ▾** | Lip sync · References · Multi shots · Start frame · Start & end frame · Audio · Motion control · Custom seed |
| **All resolutions ▾** | All resolutions · 4K · 2160p · 1440p · 1080p · 1024p · 768p · 720p · 580p · 540p · 512p |
| **Best for ▾** | Scene direction · Realistic videos · Native audio · Fast movements · Illustration & animation · Lip sync · Motion control |
| **Default ▾ (sort)** | Default · Trending · Alphabetical · Last used · Newest · Cheapest · Most expensive · Fastest |
| **🔍 Search** | model nomi bo'yicha qidiruv |

**Har model = bitta keng qator. Qator anatomiyasi (chapdan o'ngga):**
- **Thumbnail** (model namunasi videosi — kichik preview, chap chekka).
- **Ikona + Nom** + badge (`★ Featured` (sariq) yoki `New` (ko'k)).
- **Qobiliyat teglari** (chip, ikonali): `Realistic videos`, `Fast movements`, `Scene direction`, `Illustration & animation`, `Motion control`, `Lip sync`, `Custom seed`, `Multi shots` — ortig'i `+N` chip bilan yig'iladi.
- **Reference chip** (kadr ikonali): `Start / End` yoki faqat `Start`.
- **Rezolyutsiya chip**: `480p - 720p`, `720p - 4K`, `1080p` …
- **Audio chip** (model ovoz chiqarsa: `🔊 Audio`).
- **Davomiylik chip** (🕐): `5"`, `4 - 15"`, `3 - 15"` …
- *(yana `+N` overflow)*
- **Kredit narx oralig'i** (◇): `100 - 2800`, `559 - 13.1k`, `Unlimited` …

*Misol qatorlar (magnific):* Auto (Suggested · Multi shots · Start/End · 480p-1080p · Audio · 5" · ◇100-2800) · Seedance 2.0 Fast ★ (Realistic videos · Fast movements +1 · Start/End · 480p-720p · 4-15" +2 · ◇473-4571) · Kling 3.0 ★ (Realistic videos · Illustration & animation +1 · 720p-4K · Audio · 3-15" +3 · ◇210-6000) · Happy Horse ★ · Grok Imagine 1.5 (New) · Kling O1 · Kling 2.5 (◇Unlimited) · Kling 2.1 Master (◇1400-2800) …

### AssetFlow mapping
- Tezkor dropdown allaqachon bor (`/gen/models`). **Qo'shiladigan:** model qatoriga teglar + reference (Start/End) + rezolyutsiya + Audio + davomiylik + narx oralig'i chiplari (§8 metadata'dan).
- "All models" modali yangi (V3) — filtr qatori (provider/feature/resolution/best-for/sort/search) + boy qatorlar. AssetFlow modellari kam (≈7 video) → modal soddaroq, lekin **bir xil anatomiya + bir xil filtr to'plami** (faqat AssetFlow'da mavjud variantlar bilan).
- "Multiple" (4 model birlashtirish) — **SHART EMAS** (kelajak); skipla yoki disabled.

---

## 3. REFERENCES bo'limi

### 3a. Start image / End image
Ikki katta drop-zona katakcha: **Start image** (kadr-ikona) va **End image** (kadr-ikona) — boshlang'ich va yakuniy kadr. Bosilsa media picker (3c). Model `Start/End` qo'llamasa — faqat Start faol.

### 3b. Add media qatori
Start/End ostida dumaloq ikonalar qatori + "Add media" matni. Ikonalar (chapdan): **🖼 rasm · 🎥 video · 🔊 audio · 👤 character · 🎴 effect/style · +**. Bosilsa media picker (tegishli tab bilan).

### 3c. Media picker modali (video Start image konteksti)
- **Chap menyu:** `🕐 History` (default tanlangan) · `⬆ Uploads` · **— All references:** `🔍 Stock`.
  - *(Video generator pickerida FAQAT History/Uploads/Stock. Character / Elements bu kontekstda KO'RINMAYDI — ular rasm-gen yoki character-qo'llab-quvvatlovchi modellarda chiqishi mumkin.)*
- **Markaz:** **History grid** — o'tgan generatsiyalar, **oy bo'yicha guruhlangan** (`June 2026`, `May 2026`). Tepada: 🔍 Search + ⚙ filter + **loyiha selektori** (`Dark Grunge… ▾`) + ♡ favorite.
- **O'ng panel:** **"Drop an image or upload your own media"** + tugmalar: **[⬆ Upload an image]** · **[📷 Take photo]**.
  - *(Start-image pickerida faqat Upload + Take photo — rasm. "Record video/Record audio" boshqa media-turi kontekstlarida, audio/video reference uchun chiqadi.)*

### AssetFlow mapping (MUHIM — allaqachon qisman bor, G1–G4)
- **Timeline'dan** (`getActiveTimelineVideoReference`) — magnific'da YO'Q, AssetFlow'ning AE ustunligi. Saqlanadi va ta'kidlanadi.
- **Project'dan** (`getSelectedProjectReference`, G4) — AE Project panel.
- **History** (Studio Gen tarixi) → magnific "History" ekvivalenti. Reference sifatida qayta ishlatish qo'shiladi.
- **Upload** (fayl) → "Upload an image".
- **Start/End kadr:** AssetFlow `video-ref` modellari `first_frame` qo'llaydi (G3). **End frame** keyin (Kling `Start/End`). Hozircha Start (first_frame) yetarli.
- Character / Stock / Elements / Take photo / Record — **SHART EMAS** (AE kontekstida ortiqcha). Skipla.

**Natija:** AssetFlow "Rasm reference" menyusini magnific uslubidagi ko'rinishga keltir: **Start image / End image** kataklari + **"Add media"** manbalar (Timeline / Project / History / Upload).

---

## 4. SHOTS (prompt) bo'limi — multi-shot

Magnific'ning eng kuchli farqi: **bitta prompt emas, ko'p kadrli (shot) storyboard.**

- Sarlavha qatori: **SHOTS  [1] [2] ×  +**  ……  **Manual ▾** (o'ng chekka).
  - Raqamlar = shot tablari (bosilsa o'sha shotga o'tadi); `+` yangi shot qo'shadi; `×` joriy shotni o'chiradi.
  - **Manual ▾** = rejim selektori (**Manual** / **Auto** — Auto storyboard'ni avtomatik bo'ladi).
- Har shot uchun:
  - **Prompt textarea** — placeholder (shot 2 misoli): *"Describe your shot 2—who's in it, what they're doing, camera movement, etc."*
  - **@mention referencing** — promptda `@image 1` yozib yuklangan media'ga ishora (1-shot placeholder: *"Reference your video or images using @image 1"*).
  - **Per-shot davomiylik** (pastki-chap, 🕐 dropdown): **Auto / 1" / 2" / 3" / 4" / 5" / 6" / 7" / 8" / 9" / 10"** — har shot o'z uzunligi.
  - **Prompt enhance** (🪄, pastki-o'ng) + **clear** (×, pastki-o'ng).

### AssetFlow mapping
- **1-bosqich (V1, minimal):** bitta shot (mavjud composer), magnific UX'i bilan — enhance (mavjud "Yaxshilash"), magnific placeholder. @mention/multi-shot — keyin.
- **2-bosqich (V4, multi-shot):** SHOTS 1/2/+ — har shot alohida prompt + davomiylik + Manual/Auto. Generatsiya har shotni ketma-ket video qilib, AE'da ketma-ket import (storyboard). **Eng katta — alohida bosqich.**

---

## 5. Sozlamalar qatori (prompt ostida)

Uch kichik kontrol (chip ko'rinishida):
- **Davomiylik** (🕐 `5-6"`): dropdown — **2-4" Quick · 5-6" Short · 8-10" Long · 10+" Extended**.
- **Aspect ratio** (▭ `16:9`): **1:1 Square · 21:9 Ultrawide · 16:9 Widescreen · 4:3 Classic · 3:4 Traditional · 9:16 Social story** (har biri shape-ikona bilan).
- **Sound** (🔊 `ON`): ON/OFF toggle (audio chiqarish).

### AssetFlow mapping
- Davomiylik + aspect AssetFlow'da bor (sozlamalar). Magnific **yorliqlarini** (Quick/Short/Long/Extended) qo'sh — model `durations` metadata'sini shu guruhlarga map qil.
- **Sound ON/OFF** — Veo audio chiqaradi (`model.audio`); toggle qo'shiladi, model qo'llamasa yashir.
- Aspect variantlari model `aspects` ga klamplanadi (model qo'llamaydigani ko'rsatilmaydi).

---

## 6. Generate tugmasi

- Katta to'liq-kenglik tugma: **Generate** + sparkle ikona (✦). AssetFlow'da `Generatsiya · N kredit` — mavjud.
- Holatlar: normal · kredit yetmaganda (disabled/ogohlantirish) · model talab qilganda (masalan reference shart bo'lsa). Bosilgach: job + polling (mavjud oqim).

---

## 7. CREATIONS galereyasi (asosiy maydon)

- Tepada tablar: **Creations · My templates · Academy**.
- **Filtr-bar (yuqori-o'ng), chapdan o'ngga:**
  - Tur filtri: **All** · `🖼 Image` · `🎥 Video` · `🎚 Audio` · `🎬 (film/edits)` · `📦 3D`.
  - `♡` Favorites.
  - **Ko'rinish toggle:** `≡ List` · `▦ Grid ▾`.
    - Grid `▾` → **LAYOUT OPTIONS** popover: **Ratio** (Original / Square) · **Size** (S / M / L / XL).
  - `⚙` Filters (sliders).
  - `🔍` Search.
- **Har natija kartasi (list ko'rinishi):**
  - **Prompt sarlavhasi** (qisqartirilgan, masalan "STYLE: Cinematic, high-quality render…").
  - **Thumbnail** (chapda): video → ▶ + davomiylik `0:06`; rasm → static; ko'p natija → grid mozaika. Pastki-chapda **provayder badge** (`G`=Google) + **rezolyutsiya** (`1K`/`2K`).
  - **Metadata teglari** (o'ngda): aspect (`16:9`) · model nomi (`google nano banana 2`, `google veo 3.1 lite`) · sifat/rejim (`thinking high`) · `+N` · **☐ select checkbox** · **vaqt** (`40 minutes ago`, `yesterday`, `2 days ago`).
  - **Hover amallari:**
    - **Yuqori:** `⚪ select` · `⋯ more` · `🗑 delete` · `⬇ download` · `♡ favorite`.
      - `⋯ more` menyu: **Copy prompt · Move asset › · Save as template**.
    - **Pastki:** `✏ edit` · **`Use ▾`** dropdown: **Use as reference · Upscale · Extend · Recreate · Speak · Add to a project**.
    - Video karta hover'da avtomatik IJRO etiladi (scrubber + vaqt sanagichi bilan).

### AssetFlow mapping
- Mavjud **TARIX** grid (G5/F) → magnific Creations darajasiga:
  - **prompt sarlavhasi** + **metadata teglari** (model/aspect/davomiylik/sifat/vaqt) + **status** (Navbatda/Ishlanmoqda/Xato — G5'da bor).
  - **list/grid toggle** + grid layout (Ratio/Size).
  - **tur filtri** (All/Image/Video/Audio) — AssetFlow media turiga map.
  - **hover amallari:** AE'ga import (magnific "Use as reference"/"Add to a project" o'rniga AssetFlow import) · Yana (Recreate) · Tahrirlash (edit) · O'chirish (delete) · Reference qil (Use as reference → composer'ga) · Yuklab olish (download). *(Upscale/Extend/Speak — AssetFlow'da hozircha yo'q, kelajak.)*
- Sessiya-scoped tarix (F) saqlanadi.

---

## 8. AssetFlow MAVJUD video modellari (FAQAT shulardan foydalan)

`apps/api/src/lib/gen-models.ts` (hammasi `referenceMode: "video-ref"`, `first_frame` reference qo'llaydi — G3):

| ID | Nom | feature | Izoh |
|----|-----|---------|------|
| 3001 | Veo 3.1 Lite | text-to-video | arzon, audio |
| 3002 | Veo 3.1 Fast | text-to-video | tez |
| 3003 | Veo 3.1 | text-to-video | yuqori sifat, audio |
| 3004 | Kling v3.0 | image-to-video | i2v |
| 3005 | Kling v3.0 Pro | image-to-video | i2v pro |
| 3006 | Seedance 2.0 | image-to-video | i2v |
| 3007 | Wan 2.6 | image-to-video | i2v |

- Model qatorlarida ko'rsatiladigan teglar shu metadata'dan kelib chiqsin (text-to-video → "Realistic videos"; image-to-video → "Start" reference; `model.audio` bo'lsa "Audio" badge; `model.resolutions`/`durations`/`cost` → rezolyutsiya/davomiylik/narx chiplari). Yangi qobiliyat o'ylab topma — `/endpoints` bilan tasdiqlangan haqiqiy imkoniyat (G1–G3).
- Rasm modellari (keyingi rasm-panel spec): Nano Banana 2/Pro, Seedream 4.5, Flux 2.0 Pro, Grok Imagine, Gemini Edit.

---

## 9. Bosqichma-bosqich implementatsiya rejasi (ustuvorlik)

1. **V1 — Panel skeleti (magnific layout):** MODEL (boy dropdown + teg/reference/rezolyutsiya/davomiylik/narx) → REFERENCES (Start/End + manba menyu: Timeline/Project/History/Upload) → SHOT (1 ta, enhance, magnific placeholder) → sozlamalar (davomiylik yorliqlari Quick/Short/Long/Extended + aspect 6 ta + Sound ON/OFF) → Generate. Mavjud generatsiya/poll/reference/import oqimiga ulanadi (BUZILMAYDI).
2. **V2 — Creations galereya:** TARIX → metadata teglari + tur filtri + list/grid toggle (Ratio/Size) + status + hover amallar.
3. **V3 — All models modali:** filtr qatori (provider/feature/resolution/best-for/sort/search) + boy model qatorlari (anatomiya §2b) — AssetFlow modellari bilan.
4. **V4 — Multi-shot (SHOTS 1/2/+ + Manual/Auto):** har shot prompt+davomiylik, ketma-ket generatsiya + AE import. (Eng katta.)
5. **V5 — End frame · @mention · Multiple model · Use▾ kengaytmalari (Upscale/Extend/Speak)** — ixtiyoriy.

> AE kontekstiga xos ustunlik: **Timeline / Project reference** (magnific'da yo'q) — saqlanadi va ta'kidlanadi.
> magnific'ga xos, AE'da ortiqcha: Character / Stock / Elements / Take photo / Record / Multiple-model / Upscale / Extend / Speak — skip yoki kelajak.

---

*Yangilangan: 2026-06-19 — video panel, Claude in Chrome bilan to'liq qayta tahlil (filtr variantlari, ⋯/Use▾ menyulari, Manual rejim, per-shot davomiylik, layout options, karta metadata/hover amallari qo'shildi). Rasm panel spec keyin.*
