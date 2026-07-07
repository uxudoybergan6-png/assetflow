# Session report — 2026-07-07

**Vazifa:** FAZA C — web app Home boyitish MOCKUP (jonli app TEGILMADI).

**Qilindi:** `packages/assetflow-studio/platform/_home-enrich-mockup.html` (commit c3baef1) —
FAZA B board naqshi/tokenlari bilan 3 frame:
- **C1** desktop 1280 — to'liq boyitilgan Home: mavjud hero/kredit/quick-actions/Jump-back-in
  saqlangan + Featured models (Variant A: spotlight "Model of the week" + 2×2 rail) +
  boyroq kartalar (hover reveal, NEW/PRO/4K badge, kategoriya+downloads meta) +
  3 kolleksiya shelfi (Trending / Lower Thirds / New this week, fade+arrow).
- **C2** — Featured models Variant B: bir xil 5 karta shelf (nom+tavsif+narx+Try).
- **C3** mobil 390 — hammasi gorizontal strip, model kartasi 172px, quick-actions olib tashlangan.
Model nom/narxlari real (gen-models): Kling v3.0 ✦35, Nano Banana Pro ✦8, Veo 3.1 Fast ✦20,
Kokoro ✦8, SFX ✦3. prefers-reduced-motion hurmat qilinadi. Preview'da tekshirildi (0 console xato).

**Kutilmoqda:** foydalanuvchi Featured models uchun A yoki B tanlaydi → keyingi task real build
(FFAPI.models + katalog so'rovlari + AI Studio deep-link).
