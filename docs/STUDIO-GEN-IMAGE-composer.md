# Artlist image composer — jonli tahlil + plagin redizayn spetsifikatsiyasi

*Manba: toolkit.artlist.io/new?mode=image — Claude in Chrome jonli DOM + skrinshot tahlili (2026-06-15).*
*Maqsad: plagin AI Tools rasm composer'ini ("hozirgisi rasvo") Artlist darajasiga ko'tarish.*

---

## 1. Artlist image composer — ANIQ tuzilishi (jonli kuzatilgan)

Markazda suzuvchi **composer karta** (dark, glass), va chap tomonda tarix.

```
┌─ HEADER ────────────────────────────────────────────────────────────┐
│ Artlist logo        [+]  [Credits balans]  [Get More Credits]  [☰]   │
└──────────────────────────────────────────────────────────────────────┘

CHAP RAIL (vertikal):          MARKAZ (natija maydoni):
 [✎ New session]                "Type an idea to get started"
 [🧭 Explore]                    (gen'dan keyin → natija grid)
 [📁 My Library · New]
 [thumb] ← tarix                
 [thumb]   (o'tgan
 [thumb]    generatsiyalar)     
 ...                            

┌─ COMPOSER KARTA ────────────────────────────────────────────────────┐
│ [▦ Standard] [💬 AI Agent]                              [⌄ collapse]  │  ← rejim toggle
│ [+]  [🖼 Image Reference ✕]                                           │  ← input options
│ Describe the image you want to create…                        [✦T]   │  ← prompt + Enhance
│ [🖼 Image ⌄] | [G Nano Banana 2 ⌄] | [≡ 16:9/2K/1 images ⌄] |        │
│                                    [○ Unlimited (New)]   [ Generate ] │
└──────────────────────────────────────────────────────────────────────┘
```

### Elementlar (chapdan o'ngga, pastki panel)
| Element | Tafsilot |
|---|---|
| **Standard / AI Agent toggle** | Grid ikonka = oddiy gen; chat ikonka = suhbatli agent rejimi |
| **+ (Image input options)** | Reference rasm yuklash (drag/drop yoki fayl — 2 ta file input) |
| **Image Reference chip** | Yuklangan reference + "✕" bekor qilish |
| **Prompt textarea** | "Describe the image…" placeholder; **resize handle'lar** (burchak/chet); |
| **Enhance prompt (✦T)** | Promptni AI bilan boyitadi (Auto-prompt) |
| **Generation mode ⌄** | Image / Video / Voiceover / Music (URL `?mode=image`) |
| **Model selector ⌄** | Provayder ikonka + nom. Ro'yxat: Nano Banana 2 ✓, Nano Banana Pro, Seedream 5.0, **All Models ›** (to'liq katalog submenu) |
| **Generation settings ⌄** | Panel: **Aspect Ratio** (1:1, 2:3, 3:2, 3:4, 16:9 + View All), **Quality** (512px, 1k, 2k, 4k), **Number of Images** (1–5) |
| **Cost** | Model+sozlamaga qarab kredit (Nano Banana 2 @16:9/2K/1 = **363 kredit**) |
| **Unlimited toggle** | Reja imkoniyati (cheksiz gen rejimi) + "New" badge |
| **Generate** | Asosiy tugma (o'ngda) |

### Header / tarix
- Kredit balans: `2,510/7,500`, oyiga yangilanadi.
- Chap rail: **generatsiya tarixi** = thumbnaillar ustuni (har biri prompt nomi bilan: "person walking alone"...).
- Bo'sh holat: "Type an idea to get started" → gen'dan keyin natija grid.

---

## 2. Plagin HOZIRGI holati vs Artlist (farq)

Plagin (`AssetFlow_Plugin.html` #aiPage) backend'i KO'P narsaga tayyor, lekin UI sodda/chala:

| Artlist elementi | Plaginда bormi? | Holat |
|---|---|---|
| Prompt textarea | ✅ bor | OK |
| Enhance prompt | 🟡 backend bor (`/gen/prompt/enhance`), UI tugma YO'Q | qo'shish |
| Model selector (katalogdan) | ✅ bor (`aiLoadModels`, `aiSetModelCat`) | ishlaydi, lekin provayder ikonka/submenu yo'q |
| Cost-before-generate | ✅ bor (`aiCostQuote` → "Generatsiya · N kredit") | OK |
| **Aspect Ratio tanlovi** | ❌ YO'Q (`aiGenParams('rasm')` → `{}`) | **qo'shish** |
| **Quality (1k/2k/4k)** | ❌ YO'Q | **qo'shish** |
| **Number of Images (1–5)** | ❌ YO'Q | **qo'shish** |
| **Reference rasm yuklash** | 🟡 Timeline ref bor, fayldan yuklash YO'Q | qo'shish |
| Generatsiya tarixi (grid) | 🟡 `StudioGenHistory` bor | to'liq ulansin |
| Generate + holat | ✅ bor (job/poll) | OK |
| Standard/AI Agent toggle | ❌ YO'Q | ixtiyoriy (v2) |

**Asosiy kamchilik:** sozlamalar (aspect/quality/count) yo'q — shuning uchun composer "rasvo" ko'rinadi. Bular Artlist composer'ining yuragi.

---

## 3. QURILISH SPETSIFIKATSIYASI (plagin rasm composer)

### 3.1 Frontend (plugin HTML)
1. **Generation settings panel** — Artlist'dagidek pastki panelда ochiladigan:
   - **Aspect Ratio:** 1:1, 2:3, 3:2, 3:4, 16:9, 9:16 (radio chip'lar).
   - **Quality:** 1k, 2k, 4k (radio).
   - **Number of Images:** 1, 2, 3, 4 (radio).
   - Tanlov pastki panelda qisqa ko'rsatiladi: "16:9 · 2K · 1 rasm".
2. **`aiGenParams('rasm')`** → `{aspectRatio, quality, count}` qaytarsin.
   ⚠️ Bu qiymatlar **cost-quote VA generate'da bir xil** bo'lsin (imzo hash mos kelishi shart — `gen-quote.ts`).
3. **Reference rasm (fayldan):** "+" tugma → fayl tanlash → `params.referenceUrl` (R2'ga upload yoki data-URL). Timeline ref allaqachon bor — birlashtir.
4. **Enhance prompt tugmasi (✦T):** `/api/studio/gen/prompt/enhance` chaqirib textarea'ni yangilasin.
5. **Natija grid:** `count>1` bo'lsa bir nechta rasm (Artlist'dagidek grid). Har biriga "AE'ga import" + sevimli.
6. **Tarix:** `StudioGenHistory` ni chap/past panelда grid qilib ko'rsat (Download/import/qayta).
7. **Dizayn:** mavjud `tokens.css` + tema tizimidan foydalan — Artlist'ning dark/glass kartasiga o'xshat (lekin AssetFlow brendi).

### 3.2 Backend
1. **`gen-models.ts`** — rasm modellari `count`/`quality`/`aspectRatio` ni qabul qilsin; **narx param-asosli** bo'lsin (masalan `cost = base × count`, 2K/4K qimmatroq). Hozir narx statik (`model.cost`).
2. **`studio-gen.ts /gen/cost-quote`** — narxni param'dan hisoblasin (hozir `price = model.cost`). Comment ham shuni aytadi ("kelajakda param-asosli").
3. **`openrouter.ts orImage`** — OpenRouter image API `aspect_ratio`/`n` (count) param'larini qo'llab-quvvatlasa, yubor; aks holda bir nechta marta chaqir (count).
   ⚠️ Tasdiqla: OpenRouter image gen'da `n`/aspect param bormi (model'ga bog'liq — Nano Banana/Gemini aspect qo'llaydi).
4. **`gen-processor.ts`** — `count>1` natijalarini bir nechta `GenAsset` qilib saqlasin.

---

## 4. CLAUDE CODE PROMPTI (rasm composer redizayn)

```
Davom etamiz — Rasm composer'ini Artlist darajasiga ko'tarish.
Reja: docs/STUDIO-GEN-IMAGE-composer.md (§3). Manba tahlil: shu fayl §1.

Kontekst: rasm gen ishlaydi, lekin composer sodda. Artlist'da generation settings bor:
Aspect Ratio + Quality + Number of Images. Plaginda bular yo'q — shu sabab "rasvo".

VAZIFA (frontend, plugins/after-effects-cep/AssetFlow_Plugin.html #aiPage):
1. Rasm rejimi uchun "Generation settings" panel qo'sh (pastki panelda ochiladigan):
   Aspect Ratio (1:1,2:3,3:2,3:4,16:9,9:16), Quality (1k,2k,4k), Number of Images (1-4).
   Tanlovni qisqa ko'rsat: "16:9 · 2K · 1 rasm".
2. aiGenParams('rasm') → {aspectRatio,quality,count} qaytarsin. MUHIM: bu qiymatlar
   cost-quote VA generate'da BIR XIL bo'lsin (imzo hash — gen-quote.ts).
3. Enhance prompt tugmasi (✦) qo'sh → /api/studio/gen/prompt/enhance → textarea yangilansin.
4. count>1 bo'lsa natijani grid qilib ko'rsat; har rasmga "AE'ga import".
5. Dizayn: mavjud tokens.css + tema; Artlist'ning dark/glass kartasiga o'xshat (AssetFlow brendi).

VAZIFA (backend):
6. gen-models.ts: rasm narxini param-asosli qil (cost = base×count, 2K/4K qimmatroq).
7. studio-gen.ts /gen/cost-quote: narxni param'dan hisobla (hozir model.cost statik).
8. openrouter.ts orImage: aspect_ratio/count param'larini qo'lla (OpenRouter image API
   nimani qabul qilishini tasdiqla; n yo'q bo'lsa count marta chaqir).
9. gen-processor.ts: count natijalarini bir nechta GenAsset qil.

Tekshiruv: tsc -p apps/api EXIT 0; node --check plugin HTML inline JS; install-cep;
AE'da Rasm → aspect/quality/count tanla → narx yangilanishini ko'r → Generate → grid natija.
SESSION-REPORT yangila. COMMIT QILMA — natijani ko'rsat, to'xta.
```

---

## 5. Eslatmalar
- Artlist API/oqim (tRPC, getCostQuote, imzolangan narx, job) — `STUDIO-GEN-BLUEPRINT.md` da batafsil. Bu fayl faqat **image composer UI** ga fokus.
- "All Models" submenu (to'liq katalog) — keyin (v2). Hozir 2-3 model yetarli.
- "AI Agent" (suhbatli) rejimi — keyin (v2). Avval Standard composer mukammal bo'lsin.
- Unlimited toggle — AssetFlow'da kerak emas (bizda kredit modeli).

*Jonli tahlil: Claude in Chrome, 2026-06-15. Faqat ochiq frontend kuzatildi.*
