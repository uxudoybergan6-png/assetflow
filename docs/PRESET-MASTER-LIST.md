# PRESET MASTER LIST — plagin uchun yakuniy ro'yxat (2026-07-14)

4 kategoriya: IMAGE · VIDEO · AUDIO · 3D. Har element: foydalanuvchi oqimi → model → holat.
**Holat belgilari:** 🟢 backend tayyor (faqat UI/preset matn) · 🟡 ozgina kod (1-2 param/endpoint) · 🔴 yangi adapter/integratsiya.
Manbalar: `docs/BYTEPLUS-ANALYSIS.md`, `docs/PRESET-IDEAS-RESEARCH.md` + audio/3D deep research (ElevenLabs docs, Tripo/Meshy/Hitem3D API docs, BytePlus ModelArk 3D endpointlari).

---

## 🖼 IMAGE (Seedream 5.0 Pro/Lite — ulangan)

### Presetlar (prompt retseptlar, 🟢)
| # | Preset | Oqim | Izoh |
|---|---|---|---|
| I1 | **Aesthetic Styles** (10-15 karta: Y2K, iPhone-look, Cinematic, Editorial, Anime, Clay, Neon...) | prompt + uslub karta → rasm | Higgsfield Soul naqshi (50+ preset) |
| I2 | **Action Figure / Starter Pack** | selfi yukla → blister-qutidagi o'yinchoq | 2025 mega-trend (Forbes) |
| I3 | **Product Scene** (10 sahna: marble, studio, beach, forest, luxury...) | mahsulot rasmi + sahna karta | Photoroom Instant Backgrounds naqshi, i2i |
| I4 | **AI Headshot** | 2-4 selfi → professional portret | multi-ref; real-yuz moderation tekshirilsin |
| I5 | **Style Frames / Moodboard** | brif matn → pitch kadrlari | motion-dizaynerlarning №1 gen-AI ishi |
| I6 | **Text/Logo Cleaner** | rasm → matn/logo olib tashlangan | video-ref oldidan profilaktika, i2i |
| I7 | **Restyle** | rasm + uslub karta → qayta uslub | mockupdagi "Tez orada" Restyle'ni yopadi |

### Mini-applar (🟡 — sequential_image_generation qo'shish kerak, faqat Lite 1020)
| # | App | Oqim |
|---|---|---|
| I8 | **Storyboard Set** | ssenariy → 4-8 uslub-izchil kadr (batch) |
| I9 | **Icon/Element Pack** | "20 ta flat piktogramma, ko'k" → izchil to'plam → AE'ga PNG |
| I10 | **Brand Visual Set** | logo → poster/banner/post seriyasi (image-to-batch) |
| I11 | **Multi-Blend / Try-On** | 2-3 rasm birlashtirish (kiyim almashtirish, personaj+fon) — 🟢 Pro'da array image allaqachon bor |

---

## 🎬 VIDEO (Seedance 2.0 #3102 — ulangan, eng boy kategoriya)

### A. Kamera preset kartalari (🟢, 0 backend)
Earth Zoom Out ⭐ · Eyes In ⭐ · Crash Zoom In/Out · Bullet Time · Dolly Zoom · Super Dolly In · 360 Orbit · Crane Over Head · FPV Drone · Whip Pan · Handheld · Hyperlapse · POV · Pull Back Reveal · Static Lock
*(Higgsfield ~60 preset; ⭐ = TikTok'da eng viral ikkitasi. Qoida: bir shot = bitta harakat.)*

### B. VFX effekt kartalari (🟢, i2v + retsept, generate_audio bilan ovozli)
Squish · Inflate · Melt · Explode · Disintegrate · Levitate · Glass Breaking · Fire/Burn · Turn to Metal · Toon Transform · AI Hug (2 rasm) · AI Aging
*(Pika Pikaffects + Kling Effects + Vidu templates dan eng ko'p ishlaydiganlari.)*

### C. Tool/mini-applar
| # | App | Oqim | Holat |
|---|---|---|---|
| V1 | **Trend Copy** ⭐ | trend video (galereyadan/o'zi) + o'z rasmi → trend uning kontenti bilan | 🟢 ref_video+ref_image bor; kuratsiya galereya kerak |
| V2 | **Video Edit** | video + "X ni Y ga almashtir" | 🟢 (quickstart demo aynan shu) |
| V3 | **Extend / Stitch** | 3 tagacha klipni ulash/davomlash | 🟢 |
| V4 | **Morph Transition** | 2 kadr (boshi+oxiri) → silliq o'tish | 🟢 endFrame bor |
| V5 | **Continue Clip** | klipning oxirgi kadridan davom | 🟡 return_last_frame param |
| V6 | **Motion/Camera Copy** | referens videodagi harakatni yangi sahnaga | 🟢 |
| V7 | **Logo Reveal Gen** ⭐ | logo + 8 uslub karta (particle, glass, liquid, neon...) → 5s intro | 🟢 prompt retsept; VideoHive №1 kategoriya |
| V8 | **Looping Background** ⭐ | uslub karta → seamless loop fon | 🟢 hiyla: Seedream kadr → first_frame = last_frame |
| V9 | **Green-Screen Element** | "olov/tutun/portal, toza yashil fon" → import'da avto-Keylight | 🟢 + plagin tomonda Keylight avto-qo'llash (AE-native ustunlik) |
| V10 | **Talking Avatar** | avatar rasm + skript ({dialog} + ref_audio timbre) | 🟢 Higgsfield Speak naqshi |
| V11 | **UGC Ad Maker** | mahsulot rasm + avatar → qo'lida ushlab reklama | 🟢 (Higgsfield UGC Factory Seedance'da ishlaydi) |
| V12 | **Performance Transfer** | o'z harakat videosi + personaj rasmi → personaj takrorlaydi | 🟢 Runway Act-Two analogi |
| V13 | **Storyboard→Animatic** | I8 kadrlari → har birini animatsiya, zanjir | 🟡 V5 bilan birga |
| V14 | **Draft Preview (arzon tier)** | 2-3 kreditga 480p tez variant → yoqsa full | 🟡 `seedance-1-0-pro-fast` ($0.10/video) yoki 2.0 Mini modelini yoqish |
| V15 | **Product 360 Spin** | mahsulot rasmi → orbit video | 🟢 preset retsept |

---

## 🔊 AUDIO (ElevenLabs SFX #4001 + Chirp TTS #2002 — ulangan)

### Presetlar (🟢, mavjud modellar ustiga)
| # | Preset | Oqim | Izoh |
|---|---|---|---|
| A1 | **SFX kategoriya kartalari**: Whoosh · Impact/Hit · Riser · Glitch · UI klik · Ambient bed · Braam | karta + qisqa tavsif → SFX | video-editorlar aynan shu paketlarga pul to'laydi (Motion Array/Boom taksonomiyasi) |
| A2 | **Loop rejimi** SFX'da | ElevenLabs API'da smooth-loop toggle bor | 🟡 1 param |
| A3 | **Voiceover uslub kartalari**: Trailer Voice · Documentary · Energetic Ad · Calm Tutorial | matn + uslub → ovoz | Chirp ovozlari ustiga uslub-prompt |
| A4 | **Seedance ovozli presetlar** | video generatsiyada （musiqa）`<SFX>` {dialog} avto-qo'shish | 🟢 4.4-bo'lim sintaksisi |

### Mini-applar
| # | App | Oqim | Holat |
|---|---|---|---|
| A5 | **Auto-Captions (.srt)** ⭐ | video/audio → subtitr fayli → AE text layer | 🔴 BytePlus `seed-2-0-lite-260428` (audio understanding); yangi chat-adapter |
| A6 | **Auto-Foley** | klip → mos SFX variantlari | 🔴 MMAudio v2 (fal'da bor — fal adapter mavjud!); ElevenLabs video-to-sound hali beta |
| A7 | **Music Loop Gen** | janr/kayfiyat/uzunlik kartalari → trek | 🔴 Stable Audio (fal orqali) yoki Eleven Music API; Soundraw naqshi UX |
| A8 | **Voice Isolator / Cleanup** | shovqinli yozuv → toza ovoz | 🔴 ElevenLabs Voice Isolator API (kalit allaqachon bor!) — 🟡 ga yaqin |
| A9 | **Voice Changer** | o'z yozuvi → boshqa ovozda (timing saqlanadi) | 🔴 ElevenLabs API |

---

## 🧊 3D (BytePlus ModelArk'da tayyor — Hyper3D-Rodin-Gen2 $0.399, Hitem3d-2.0 $0.5-0.9)

Hammasi 🔴 bitta yangi adapter (`byteplus-3d`, task API — video adapteri naqshida) + AE natively GLB import qiladi (2024+dan rasmiy) → plagin avto-import qila oladi.

| # | App | Oqim | Izoh |
|---|---|---|---|
| D1 | **Photo → 3D Model** ⭐ | rasm → GLB mesh → AE sahnasiga avto-import | Copilot 3D/Tripo naqshi; "AE ichida" hech kimda yo'q |
| D2 | **Logo → 3D** | logo → ekstrudlangan 3D → AE'da aylantirish | logo-reveal bilan juft |
| D3 | **Product → 3D Spin** | mahsulot rasm → mesh → AE kamerada 360° | V15 ning "haqiqiy 3D" varianti; bozorda bo'sh joy |
| D4 | **Figurine Maker** | selfi → 3D geroycha mesh | Hitem3D portrait modeli; viral trend'ning mesh-versiyasi |
| D5 | **Depth Map / Relief** | rasm → EXR/PNG depth → AE'da parallax/DOF kompoziting | Hitem3D depth-relief $0.20; motion-dizayner uchun juda amaliy |
| D6 | **Uslub kartalari**: Realistic · Clay · Cartoon · Gold · Bronze | Tripo'da API-enum sifatida bor; Rodin/Hitem'da prompt orqali | keyingi bosqich |

Eslatma: ko'p "3D figurine" applar aslida 2D rasm (Nano Banana) — bizda D1-D4 haqiqiy mesh, AE GLB import bilan. Bepul kvotalar: Hyper3d 150K, Hitem3d 500K token — pilot bepul.

---

## YO'L XARITASI (tavsiya)

**Bosqich 1 — 0 kod, 1 hafta:** Video A+B kartalari (kamera 15 + VFX 12) · Image I1-I7 · Audio A1/A3/A4 · V1 Trend Copy UI · V4 Morph · V7 Logo Reveal · V8 Loop BG → **plaginda birdan ~45 preset paydo bo'ladi.**
**Bosqich 2 — kichik kod:** V5 (return_last_frame) · V14 arzon draft tier · I8-I10 Seedream batch · A2 loop · A8 Voice Isolator (ElevenLabs kaliti bor).
**Bosqich 3 — yangi adapterlar:** A5 Auto-Captions (BytePlus chat) · 3D adapter (D1-D5) · A6 Auto-Foley (fal/MMAudio) · A7 Music.

---
*Deep research (jami 7 qidiruv agenti, ~80 manba) + Element/ hujjat tahlili asosida. Claude (Cowork), 2026-07-14.*
