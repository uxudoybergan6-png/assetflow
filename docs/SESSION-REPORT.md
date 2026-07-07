# Sessiya hisoboti — 2026-07-07 · PHASE B build 1/2: AI Studio workspace port

**Qilindi:** Tasdiqlangan mockup (frames A–F) jonli platformaga port qilindi — commit `2c1b524`,
faqat `platform/index.html` (+550/−63). Ikki panel workspace (sessiya rail + Visuals|Audio toggle),
Sparky pending (tile/audio-row/rail-mini, % 93 da to'xtaydi), Use ▾ menyu (Edit image /
Generate video from image = SOON placeholder + toast; Download/Regenerate/Delete mavjud
handlerlarda), model quick-pick (tavsif+narx) + to'liq modal (qidiruv/filter/guruhlar, bitta
`pickModel`), dock evolyutsiyasi (reference slot vizual, COST, balans strip, off/pending CTA),
bo'sh holat hero + suggestion chiplar, mobil 390 (strip, 2 ustun grid, sheet-menyu).

**Tekshirildi:** headless Chrome + mock API (:4000, fake sessiya) 1280/390px — freymlar mockupga
mos, voice+image gen end-to-end o'tdi, konsol xatosiz, overflow yo'q, boshqa ekranlar buzilmagan.

**Pul zonasi:** `generate`/`buildParams`/`estCost`/`pollJob` HEAD bilan bayt-ma-bayt BIR XIL
(diff tasdiqlagan). Gen so'roviga reference param QO'SHILMAGAN.

**Kutilmoqda:** Step 2/2 — Use ▾ ikki amalini real ulash (ref handoff); push foydalanuvchidan.
