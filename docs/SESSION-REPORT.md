# Session report — 2026-08-03 (Premiere UXP: panel Premiere'da JONLI ishladi)

- **Panel butunlay stilsiz chiqardi** (xom matn, "No connection" strip'i, `__AF_BUILD__`).
  Sabab: **UXP nisbiy yo'lni plagin ILDIZIDAN yechadi**, hujjat papkasidan emas.
  `ported/index.html` da `href="ae.css"` → `/ae.css` (yo'q), `../js/…` esa ildizdan
  tashqariga chiqardi → CSS ham, 31 ta skript ham 404. Brauzerda hammasi to'g'ri edi.
  **Tuzatildi:** kirish nuqtasi ildizga — `panel.html`, barcha yo'l ildizdan
  (`js/…`, `ported/…`). `manifest.main` yangilandi, `ported/index.html` o'chiriladi.
- **UXP `border-radius` ni KLAMPLAMAYDI** (spec §5.5 talab qiladi). `999px`/`var(--r-full)`
  bergan 161 klass Premiere'da "linza" bo'lib chiqardi — kirish ekranidagi Sign in /
  Continue with Google tugmalari panel bo'ylab oq yoy edi. To'g'ri qiymat `min(w,h)/2`
  faqat ish vaqtida ma'lum → port `__AF_PILLC` yig'adi, `js/ae-shim/pill-radius.js`
  klamplaydi. CSS qiymati TEGILMADI (brauzer QA etaloni buzilmasin).
- `__AF_BUILD__` shtampi: `install-uxp-dev.mjs` (dev-<ver>-<sana>) va `build-ccx.mjs`
  (`<ver>-<flavor>` — determinizm saqlanadi) uradi. AE `install-cep.sh` bilan bir xil.
- **Jonli tasdiqlandi** (Premiere Pro 2026, FF-UXP-Spike): panel to'liq stilli,
  shriftlar, kartalar, pill tugmalar AE bilan bir xil. `.ccx` 53 fayl · 740.9 KB · toza.
- SABOQ: QA imzosi faqat GEOMETRIYA (x,y,w,h) — radius/rang/soya farqini KO'RMAYDI.
  README §5 ga yozildi: reliz oldidan panel jonli ko'zdan kechiriladi.
- KUTILMOQDA: `.mogrt` import end-to-end — kirish (parol) + `catalog?app=pr` prod'da
  0 element kerak · migratsiya `20260803090000_plugin_release_host` PROD ga (deploy'dan OLDIN).
