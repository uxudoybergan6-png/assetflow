# Session report — 2026-08-02 (Premiere UXP: FAZA 2 + AE parity o'lchovi)
- FAZA 2 yopildi: karta/detal media **ko'rinmasligi** tuzatildi — UXP `<img>`/`<video>` intrinsic
  o'lchamni o'lchamaydi, `object-fit` yo'q → `sizeMedia()` ikkala o'lchovni `orient` dan beradi.
- Jonli tasdiq (Premiere 26.2.2): Motion tab 5 natija — rasm/preview ko'rinadi, detal video o'ynaydi.
- `js/diag-layout.js` qo'shildi: panel ichida **18 ta UXP probe** ("Diagnostika → UXP tekshiruvi").
- Ishlatilmagan spike plagini registrdan olib tashlandi (menyuda faqat bitta dev plagin chiqardi).
- PARITY ✅ ko'chadi: inline `<svg>` (285 ikona), `>` `+` `[attr]` `:not()` `:first-child`,
  `ellipsis`, `position`, scroll, `::before`, `@media`, runtime CSS var, gradient/soya;
  1200 tugun = `innerHTML` 45 ms · layout 0 ms → AE hajmi to'siq emas.
- PARITY ❌ transform shart: inline `onclick` bajarilmaydi (`new Function` shim mumkin),
  `transition` va `Element.animate` yo'q, `filter`/`backdrop-filter` yo'q,
  `-webkit-line-clamp` kesmaydi, `DOMParser`/`<template>` yo'q, `grid`/`gap` yo'q.
- TUZOQ: `getComputedStyle` native widget uchun dalil emas (bg qaytaradi, lekin chizmaydi).
- Hujjat: SPIKE-NATIJA §10 (FAZA 2 tuzoqlari) + §11 (AE→UXP parity jadvali).
- KUTILMOQDA: FAZA 3 import · 1:1 AE port transformi + host adapter · backend `app=pr` kanali.
- KUTILMOQDA (launch to'sig'i): `GET /api/plugin/catalog?app=pr` production'da 0 element.
