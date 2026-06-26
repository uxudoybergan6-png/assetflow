# SESSION REPORT — 2026-06-26 — Nano Banana 2 (t2i) + MODEL-AWARE arxitektura

Jami 4 fal model: gpt-image-2/edit (1102), gpt-image-2 (1103), nano-banana-2/edit (1104), nano-banana-2 (1105).

1. **gen-models.ts id:1105** — `fal-ai/nano-banana-2`, feature:`text-to-image`, refMode:`none`, maxRefs:0, imgSettings: nano naqshi (aspect_ratio+resolution, def 1K, cost 6/8/12/16). Barcha avvalgi modellar tegilmadi.
2. **fal.ts, gen-processor.ts** — O'ZGARMADI. `falImage` bo'sh `imageUrls` → t2i (image_urls yo'q). `falNeedsRef = useFal && refMode!=='none'` → nano t2i refsiz.
3. **Plagin picker** — avtomatik 4 model ko'rsatadi (provider==='fal' filtr). `setModel` imgSettings dan ars/quals/qcost/qLabel/qDefault o'qiydi.

## TEKSHIRUV (headless harness)
- tsc TOZA (npm run build -w apps/api).
- Picker: 4 model (GPT Image 2 Edit / GPT Image 2 / Nano Banana 2 Edit / Nano Banana 2).
- Nano Banana 2 tanlash → qLabel:"Resolution", qVal:"1K", cost ✦8, @mention yashirildi, igRefSect ref-children barchasi none.
- /gen POST: modelId:1105, referenceUrls:[], referenceUrl:null, quality:"1K", aspectRatio:"Auto" — image_urls yo'q.
- gpt modellari regressiyasiz (avvalgi sessiya tasdiqlaridan).

## KUTILMOQDA
- Backend PUSH (Render, FAL_KEY env) → AE'da real sinash.
- fal endpoint: queue.fal.run/fal-ai/nano-banana-2, params: aspect_ratio + resolution.
