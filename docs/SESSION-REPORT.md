# Sessiya hisoboti — 2026-07-04

## Landing spacing kompakt (~30% vertikal)

**Vazifa:** `packages/assetflow-studio/platform/index.html` — faqat LANDING
(`isLanding`) ekranidagi vertikal bo'shliqlar ~30% qisqartirildi. Qiymatlar inline
(har seksiyada), shu bois tabiiy landing-scoped; Pricing/Plugin alohida inline.

**O'zgargan (vertikal only):**
- Hero: top `64→44`; headline margin `22→16`, subhead `18→14`, CTA `28→20`,
  "Karta shart emas" `14→10`, product-shot `44→28`.
- Seksiyalar: 01 `64→44`; 02/03/04 + FAQ `72→50`. Stats strip `26→18`.
  CTA band pastki margin `90→62`.
- Ichki margin: tabs `20→14`, showcase `22→16`, studio4 `26→18`, plans `28→20`,
  FAQ list `26→18`.

**O'zgarmadi:** shriftlar (hero 56px), gorizontal padding 80px, grid ustunlar,
kartalar, ranglar. Pricing (`56px 80px 72px`)/Plugin (`56px 80px 0`) TEGILMADI.
Mobile media query (32px) TEGILMADI.

**Tekshiruv:** desktop 1280px (hero+stats+showcase fold ichida), mobile 390px OK,
console xatosiz. Pricing/Plugin padding eski holicha tasdiqlandi.
