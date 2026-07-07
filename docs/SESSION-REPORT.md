# Sessiya hisoboti — 2026-07-07 · PHASE B mockup: AI Studio depth

**Vazifa:** AI Studio qayta dizayni uchun statik mockup (jonli kodga TEGILMADI).

**Qilindi:** `packages/assetflow-studio/platform/_aistudio-depth-mockup.html` (commit 9ae16f9).
6 zona: A) Visuals view + ochiq "Use ▾" menyu (Edit image / Generate video from image real,
Upscale/Variations = SOON disabled); B) Sparky maskot + 48% progress (indeterminate bar o'rniga);
C) Audio view (waveform ro'yxat, inline gen 32%) + model quick-pick popover; D) to'liq model
modal (qidiruv + capability guruhlar); E) bo'sh/birinchi holat; F) 390px mobil (rail →
gorizontal strip, Use = sheet-karta). Tokenlar index.html `.ff` blokidan 1:1; Phase-A til
(spend-grad CTA, pill-active, borderless kartalar) saqlangan.

**Preview'da topilib tuzatildi:** ax-g* gradientlarni keyingi background'lar yutgan
(`.frame .ax-g*` spetsifiklik); Use-menyu dock ustiga chiqqan (work 852px); quick-pick
popover model chipdan uzilgan (anchored); modal scrollbar qoraytirildi.

**Kutilmoqda:** foydalanuvchi tasdiqlashi → real port (index.html ffa-st-* evolyutsiyasi).
