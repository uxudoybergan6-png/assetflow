# AI Tools (Pillar B) — GAP tahlili

Mockup (yagona haqiqat manbai): `packages/assetflow-studio/platform/_frameflow-redesign-mockup.html`
panellar **b1–b12** (satr ~1001–1704).
Joriy plagin AI UI: `plugins/after-effects-cep/AssetFlow_Plugin.html` — `.axroot` scope
(`#v-launcher` ~3388, `#v-aicat` ~3394, `.axig` rasm `#v-imggen` ~3400, `.axig.axvg` video `#v-vidgen`
~3520, `#v-history` ~3725, `#v-settings` ~3731) + umumiy `#afLightbox` (`window.afRecent`, ~9982) +
`window.afGallery` (~10562).

> **Metod:** har panel joriy plagindagi ENG YAQIN ekran/sheet bilan solishtirildi; verdikt shu ekran
> markup'iga asoslanadi (klass/anchor ko'rsatilgan). Skrinshotlar `cep-plugin-preview` harness'da
> (http-server :8976, viewport **392px**) shu sessiyada jonli olindi — pastdagi "Skrinshot" ustunidagi
> nomlar shu sessiyadagi kartinkalarга ishora qiladi. Plagin **o'zgartirilmadi** (faqat o'qish + skrinshot).

## Xulosa (hisob)

| Verdikt | Soni | Panellar |
|---------|------|----------|
| **MATCH** (tayyor) | **0** | — |
| **PARTIAL** (moslash kerak) | **11** | b1, b2, b3, b4, b5, b6, b8, b9, b10, b11, b12 |
| **MISSING** (qurish kerak) | **1** | b7 |

Umumiy manzara: AI Tools'ning butun **struktura karkasi allaqachon mavjud** (launcher, rasm/video tool,
model/referens/trim sheet'lar, tarix galereyasi, lightbox, sozlama). Hech biri mockup bilan 1:1 emas —
lekin faqat **bittasi (b7)** butunlay yo'q. Qolgani "vizual moslash" ishi.

### Ko'ndalang (cross-cutting) farqlar — hammasiga tegadi, avval qaror qilinsin

1. **Sheet idiomi:** mockup barcha sheet'lar = pastdan chiqadigan **bottom-sheet + grab-handle** (36×4px
   tutqich). Plaginda sheet'lar yuqoridan tushadigan overlay-karta (grab-handle yo'q). → b2, b3, b6, b7.
2. **Sozlamalar:** mockup = inline **pill/chip** qatorlar (MODEL·NISBAT·REZOLYUTSIYA…). Plaginda = 2×2
   **seg-dropdown** qutilar (`.seg`). → b4, b5, b7.
3. **Generate tugmasi:** mockup = to'liq kenglik **lime "Video/Rasm yaratish ✦N"** CTA + izoh qatori.
   Plaginda = kichik doira **strelka** `.gensend` (cost yonida). → b4, b5.
4. **Header:** mockup har ekranda o'z **segment-toggle + kredit chip + avatar** header'i. Plaginda global
   `.pbar` (FrameFlow brend) + ekran ichida `.ailead`/`.igtop`/`.crumb`. → b1, b8, b11.

Bu 4 qarorni birinchi bo'lib qotirish kerak — ular deyarli har panelга kirib boradi.

---

## Panel-ma-panel jadval

| Panel | Mockup mazmuni (qisqa) | Plagindagi holat | Aniq farqlar | Tavsiya |
|-------|------------------------|------------------|--------------|---------|
| **b1** AI launcher | Header'da `Katalog\|AI Tools` segment-toggle + kredit chip + avatar; katta "✦ AI Tools" sarlavha + subtitle; 2×2 kategoriya kartalari (Rasm/Video **LIVE** nuqta + model ro'yxati + radial glow, Audio/3D **TEZ ORADA**); **TARIX** gorizontal strip; pastda info-toast | **PARTIAL** — `#v-launcher` + `.cats`/`.cat` (JS `aiRenderCatGrid` ~10504). 4 kategoriya (Image/Video "1 tool", Audio/3D "tez orada") bor | Kartalar sodda (icon+nom+"1 tool"), model ro'yxati / LIVE nuqta / glow yo'q; segment-toggle yo'q; avatar yo'q; **TARIX strip yo'q**; katta sarlavha+subtitle yo'q; pastki info-toast yo'q | Kartalarni mockup 1:1 qayta yasash (model mono ro'yxat+LIVE+glow), header segment-toggle+avatar, TARIX strip qo'shish. *Skrinshot: b1-launcher* |
| **b2** Model sheet | Bottom-sheet + grab-handle; "Model" + "narx — 1 natija uchun"; qatorlar **nom+tavsif+narx (✦N)**; tanlangan qator subtil bg + chap lime nuqta; ko'k info-box | **PARTIAL** — `#igMSheet`/`#vgMSheet`, JS `renderModelSheet` (~10833). Qatorlar icon+nom+subtitle, tanlangani lime **outline+✓** | **Narx (✦N) yo'q** har qatorда; tanlash uslubi outline+tick (mockup: bg+nuqta); grab-handle yo'q, yuqoridan tushadi; subtitle = "brand · qoida" (mockup: tavsif); pastda oddiy hint (mockup: ko'k info-box) | Bottom-sheet'ga o'tkazish, qatorga narx qo'shish, tanlash uslubini bg+nuqtaga almashtirish. *Skrinshot: b2-model-sheet* |
| **b3** Referens manba + ogohlantirish | Bottom-sheet "+ Referens" + subtitle; 3 qator (Fayl yuklash `PNG·JPG·MP4·50MB`, Project paneldan, Timeline'dan) har birida caret-right; kompozitsiyada olov-rang "referens majburiy" warn + dashed slot | **PARTIAL** — `#igAddSheet` (`igSrcFile/igSrcProj/igSrcTl`) 3 manba bor; warn `#igRefWarn` compose'da bor | Grab-handle yo'q; sarlavha "Referens qo'shish" (mockup "+ Referens" + "Manbani tanlang"); subtitle'lar boshqa (format/hajm yo'q); qatorda caret-right yo'q; warn matni/rangi farq | Subtitle'ga format+hajm, caret-right, grab-handle; warn rangini olov-rangga moslash. *Skrinshot: b3-ref-source* |
| **b4** Video — Fast | `Fast\|R2V` segment-toggle; **KADRLAR** + FAST badge; boshlang'ich(to'la)/yakuniy(dashed) kadr; inline manba chip'lar; prompt + Yaxshilash/Tozalash; **pill** sozlamalar (Model·Nisbat·Rezolyutsiya·Davomiylik·Ovoz-toggle); to'liq lime "Video yaratish ✦25"; SO'NGGI strip | **PARTIAL** — `#v-vidgen` Fast (`#vgFrameSect`: `vgStartBox`/`vgEndBox`), prompt, `.seg` sozlamalar + `vgAudToggle`, `#vgRecent` | **Fast/R2V segment-toggle yo'q** (rejim model'ga bog'liq: `vgFrameSect`⇄`vgMediaSect`); manba inline emas, sheet'da (`vgSrcSheet`); sozlamalar seg-dropdown (mockup: pill); generate = strelka (mockup: to'liq lime CTA); FAST badge yashirin | Fast/R2V toggle qo'shish; sozlamalarni pill'ga; to'liq lime CTA; manba chip'larini inline. *Skrinshot: b4-video-fast* |
| **b5** Video — R2V | FAOL REFERENSLAR + hisob "Rasm 2/3·Video 1/1·Ovoz 0/1"; @ref thumbnaillar (×, ko'k outline=faol); `+Rasm/+Video(dim)/+Ovoz` dashed chip; SAVED REFERENCES "10 minut" timer; @ref prompt; pill sozlamalar; lime "✦60"; "≈1–2 min·xatoda kredit qaytadi" | **PARTIAL** — `#vgMediaSect`: `vgRefMeta` hisob, `+Rasm/+Video/+Ovoz` (`vgAddImg/Vid/Aud`), FAOL/SAVED `refbox` (`vgRefGrid`/`vgSavedWrap` "10 minut"), @ref `vgMention` | **Struktura mos** (eng yaqin panel). Farq: `+…` tugmalari to'la (mockup: dashed, +Video dim); sozlamalar seg (mockup pill); generate strelka (mockup lime CTA + izoh qatori) | Chip'larni dashed+dim; pill sozlamalar; lime CTA+izoh. *Skrinshot: b5-video-r2v* |
| **b6** Video trim sheet | Bottom-sheet + handle; sarlavha+`clip·14s`; player+play+vaqt; `Butun klip\|Tanlangan qism` seg; **ko'k** trim tutqichlar; "00:02–00:09·7s" + olov-rang "15s dan uzun bo'lmasin"; audio-toggle; "Shu bo'lakni ishlatish" (qaychi) | **PARTIAL** (yaqin) — `#vgClipSheet`: player, `vgClipModeSeg` (Butun/Tanlangan), `#vgClipTl` trim, `vgClipWarn` 15s, audio-toggle, apply | Tutqichlar **lime** (mockup: ko'k `#7CC4FF`); grab-handle yo'q, yuqoridan tushadi; warn yashirin (limit oshsa), mockup doim inline; qo'shimcha note-matnlar ko'p | Tutqich rangini ko'kка; grab-handle; warn'ni ixchamlashtirib inline; ortiqcha note'ni kamaytirish. *Skrinshot: b6-video-trim* |
| **b7** Video sozlamalar (birlashgan sheet) | **Bitta** bottom-sheet "Video sozlamalari": MODEL tanlov + NISBAT + REZOLYUTSIYA + DAVOMIYLIK + "Ovoz generatsiyasi +✦8" toggle — hammasi bir joyda; "Tayyor" tugma | **MISSING** — bunday **birlashgan sheet yo'q**. Sozlamalar `.seg` qatorlaridan **alohida** sheet'lar orqali ochiladi: `#vgMSheet`, `#vgArSheet`, `#vgResSheet`, `#vgDurSheet` (+`#vgBitSheet`) | Funksiya bor, lekin 4–5 ta alohida sheet'ga bo'lingan; mockupdagi yagona "Video sozlamalari" varag'i mavjud emas | Yangi birlashgan `vgSettingsSheet` qurish (yoki inline pill panel — b4 bilan uyg'un) va alohida sheet'larни shunga yig'ish | 
| **b8** Tarix — galereya | Header `‹ Tarix` + zoom `−\|+` + "Tanlash"; filter chip (Hammasi/Rasm/Video/Ovoz/SFX); 3-ustun `aspect 1/1` grid + loading tile; "128 ta natija · 2.1 GB" footer | **PARTIAL** — `#v-history`→`window.afGallery` (~10562): `galtabs` filter (aynan Hammasi/Rasm/Video/Ovoz/SFX), `galzoom` (−/+, data-cols 1–3), `galselbtn` "Tanlash", `.rc` grid, pending tile | Header `.crumb` "AI Tools › Tarix" (mockup: sodda `‹ Tarix`); **"N natija · GB" footer yo'q** (faqat `galempty`); grid karta uslubi (badge/bd) mockupdan farq | Footer count+hajm qo'shish; header'ni soddalashtirish; karta uslubini moslash. *Skrinshot: b8-history* |
| **b9** Tarix — tanlash/batch/confirm | Header `✕ 3 tanlandi` + "Barchasini tanlash"; grid tanlangan=ko'k outline+check badge; **custom confirm** modal ("3 ta o'chirilsinmi? …serverdan ham o'chadi"); pastda floating batch bar (Yuklab olish / O'chirish) | **PARTIAL** — afGallery select-mode (`st.select`, `.galbatch`: "N tanlandi" + Yuklab olish(non-CEP) + O'chirish + Bekor), `.rcb` check badge, o'chirishда `window.afConfirm` (~10130) custom modal | Header'da "N tanlandi"+**"Barchasini tanlash" yo'q** (select-all); confirm matni qisqaroq (mockup: "serverdan ham o'chadi" + qizil tugma); batch bar bor (floating pill) | Header'ga select-count + "Barchasini tanlash"; confirm matnini/rangini moslash. *Skrinshot: (b8-history select-mode)* |
| **b10** Lightbox | Qora fon; "3/24" counter + ESC badge + ✕; katta media + **prev/next** o'q; video scrubber+vaqt+ovoz; prompt+meta karta (model·nisbat·narx·sana chip); action qatori (**lime Import** + Referens/Qayta gen/Download icon-doira) | **PARTIAL** — umumiy `#afLightbox` (`openLightbox` ~10016): media + `✕` + 4 action (AE import / Referens / Qayta gen / Yuklab olish) | **Counter (N/N) yo'q; ESC badge yo'q; prev/next nav yo'q; scrubber/vaqt/ovoz yo'q; prompt+meta karta yo'q (chip yo'q)**; action'lar bir xil dark tugma (mockup: lime-primary Import + icon-doiralar) | Counter+nav+scrubber+meta karta qo'shish; Import'ni lime-primary; boshqalarni icon-doira. *Skrinshot: b10-lightbox* |
| **b11** AI Sozlamalar | Header `‹ Sozlamalar`; katta **kredit balans karta** (✦1230 + oxirgi to'ldirish + lime "Kredit to'ldirish"); 3 **paket** (500/1200·TOP/3000 narx); **KREDIT TARIXI** ro'yxati (icon+summa); PREFERENSLAR toggle (hover-autoplay, avto-import) | **PARTIAL** (missing tomon og'ir) — `#v-settings`: "Kredit balansi" + "Kredit to'ldirish", Default import Comp/Bin, Auto-load toggle, + 3 **demo** toggle (empty/kam-kredit/gen-xato) | Katta balans **karta yo'q**; **kredit paketlari yo'q**; **kredit tarixi yo'q**; mockup preferens'lari yo'q; demo toggle'lar mockupda yo'q (dev-only); `.crumb` header | Balans karta + paketlar + kredit tarixi qurish; demo toggle'larни ajratish/olib tashlash; preferens'larni moslash. *Skrinshot: b11-settings* |
| **b12** Chekka holatlar | (1) **Kam kredit**: compose'da qizil banner "Kredit yetarli emas·kerak ✦60·sizda ✦12" + lime "Kredit to'ldirish"; (2) **Sessiya tugadi**: modal karta + "Kirish"; (3) **Bo'sh workspace**: markazда "Hali generatsiya yo'q" + strelka-past | **PARTIAL** (aralash) — (1) kam kredit = `lowDemo`→balans past + `gensend` "off" + **toast** "Kredit yetarli emas" (banner emas); (2) sessiya = **toast** "Sessiya tugadi — qayta kiring"; login-gate modal `#lrOverlay` ("Tizimga kiring"+Kirish) bor lekin AI-sessiyaga emas, katalog download'ga; (3) bo'sh = galereya `galempty` "Hozircha bo'sh" matni | (1) inline qizil banner+CTA yo'q (toast); (2) AI-sessiya modal yo'q (toast; `lrOverlay` matni/konteksti boshqa); (3) markaziy "Hali generatsiya yo'q"+strelka hero yo'q | 3 holatni mockup ko'rinishida qurish: compose qizil banner, sessiya modal (lrOverlay'ni qayta ishlatib), bo'sh-hero. *Skrinshot: b11-settings (demo toggle'lar)* |

---

## Tavsiya etilgan redesign tartibi

Avval **ko'ndalang 4 qaror** (bottom-sheet+grab-handle, pill-sozlama, lime-CTA, per-ekran header) —
ular quyidagi ishlarни soddalashtiradi. So'ng panel tartibi (ta'sir × divergensiya bo'yicha):

1. **b1 (launcher)** — kirish nuqtasi; header segment-toggle + karta uslubi + TARIX strip idiomini o'rnatadi.
2. **b4 + b5 (video Fast/R2V)** — eng katta vizual divergensiya; pill-sozlama + lime-CTA naqshini kiritadi
   (b7 shundan tabiiy chiqadi).
3. **b11 (sozlamalar)** — eng ko'p yetishmaydigan bo'lak (balans karta + paketlar + kredit tarixi).
4. **b10 (lightbox)** — counter/nav/scrubber/meta karta — ko'p yetishmovchilik, umumiy komponent (afRecent).
5. **b2 + b3 (sheet'lar)** — bottom-sheet + grab-handle + narx idiomi (barcha sheet'larга tarqaydi).
6. **b8 + b9 (tarix)** — footer count, select-all header, confirm matni.
7. **b7 (birlashgan video sozlama sheet)** — b4 pill-panel tayyor bo'lgach oson.
8. **b12 (chekka holatlar)** — banner / sessiya-modal / bo'sh-hero.

> Eng ko'p ish talab qiladigan 3 panel: **b11** (sozlamalar — ko'p bo'lak yo'q), **b10** (lightbox — ko'p
> yetishmovchilik), **b1** (launcher — birinchi taassurot + karta idiomi). b7 yagona 0'dan quriladigan panel,
> lekin kichik (b4 pill-panelга tayanadi).
