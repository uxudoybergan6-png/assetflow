# SESSION-REPORT — SC_32 Plugin CMS to'liq zanjir (2026-07-18)

**Vazifa:** "Plugin CMS ishlamayapti" — editor→save→media→public→plugin apply→reset zanjiri diagnostikasi.

- KOD (tuzatildi): (1) editor media preview URL ochilmasa xom buzilgan <img> — endi "MEDIA
  UNREACHABLE" fallback (pcMediaErr, admin-plugin-cms.js); (2) plagin CMS refresh throttle
  300000ms >= interval 300000ms → har ikkinchi tick skip (~10 daq) — endi 270000ms (~5 daq real).
- DEPLOY (EGA QADAMI, kod to'g'ri): prod CDN worker ESKI — cdn.getframeflow.app site/plugin/*
  (va landing/*) ga 403; isPublicReadKey kodda TO'G'RI (SC_02 c4d1c05). Owner skrinshotidagi
  buzilgan preview shu. Ega: `cd workers/cdn-proxy && npx wrangler deploy`.
- ENV: lokal R2 bucket CORS localhost PUT'ni bloklaydi (curl 200, brauzer "Failed to fetch") —
  editor toast bilan ko'rsatadi; bucket CORS sozlash ega qadami.
- Tekshirildi (ishlaydi): admin GET/PUT/audit, zod rad → ko'rinadigan toast, mock-storage toast,
  public GET (60s kesh), plagin boot pickup + guest \n, media-first 404 → graceful degrade,
  Reset → built-in copy. Pul-zonasi TEGILMAGAN.
- QA: node --check 7/7 + cms js, studio:sync, install-cep.sh OK (com.frameflow verify mos).
