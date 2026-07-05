# Sessiya hisoboti — 2026-07-05

**Vazifa:** FrameFlow landing'ni boyroq/premium qilish — standalone maket (jonli index.html TEGILMAGAN).

**Qilindi:** `packages/assetflow-studio/platform/_landing-rich-mockup.html` — 2 hero variant + to'liq boy landing:
- **Variant A «Jonli studiya» (tavsiya):** katta media-hero — AI Studio jonli simulyatsiyasi (generatsiya sikli, video-play, o'zi yoziladigan prompt), aurora-mesh fon, 64px sarlavha, pog'onali kirish.
- **Variant B «Kinematik sahna»:** immersiv to'liq ekran — suzuvchi parallax kartalar, markaziy vignette, pastda marquee-lenta.
- To'liq landing (A asosida): count-up statistika, 2 qatorli marquee shablon-ko'rgazma (hover-play), tilt'li AI Studio kartalari, plagin 3D-panel (jonli sync), glow'li narx tizeri, akkordeon FAQ, nafas oluvchi CTA band.
- Brend tokenlar/shriftlar 1:1 (tokens.css: #06080B / #13161C / #C2F04A, Hanken Grotesk + IBM Plex Mono); prefers-reduced-motion hurmat qilinadi.

**Tekshirildi:** headless Chrome skrinshotlar 1280 va 390 px — konsol xatosiz; mobil overflow (plans grid) tuzatildi. Eslatma: headless Chrome min oyna eni ~500px → 390 uchun iframe-wrapper texnikasi.

**Kutilmoqda:** foydalanuvchi hero variantini tanlaydi → tanlangan variant jonli `index.html` ga port qilinadi.
