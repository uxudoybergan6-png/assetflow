# Plagin redesign — FAZA 0 (texnik spike) — YAKUN

> Savol: yangi dizayn (`design-preview/New Design/Design prompt plugin/FrameFlow Redesign.dc.html`) plaginga qanday ko'chiriladi — **dc-runtime/React** bilanmi (platforma qilgani kabi) yoki **vanilla HTML/CSS ekstraksiya** bilanmi?
>
> **QAROR: Strategiya B — vanilla ekstraksiya. dc-runtime plagin uchun RAD ETILDI.** (Bu render muammosi emas — arxitektura qarori.)

## Dalillar

### 1. CEF/Chromium bazasi yetarli
- Manifest: `CSXS 11.0`, `AEFT [18.0,99.9]`. O'rnatilgan: **AE 2025** (CEP 11 = Chromium 88) + **AE 2026** (CEP 12 = Chromium 90+).
- Ikkalasi ham React/zamonaviy CSS uchun yetarli.

### 2. Dizayn CEF 88 dan tashqari HECH NARSA ishlatmaydi (CSS audit)
Yangi dizayn faqat: `backdrop-filter` (11×), `aspect-ratio` (9×), `inset`, `gap` (234×), `grid-template` (8×), radial-gradient dotted grid.
**Yo'q:** `color-mix`, `:has()`, container queries, `clamp/min/max`, `:is/:where`, `of S` selektori — ya'ni Chromium 88+ hech qanday risk yo'q.

### 3. Jonli dalil — joriy plagin ALLAQACHON shu CSS + shu tokenlarni CEF'da ishlatadi
- `AssetFlow_Plugin.html`: `backdrop-filter` 14×, `aspect-ratio` 14× — bugun CEF'da render bo'ladi.
- `.axhome` (2809-qator) allaqachon **aynan yangi dizayn tokenlarini** ishlatadi: `--acc:#C2F04A`, `--txt:#F2F5F8`, `--mut:#8A93A3`, `--blue:#7CC4FF`, `--acc-ink:#0E1400`, `#06080B`, Hanken Grotesk, IBM Plex Mono. Yangi dizayn CEF'ga hech qanday yangi narsa kiritmaydi.

### 4. Render dalili
Dizaynning eng xavfli qismi (frosted composer `backdrop-filter:blur(44px)` + dotted grid + breathing lime glow + Phosphor ikonlar + ikkala shrift) vanilla HTML/CSS'ga ajratilib, real Chromium'da **1:1 render bo'ldi** (spike: `scratchpad/faza0-spike/index.html`).

## Nega dc-runtime plagin uchun NOTO'G'RI (arxitektura, render emas)
1. `support.js`/`dc-runtime.js` (60KB, bir xil fayl) `window.React`+`window.ReactDOM` talab qiladi VA runtime'da Babel'ni unpkg CDN'dan yuklaydi (`@babel/standalone`, 1048-qator) — eski CEF'ga React 18 + runtime Babel + CDN bog'liqligini qo'shish mo'rt va sekinroq.
2. **Hal qiluvchi:** dc-runtime — React freymvorki. Uni qabul qilish plaginning **12,387 qatorli ishlayotgan vanilla JS**'ini — jumladan pul-kritik kredit/refund logikasini (`consumeAiCredits`, `guardDownloadable`, `hostCall`) — React komponentlarga qayta yozishni majbur qiladi. Reja buni ANIQ taqiqlaydi.
3. Platforma dc-runtime ishlatadi, chunki u dizayn-canvas'dan **tug'ilgan** (birinchi kundan port, legacy logika yo'q). Plaginda chuqur legacy logika bor — teskari holat.

## Strategiya B — qanday ishlaydi
- `.dc.html` dizayn = **vizual spetsifikatsiya**. Uning HTML/CSS'i (token + komponent + ekran layout) mavjud vanilla plaginga ajratib olinadi.
- `sc-for` (22×) va `{{ }}` (154×) data-loop'lari plagin allaqachon qiladigan JS-generatsiya DOM'ga 1:1 mos keladi (masalan `.recentgrid` karta rendering).

## Spike'da topilgan MUHIM saboq
- **`.ph` / `ph-*` klass nomlaridan qoching** (icon bo'lmagan elementlar uchun) — Phosphor CSS'i ularni egallab, matnni icon glifiga aylantiradi. Yangi klasslarni namespace qil (masalan `ff-*`).
- Shrift/ikon: joriy plagin CDN'dan yuklaydi. Kelajakda self-host qilish (platforma `assets/fonts` qilgani kabi) unpkg/Google runtime bog'liqligini yo'qotadi — yaxshi, lekin bloklovchi emas.

## Keyingi qadam
Faza 1 (component library) — tokenlar + global komponentlarni (`f1`-`f4`) vanilla CSS modul sifatida chiqarib, joriy `.axhome`/`.axroot` bilan birlashtirish. Spike fayli (`scratchpad/faza0-spike/index.html`) shu ishning urug'i.

*Yaratildi: 2026-07-03 · Faza 0 bir urinishda yakunlandi (Opus).*
