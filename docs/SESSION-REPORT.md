# SESSION REPORT — 2026-06-26 — 2-model (GPT Image 2 t2i) + arxitektura umumlashtirish

Audit "3 to'siq"i yechildi: model picker + generic fal + provider routing. Kredit/refund/atomik guard, @imgN, vision enhance — BUZILMADI.

1. **gen-models.ts:** yangi model `id:1103 openai/gpt-image-2` (provider fal, feature `text-to-image`, `referenceMode:"none"`+`refMode:"none"`, maxRefs 0, qualityCost low3/med6/high12). Mavjud `1102 .../edit` (required) qoldi. MUHIM: `referenceMode:"none"` (aks holда getReferenceMode image-default='image-edit' referens talab qilardi).
2. **fal.ts:** `falImageEdit` → GENERIC `falImage(modelKey, prompt, {imageUrls?,aspect,quality})`. imageUrls bo'sh → t2i (`openai/gpt-image-2`, image_urls yo'q, @imgN mapping yo'q); imageUrls bor → edit (`.../edit`, image_urls + @imgN→"image N"). Submit/poll/R2/timeout-sentinel o'zgarmadi.
3. **gen-processor.ts:** image blok `falNeedsRef = useFal && refMode!=='none'` — edit referens materialize qiladi (talab), t2i o'tkazib yuboradi (falImageUrls=[]). genOne → `falImage(...)`. Atomik consume/refund guard (audit fix) saqlandi.
4. **PLAGIN model picker (model-aware):** `meta.models` /gen/models'дан (provider==='fal' filtr) → 2 model dinamik sheet (`renderModelSheet`/`setModel`). t2i tanlanса: ＋Referens/ogohlantirish/refMeta YASHIRIN, @dropdown o'chiq (`checkMention` refMode none guard), Yaratish faqat prompt bilan, refs tozalanadi. edit: referens majburiy. ✨ Yaxshilash: ref bor→vision, yo'q→text (mavjud).

## TEKSHIRUV
- `npm run build -w apps/api` TOZA · plagin 6 `<script>` blok 0 xato.
- Headless (preview, screenshot): picker 2 model (Edit=majburiy✓ / t2i=referenssiz); t2i → /gen `modelId:1103` REFERENSSIZ (referenceUrls bo'sh) → natija; edit → `modelId:1102` referenceUrls YUBORILADI (regressiyasiz); model almashganда UI model-aware (t2i ref yashirin, @dropdown yo'q, Yaratish prompt-only).
- Kredit/refund/atomik guard tegilmadi. KUTILMOQDA: backend PUSH (Render, FAL_KEY) → AE'da t2i real sinash.
