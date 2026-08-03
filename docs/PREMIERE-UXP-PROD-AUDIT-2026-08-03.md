# PREMIERE UXP — PRODUKT-ZANJIR AUDITI (2026-08-03)

> Maqsad: Premiere Pro plaginini **produkt holatiga** yetkazish uchun to'liq zanjirni
> baholash: Contributor → ingest → moderatsiya → katalog → panel → import (mogrt/prproj)
> → AI Tools → pul → reliz → ops. Metod: kod-tasdiqlangan + Premiere'da JONLI o'lchovlar.
> Ijro prompti: `docs/PREMIERE-UXP-PROD-SYSTEM-PROMPT.md` (shu audit asosida).
> Oldingi hujjatlar: `PREMIERE-UXP-AUDIT-2026-08-02.md` (qurish auditi),
> `PREMIERE-UXP-SPIKE-NATIJA.md` (empirik probe), `PREMIERE-UXP-SYSTEM-PROMPT.md` (qurish prompti).

> **2026-08-03 yakuniy kod yangilanishi:** ushbu auditdagi P0/P2/P3/P5 kod bo'shliqlari
> yopildi: repaint/indexedDB/dev-package guard, `.prproj importSequences`, `cep.fs`,
> app=pr updater/landing, crash-log, app kesimli analitika va state restore. Lokal CCX
> 65 fayl/783.9 KB va byte-verify PASS. Premiere 26.2.2 macOS'da save→quit→relaunch,
> docked panel render va boot diag `(xato yo'q)` bilan tasdiqlandi. Quyidagi matritsa
> boshlang'ich audit tarixidir;
> joriy darvozalar: production push/deploy, kamida bitta real `app=pr` kontent/release,
> login ortidagi import/AI smoke va Windows beta.

---

## 1. XULOSA (bitta jumla)

Plagin klienti 1:1 portlangan va Premiere'da jonli ishlaydi; zanjirning **haqiqiy
to'siqlari** — (a) productionda `app=pr` kontent **0 ta** (import zanjirini sinab bo'lmaydi),
(b) panelda 4 ta P0 nuqson (qora repaint, Google E2E, dev-probe'lar, guest-home overlap),
(c) AI Tools'da `window.cep.fs` shim'i yo'qligi sabab **referens yuklash o'lik**,
(d) `.prproj` import yo'li umuman qurilmagan, (e) `plugin_release_host` migratsiyasi
productionga qo'llanmagan.

## 2. ZANJIR HOLAT MATRITSASI

| # | Zveno | Holat | Dalil / izoh |
|---|-------|-------|--------------|
| 1 | Contributor upload (pr) | 🟡 | UI'da "Premiere Pro" varianti bor (`contributor-views.js:324`, exts `.mogrt/.zip`), lekin **`.prproj` UI ro'yxatida YO'Q** (server `apps.ts` esa `.mogrt/.prproj` kutadi); jonli pr upload hech qachon o'tkazilmagan |
| 2 | Ingest | 🟡 | `template-files.ts` pack ro'yxatida `.mogrt` bor; `ingest-zip.ts` ranged-streaming app-agnostik; `mogrt-extract.ts` sahna-ajratish AE-pack uchun yozilgan — **sof-pr pack (bitta .mogrt / .prproj+media zip) jonli o'tkazilmagan** |
| 3 | Moderatsiya (Admin) | 🟢 | App-agnostik; approve/reject/published oqimi ishlaydi (AE'da isbotlangan) |
| 4 | Katalog `?app=pr` | 🔴 | Server filtri + app-neytral turlar (`apps.ts` APP_NEUTRAL: LUT/musiqa/SFX) KODDA bor, lekin **production katalog 0 ta qaytaradi** — bu launch gate G1; migratsiya ham qo'llanmagan (№10) |
| 5 | Panel Browse | 🟢/🔴 | 1:1 port jonli (19/19 ekran, 0 geometrik farq); LEKIN P0 nuqsonlar: §3 |
| 6 | Auth | 🟡 | Email+parol jonli ✔; Google device-code: "Copy code/link" TUZATILDI (capture-stopPropagation ildiz sababi), **E2E brauzer tasdig'i kutilmoqda** (foydalanuvchi amali) |
| 7 | Import ko'prigi | 🟡 | `csinterface-shim.js` da 12 host-funksiya TAYYOR: `importTemplateProject`(→`insertMogrtFromPath`), `installMogrtToLibrary`, `importFootageBundle`, `importMediaFromPath`, `pickDownloadFolder`, `revealFileInOS`, `removeImportedTemplate`, `listProjectFootage`, `exportTimelineFrame`, `getActiveTimelineVideoReference`… — lekin kontent 0 bo'lgani uchun **birortasi ham real shablon bilan jonli o'tkazilmagan** |
| 8 | `.prproj` import | 🔴 | Ko'prikda YO'Q: `importTemplateProject` faqat mogrt yo'lini biladi; `Project.importSequences` bridge'lanmagan; prproj pack ochish/yo'naltirish oqimi yozilmagan |
| 9 | AI Tools | 🟡/🔴 | UI to'liq portlangan; backend app-agnostik (`/api/studio/gen` — tegilmaydi); kadr-eksport va footage-ro'yxat ko'prigi bor; **LEKIN `window.cep.fs.showOpenDialog/readFile` shim'lanmagan** (`AssetFlow_Plugin.html:12552` qattiq gate) → referens fayl yuklash "File upload only works inside After Effects" bilan o'lik; jonli smoke o'tkazilmagan |
| 10 | Pul zonasi | 🟢 | TEGILMAGAN (qoida); panel faqat mavjud endpointlarni chaqiradi; kredit/limit/watermark serverda |
| 11 | Reliz kanali | 🟡 | `.ccx` build+verify skriptlari ishlaydi; `plugin-release-contract.ts` da `pr` host (`ccx` mac+win) TAYYOR; **`20260803090000_plugin_release_host` migratsiyasi productionga QO'LLANMAGAN** — API deploy'dan OLDIN shart; landing'da yuklab olish yo'q; panelda versiya-tekshiruv UI ulanmagan |
| 12 | Ops | 🔴 | Panel crash/error hisobot yo'li yo'q (Sentry yo'q); `download-events` `app` o'lchovi bor lekin pr bilan jonli yozilmagan; admin analitikada pr kesimi tekshirilmagan |

## 3. PANEL P0 NUQSONLARI (jonli o'lchangan)

1. **Qora tana (repaint)** — hisob oynasini ochib fondan yopganda panel tanasi qop-qora
   qoladi. O'lchov: DOM SOG'LOM (`homeGuest: display=block 650×697 bolalar=7`,
   `accountSheet: display=none`, yangi xato 0) → bu **UXP qayta chizish nosozligi**,
   DOM emas. Davo yo'nalishi: yopishdan keyin majburiy reflow/repaint hiylasi.
   Foydalanuvchi skrinshotidagi asl shikoyat shu.
2. **Google E2E** — kod nusxalash ishlaydi (jonli: `612G-RNX6-CGDG-Z`), brauzer tasdig'i
   foydalanuvchi amali (parol kiritish taqiq) — tasdiqdan keyin token oqimini tekshirish.
3. **Dev-instrumentlar relizda qolmasin** — diag overlay (⚠/ERR/DOM/CLIP/CSS) + EVT
   T1/T2/T3 chiplar `isDev()` bilan gate'langan; reliz buildda chiqmasligini `verify-ccx`
   darajasida kafolatlash kerak.
4. **Guest-home "A PEEK AT THE CATALOG"** — matn ustma-ust (o'lchov: skrinshot).
5. **`indexedDB` yo'q** — AE `assetflow-local-store.js:75` va `disk-bridge.js:19` ishlatadi;
   har boot'da 1 xato-log + lokal kesh/handle saqlash o'chiq. Shim yoki halol no-op kerak.
6. **`uxp-copy-late.js` delegati** — endi zaxira (AE ishlovchisi ishlaydi); saqlash =
   himoya, olib tashlash = 1:1 ga yaqinroq. Qaror kerak (tavsiya: saqlash, izoh bilan).

## 4. FOYDALANUVCHI SO'RAMAGAN, LEKIN PRODUKT UCHUN SHART (to'liqlik ro'yxati)

- **Seed/start kontent**: katalog bo'sh panel = o'lik mahsulot. Kamida 10–20 sifatli
  `.mogrt` starter to'plami (G1 darvozasi) — kontent-operatsiya rejasi kerak.
- **Versiya-tekshiruv + yangilanish taklifi**: `GET /api/plugin/version?app=pr` panelda
  ko'rsatilishi, yangi versiyada "Update" CTA (AE naqshi).
- **Landing/veb**: `.ccx` yuklab olish sahifasi + o'rnatish qo'llanmasi (CCD double-click).
- **Windows**: yo'l ayirmalari (`\`), smoke-test; imkonsiz bo'lsa OCHIQ yozish.
- **Holat tiklash**: UXP panel unload bo'lishi mumkin — boot'da storage'dan tiklanadigan
  yagona state (qidiruv/filtr/scroll konteksti yo'qolmasin).
- **AE+PR parallel**: token/prefs kalitlari app-suffiksli — bir-birini logout qilmasin.
- **Adobe review talablari**: abandoned-login holati, `launchProcess` cheklovi,
  `fullAccess` sababi (EG papka) hujjatlashtirilgan bo'lishi.
- **Analitika**: `download-events`/plugin-analytics'da `app=pr` kesimi admin panelda ko'rinishi.
- **Crash-hisobot**: panel xatolarini serverga yetkazish yo'li (minimal: log-report endpoint).
- **Scroll UX**: g'ildirak/trackpad xatti-harakati UXP'da to'liq tekshirilmagan (strip-settle
  faqat tab-lentaga tegadi) — katalog gridida jonli tekshiruv kerak.

## 5. RISKLAR

| Risk | Ehtimol | Zarar | Yumshatish |
|------|---------|-------|------------|
| UXP repaint nosozliklari yana chiqadi (qora tana kabi) | O'rta | Yuqori | Yagona "repaint-kick" helper + har overlay yopilishida qo'llash |
| Migratsiya kod-dan keyin deploy bo'lsa boot crash | Past | Yuqori | Tartib qoidasi: MIGRATE → API deploy (FAZA-5 saboqli) |
| `.prproj` importi API darajasida cheklangan chiqishi | O'rta | O'rta | Spike-probe birinchi (importSequences jonli), keyin UI |
| 0-kontent bilan launch | Yuqori | Yuqori | G1 darvoza: ≥10 tasdiqlangan pr shablon bo'lmaguncha marketing yo'q |
| Windows'da tekshirilmagan reliz | O'rta | O'rta | Beta bosqichida win foydalanuvchi topish; bo'lmasa "mac-only beta" halol yorlig'i |

## 6. USTUVORLIK (ijro tartibi)

- **P0 — Stabilizatsiya**: §3.1–3.5 (qora repaint birinchi — foydalanuvchining faol shikoyati).
- **P1 — Kontent zanjiri**: migratsiya→prod, API deploy, contributor'dan jonli pr upload
  (.mogrt), ingest→approve→katalogda 1 ta real shablon.
- **P2 — Import jonli**: mogrt→timeline, EG install, footage bundle, pack yuklab olish;
  keyin `.prproj` ko'prigi (spike→bridge→UI).
- **P3 — AI Tools jonli**: `window.cep.fs` shim (picker+readFile), barcha tool smoke,
  galereya/sessiya/kredit UI tasdiq.
- **P4 — Reliz**: ccx flavor'lar, versiya-tekshiruv UI, landing, QA matritsa, win smoke, beta.
- **P5 — Ops**: crash-hisobot, analitika kesimi, hujjatlar.

*Yangilangan: 2026-08-03. Har band kod yoki jonli o'lchov bilan tasdiqlangan; taxminlar alohida belgilangan.*
