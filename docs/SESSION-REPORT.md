# SESSION REPORT — 2026-06-27 — Video tool: kadr manba + So'nggi grid tuzatish

## Topilgan xatolar (foydalanuvchi 2bf65a2 da sinab topdi)

1. **So'nggi grid rasm gen'larni "Video" deb ko'rsatardi:** `/gen/history` endpoint `?mode=` parametrini E'TIBORSIZ qoldirardi → barcha gen (rasm ham) qaytarardi.
2. **Project paneldan + Timeline'dan kadr ISHLAMAYDI:** vgScript `listProjectFootage()`/`exportTimelineFrame()` ni GLOBAL sync funksiya deb chaqirardi — aslida ular host.jsx funksiyalari, `hostCall(fn)` (csInterface.evalScript) orqali ASYNC chaqiriladi (igScript naqshi). Faqat "Fayl yuklash" ishlardi.

## Tuzatildi

1. **Backend** `studio-gen.ts` `/gen/history`: `?mode=video` filtri qo'shildi (GEN_MODES validatsiya, Prisma `where.mode`).
2. **Frontend filtr:** `loadVgRecent` — `g.mode==='video'` + URL `.mp4|webm|mov|m4v` tekshiruvi (server eski bo'lsa ham himoya).
3. **`hostCall` helper** vgScript'ga qo'shildi; `pickProjFrame` → `hostCall('listProjectFootage')` (`items[].mediaPath/mediaType`), `pickTlFrame` → `hostCall('exportTimelineFrame')` (`r.path`). `readDataUrl` bilan o'qiydi.
4. **Video thumbnail:** poster yo'q video → `<video preload=metadata>` birinchi kadri (CSS background videoni render qilmaydi).

## Tekshiruv (brauzer harness — vidgen-test.html)

vgScript syntax TOZA (32492 b). API `tsc` 0 xato. Harness: kadr quti click → manba sheet ✓; So'nggi grid faqat 2 video (rasm filtrlandi) ✓; video thumbnaillar ✓; lightbox video player + AE import/Yuklab ✓.

## KUTILMOQDA

Render API redeploy (`/gen/history?mode` filtri) + AE'da install-cep.sh → Project/Timeline kadr end-to-end.
