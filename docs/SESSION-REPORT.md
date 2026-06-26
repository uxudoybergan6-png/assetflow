# SESSION REPORT — 2026-06-26 — Multi-gen parallel support

"Rasm yaratish" composerida bir vaqtda bir nechta gen qo'llab-quvvatlash.

1. **AssetFlow_Plugin.html:** Global `pollTimer/cancelled/polling/submitted` o'rniga `activeJobs[]` massivi + `jobSeq`. Har job: `{seq,jobId,prompt,label,jcost,ar,q,cancelled,submitted,pollTimer,progTimer,t0}`. `renderJobs()` `igProg`ni dinamik qayta quради. `genClick()` job push → `refreshGen()` (button disabled faqat `activeJobs.length>=MAX_JOBS` bo'lsa) → async zanjir mustaqil. `cancelJob()` har job uchun alohida Bekor tugmasi. `teardownGen()` nav-away'da hamma jobni tozalaydi.
2. **igProg HTML:** `<!-- faol job qatorlari JS renderJobs() tomonidan... -->` static comment; jrowlar JS tomonidan.
3. **CSS:** `.jrow+.jrow` ajratuvchi chiziq qo'shildi.

## TEKSHIRUV (headless harness)

- Gen tugmasi bosib bo'lgach DARHOL qayta yonadi (composer bloklanmaydi) ✓
- 3 ta gen mustaqil yuborildi (har biri alohida cost-quote+poll+natija) ✓
- 3 ta natija igGrid'ga PREPEND qilindi; resMeta "3 ta" ✓
- MAX_JOBS=5: 5 faol jobda button disabled, 6-chi bloklanadi ✓
- Cancel: 1 jobni bekor → 4 qoladi → button qayta yonadi → kredit yechilmadi toast ✓

## KUTILMOQDA

Backend PUSH (Render) — fal.ai 7 model (1102-1108) uchun FAL_KEY env kerak.
