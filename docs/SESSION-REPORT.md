# SESSION REPORT — 2026-06-26 — Seedream V4.5 Edit + quality-yo'q imgSettings

Jami 5 fal model: gpt-edit/1102, gpt-t2i/1103, nano-edit/1104, nano-t2i/1105, seedream-edit/1106.

1. **gen-models.ts:** `imgSettings.quality` opsional qilindi (TypeScript `quality?:`). Seedream V4.5 Edit (id:1106): image-edit, refMode required, cost:4, num:[1-6], imgSettings.aspect image_size (Auto 2K→auto_2K, Auto 4K→auto_4K, ratio→fal enum), quality YO'Q. `imageUnitCost` o'zgarmadi — quality yo'q → model.cost fallback (4).
2. **fal.ts:** `hasQuality = !s || !!s.quality` — settings bor lekin quality yo'q model → quality/resolution param fal inputiga YUBORILMAYDI. gpt/nano regressiyasiz (quality mavjud → param yuboriladi).
3. **gen-processor.ts:** O'ZGARMADI. `falNeedsRef = refMode!=='none'` seedream uchun true (refs materializatsiya qilinadi). Cost gen.cost'dan (cost-quote → imageUnitCost → model.cost=4 × count).
4. **Plagin:** `meta.hasQuality=!!ql`, `meta.flatCost=m.cost`. `cost()` — hasQuality bo'lsa qcost[q]×n, bo'lmasa flatCost×n. `applyMeta` — `igQSeg.style.display=none` (quality yo'q model). Soni 1-6 pilllar.

## TEKSHIRUV (headless harness, 5 model)
- tsc TOZA. Plagin JS 0 xato.
- Seedream: 2-chip none, arVal:"Auto 2K", cost:✦4 (1ta), ✦12 (3ta). Ref+prompt → /gen: modelId:1106, aspectRatio:"Auto 2K", count:3, price:12, referenceUrls:[url]. quality:"high" params'da lekin fal.ts hasQuality=false → image_size+image_urls+prompt faqat.
- GPT regressiya: qSegDisplay:flex, qLabel:"Sifat", cost:✦12 — HOLDS.

## KUTILMOQDA
Backend PUSH (Render, FAL_KEY) → real sinash. fal endpoint: queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit.
