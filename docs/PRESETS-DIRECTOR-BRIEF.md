# PRESETLAR VA APPLAR — DIREKTOR BRIEF (to'liq ishga tushirish hujjati)

*2026-07-14. Bu fayl yangi Claude Code sessiyasini boshlash uchun YAGONA kirish hujjati.*
*Chuqurroq ma'lumot: `docs/BYTEPLUS-ANALYSIS.md` (API audit), `docs/PRESET-IDEAS-RESEARCH.md` (bozor tadqiqoti, ~80 manba), `docs/PRESET-MASTER-LIST.md` (texnik ro'yxat), `docs/PRESET-QUALITY-PLAN.md` (sifat plani), `Element/` (BytePlus rasmiy hujjatlari).*

---

## 1. MAQSAD

AE plagin (va Studio web) ichidagi Gen AI studiyaga **preset-karta tizimi** qo'shish: foydalanuvchi prompt yozmaydi — natija nomini bosadi ("Explode", "Logo Reveal", "Earth Zoom Out"). Bozor formulasi (Higgsfield/Kling/Pika/Vidu isbotlagan): *rasm yukla → karta bos → natija.*

**Preset** = tayyor retsept: 1 tugma, 1 natija, ichida yashirin prompt. Qo'shish = JSON'ga yozuv.
**App** = mini-jarayon: 2+ qadam yoki 2+ AI chaqiruv yoki AE-tomonlama qo'shimcha ish (masalan avto-Keylight).

## 2. MAVJUD POYDEVOR (tayyor, TEGMA — faqat ustiga qur)

- **Provayderlar ulangan:** BytePlus Seedance 2.0 (`3102`, `dreamina-seedance-2-0-260128`) + Seedream 5.0 Pro (`1021`) · Vertex (Veo/Imagen/Nano Banana) · ElevenLabs SFX (`4001`) · Chirp TTS (`2002`) · fal Topaz upscale (`3201`).
- **Pul oqimi ishonchli:** imzolangan cost-quote → atomik kredit yechish → xatoda avto-refund → stuck-reconciler. Fayllar: `apps/api/src/lib/gen-quote.ts`, `plugin-profile.ts`, `gen-processor.ts`.
- **Katalog + boot-validatsiya naqshi:** `apps/api/src/lib/gen-models.ts` + `gen-models-validate.ts` (buzuq konfiguratsiyada server ko'tarilmaydi).
- **Plagin UI:** `plugins/after-effects-cep/AssetFlow_Plugin.html` — `AI_CATS` (~10623-qator) 3 jonli kategoriya (Image/Video/Audio). Preset to'ri shu panellar ichiga kiradi.
- **@mention tizimi:** `@img1` → "Image 1" rewrite `byteplus.ts`da tayyor.

## 3. ARXITEKTURA QARORI

**Preset = kod EMAS, validatsiyalangan MA'LUMOT.** Yangi fayl: `apps/api/src/lib/preset-catalog.ts` (yoki JSON):

```jsonc
{
  "id": "cam-earth-zoom-out",
  "category": "video-camera",          // video-camera | video-fx | video-app | image-style | image-app | audio | 3d
  "modelId": 3102,                      // gen-models.ts dagi mavjud model
  "uxTemplate": "card-1-image",         // pastdagi 4 shablondan biri
  "labels": { "uz": "Earth Zoom Out" },
  "promptTemplate": "...",              // {subject}, {userText} o'rinbosarlari bilan
  "constraintsBlock": true,             // standart cheklov blokini qo'shish
  "params": { "resolution": "720p", "duration": 5, "ratio": "adaptive" },
  "exampleAssetUrl": "",                // golden testdan keyin to'ldiriladi
  "enabled": false,                     // golden test o'tmaguncha false
  "promptVersion": 1,
  "phase": 1
}
```

**Qat'iy qoidalar:**
1. Promptni SERVER quradi (client faqat presetId + fayllar yuboradi) — spoofing yo'q.
2. Boot-validatsiya (gen-models-validate naqshi): modelId mavjudmi, uxTemplate ro'yxatdami, promptTemplate o'rinbosarlari shablon inputlariga mosmi. Xato = server ko'tarilmaydi.
3. `enabled` = per-preset kill-switch (deploy'siz o'chirish — DB override yoki config).
4. Narx mavjud signed-quote yo'lidan (preset params → computeGenCost) — pul kodiga TEGILMAYDI.

**4 UX shablon (dizayn faqat shularga qilinadi, 68 elementga emas):**
| Shablon | Inputlar | Kimlar ishlatadi |
|---|---|---|
| `card-1-image` | 1 rasm (yoki AE kadri) | 15 kamera + 9 VFX + Restyle, Product Scene... (~27) |
| `card-2-files` | 2 fayl | Morph, Hug, Trend Copy, Multi-Blend, Motion Copy (~8) |
| `card-text` | faqat matn | Styles, SFX, Voiceover, Loop fon, Icon Pack (~10) |
| `wizard` | 2-3 qadam | UGC Ad, Talking Avatar, Storyboard, Brand Set (4-5) |

**Har kartada majburiy 4 element:** namuna video/rasm (hover'da o'ynaydi) · o'zbekcha nom · input belgisi (1 rasm/2 fayl/matn) · narx-kredit + taxminiy vaqt. "3 soniya qoidasi": foydalanuvchi 3 soniyada tushunsin.

## 4. TO'LIQ RO'YXAT

Holat: 🟢 backend tayyor (faqat preset/UI) · 🟡 kichik kod · 🔴 yangi adapter. F = faza.

### 🖼 IMAGE — Seedream 5.0 Pro `1021` (batch uchun Lite `1020` ni yoqish)

| ID | Nomi | Nima qiladi | Shablon | Holat | F |
|---|---|---|---|---|---|
| img-style-* | Aesthetic Styles (10-15: Anime, Y2K, Cinematic, Clay, Neon, Editorial...) | prompt+karta → uslubli rasm | card-text | 🟢 | 1 |
| img-figure | Action Figure | selfi → qutidagi o'yinchoq figura | card-1-image | 🟢 | 1 |
| img-product-scene | Product Scene (10 sahna) | mahsulot → professional studiya foto | card-1-image | 🟢 | 1 |
| img-headshot | AI Headshot | 3-4 selfi → rasmiy portret | card-2-files | 🟢 | 2 |
| img-styleframes | Style Frames | brif → pitch kadrlari | card-text | 🟢 | 1 |
| img-cleaner | Text/Logo Cleaner | rasmdan yozuv/logo o'chirish | card-1-image | 🟢 | 1 |
| img-restyle | Restyle | rasm → boshqa uslub | card-1-image | 🟢 | 1 |
| img-storyboard | Storyboard Set (app) | ssenariy → 6-8 izchil kadr | wizard | 🟡 seq_gen param, Lite | 2 |
| img-iconpack | Icon Pack (app) | tavsif → izchil ikonka to'plami | card-text | 🟡 Lite batch | 2 |
| img-brandset | Brand Visual Set (app) | logo → poster/banner seriyasi | wizard | 🟡 Lite batch | 2 |
| img-blend | Multi-Blend / Try-On | 2-3 rasmni birlashtirish | card-2-files | 🟢 Pro array bor | 1 |

### 🎬 VIDEO — Seedance 2.0 `3102`

**Kamera presetlari (card-1-image, 🟢, F1):** Earth Zoom Out ⭐, Eyes In ⭐, Crash Zoom In/Out, Bullet Time, Dolly Zoom, Super Dolly In, 360 Orbit, Crane Over Head, FPV Drone, Whip Pan, Handheld, Hyperlapse, POV, Pull Back Reveal, Static Lock. *(Prompt lug'ati Element prompt-guide'dan; 1 shot = 1 harakat.)*

**VFX presetlari (card-1-image, 🟢, F1):** Squish, Inflate, Melt, Explode, Disintegrate, Levitate, Glass Breaking, Fire, Turn to Metal, Toon Transform + card-2-files: AI Hug, AI Aging. *(generate_audio:true + `< >` SFX sintaksis bilan ovozli.)*

**Applar:**
| ID | Nomi | Nima qiladi | Shablon | Holat | F |
|---|---|---|---|---|---|
| vid-trend-copy | Trend Copy ⭐ | trend video + o'z rasmi → trend o'z kontenti bilan | card-2-files | 🟢 + kuratsiya galereya | 1 |
| vid-edit | Video Edit | "X ni Y ga almashtir" (qayta suratsiz) | card-2-files | 🟢 | 1 |
| vid-extend | Extend/Stitch | klip davomi, 3 tagacha ulash | card-1-image(video) | 🟢 | 2 |
| vid-morph | Morph Transition | 2 kadr → silliq o'tish | card-2-files | 🟢 endFrame bor | 1 |
| vid-continue | Continue Clip | oxirgi kadrdan davom | card-1-image | 🟡 return_last_frame | 2 |
| vid-motioncopy | Motion Copy | harakatni boshqa sahnaga ko'chirish | card-2-files | 🟢 | 2 |
| vid-logoreveal | Logo Reveal ⭐ | logo + 8 uslub → 5s intro | card-1-image | 🟢 | 1 |
| vid-loopbg | Loop fon ⭐ | seamless aylanadigan fon (hiyla: Seedream kadr → first_frame=last_frame) | card-text | 🟢 | 1 |
| vid-greenscreen | Green-Screen Element | yashil fonda effekt + import'da avto-Keylight | card-text | 🟢 + plagin Keylight | 2 |
| vid-avatar | Talking Avatar | avatar + matn → gapiradigan video ({dialog} + ref_audio) | wizard | 🟢 | 2 |
| vid-ugc | UGC Ad Maker | mahsulot → "oddiy odam" reklamasi | wizard | 🟢 | 2 |
| vid-performance | Performance Transfer | o'z mimikasi → personaj takrorlaydi | card-2-files | 🟢 | 3 |
| vid-animatic | Storyboard→Animatic | kadrlarni jonlantirib qoralama video | wizard | 🟡 V5 bilan | 3 |
| vid-draft | Draft Preview | 2-3 kreditga arzon sinov | (barcha video preset ichida tugma) | 🟡 `seedance-1-0-pro-fast`/Mini yoqish | 2 |
| vid-spin360 | Product 360 | mahsulot atrofida aylanish | card-1-image | 🟢 | 1 |

### 🔊 AUDIO — ElevenLabs `4001` + Chirp `2002` (+BytePlus chat 🔴)

| ID | Nomi | Nima qiladi | Shablon | Holat | F |
|---|---|---|---|---|---|
| sfx-* | SFX kartalari (Whoosh, Impact, Riser, Glitch, UI, Ambient, Braam) | karta+tavsif → SFX | card-text | 🟢 | 1 |
| sfx-loop | Loop rejimi | cheksiz aylanadigan SFX | (toggle) | 🟡 1 param | 2 |
| voice-style-* | Voiceover uslublari (Trailer, Documentary, Ad, Tutorial) | matn+karta → diktor | card-text | 🟢 | 1 |
| aud-captions | Auto-Captions (app) ⭐ | video → .srt → AE text layer | card-1-image(video) | 🔴 BytePlus `seed-2-0-lite-260428` | 3 |
| aud-foley | Auto-Foley (app) | klip → mos SFX variantlari | card-1-image(video) | 🔴 fal MMAudio v2 | 3 |
| aud-music | Music Loop Gen (app) | janr/kayfiyat → trek | card-text | 🔴 Stable Audio (fal) | 3 |
| aud-isolator | Voice Isolator (app) | shovqindan toza ovoz | card-1-image(audio) | 🔴 ElevenLabs API (kalit BOR — oson) | 2 |
| aud-changer | Voice Changer (app) | yozuv boshqa ovozda | card-1-image(audio) | 🔴 ElevenLabs | 3 |

### 🧊 3D — BytePlus ModelArk (Hyper3D-Rodin-Gen2 ~$0.399, Hitem3d-2.0 $0.5-0.9) — hammasi 🔴 bitta `byteplus-3d` adapter, F3

| ID | Nomi | Nima qiladi |
|---|---|---|
| 3d-photo | Photo → 3D Model ⭐ | rasm → GLB → AE'ga avto-import (AE 2024+ GLB native!) |
| 3d-logo | Logo → 3D | tekis logo → hajmli model |
| 3d-spin | Product 3D Spin | mahsulot mesh → AE kamerada 360° |
| 3d-figurine | Figurine Maker | selfi → 3D geroycha (Hitem portrait) |
| 3d-depth | Depth Map | rasm → EXR/PNG chuqurlik → parallax/DOF ($0.20) |
| 3d-style | Uslub kartalari | Realistic/Clay/Cartoon/Gold/Bronze |

## 5. PROMPT YOZISH QOIDALARI (Element hujjatlaridan — MAJBURIY)

1. **Formula:** subyekt + harakat detali + muhit + yorug'lik/rang + kamera + uslub + sifat + cheklovlar.
2. **Standart cheklov bloki** (constraintsBlock:true bo'lganda avto-qo'shiladi):
   `HD, rich details, cinematic texture, natural colors, soft lighting. Keep it subtitle-free. Do not generate any text, logo, or watermark. Throughout the video, characters with completely identical appearance are prohibited — no duplicate avatars or twin effect.`
3. **Maxsus sintaksis:** musiqa `（ ）` · SFX `< >` · dialog `{ }` (boshqa til: "says in Japanese {...}") · subtitr `【 】`.
4. **Ko'p-shot:** `Shot 1: [kamera] + [harakat] + [audio]. Shot 2: ...` — aniq soniya YOZILMAYDI ("0-3s" beqaror). 1 shot = 1 kamera harakati.
5. **Edit rejimida** `[Video 1]` to'g'ridan ishlatiladi — "reference" so'zi TAQIQLANADI (aks holda referens-task deb tushunadi).
6. **Subyekt izchilligi:** `Define [2-3 belgi] in Image 1 as Subject 1`; keyin `Subject 1@Image 1`.
7. **Kamera lug'ati:** slow push-in, pull back, smooth lateral tracking, 360-degree orbiting shot, drone/aerial overhead, first-person POV, fixed camera position, handheld with slight shake, close-up/medium/wide shot.
8. **Xato-profilaktika:** yuz-referens uchun headshot + full-body alohida (kolaj EMAS), yuz rasmi birinchi; 4+ odam → avval Seedream'da guruh rasm; uslub saqlash uchun ref'ni avval Seedream'da uslubga o'tkazish.

## 6. SIFAT JARAYONI (golden test — har preset uchun)

1. Retsept yozish (5-bo'lim qoidalari bilan) → 2. **10 xil input bilan arzon rejimda (480p/4s) yugurtirish** (~$1-2/preset) → 3. Baholash: kutilgan natija? subtitle-leak? egizak? uslub buzilishi? → 4. **≥8/10 bo'lmasa chiqmaydi**, prompt qayta yoziladi (promptVersion++) → 5. Eng yaxshi natija = kartaning namuna videosi → 6. `enabled:true`.
Test CLI: `scripts/preset-test.mjs <presetId>` (yozilishi kerak, F1).

**Definition of Done (har preset):** JSON validatsiya o'tdi · golden ≥8/10 · namuna video kartada · o'zbekcha nom+input belgisi+narx ko'rinadi · xato xabarlari sodda tilda · telemetriya yozilyapti · kill-switch tekshirildi.

## 7. ISH REJASI (Claude Code bilan, jami ~4-6 hafta)

**F1 (~1-1.5 hafta) — birinchi reliz: 10-12 preset**
1. `expired` status fix (`byteplusPollStep` — hujjat enum: queued|running|succeeded|failed|**expired**) + `seed` saqlash + `return_last_frame` param — yarim kun
2. `preset-catalog.ts` + boot-validatsiya + server prompt-builder (rewriteMentionTokens bilan integratsiya) — 1-2 kun
3. Plagin UI: `card-1-image` shablon + preset to'ri (AI_CATS ichiga) — 1-2 kun
4. Birinchi to'lqin retseptlari: Earth Zoom Out, Eyes In, Crash Zoom, Explode, Melt, Squish, Levitate, Logo Reveal (3 uslub), Loop fon, Product 360, Video Edit — 1 kun
5. Golden testlar + namuna videolar — 2-3 kun
6. Beta flag bilan 5-10 foydalanuvchiga → telemetriya (per-preset muvaffaqiyat %, refund %, retry %)

**F2 (~1 hafta):** qolgan ~30 preset + card-2-files/card-text shablonlar · Draft Preview tugmasi (arzon model yoqish) · Seedream batch (Storyboard/Icon/Brand) · Voice Isolator · Studio web'ga o'sha katalogni ulash · Trend Copy galereyasi (faqat kuratsiya qilingan trendlar).

**F3 (~2-3 hafta):** BytePlus chat adapter (Auto-Captions + describe/enhance ko'chirish) · `byteplus-3d` adapter + AE GLB avto-import · Auto-Foley (fal MMAudio) · Music · wizard shablon (UGC Ad, Talking Avatar, Animatic).

**Rollout qoidasi:** ichki test → beta (flag) → hamma. 45 tasini birdan EMAS. Preset muvaffaqiyati minSuccessRate'dan tushsa — avto-signal + kill-switch.

## 8. XAVFLAR / DIQQAT

- **Moderation:** BytePlus real-yuz referensi rad etishi mumkin (`BYTEPLUS_INPUT_MODERATION_PREFIX` ishlangan) — xabar sodda tilda + refund ko'rsatilsin. Hug/Headshot presetlari xavf ostida — golden testda aniqlanadi; yiqilsa Kling Effects API muqobili (F3+ qaror, hozir EMAS — 2026-07-11 qarori: Seedance yagona video provayder).
- **4k:** H.265 10-bit, RPM 15/concurrency 1 — preset default 720p; 4k faqat advanced.
- **Natija URL muddati:** video 48h, rasm 24h — darhol persist (mavjud ✅).
- **Kling taqqoslash:** flagman narxi o'xshash (V3-Omni 5s 1080p ~$0.70 vs Seedance 2.0 ~$1.87, lekin Mini $0.38 / 1.5 Pro $0.13 / 1.0 Fast $0.10 bizda arzon) — arzon-draft strategiya bizni yutqazmaydi.
- **Studio manba qoidasi:** UI o'zgarishlar `packages/assetflow-studio/js|styles` MANBAga, artefaktlarga EMAS (`CLAUDE.md`).
- **Kod uslubi:** minimal diff, o'zbekcha UI, commit faqat so'ralganda, sessiya oxirida `docs/SESSION-REPORT.md`.

## 9. TELEFON RAQAMLARI (asosiy fayllar)

```
apps/api/src/lib/ai/byteplus.ts          ← adapter (expired fix, return_last_frame shu yerga)
apps/api/src/lib/gen-models.ts           ← model katalogi (1020/3101/arzon draft yoqish)
apps/api/src/lib/gen-models-validate.ts  ← boot-validatsiya (preset validatsiya shu naqshda)
apps/api/src/lib/gen-processor.ts        ← router (yangi adapter branch'lari)
apps/api/src/routes/studio-gen.ts        ← HTTP yuzasi (preset endpoint shu yerga)
plugins/after-effects-cep/AssetFlow_Plugin.html  ← plagin UI (AI_CATS ~10623)
docs/mockups/batch8-plugin/index.html    ← dizayn referens (concept-seedance pane)
Element/                                  ← BytePlus rasmiy hujjatlar (prompt guide!)
```

---
*Tayyorladi: Claude (Cowork), 2026-07-14. Asos: Element/ 42 rasmiy hujjat + kod audit + deep research (7 qidiruv agenti, ~80 manba). Yangi sessiyada: "docs/PRESETS-DIRECTOR-BRIEF.md ni o'qi va F1-1 dan boshla" deb yozing.*
