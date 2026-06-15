# SESSION REPORT — 2026-06-15 — Studio Gen backend: to'liq katalog + kredit xavfsizligi ✅

Reja: docs/OPENROUTER-katalog-yakuniy.md + docs/STUDIO-GEN-composer-v2.md. UI EMAS — faqat backend.

## Kredit xavfsizligi (jonli tasdiqlangan)
- HAR 13 slug OpenRouter /models/<key>/endpoints bilan tekshirildi → hammasi JONLI (bo'sh emas).
- Video capabilities OpenRouter /api/v1/videos/models avtoritativ ro'yxatidan olindi.
- Model guard: studio-gen.ts cost-quote VA /gen → isModelEnabled() (noma'lum/o'chirilgan → 400,
  kredit YECHILMASIN; guard consumeAiCredits'dan OLDIN).
- Param gigiyenasi: resolveVideoParams() duration/resolution/aspect'ni model qo'llaganiga klamplaydi
  (yaroqsiz qiymat OpenRouter'ga yuborilmaydi). orImage modalities model'dan (Flux=["image"]).
- Refund: gen-processor fail() har xato yo'lida refundAiCredits (mavjud, saqlandi).

## Katalog (gen-models.ts) — capabilities metadata bilan
- Rasm 5: Nano Banana 2(def)/Pro, Seedream 4.5, Flux 2.0 Pro, Grok Imagine (+Gemini Edit).
- Video 7: Veo 3.1 Lite(def)/Fast/3.1, Kling v3.0/Pro, Seedance 2.0, Wan 2.6.
- Ovoz: Kokoro TTS. Narx: video cost = /s × duration (computeGenCost).

## Test
- tsc -p apps/api EXIT 0 ✅
- Pure-funksiya: klamp (veo 5s→6, 4K→1080p, 21:9→16:9) ✅; narx veo-lite 6s=60, kling 10s=120 ✅
- Jonli RASM (prod, Nano Banana 2 id1001) → ✅ DONE (R2 asset, narx 5).
- Jonli VIDEO veo-3.1-lite → KUTILMOQDA: yangi model prod'da yo'q; deploy yoki lokal kalit kerak.

## Holat
COMMIT QILINMADI. Video jonli testi uchun foydalanuvchi qarori kutilmoqda.
