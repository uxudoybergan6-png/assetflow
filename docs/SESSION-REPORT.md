# SESSION REPORT — 2026-06-15 — Contributor upload "aloqa uzildi" + SFX-B davom

## Contributor upload xatosi (tuzatildi)
- Shikoyat: shablon yuklashda "Server bilan aloqa uzildi".
- Diagnoz: API SOG'LOM (prod create-template 0.8s, HTTP 400=validatsiya, tarmoq emas).
  Sabab vaqtinchalik — Render free-tarif COLD START (uyqudan uyg'onish) yoki deploy-restart
  birinchi fetch'ni uzdi. Xato fetch-throw (1-bosqich: shablon yozuvi), fayl yuklashda emas.
- Tuzatish: **studio-api.js request() — tarmoq xatosida 3 marta retry** (1.5s/3s backoff).
  Cold-start'дан avtomatik tiklanadi. POST takrori xavfsiz (network-throw=server qayta ishlamadi;
  upload UP_EDIT_ID bilan dublikatsiz). studio:sync bajarildi.

## SFX-B (timeline → SFX) — bosqichlar holati
- B1 ✅: readTimelineForSfx (render'siz timeline o'qish — 1 layer/0 marker/10s tasdiqlandi).
- B2a: sampleFramesForSfx (saveFrameToPng — render'siz kadr namunasi) — test tugmasi pill qilindi.
  ⏱ "Timeline o'qish (B1 test)" → layer+marker+kadr hisoboti. AE test kutilmoqda.

## Tekshirildi
- studio-api.js node --check OK; install-cep (SFX-B); inline JS 0 xato.

## Holat
Studio fix: commit+push → CF Pages auto-build. SFX-B AE'да davom etadi (kadr to'g'riligini tekshirish).
