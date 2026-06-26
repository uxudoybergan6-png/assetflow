# SESSION REPORT — 2026-06-26 — Nano Banana 2 Edit + MODEL-AWARE sozlama arxitekturasi

Har model sozlama param NOMLARI/variantlari/narxini O'ZI e'lon qiladi (imgSettings deskriptor) → UI+fal+cost shundan. Mavjud 3 model regressiyasiz, kredit/refund/atomik guard buzilmadi.

1. **gen-models.ts:** `GenModel.imgSettings` deskriptori — `aspect{param,options,map,def}` + `quality{label,param,options,def,cost}` + `num`. Yangi model `id:1104 fal-ai/nano-banana-2/edit` (provider fal, image-edit, refMode required): aspect param `aspect_ratio` (Auto→auto, ratio'lar o'zi), quality `resolution` [0.5K/1K/2K/4K] def 1K cost 6/8/12/16. gpt-2 edit+t2i: aspect `image_size` (square_hd/...), quality `quality` (low/med/high). `imageUnitCost` endi `imgSettings.quality.cost`dan (flat qualityCost fallback).
2. **fal.ts:** `falImage` MODEL-AWARE — input param nomlari `opts.settings`dan: aspectParam+map, qualityParam+value, num_images, output_format, image_urls (refs bo'lsa, @imgN→"image N"). settings yo'q → eski xulq (AR_TO_SIZE/quality). Submit/poll/R2/timeout o'zgarmadi.
3. **gen-processor.ts:** `genOne → falImage(..., {settings:model.imgSettings})`. `falNeedsRef` refMode'дан (t2i refsiz, edit/nano referens). Atomik consume/refund guard SAQLANDI.
4. **PLAGIN:** `setModel` `imgSettings`dan ars/quals/qcost/qLabel/qDefault/aspDef/counts o'qiydi; `applyMeta` 2-chip LABEL'ini model'dan (`#igQLab`: gpt→"Sifat", nano→"Resolution"). Picker /gen/models provider=fal (3 model). refMode/@dropdown/✨enhance model-aware (mavjud).

## TEKSHIRUV
- `npm run build -w apps/api` TOZA · plagin 6 `<script>` blok 0 xato.
- Headless (screenshot): picker 3 model; **nano → chip "Resolution" [0.5K/1K/2K/4K], 4K→✦16, /gen modelId:1104 quality:'4K' referens bilan**; gpt edit/t2i → "Sifat" (low/med/high) regressiyasiz; cost model deskriptoridan.
- Kredit/refund/atomik/@imgN/vision/overlay tegilmadi. KUTILMOQDA: backend PUSH (Render, FAL_KEY) → AE'da nano real sinash.
