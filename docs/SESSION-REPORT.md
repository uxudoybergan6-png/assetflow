# SESSION-REPORT — Boy landing port, Variant B (2026-07-05)

**Nima qilindi:** `platform/_landing-rich-mockup.html` dagi **Variant B «Kinematik sahna»** jonli `platform/index.html` landing'iga to'liq port qilindi (CF Pages manbasi ekani `prepare-cf-pages.mjs` orqali tasdiqlandi):
1. **Hero B** — aurora/mesh fon + dot-grid, 6 suzuvchi karta (parallax, bittasi "AI generatsiya… VIDEO · 62%" holatida), markaziy vignette, d64 gradient sarlavha, cta-glow, pastda uzluksiz shablon-marquee.
2. **Barcha bo'limlar B estetikasida** (ffl- scoped CSS): stats count-up (mavjud `runStats/statP` dvigateliga ulandi), showcase 2 qatorli marquee (cattab filtri REAL ishlaydi — 1-qator faol kategoriya), AI Studio tilt/glow kartalari + yozilayotgan prompt bandi, plagin 3D panel (syncline), narx tizeri lime-glow Pro, FAQ akkordeon (max-height animatsiya), CTA band (nafas oluvchi glow), footer o'zgarmagan.
3. **JS** — `installLanding()` (parallax/typing/tilt, idempotent, lifecycle'ga ulangan); `_rvSafety` endi `data-stats` ni ham trigger qiladi.

**Saqlangan bindinglar:** goRegister/goTemplates/goPricing/goPlugin/goLogin, onCat/catTabs, carousel ma'lumotlari (marquee tcard → openDetail modal), studioCards/onTryTool, plansView/onChoosePlan, faqsView/onFaq, marketing nav (frost + drawer), footer. App ekranlari/Pricing/Plugin sahifalari va ff-api.js TEGILMADI. Fontlar self-hosted, yangi CDN yo'q.

**Tekshirildi:** 1280 to'liq sahifa + 390 mobil (gorizontal overflow YO'Q, docW=390), count-up/typing/marquee jonli, cattab filtri marquee'ni yangilaydi, FAQ toggle, detail modal, #auth routing, reduced-motion'da barcha harakat o'chib to'liq qiymatlar darhol chiqadi. Konsolda yangi xato yo'q (detail.author warning — eskidan mavjud).

**Kutilmoqda:** push foydalanuvchi tomonidan (CF Pages deploy shundan keyin).
