# SESSION REPORT — 2026-06-26 — Seedream V5 Lite (t2i + edit)

Jami 9 fal model (1102-1110). Yangi: Seedream V5 Lite t2i (id:1109) + Seedream V5 Lite Edit (id:1110).

1. **gen-models.ts:** id:1109 — `fal-ai/bytedance/seedream/v5/lite/text-to-image`, refMode:none, maxRefs:0, cost:4. id:1110 — `fal-ai/bytedance/seedream/v5/lite/edit`, refMode:required, maxRefs:10, cost:4. Ikkalasida `imgSettings.aspect` = image_size (Auto 2K/3K/4K→auto_2K/3K/4K; 1:1→square_hd; 4:3/3:4/16:9/9:16→nisbat enumlar), def:"Auto 2K". `quality` YO'Q (tekis narx, 2-chip yashirin). `num:[1-6]`. `noNumParam` YO'Q (num_images=1 yuboriladi, gen-processor loop qiladi).
2. **fal.ts / gen-processor.ts:** O'ZGARMADI — generic `falImage` + imgSettings yo'li to'g'ridan to'g'ri ishlaydi.
3. **Plagin:** O'ZGARMADI — `/gen/models` dinamik, model picker avtomatik chiqaradi.

## TEKSHIRUV (9-model harness)

- tsc TOZA. Plagin JS 0 xato.
- V5 Lite t2i (1109): arVal:Auto 2K, 2-chip:none, Soni:1-6, ref:yashirin, POST modelId:1109 aspectRatio:"Auto 2K" count:3 referenceUrls:[], ✦12 yechildi (=4×3). ✓
- V5 Lite Edit (1110): 2-chip:none, ref:ko'rinadi+warn (majburiy), arVal:Auto 2K. ✓
- Regressiya GPT Image 2: qSeg ko'rinadi, ✦12, count 1-4. ✓

## KUTILMOQDA

Backend PUSH (Render) — FAL_KEY env kerak (fal-ai/bytedance/seedream/v5/lite/... endpointlar).
