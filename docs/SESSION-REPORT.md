# SESSION REPORT — 2026-06-15 — Rasm sozlamalari NATIVE (image_config) + count ✅

Reja: rasm aspect/quality backend'da haqiqatan qo'llanishi. OpenRouter docs: image_config NATIVE.

## Backend
- **openrouter.ts orImage/orImageEdit**: yangi `image_config` param →
  body.image_config={aspect_ratio,image_size} (faqat berilsa). Promptga QO'SHILMAYDI.
- **gen-models.ts**: IMG_QUALITY → ["1K","2K","4K"] (512px olib tashlandi); resolveImageCount();
  computeGenCost rasm = cost × count (video = cost/s × duration).
- **gen-processor.ts**: image branch image_config quradi (aspectRatio→aspect_ratio,
  quality→image_size) + count marta loop, har biri alohida GenAsset. Bittasi xato →
  butun batch fail + to'liq refund.

## Plugin
- aiRenderImages(): N rasm grid (.multi 2-ustun), har biriga "AE'ga import" (aiImportIdx).
- aiImportResult → aiImportMedia(url,kind,ext) refaktor (rasm/video/audio umumiy).
- aiRunStudioGen: rasm → barcha asset'lar grid; video/ovoz → birinchisi.

## Tekshirildi
- tsc -p apps/api EXIT 0 ✅; inline JS node --check (0 xato) ✅; install-cep ✅
- Jonli test (Nano Banana 2, 9:16, 2K, 2 rasm → 2 vertikal) — DEPLOY'dan keyin.

## Holat
Commit + push → deploy → jonli image_config testi (2 vertikal rasm).
