# SESSION REPORT — 2026-07-13 · P1 #14b AI-gen suv belgisi (owner A varianti)

- Muammo: narx sahifasi Free="watermarked export"/Pro="watermark-free" va'da qilardi, lekin
  `hydrateGenAssets` HAMMAGA toza asl 4K faylni imzolar edi → FREE toza yuklab olardi (pul teshigi).
- Yechim: reja-asosli darvoza. Pullik → TOZA asl; FREE → SUV BELGILI nusxa. Server tomonda, klientda EMAS.
- Yangi: `GenAsset.watermarkKey` + migratsiya; `lib/gen-watermark.ts` (step-14 ffmpeg dvigatelini
  QAYTA ishlatadi — yangi quvur yo'q); `gen/<uid>/<id>-<ts>-wm.<ext>` (PRIVATE — isPublicReadKey false).
- gen-processor: rasm/audio/video uchun EAGER suv belgili nusxa (bir marta, keshlanadi).
- `hydrateGenAssets(opts.viewerIsPaid)` YAGONA darvoza; sessiya/`:jobId`/history/projects/admin
  hammasi shu orqali. Ledger thumb + session cover `resultKey` fallbacki OLIB TASHLANDI (leak yo'q).
- Ko'rsatish derivativlari (thumb/display/preview) toza qoladi (kichik — 4K bermaydi). Money-zone TEGILMADI.
- Isbot (lokal): isPublicReadKey 9/9 (toza+wm PRIVATE); haqiqiy ffmpeg rasm/video/audio suv belgili;
  haqiqiy `hydrateGenAssets` 18/18 (Free→wm, Pro→toza, eski qator→kichik display, toza asl HECH QACHON).
- Kutilmoqda: migrate:deploy + deploy + eski qatorlar uchun `backfill-gen-watermarks.js` + AE E2E test.
