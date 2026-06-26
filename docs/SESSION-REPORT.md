# SESSION REPORT — 2026-06-26 — Flux 2 Pro t2i + edit

Jami 7 fal model (1102-1108). Yangi: Flux 2 Pro (id:1107, t2i, refMode none) + Flux 2 Pro Edit (id:1108, image-edit, refMode required, maxRefs 4).

1. **gen-models.ts:** `noNumParam?: boolean` va `outputFormat?: string` GenModel'ga qo'shildi. Flux t2i: image_size (1:1→square_hd / 4:3→landscape_4_3 / ... / Kvadrat→square), def:4:3, refMode none, cost 4, noNumParam true, outputFormat jpeg. Flux edit: image_size + Auto→auto, def:Auto, refMode required, maxRefs 4. Ikkalasida quality yo'q (2-chip yashirin).
2. **fal.ts:** `noNumParam` → `num_images` input'dan tushiriladi (Flux API qabul qilmaydi). `outputFormat` → `output_format` (default png). Imzo: `opts.noNumParam` va `opts.outputFormat`. gpt/nano/seedream regressiyasiz (noNumParam yo'q → num_images yuboriladi; outputFormat yo'q → png).
3. **gen-processor.ts:** `falImage(..., {noNumParam: model.noNumParam, outputFormat: model.outputFormat})` — 1 qator o'zgarish.
4. **Plagin:** O'ZGARMADI. hasQuality=false → 2-chip yashirin; refMode='none' → refAdd yashirin; setModel imgSettings.num → counts [1-4].

## TEKSHIRUV (7-model harness)
- tsc TOZA. Plagin JS 0 xato.
- Flux t2i (1107): qSeg none, arVal:4:3, cost:✦4, refAdd:none, POST modelId:1107 aspectRatio:4:3 referenceUrls:[]. image_size=landscape_4_3 (map), num_images YO'Q, output_format=jpeg (backend).
- Flux edit (1108): qSeg none, arVal:Auto, cost:✦4, refAdd:flex, POST modelId:1108 aspectRatio:Auto referenceUrls:[url]. image_size=auto (map), num_images YO'Q, image_urls=[url], jpeg.
- GPT regressiya: qSeg:flex, Sifat, ✦12 — HOLDS.

## KUTILMOQDA
Backend PUSH (Render, FAL_KEY). Flux endpoints: queue.fal.run/fal-ai/flux-2-pro va .../edit.
