# Session report — 2026-08-03 (Premiere UXP: 1:1 parity + paketlash + `pr` reliz kanali)
- **1:1 parity YOPILDI**: `QASweep` 19/19 ekran, tor (440×900) va keng (900×1000) rejimda
  `QABad()` bo'sh. Oxirgi farq — `::after` psevdosi zichlik (kc6) gap'ini olmasdi;
  `ae-port.mjs` da `setSelfGap()` bilan UMUMIY tuzatildi (per-ekran hack yo'q).
- TUZOQ (harness): `__QAPFX` iframe reload'da yo'qolardi → tor o'lchov keng imzo bilan
  solishtirilib o'nlab soxta farq berardi. `QAPfx()` endi `sessionStorage` da saqlaydi.
  Iframe o'lchami imzo olingandagi bilan AYNAN bir xil bo'lishi shart (keng = 900×1000).
- `build-ccx.mjs`: fayl ro'yxati `manifest.main` dan REKURSIV hisoblanadi (qo'l allowlist yo'q),
  ZIP xom baytdan yoziladi. 52 fayl · 738.4 KB. Marketplace flavor faqat `FF_PR_MARKETPLACE_ID` bilan.
- `verify-ccx.mjs`: paket BAYTLARINI tekshiradi (secret, dev qoldiq, sourcemap, symlink,
  havola yaxlitligi, `network.domains`). `localhost` uchrashlari `LOCAL_OK` da SANOQ bilan
  qulflangan — manba o'zgarsa tekshiruv yiqiladi. Natija: toza.
- `plugins/premiere-uxp/README.md` — port / dev-install / build / QA oqimi.
- Backend `pr` kanali: migratsiya `20260803090000_plugin_release_host` LOKAL DB ga qo'llandi,
  `apps/api` tsc toza; admin **Releases** ga host tanlagich (AE `.pkg`/`.exe`, PR bitta `.ccx`
  ikkala platformaga), tarix host bo'yicha filtrlanadi, `host` yo'q eski yozuv = `ae`.
- KUTILMOQDA: Premiere'da jonli tekshiruv (panel + `.mogrt` import, FAZA 3) ·
  migratsiya PROD ga (deploy'dan OLDIN) · `catalog?app=pr` production'da 0 element (launch to'sig'i).
