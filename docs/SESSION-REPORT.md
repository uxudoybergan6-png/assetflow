# Sessiya hisoboti — 2026-07-31 (BATCH 11 — HUQUQ / OMMAVIY DA'VOLAR)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md`, 8-bosqich. **Bajarildi 6/10** (4 tasi egasi qaroriga
bog'liq — §2: #38, #118, #121, #156 boshlanmadi). Yangi migratsiya YO'Q.

- **#119** — 4 ta huquqiy + help sahifasining OCHIQ HTML manbasidagi 8 ta "needs lawyer review" /
  LEGAL-TODO izohi olindi (ular mijoz brauzeriga yetkazilardi = nizoda mijoz foydasiga dalil);
  matni yo'qolmasin uchun `docs/LEGAL-TODO.md` ga sahifa-ba-sahifa jadval sifatida ko'chirildi.
- **#120** — `help.html` 4K importni Pro imtiyozi deb yozardi; gate allaqachon olib tashlangan →
  matn haqiqatga moslandi (to'liq kutubxona, har qanday o'lchamda; Free faqat SONI bilan cheklangan).
- **#117** — landing'dagi 4 ta AI narxi hech bir modelga mos emasdi; SFX **3** deb e'lon qilinib
  **4** olinardi (mijozdan ko'proq). `gen-models.ts` yoqilgan modellaridan hisoblandi: rasm
  `from 2`, video `from 3 credits/sec`, ovoz/SFX `from 4`. Server CMS + klient fallback sinxron.
- **#116** — `verify-public-copy.mjs` endi `terms/privacy/refund/dmca/help` ni ham skanerlaydi,
  #119 izohlarining qaytishini va #117 narxlarining `gen-models` bilan mosligini qadaydi
  (136 tekshiruv ✓). Yangi `npm run test:public-copy` + CI'da "Build API" dan KEYIN.
- **#122** — server chegarasi bor (#82), lekin plagin har xatoni "Failed to create project" derdi →
  endi server sababi (`PROJECT_LIMIT`) ko'rsatiladi. **AE testi kutilmoqda.**
- **#157** — 6 ta ochiq sahifaga `description` + canonical + OG/Twitter teglari; CF Pages build
  endi `robots.txt` (shaxsiy ekranlar Disallow) va `sitemap.xml` (9 ochiq yo'l) chiqaradi.
  `og:image` ATAYLAB yo'q — brend rasm asseti hali yo'q (**egasidan kerak**).

**Testlar:** `test:public-copy` 136/136 ✓ · `test:plugin-package` 59 ✓ · `test:plugin-responsive` ✓ ·
`npm run build -w apps/api` ✓ · CF Pages build ✓ · plagin inline-skript sintaksisi baseline bilan bir xil.

⚠️ **Migratsiya kutilmoqda** (oldingi batchlardan, prod'ga QO'LLANMAGAN, 8 ta — `20260730160000…20260730240000`).
