# Tema tizimi + to'liq plagin re-skin (implementatsiya rejasi)

*Maqsad: butun plagin Claude Design maketiga mos + 3 ta almashtiriladigan tema.*
*Holat: REJA.*

## Maqsad
1. Butun plagin (AI Tools ✅, Katalog, Hisob, sidebar) maketga to'liq mos.
2. 3 ta tema, plagin ichidan almashtiriladigan:
   - **Standart** — dark flat (Artlist uslubi, near-black `#0a0b08`, blur yo'q).
   - **Liquid Glass** — dark shisha (translucent panel + backdrop-blur + rim highlight).
   - **Light Glass** — light shisha (yorug' fon, oq-translucent panel, qora matn, blur).

## Arxitektura — bitta markup + tema tokenlari (MUHIM)

> **Aniqlashtirildi:** PLAGIN STRUKTURASI/INTERFEYSI = 100% `AssetFlow Standart.html`dan
> (barcha ekran, layout, komponent aynan shundan). `AssetFlow Liquid Glass.html` FAQAT
> tema qiymatlarini (blur, translucent surface, rim, fon) olish uchun — strukturasi EMAS.
> Light Glass = bir xil struktura + light tema qiymatlari.

3 ta alohida HTML EMAS. Bitta markup (Standart'dan), `tokens.css` ichida tema-token to'plamlari:
```
:root[data-theme="standart"]    { --bg:#0a0b08; --surface:#141612; --text:#f5f7f0;
                                   --glass-blur:0px; --glass-bg:#141612; --rim:transparent; ... }
:root[data-theme="liquid-glass"]{ --bg:#070806; --surface:rgba(20,24,18,.55); --text:#f6f8f1;
                                   --glass-blur:28px; --glass-bg:rgba(20,24,18,.55); --rim:rgba(255,255,255,.18); ... }
:root[data-theme="light-glass"] { --bg:#eef1ea; --surface:rgba(255,255,255,.55); --text:#14160f;
                                   --glass-blur:28px; --glass-bg:rgba(255,255,255,.6); --rim:rgba(255,255,255,.7); ... }
```
- Komponentlar shu tokenlardan foydalanadi: `background:var(--glass-bg)`, `backdrop-filter:blur(var(--glass-blur))`, `border-top:1px solid var(--rim)`.
- Flat temada `--glass-blur:0` → blur yo'q (tez). Glass temalarda blur ishlaydi.
- Lime aksent uchchala temada ham brend (light'da biroz to'qroq lime kontrast uchun).

## Tema almashtirgich
- Hisob ekranida (yoki sidebar pastida) 3 tugmali tanlov: Standart / Liquid Glass / Light Glass.
- Bosilganda `document.documentElement.setAttribute('data-theme', x)` + prefs'ga yoziladi (`persistUserPrefs` merge — boshqa maydonlarni buzmasdan).
- Boot'da prefs'dan o'qib qo'llanadi (default: standart).

## Re-skin ko'lami (mantiq saqlanadi — faqat ko'rinish)
| Ekran | Holat | Eslatma |
|---|---|---|
| AI Tools | ✅ qilingan | tema tokenlariga ulansin |
| Katalog (Shablonlar) | 🔴 | hero kartalar, filtr+AI toggle, kategoriya-label kartalar, doimiy ★/⬇. Fetch/filtr/import/hover-video SAQLANADI |
| Hisob | 🔴 | usage stat qatori, Free/Pro kartalar, folder, logout + tema almashtirgich. Plan/limit mantig'i SAQLANADI |
| Sidebar | 🔴 | user kartasi (Pro badge), yig'iladigan Katalog, AI kredit chip. switchNavFromSidebar SAQLANADI |
| Login modal, toast | 🟡 | tema tokenlariga ulansin |

## Ketma-ketlik
1. **Tema arxitekturasi** — tokens.css'ni `[data-theme]` blokларга refaktor (3 tema) + komponentlar `--glass-bg`/`--glass-blur`/`--rim` ishlatsin + tema almashtirgich (Hisob) + prefs persist + boot-load. (Avval Standart to'liq, Glass/Light keyingi qadamda qiymat to'ldiriladi.)
2. **Katalog re-skin** — maketga, mantiq saqlanadi.
3. **Hisob + Sidebar re-skin** — maketga.
4. **Liquid Glass + Light Glass token qiymatlari** — to'ldirish, AE'da blur unumdorligini sinash.
5. **AE perf test** — glass temalarda hover/scroll jank yo'qligini tekshirish; blur darajasini me'yorlash.

## Eslatmalar / xavflar
- **backdrop-blur unumdorligi** — CEP (Chromium). Ko'p element + katta blur AE'da sekinlashishi mumkin. Glass temalarda blur ~24-28px, faqat kerakli panellarda. Flat tema doim tez (zaxira variant).
- **Light Glass kontrasti** — yorug' fonда matn/aksent WCAG AA bo'lsin (lime'ni to'qroq qilish kerak bo'lishi mumkin).
- **Light Glass maketi** — alohida Claude Design maketi shart emas (layout bir xil); token qiymatlaridan chiqariladi. Xohlasangiz, ko'rish uchun alohida mockup ham generatsiya qilamiz.
- Mantiq (fetch, filtr, import, plan, nav) HECH QAYERDA buzilmaydi — bu re-skin.
