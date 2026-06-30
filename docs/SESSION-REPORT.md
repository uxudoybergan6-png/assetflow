# SESSION REPORT — 2026-06-30 — Rasm tool ↔ Video tool parity + model wiring

3 parallel audit (model wiring · referens parity · funksiyalar/UX) → rasm tool video bilan teng qilindi.

**Model wiring (gen-models.ts):**
- 9 jonli fal rasm modeli (1102–1110) ✅ to'g'ri ulangan (audit tasdiqladi — charge-then-fail yo'q).
- **Magnific 1201–1206** `enabled:false` (magnificOnly, GEN_PROVIDER=magnific dormant → latent charge-then-fail yopildi; video B6 naqshi). tsc ✓.

**Rasm tool parity (AssetFlow_Plugin.html — node ✓):**
- **Ctrl+V paste** rasm → referens (video naqshi; addRef qayta ishlatildi).
- **Project paneldan checkbox multi-select** + "Qo'shish (N)" footer (avval bittadan edi).
- **Model almashda tasdiq** — referenssiz modelга o'tishda biriktirilgan refs yo'qotilishidan oldin confirm (H2).
- **Limitlar oldindan**: igRefMeta "N / max referens · majburiy".
- **Narx tooltip**: "✦/rasm × N = ✦total" (video kabi).
- **Neytral default'lar**: igMName "…", igCost "✦—" (GPT/✦12 sizmaydi).
- **Fayl multi**: bo'sh-slot qadar + bitta umumiy toast (spam emas).
- **Enhance**: safetyAdjusted xabari qo'shildi.

Qoldi (minor): video model-sheet ikonkasi rasm darajasiga (BRAND_SVG) — reverse parity; image job ETA hint; download fayl nomi. Kutilmoqda: push + AE qayta o'rnatish + jonli test.
