# BytePlus ModelArk — Element/ hujjatlari to'liq tahlili (2026-07-14)

**Manba:** `Element/` papkasidagi 42 hujjat + `modelark_seedance2.0_quickstart_package.zip` + joriy kod auditi (`apps/api/src/lib/ai/byteplus.ts`, `gen-models.ts`, `gen-processor.ts`).

---

## 1-QISM. Joriy integratsiya auditi — TO'G'RI ULANGANMI?

**Xulosa: HA, ~95% to'g'ri.** `byteplus.ts` adapter hujjatlarga aniq mos:

| Tekshiruv | Holat |
|---|---|
| Auth `Authorization: Bearer` + `ark.ap-southeast.bytepluses.com/api/v3` | ✅ To'g'ri |
| Video async: `POST /contents/generations/tasks` → poll `GET .../tasks/{id}` | ✅ To'g'ri |
| `content[]` rollari: `first_frame`/`last_frame`/`reference_image`/`reference_video`/`reference_audio` | ✅ To'g'ri (quickstart demo bilan bir xil) |
| Yangi/strict param usuli (top-level `resolution`, `ratio`, `duration`, `generate_audio`, `watermark`) — legacy `--rs` flaglar EMAS | ✅ To'g'ri (tavsiya etilgan usul) |
| `auto` → `adaptive` ratio mapping, duration 4–15 clamp | ✅ To'g'ri |
| `mediaRefs: {image:9, video:3, audio:3}` — hujjatdagi limit ham aynan 0–9/0–3/0–3 | ✅ Aniq mos |
| `@img1` → `Image 1` mention rewrite + first/last_frame offset hisobi | ✅ To'g'ri (hujjatdagi "o'sha tur asseti orasida 1-based" qoidasi) |
| `videoInputPerSecMultiplier: 0.6` — hujjat: video-input narxi 4.3/7.0 ≈ 0.61 | ✅ Mos |
| 4k semafor (concurrency 1), individual limit 3 | ✅ Hujjatdagi limitga mos (4k RPM 15 / conc 1) |
| 24 soatlik natija URL → darhol GCS'ga persist | ✅ To'g'ri |
| Seedream: sync `POST /images/generations`, `image` string\|array, piksel jadvali | ✅ Jadval hujjatdagi bilan bir xil |

### Topilgan kamchiliklar (kichik, lekin tuzatish kerak)

1. **`expired` status ishlanmagan** — `byteplusPollStep` faqat `succeeded|failed|cancelled` ni biladi. Hujjat enum'i: `queued | running | succeeded | failed | expired`. Task muddati o'tsa (`execution_expires_after` 48h) poll abadiy `pending` qaytaradi → faqat reconciler 20 daq+ kutib hal qiladi. **Tuzatish:** `status === "expired"` → failed sifatida map qilish.
2. **`return_last_frame` ishlatilmayapti** — bepul imkoniyat: har video bilan oxirgi kadr URL keladi. Bu "davomini yaratish" (clip chaining) tool'ining kaliti (pastda #T4).
3. **`seed` yuborilmayapti** — reproducibility yo'q. Javobda `seed` qaytadi — uni `GenAsset` metadata'ga saqlab, "Regenerate (same seed)" tugmasi qilish mumkin.
4. **`callback_url` (webhook) o'rniga polling** — ishlaydi, lekin webhook qo'shilsa poll yuki va latency kamayadi (fal'da webhook tajribasi bor edi).
5. **Seedream `sequential_image_generation` ishlatilmayapti** — ataylab (v1), lekin bu "Storyboard to'plami" tool'ini beradi (#T8). Eslatma: **5.0 Pro (1021) batch'ni QO'LLAMAYDI** — faqat Lite/4.5/4.0.
6. **`duration: -1` (intelligent auto)** — hujjatda bor, bizda Auto→4s. Hozirgi yechim billing uchun xavfsizroq (narx oldindan ma'lum) — o'zgartirish SHART EMAS, faqat bilib qo'yish.

### Model tanlovi to'g'riligi

- `dreamina-seedance-2-0-260128` (3102) — to'g'ri ID, barcha rejimlar (t2v/i2v/first+last/ref/edit/extend) bitta modelda ✅
- `dola-seedream-5-0-pro-260628` (1021), `seedream-5-0-260128` (1020) — to'g'ri ID'lar ✅
- Diqqat: `camera_fixed`, `frames`, `draft`, `service_tier:"flex"` — **Seedance 2.0 da ISHLAMAYDI** (faqat 1.5/1.0). Bizda yuborilmayapti ✅

---

## 2-QISM. Ishlatilmayotgan BytePlus imkoniyatlari (katta zaxira)

Hozir faqat **generatsiya** (Seedance video + Seedream rasm) ulangan. Hujjatlarning ~70% boshqa imkoniyatlar haqida — ular umuman ishlatilmayapti:

### 2.1 Multimodal understanding (Seed LLM'lari) — eng katta imkoniyat
- `seed-2-0-mini-260215` — $0.10/M in, $0.40/M out. Rasm+video+hujjat tushunadi, structured output, visual grounding.
- `seed-2-0-lite-260428` / `seed-2-0-mini-260428` — **audio ham tushunadi** (transkripsiya, timbre, emotsiya).
- `seed-1-6-flash-250715` — eng arzon: $0.075/M in, $0.30/M out.
- Bu `/gen/describe` va `/gen/prompt/enhance` ni BytePlus'ga ko'chirish + yangi tool'lar (auto-tag, caption, QC) degani — bitta provayder, bitta hisob.

### 2.2 Skylark multimodal embedding — bge-m3 o'rnini bosuvchi UPGRADE
- `skylark-embedding-vision-251215` — matn+rasm+video BIR vektor fazoda (dim sozlanadi, `dimensions:1024`).
- Hozirgi bge-m3 faqat matn. Skylark bilan: **matn→thumbnail qidiruv, rasm→rasm qidiruv** ("shu kadrga o'xshash shablon top"). Sparse vektor ham bor (hybrid ranking saqlanadi).
- Narx: image-in $0.325/M tok, text-in $0.125/M tok, 500K bepul kvota. Migratsiya = butun korpusni qayta embed + index rebuild.

### 2.3 Arzonlashtirish mexanizmlari
- **Context caching (implicit)** — bepul, avtomatik, ≥1024 token prefix; cache-hit input ~5x arzon. System prompt'larni boshiga qo'yish kifoya.
- **Batch inference** — ≥50% chegirma (auto-tagging, bulk indexing kabi non-interactive ishlar uchun).
- **Files API** — 20 GB bepul; bitta preview videoni bir marta yuklab `file_id` bilan qayta-qayta ishlatish (har safar qayta yuklamaslik).
- **Seedance 1.0 Pro Fast** (`seedance-1-0-pro-fast-251015`) — $0.10/video (5s 720p)! 2.0 Mini ($0.38) dan ham 4x arzon → "Draft/Preview" tarif uchun ideal.
- **Seedance 1.5 Pro draft mode** — 0.6–0.7x token; `flex` offline tier — 50% chegirma (faqat 1.5/1.0).

### 2.4 Boshqa
- **3D generatsiya**: `Hyper3d-Rodin-Gen2` ($0.399/call, 150K bepul), `Hitem3d-2.0` ($0.8–1.8, 500K bepul) — AE'da 3D layer/Element 3D uchun yangi kategoriya.
- **Structured output + function calling** — auto-tag/QC natijalarini kafolatlangan JSON'da olish.
- **Region**: hammasi `ap-southeast-1` da ✅ (EU'da faqat 3 model, batch yo'q — ko'chmaslik kerak).
- **Diqqat**: balans ≤0 holatda 2 soatdan keyin servis to'xtaydi; ModelArk'da alohida TTS/ASR modeli YO'Q (audio faqat understanding) — Chirp/ElevenLabs qoladi.

---

## 3-QISM. PLAGIN UCHUN YANGI TOOL'LAR (hujjatlar imkon beradi)

Barchasi mavjud arxitektura (signed quote → credit → process → refund) ustiga tushadi. Model'lar allaqachon ulangan yoki §2 modellarini talab qiladi.

### A. Seedance 2.0 (3102) ustiga — YANGI KOD MINIMAL, faqat UI/preset

| # | Tool | Qanday ishlaydi | Nima kerak |
|---|---|---|---|
| T1 | **Video Edit** (obyekt almashtirish/qo'shish/o'chirish) | `reference_video` + prompt `[Video 1]` to'g'ridan (quickstart demo aynan shu!) | UI pane + prompt scaffold |
| T2 | **Video Extend / Stitch** (3 klipgacha ulash) | 3x `reference_video` + transition prompt | UI pane |
| T3 | **First↔Last Morph / Transition** | `first_frame`+`last_frame` (endFrame:true allaqachon bor!) | Faqat UI preset |
| T4 | **Continue Clip (davomini yaratish)** | `return_last_frame:true` → last_frame → keyingi task first_frame | Adapter'ga 1 param + UI |
| T5 | **Motion/Camera Copy** | `reference_video` + "Reference the camera movement in Video 1" | Prompt preset |
| T6 | **Lip-sync / Dubbing** | `generate_audio:true` + `reference_audio` (timbre) + `{dialog}` sintaksis | Prompt scaffold |
| T7 | **360° Product Spin / Turnaround** | i2v + "rotate 360°, orbit" preset | Prompt preset |

### B. Seedream ustiga

| # | Tool | Model | Nima kerak |
|---|---|---|---|
| T8 | **Storyboard Set** (4–8 uslub-izchil kadr) | 1020 Lite: `sequential_image_generation:"auto"` + `max_images` (refs+outputs ≤ 15) | Adapter'ga 2 param |
| T9 | **Multi-Image Blend / Try-On** | 1021 Pro (≤10 ref) — `image:[...]` allaqachon qo'llanadi | UI (ko'p-ref tanlov) |
| T10 | **Text/Logo Cleaner** | i2i "remove all text/logos" — video ref'dan oldin tozalash (subtitle-leak profilaktikasi) | Prompt preset |

### C. Understanding modellari bilan (yangi adapter yo'nalishi — §2.1)

| # | Tool | Model | Qiymati |
|---|---|---|---|
| T11 | **Auto-Tag Templates** — contributor yuklagan preview'dan janr/mood/obyekt teglari (admin moderatsiya + qidiruvga) | `seed-2-0-mini` + structured output, batch'da 50% off | Katalog sifati |
| T12 | **Video→Captions (.srt)** | `seed-2-0-lite-260428`, `input_video` (audio avtomatik ajratiladi), HH:mm:ss prompt | AE'da subtitle layer |
| T13 | **Frame Describe → Asset Brief** — joriy AE kadrini eksport → tavsif → gen prompt | `seed-2-0-lite` (hozirgi /gen/describe'ni ko'chirish) | Arzonroq + yagona provayder |
| T14 | **Semantic + Thumbnail Search v2** | `skylark-embedding-vision` (§2.2) | "Shu kadrga o'xshash shablon" |
| T15 | **Upload QC Gate** — contributor upload'ini avto-tekshirish (sifat, taqiqlangan kontent) | `seed-2-0-mini` + policy prompt | Moderatsiya yuki kamayadi |
| T16 | **Brand-Guide Ingest** — PDF brif → JSON (ranglar, shriftlar, copy) → shablon auto-fill | `seed-2-0-lite`, Responses API `input_file` | Pro-tier feature |

### D. Arzon tier

| # | Tool | Model |
|---|---|---|
| T17 | **Draft Video (arzon preview)** — 2-3 kreditga 480p tez variant, yoqsa full render | `seedance-1-0-pro-fast` ($0.10/video) yoki 2.0 Mini |
| T18 | **3D Asset Gen** | `Hyper3d-Rodin-Gen2` / `Hitem3d-2.0` |

**Mockup'lardagi "Tez orada" tool'lar bilan bog'lash:** batch8 mockup'dagi `concept-seedance` (multimodal references) = T1/T2/T5 — hujjatlar buni to'liq qo'llaydi, ochish mumkin. `Restyle` = Seedream i2i yoki Seedance "reference style" (T5 varianti). `Slow-mo/Relight/Inpaint/RemoveBG` — BytePlus'da YO'Q, fal/Magnific'da qoladi.

---

## 4-QISM. PRESET'LAR (prompt guide'dan — darhol qo'shsa bo'ladi)

Bular kod emas, plagin UI'siga preset tugma/dropdown sifatida kiradi. Prompt guide'ning eng qimmatli qismi:

### 4.1 Kamera preset'lari (har shot'da FAQAT BITTASI — hujjat qoidasi)
`slow push-in` · `pull back` · `smooth lateral tracking` · `360-degree orbiting shot` · `drone/aerial overhead` · `first-person POV` · `fixed camera position` · `handheld with slight shake` · `close-up` / `medium shot` / `wide shot`

### 4.2 Uslub preset'lari
`cyberpunk cool blue-purple tone` · `retro film, film-grain, low saturation` · `fresh Japanese style` · `2D Japanese anime style` · `3D CG xianxia` · `cinematic documentary`

### 4.3 Sifat + cheklov bloki (HAR promptga avto-qo'shish tavsiya etiladi)
```
HD, rich details, cinematic texture, natural colors, soft lighting.
Keep it subtitle-free. Do not generate any text, logo, or watermark.
Throughout the video, characters with completely identical appearance are prohibited —
no duplicate avatars or twin effect.
```
(Subtitle/logo-leak va "egizak" bug'lari — hujjatdagi eng ko'p uchraydigan muammolar.)

### 4.4 Maxsus belgi sintaksisi (UI helper tugmalar)
| Tur | Belgi | Misol |
|---|---|---|
| Musiqa | `（ ）` | `（fast-paced rock music playing）` |
| SFX | `< >` | `< dog barking in the distance >` |
| Dialog | `{ }` | `{Hello!}` — boshqa til: `says in Japanese {...}` |
| Subtitr | `【 】` | `【Chapter One】` |

### 4.5 Prompt scaffold'lar
- **Advanced formula:** `subyekt + harakat detali + muhit + yorug'lik/rang + kamera + uslub + sifat + cheklovlar`
- **Storyboard:** `Shot 1: [kamera] + [harakat] + [audio]. Shot 2: ...` (aniq soniya YOZMASLIK — "0-3s" beqaror)
- **Subyekt izchilligi:** `Define [2-3 barqaror belgi] in Image 1 as Subject 1` + har eslashda `Subject 1@Image 1` (bizning `@img1` rewrite allaqachon shunga xizmat qiladi ✅)
- **Edit:** `strictly edit [Video 1], and modify X to Y` (edit'da "reference" so'zini ISHLATMASLIK!)
- **Asset strategiyasi tavsiyasi (UI hint):** 4–5 asset optimal — 1-2 personaj rasm + 1 muhit + 1 kamera-video + 1 audio; limitni to'ldirmaslik.

### 4.6 Xato-profilaktika qoidalari (UI hint sifatida)
- Personaj uchun: alohida yuz (headshot) + to'liq bo'y rasmi; yuz rasmi BIRINCHI o'rinda; 3-view/kolaj EMAS.
- 4+ odam kerak bo'lsa: avval Seedream'da guruh rasm(lar) → keyin i2v.
- Uslub saqlash: ref rasmni avval Seedream'da kerakli uslubga o'tkazish.

---

## 5-QISM. Tavsiya etilgan tartib (prioritet)

1. **Tez g'alaba (kod deyarli yo'q):** `expired` status fix + `return_last_frame`/`seed` qo'shish; 4-qism preset'larini plagin UI'siga kiritish; T3 (morph) — allaqachon ishlaydi, faqat UI'da ko'rsatish.
2. **Batch8 concept'ni ochish:** T1 Video Edit + T2 Extend + T5 Motion Copy (Seedance 3102 hammasi qo'llaydi, faqat UI pane).
3. **Understanding adapter (`byteplus-chat`):** `/gen/describe` + `/gen/enhance` ni `seed-2-0-mini`ga ko'chirish → keyin T11 auto-tag, T12 captions.
4. **Embedding v2:** Skylark bilan thumbnail search (narx modelini oldin hisoblash — 500K bepul kvotada pilot).
5. **T17 arzon draft tier** — konversiya uchun (foydalanuvchi 2-3 kreditga sinab ko'radi).

---
*Muallif: Claude (Cowork sessiyasi), 2026-07-14. Manba hujjatlar: `Element/`, kod: `byteplus.ts`, `gen-models.ts`, `gen-processor.ts`.*
