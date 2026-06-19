# SESSION REPORT — 2026-06-19 — G5.2: Video MOTION/TIMELINE real harakatga asoslansin

## Diagnostika
- `aiExtractFrames` kadrlarni davomiylik bo'ylab TENG taqsimlardi (`dur*(i+0.5)/n`) — bir joydan EMAS. ✓
- Lekin: (1) cap `Math.min(...,3)` → faqat 3 kadr; TIMELINE per-soniya breakdown 3 siyrak nuqtadan → interpolatsiya/gallyutsinatsiya. (2) Kadr VAQT belgilari yuborilmasdi → model timing'ni taxmin qilardi.

## Tuzatish (A yo'l — multi-frame + timestamp + grounding)
- **Frontend** `aiExtractFrames`: video → **8 kadr**, endpoint-inclusive teng oraliq (0%…100%, `i/(n-1)`, 0.03..0.98 klamp); `{frames,duration,times}` qaytaradi. `aiDescribeFrom` 8 kadr + `frameTimes` (o'ndan bir aniqlik) yuboradi; timeout 90→120s.
- **studio-gen.ts** `/gen/describe`: `images` max 3→**8**, yangi `frameTimes[]` (≤8) → `orImageToPrompt`.
- **openrouter.ts** `orImageToPrompt(..., frameTimes)`: video system promptga grounding — "kadrlar NON-consecutive, berilgan timestamp'larda olingan; MOTION/TIMELINE'ni FAQAT ketma-ket kadrlar orasidagi HAQIQIY o'zgarishga asosla, ko'rmagan harakatni o'ylab topma; o'xshash kadrlar → statik/minimal". User text har kadr timestamp'ini sanab beradi (`fmtTs` 00:SS.s).

## Path B qarori (to'g'ridan video) — RAD ETILDI (A'da qolindi)
- gemini-2.5-flash video input qo'llaydi (/endpoints in=video). LEKIN transport amaliy emas: base64 video 8mb JSON limitdan oshadi (10s klip ~5-50MB); R2 signed URL uchun butun videoni plugin→API→R2 yuklash og'ir/sekin + OpenRouter Gemini video content-part cheklovlari. 8 kadr+timestamp (~3MB) yengil, ishonchli, grounding bilan gallyutsinatsiyani oldini oladi. `materializeRefUrl` (R2 signed URL) naqshi kerak bo'lsa tayyor.

## Tekshirildi
- tsc toza. Plugin parse: 2 blok, 0 xato. Payload ~3.1MB < 8mb. CEP'ga ko'chirildi (AE qo'zg'atilmadi). Studio static UI tegmadi → studio:sync shart emas.

## Kutilmoqda
- Deploy (API → Render) + AE jonli test: video «Tasvirdan» → TIMELINE haqiqiy harakat (statik klip → "minimal motion").
