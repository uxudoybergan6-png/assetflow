# SESSION REPORT — 2026-07-01 — 4 yangi Google rasm modeli qo'shildi (jami 5)

Foydalanuvchi 4 model havolasini yubordi. Ish tartibi bo'yicha har biri JONLI tahlil (region + param + real gen) qilinib model-aware UI bilan ulandi.

## Qo'shilgan modellar (hammasi JONLI ✅)
| Model | key | region | nisbat | sifat | referens | narx |
|---|---|---|---|---|---|---|
| Nano Banana 2 (default) | gemini-3.1-flash-image | global | 8 | 1K/2K/4K | 10 | 4/8/16 |
| Nano Banana 2 Lite | gemini-3.1-flash-lite-image | global | 8 | 1K | 10 | 2 |
| Nano Banana Pro | gemini-3-pro-image | global | 8 | 1K/2K/4K | 10 | 8/14/24 |
| Imagen 4 | imagen-4.0-generate-001 | us-central1 | 5 | 1K/2K | — (t2i) | 4/6 |
| Imagen 4 Ultra | imagen-4.0-ultra-generate-001 | us-central1 | 5 | 1K/2K | — (t2i) | 6/10 |

## Jonli sinovlar
- Lite: t2i+edit ✅, 2K=400 xato → FAQAT 1K (tez ~5s, ~200KB). Sifat selektori yo'q (tekis 2 kr).
- Pro: 2K (6.7MB/26s) ✅, 4K (20.5MB/58s) ✅ tasdiqlandi. Premium/sekin.
- Imagen 4 / Ultra: 16:9+2K ✅ (6.4/6.9MB). t2i only (referens UI yashirin). imageSize ishlaydi.
- E2e prod pipeline: Lite (narx 2), Imagen 4 (2K narx 6) ✅.

## Texnik
- Adapter (vertex-image.ts) o'zgarmadi — locationFor (gemini-3.x=global, imagen=us-central1) + imageSize allaqachon qo'llaydi.
- Model-aware: imgSettings.quality (Sifat selektori) faqat ko'p o'lchamli modellarda; Imagen referenceMode=none.
- Narxlar TAXMINIY (premium tierlar) — Google aniq narxi bilan keyin moslash mumkin.

## Foydalanuvchiga
- Plaginda Rasm tab qayta ochilsin → Model dropdownda 5 Google model. Har biri o'z UI'si bilan (Lite'da Sifat yo'q, Imagen'da referens yo'q).
