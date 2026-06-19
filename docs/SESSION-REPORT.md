# SESSION REPORT — 2026-06-19 — G5.1: Tasvirdan prompt — STRUKTURALI kinematik format

## Bajarildi
- **openrouter.ts `orImageToPrompt(model, images, kind, durationSec)`** — `kind` bo'yicha strukturali system instruction:
  - **video** → STYLE / SCENE / SUBJECT / MOTION / CAMERA / TIMELINE (00:00→00:NN soniyalab breakdown) / ENDING FRAME / SOUND DESIGN. Faqat shu bo'limlar, ingliz tilida, izohsiz.
  - **image** → STYLE / SCENE / SUBJECT / COMPOSITION / LIGHTING / DETAILS (qisqaroq).
  - `fmtClock()` 00:SS/MM:SS; `durationSec` klamp 1..60 (default 10). `max_tokens` 400→**1200** (strukturali format uzun).
- **studio-gen.ts `/gen/describe`** — `durationSec` (optional, ≤600) qabul qiladi, `orImageToPrompt(VISION_MODEL, images, kind, durationSec)` ga uzatadi.
- **Plugin** — `aiExtractFrames` endi `{frames, duration}` qaytaradi (video duration). `aiDescribeFrom` video bo'lsa `durationSec=Math.round(duration)` yuboradi → TIMELINE video uzunligiga mos. `aiReferenceDataUri` ham yangi shaklga moslandi. UI o'zgarmadi (tugma/menyu o'sha).

## Tekshirildi
- tsc toza. Plugin parse: 2 blok, 0 xato. Ikkala `aiExtractFrames` chaqiruvi yangi `{frames,duration}` shakliga moslandi. CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.

## Kutilmoqda
- Deploy (API → Render) + AE jonli test: video «Tasvirdan» → strukturali TIMELINE prompt; rasm → STYLE/SCENE/.../DETAILS.
