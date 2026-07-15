# Preset mini-app g'oyalari — raqobatchi bozor tadqiqoti (deep research, 2026-07-14)

**Metodika:** 5 parallel qidiruv yo'nalishi (Higgsfield · Pika/Runway/LTX · Kling/Hailuo/Vidu · Krea/Freepik/CapCut · AE-bozor), ~60 manba tekshirildi. Har g'oya Element/ hujjatlaridagi Seedance 2.0 / Seedream 5.0 API imkoniyatlariga moslab baholandi. Ishonch: ✅ = birlamchi manba tasdiqlagan; ⚠️ = uchinchi-tomon manba (ehtimoliy, tekshirilmagan detal).

**Bozorning asosiy naqshi:** g'oliblar bitta modelni bitta NOMLANGAN natija ortiga yashiradi — "hug", "figurine", "crash zoom", "headshot". UX doim bir xil: **rasm yukla → preset kartani bos → natija.** Prompt yozish yo'q. Higgsfield shu formula bilan 80+ mini-app va ~60 kamera-presetgacha o'sdi.

---

## A. KAMERA PRESET KARTALARI (eng oson, darhol qilsa bo'ladi)

**Kimda bor:** Higgsfield Camera Controls — ~60 nomlangan preset (Bullet Time, Crash Zoom, Dolly Zoom, Super Dolly, Crane Over The Head, FPV Drone, 360 Orbit, Whip Pan, Snorricam, Dutch Angle, Handheld, Hyperlapse, Earth Zoom Out, Eyes In...). Eng virallari: **Earth Zoom Out** va **Eyes In** (TikTok trendlari). ✅ [higgsfield.ai/camera-controls]
Hailuo Director: `[Push in]`, `[Pan left]`, `[Tracking shot]` qavs-teg sintaksisi, 3 tagacha birga. ✅

**Bizda qanday:** Seedance 2.0 i2v + prompt guide'dagi kamera lug'ati (slow push-in, 360-degree orbiting, drone overhead, POV, handheld shake — hujjat aynan shu so'zlarni tushunadi). Har preset = tayyor prompt shablon + rasm. **Qoida: bir shot'da bitta kamera harakati** (bizning hujjatdan).
**Ish hajmi:** 0 backend. 15–20 preset karta UI'da. Eng viral 2 tasini birinchi qiling: Earth Zoom Out ("camera rapidly pulls back from subject into sky, through clouds, to orbital view of Earth") va Eyes In.

## B. VFX EFFEKT PRESETLARI (bir-tugmali "wow")

**Kimda bor:**
- Pika **Pikaffects**: Explode, Melt, Crush, Inflate, Squish, Cake-ify, Levitate, Dissolve ✅ [PetaPixel/VentureBeat]
- Kling Effects: squish/fuzzyfuzzy, expansion/bloombloom, jelly, pixel, yearbook, instant_film, anime_figure, rocket; 2-rasmli: **hug, kiss, heart gesture** ✅
- Higgsfield Effects: Explosion, Disintegration, Levitation, Melting, Turning Metal + "Effects Mix" (2 tasini birlashtirish) ✅
- Vidu templates (~11 sahifa): AI Hug, AI Kissing, Face Punch, Flying, Mermaid, Inflate, Glass Breaking, toon-transform ✅

**Bizda qanday:** har biri Seedance i2v + qat'iy prompt retsept. Masalan Squish = "hands press down on [subject], it squishes like soft rubber with squeaking sound < rubber squeak >". `generate_audio:true` bilan ovozli ("Kling'da rezina g'ijirlashi avtomatik" — bizda ham `< >` SFX sintaksisi bor!). Hug/Kiss = 2 rasm `reference_image` + "the two people embrace warmly". Diqqat: real yuzlar BytePlus input moderation'ga tushishi mumkin (bizning kodda allaqachon ishlangan) — stilizatsiya taklif qilish.
**Ish hajmi:** 0 backend. 10–15 effekt karta. AE auditoriyasi uchun eng mosi: Disintegration, Explosion, Levitation, Glass Breaking (VFX-elementlar sifatida).

## C. "TREND COPY" — Seedance'ning O'ZIGA XOS kuchi

**Dalil:** TechCrunch (2026-03): Seedance 2.0 CapCut'da **trend TikTok effektini referens videodan nusxalaydi** — ByteDance'ning o'zi Seedance'ni "fixed effekt ID emas, referens-imitatsiya" preset mexanikasi bilan sotadi. ✅ Bu bizning hujjatdagi "Reference the special effect in Video 1" formulasi bilan bir xil.

**Tool:** foydalanuvchi trend videoni (yoki bizning kuratsiya qilingan trend galereyadan) + o'z rasmini beradi → Seedance trendni uning kontenti bilan qayta yaratadi. **Hech bir AE plugin'da bunday yo'q.** Backend tayyor (3102 `reference_video` + `reference_image`), faqat UI + kuratsiya qilingan trend-galereya kerak. Higgsfield "Viral Presets" lentasi shu modelning isboti (har kuni yangi presetlar ⚠️).

## D. MOTION-DESIGN MAXSUS PRESETLAR (bizning differensiator — raqobatchilarda YO'Q)

AE bozorida eng ko'p sotiladigan kategoriyalar: **logo reveal/intro, titles/lower thirds, transitions, overlays/elements** ✅ [VideoHive/Motion Array]. Hech bir gen-AI platforma bularni AE ichida preset qilmagan:

| Preset | Qanday ishlaydi | API |
|---|---|---|
| **Logo Reveal Gen** | Logo rasmini yukla → 8 uslub karta (particle assembly, glass shatter, liquid, neon...) → 5s video | Seedance i2v, logo `first_frame` yoki `reference_image` + "do not modify the logo design" cheklov |
| **Looping Background** | Uslub karta (gradient flow, particles, smoke...) → seamless loop fon | Seedance: bitta kadrni Seedream'da yasab, `first_frame` = `last_frame` QILIB yuborish → ideal loop! (bizning endFrame allaqachon bor) — OpenArt/Melies shu nishada pullik ✅ |
| **Green-Screen Element** | "Yonayotgan olov, yashil fonda" → AE'da avto-Keylight | Seedance t2v + "solid pure green background, single subject, no shadows" prompt + **plugin import'da avto Keylight effekt qo'yadi** — bu bizning AE-native ustunlik. ⚠️ ogohlantirish: AI-yashil fon real chromadan yomonroq keylanadi, "preview → key sifati" ko'rsatish kerak. (Firefly'da native alpha bor ✅, Seedance'da yo'q) |
| **Storyboard/Animatic** | Ssenariy matn → Seedream batch (uslub-izchil 6–8 kadr) → xohlasa har kadrni Seedance animatik qiladi | Seedream Lite `sequential_image_generation` + Seedance i2v zanjiri. LTX Studio $35–125/oy shu pipeline'ga oladi ✅ |
| **Style Frames** | Moodboard/uslub kadrlar mijoz pitch'i uchun | Seedream multi-ref — motion-dizaynerlar gen-AI'ni eng ko'p shu uchun ishlatadi ✅ [School of Motion] |
| **Transition Pack** | 2 komp kadri orasida AI o'tish (morph, whip, portal) | Bizning T3 first+last morph — allaqachon backend tayyor |

## E. AVATAR / UGC (Higgsfield'ning pul mashinasi)

- **Speak-uslub talking avatar**: avatar rasm + skript + ovoz → lip-sync gapiruvchi video. Higgsfield Speak 2.0 (70+ til) ✅. Bizda: Seedance `generate_audio` + `{dialog}` sintaksis + `reference_audio` timbre; ovozni Chirp TTS'dan olib `reference_audio` qilib berish ham mumkin.
- **Act-Two-uslub performance**: o'z harakat videosini yozib → personaj takrorlaydi. Runway Act-Two ✅. Bizda: `reference_video` (harakat) + `reference_image` (personaj) — "Reference the action in Video 1".
- **UGC Ad Maker**: mahsulot rasmi → avatar qo'lida ushlab reklama qiladi (Higgsfield UGC Factory — Seedance'da ishlaydi! ✅). Bizda to'liq mumkin: mahsulot `reference_image` + avatar `reference_image` + dialog.

## F. RASM PRESETLARI (Seedream — arzon, tez konversiya)

- **Aesthetic preset to'plami** (Higgsfield Soul 50–60 preset: Y2K, iPhone-look... ✅) → Seedream t2i uslub promptlari.
- **Action Figure / Starter Pack** (2025 mega-trend, Forbes ✅) → Seedream i2i "toy action figure in blister pack with accessory icons".
- **AI Headshot** (bozor ~$350–500M ⚠️ vendor raqamlari; HeadshotPro 17.9M rasm) → Seedream multi-ref (bir necha selfi → professional portret). Real-yuz moderation'ni tekshirish kerak.
- **Product Scene presets** (Photoroom Instant Backgrounds ✅) → Seedream i2i: mahsulot rasmi + sahna karta (marble, beach, studio...) — AE'da mahsulot-reklama qiluvchilar uchun.
- **Icon/Element Set** (Freepik Icon Generator ✅) → Seedream batch — uslub-izchil ikonka/element to'plami, AE'ga PNG import.

---

## Verifikatsiya xulosasi

Yuqori ishonch (birlamchi manba): Higgsfield camera/effects/Soul/Speak/UGC, Runway References/Act-Two/Aleph/Apps (changelog), Kling Effects ro'yxati, Vidu templates, Firefly alpha-video, VideoHive kategoriyalari, TechCrunch Seedance-CapCut. O'rtacha (uchinchi-tomon, ehtimoliy): Pika effektlarining to'liq joriy ro'yxati (sayt yopiq), Higgsfield "kuniga 10 preset", headshot bozor hajmi, Krea "1000+ preset" soni. Bularning hech biri implementatsiya qaroriga ta'sir qilmaydi — hammasi Element hujjatlarida tasdiqlangan Seedance/Seedream imkoniyatlari doirasida.

## TOP-10 tavsiya (foyda/mehnat nisbati bo'yicha)

1. **Kamera preset kartalari** (A) — 0 backend, Earth Zoom Out + Eyes In'dan boshlash
2. **VFX effekt kartalari** (B) — 0 backend, 10 ta retsept
3. **Trend Copy** (C) — backend tayyor, faqat UI + trend galereya; noyob positioning
4. **Logo Reveal Gen** (D) — AE auditoriyasining №1 pullik kategoriyasi
5. **Looping Background** (D) — first=last frame hiylasi, backend tayyor
6. **Transition/Morph** (D) — T3, backend tayyor
7. **Green-Screen Element + avto-Keylight** (D) — AE-native ustunlik
8. **Talking Avatar / UGC Ad** (E) — Higgsfield'ning eng daromadli lineup'i, Seedance'da isbotlangan
9. **Storyboard Set** (D) — Seedream batch (Lite'da), LTX'ga muqobil
10. **Product Scene / Action Figure rasm presetlari** (F) — arzon, viral

## Asosiy manbalar

higgsfield.ai/camera-controls · higgsfield.ai/collection/effects · higgsfield.ai/soul · higgsfield.ai/blog/Higgsfield-UGC-Factory-Explained · runwayml.com/changelog · runwayml.com/research/introducing-runway-aleph · petapixel.com (Pikaffects) · app.klingai.com/global/special-effects · vidu.com/ai-templates · hailuoai.video (Director tags) · dreamina.capcut.com/seedance · techcrunch.com/2026/03/26 (Seedance 2.0 → CapCut) · helpx.adobe.com (Firefly transparent video) · videohive.net/popular_item · motionarray.com · schoolofmotion.com/blog/eoy2025 · ltx.io/studio · photoroom.com/tools/instant-backgrounds · forbes.com (action figure trend)

---
*Deep research: 5 parallel qidiruv agenti, ~60 manba. Claude (Cowork), 2026-07-14.*
