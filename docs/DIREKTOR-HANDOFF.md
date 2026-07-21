# DIREKTOR-HANDOFF — Loyiha Direktori (doimiy daftar)

> Bu fayl butun loyiha davomida yashaydi. Faqat ASOSIY narsa turadi: rol, ishlash uslubi,
> qat'iy qoidalar, JORIY holat, hujjatlar xaritasi. Batafsil tarix bu yerda EMAS — u batch
> md fayllarда, docs/PROJECT-STATUS.md'да va git tarixида. Daftar shishib ketmasin:
> "JORIY HOLAT" bo'limини YANGILAB tur (eski tafsilotни ko'chirib tashla, saqlama).
>
> **BU YERGA YOZILADI (faqat):** rol, ishlash uslubi, qat'iy qoidalar, hujjatlar xaritasi
> (o'zgармаса — tegилmайди) + "JORIY HOLAT" (3–6 qator, qayerга yetdik).
> **BU YERGA YOZILMAYDI:** har muammо/prompt matni, commit hash'lар, ildiz-sabab qaydlar,
> faza-bo'faza log, uzun tafsilot → bular **batch fayl** yoki `docs/SESSION-REPORT.md`'ga.
> Qoida: yangi holat kelса, eskиsини O'CHIR (ustiga yoz), qo'shib UZAYTIRMA. Butun fayl ~150 qator ичida qolsin.

---

## 1. ROL — Loyiha Direktori

Sen — o'zbek foydalanuvchi bilan **Claude Code** (alohida kod-agent) o'rtasidagi **Direktor**san.

- **Kod YOZMAYSAN.** Foydalanuvchining o'zbekcha xom g'oyasi/muammosini Claude Code uchun
  **TO'LIQ INGLIZ tilидаги, self-contained, one-shot** promptga aylantirasan: nima qilish,
  qaysi fayl, chegaralar, kutilgan natija, noaniqликда qanday qaror qilish.
- **Har prompt oxiri:** *"When finished: (a) commit with a clear concise message (no
  Co-Authored-By); do NOT push. (b) write a short summary."*
- **Foydalanuvchi bilan doim O'ZBEKCHA, sodda** (texnik bo'lmagan odam tushunadigan) gaplashasan.
  Code natijasini ham o'zbekcha, sodda tushuntirasan. FAQAT Code prompti inglizcha.
- **Proaktiv bo'l:** foydalanuvchi aytmagan muammolarни ham o'zing topib ogohlantir. Ortiqcha
  uzun tushuntirma berma — foydalanuvchi buni yoqtirmaydi (qisqa, aniq).

### Model tanlash (Code'ni qaysi modelда ishlatish)
- Oddiy / kичик / aniq (CSS, joylashuv, bitta fayl) → **Sonnet 5** (kunlik ish; Haiku EMAS).
- Murakkab / ko'p qatlamli / migratsiya / refactor / plagin+backend → **Fable 5 (+Extra/High)**.
- Fable 5 kodlaшда eng kuchli (SWE-Bench Pro 80.3% vs Opus 4.8 69.2%) lekin kvotani ~2x tez yeydi.
- Kvota tejash kerak bo'lsa → **Opus 4.8** yoki **Fable 5 Medium**.

---

## 2. ISHLASH USLUBI (asosiy oqim)

1. Foydalanuvchi jonli testда topgan muammoни o'zbekcha aytadi.
2. **Direktor AVVAL kodни o'zi ko'rib chiqadi** (Grep/Read bilan aniq fayl, element/selektor,
   ildiz-sababни topadi) — "ko'r-ko'rona" prompt yozmaydi. So'ng shu aniq diagnozga asoslanган
   to'liq inglizcha Code promptини **alohida batch md faylга** yozadi (aniq qator/selektor bilan).
   Muammolar daftарга (bu fayl) EMAS, **batch faylга** yoziladi.
3. Har batch faylда yuqorida **GLOBAL QOIDALAR** header bo'ladi (pastдаги 4-bo'limdan).
4. Foydalanuvchi har promptни Code'да ishlatadi, oradа `/clear` qiladi → har prompt **self-contained**.
5. Foydalanuvchi natijaни (screenshot / xulosa) ko'rib chiqadi, keyingисига o'tadi.
6. **PUSH'ни doim FOYDALANUVCHI qiladi** (GitHub Desktop). Direktor/Code hech qachon push qilmaydi.
7. Direktor Code natijаsини o'zbekcha sodda tushuntiradi, so'ng bu daftардаги "JORIY HOLAT"ни
   qisqa yangilaydi (faqat asosiy — qayerга yetdik; eski tafsilotни saqlamaydi).

**Prompt topshirish qoidasi:** Direktor har promptni foydalanuvchiga berganда (a) prompt OSTIDA
qaysi modelда ishlatishни aniq aytadi (Sonnet 5 / Fable 5 / Opus 4.8 — 1-bo'limdagi mezon bo'yicha),
(b) Code oldiда turgan ishни o'zbekча sodda 3-6 bandда tushuntiradi (foydalanuvchi nima kutishни bilsin).

**2 rejim** (foydalanuvchi tanlaydi):
- **Birma-bir:** har muammо kelганда darhol alohida prompt (tez, jonli test uchun).
- **Jamlash:** foydalanuvchi bir nechta muammoни ketma-ket aytadi → Direktor oxирида ularни
  bitta yoki bir necha promptга jamlab beradi (bir xil fayllar tegсa — samarali).

**Batch fayl:** bir "davra"/kun uchun bitta fayl — `docs/FIX-PROMPTS-BATCH<N>-<sana>.md`.
Yangi davra boshlанганда yangi fayl ochiladi (eskиси tarix bo'lib qoladi).
Batch fayl **TO'LIQ ingliz tilида** yoziladi (header, izoh, prompt — hammasi English).
Joriy aktiv: `docs/FIX-PROMPTS-SC-2026-07-16.md` (SC oqimi — plagin CMS + topilgan muammolar).

### Yangi chatда davom etish (kontekst tugаганда)
Foydalanuvchi yangi chat ochганда: bu faylни Claude'ga beradi → Claude **ROL (1-bo'lim)ни qabul
qiladi** → "JORIY HOLAT (5-bo'lim)дан davom et" deydi. Boshqa hech narsa kerak emas — bu daftar
+ hujjatлар xaritasi (6-bo'lim) yetarli.

---

## 3. LOYIHA (qisqa)

**FrameFlow** (eski nom AssetFlow). Repo: `~/Projects/creative-tools-saas`.
AE/Premiere shablon marketplace + AI generatsiya studiyasi.

**Zanjir:** Contributor shablon yuklaydi → Admin tasdiqlaydi → tasdiqlangan shablon AE plagin
katalogида chiqadi → obunachi AE ichида import qiladi (Free/Pro limit) → obunachi AE ичида
kredit bilan rasm/video/ovoz/SFX generatsiya qiladi (Studio Gen AI).

**Infra (haqiqiy):**
| Xizmat | URL |
|--------|-----|
| API (Cloud Run) | `api.getframeflow.app` |
| Web (CF Pages) | `getframeflow.app` |
| Storage | GCS · AI: Vertex · DB: Neon Postgres · To'lov: Lemon Squeezy (MoR) |

**Plagin:** `plugins/after-effects-cep/` (bitta HTML fayl ~792KB, bundle `com.frameflow`).
Server deploy'ga KIRMAYDI — AE ичига `install-cep.sh` bilan o'rnatiladi.

**Seed hisoblar:** admin@assetflow.uz / admin123 · dilnoza.k@gmail.com / contrib123 (contributor)
· user@assetflow.uz / user123 (obunachi).

---

## 4. QAT'IY QOIDALAR (HAR promptга tegishli — buzma)

- **PUL-ZONA BYTE-FOR-BYTE:** kredit consume/refund, imzolangan cost-quote va HMAC'i
  (`lib/gen-quote.ts`, `gen-models.ts` `computeGenCost`/`imageUnitCost`, `plugin-profile.ts`),
  webhook idempotentligi, har qanday kredit QIYMATI — HECH QACHON o'zgармайди. Fix shularга
  tegsa → TO'XTA va flag qil.
- **Migratsiya faqat additive** (yangi jadval/ustun; buzuvchi emas). `migrate:deploy` oqими.
- **English UI**; kod izohlari o'zbekcha.
- **Studio manba:** ROOT `packages/assetflow-studio/js|styles` (+ `admin/`, `contributor/` manba)
  ni edit → `npm run studio:sync`. `platform/index.html` = CF Pages TO'G'RIDAN manba (to'g'ridan edit).
  `studio/`, `admin/` artefaktларини HECH QACHON edit qilma. Landing (`ffl-`) ga tegma.
- **Plagin:** edit → `bash plugins/after-effects-cep/scripts/install-cep.sh` (USER AE restart).
  AE'да internet YO'Q (shrift self-host, inline SVG). `node --check` + DOM/handler bilan tasdiqla.
- **Commit** aniq xabar bilan, **`Co-Authored-By` YO'Q** (deploy bloklaydi). **PUSH QILMA.**
- **Minimal, tor diff.** Mavjudni qayta ishlat, regress qilma. Har prompt self-contained (`/clear`).
- **PLAGIN UI KONSTITUTSIYASI (2026-07-17, ega tasdig'i — HAR UI promptiga kiritiladi):**
  (1) bitta chrome — yagona top bar, ikkinchi to'liq bar taqiq; (2) karta yuzi = media +
  tur belgisi, qolgani hover/fokusda; (3) zona budjeti — doimiy ko'rinadigan boshqaruv
  ≤5, ortig'i bitta ⋯/disclosure ortida; (4) progressiv ochilish — funksiya O'ChMAYDI,
  ko'chadi; (5) faqat tema tokenlari, bitta spacing shkala; (6) narx/kredit doim ko'rinadi.
- **Referens (Artlist/Higgsfield) = ILHOM, 1:1 nusxa EMAS.** Naqsh/oqim/kayfiyat olinadi; kod,
  asset, piksel-klon TAQIQ. ⚠️ YANGILANDI (2026-07-12, USER so'rovnomasi): eski "lime accent
  saqlanadi" qoidasi BEKOR — USER hozirgi identikadan voz kechdi; yangi identika BATCH6'da
  tanlanadi (`docs/BATCH6-REDESIGN-BRIEF.md` — brif + so'rovnoma natijalari shu yerda).

---

## 5. JORIY HOLAT (2026-07-21)

> ✅ **SECURITY TASK 1 TUGADI (2026-07-21, push/deploy YO'Q):** bog'liqlik xavfsizligi +
> multipart (upload) qattiqlashtirish. Mahsulot xatti-harakati va pul-zona TEGILMAGAN.
> **Audit (mustaqil qayta o'lchandi):** OLDIN `9 = 3 high · 4 moderate · 2 low · 0 critical`
> (HEAD lock'ini vaqtinchalik nusxada `npm audit --package-lock-only` bilan takrorlab tasdiqlandi) →
> **KEYIN `0` (426 bog'liqlik; `--omit=dev` ham 0)**. `npm ls --all` toza.
> **Versiyalar:** multer `2.1.1→2.2.0` · http-proxy-middleware `3.0.5→3.0.7` · PM2 `6.0.14→7.0.3` ·
> google-auth-library apps/api'da `9.15.1→10.9.0` (root'da 10.9.0 allaqachon bor edi — nested nusxa
> yo'qoldi) · `@types/multer 1.4.13→2.2.0` · tranzitiv: body-parser `2.2.2→2.3.0`, esbuild
> `0.28.0→0.28.1`, protobufjs `7.6.4→7.6.5`, js-yaml `4.1.1→4.3.0`; zaif `uuid@9.0.1` daraxtdan
> butunlay chiqdi (gtoken/gaxios6 zanjiri bilan). Lock 491→427 yozuv — **7 workspace'ning hammasi
> joyida**, kamayish faqat pm2 6 va google-auth 9 tranzitivlaridan (yo'qolgan paket yo'q).
> **Upload qattiqlashtirish:** yangi yagona manba `apps/api/src/lib/upload-limits.ts` — 4 ta multer
> nusxasiga `fieldNestingDepth:1` (GHSA-72gw-mp4g-v24j himoyasi 2.2.0'da **opt-in**, versiyaning
> o'zi yetarli emas) + chekli `files/fields/parts` (busboy default = Infinity edi). **Imkoniyat
> SAQLANGAN va test bilan isbotlangan:** avatar 5MB/1 fayl · gen ref 100MB/1 fayl · contributor
> assets 3300MB + thumb+preview+pack · sahna preview 512MB × 160 fayl. `index.ts` global xato
> ishlovchisiga MulterError → 400/413 (avval 500 + Sentry shovqini); o'z ishlovchisi bor marshrutlar
> (upload-assets, ref-upload) unga YETIB BORMAYDI, auth semantikasi o'zgarmagan (requireAuth multer'dan
> oldin).
> **Testlar:** yangi `apps/api/scripts/test-upload-limits.mjs` (production `dist/lib/upload-limits.js`ni
> AYNAN import qilib haqiqiy multer+HTTP bilan yuguradi; kontrol holat `fieldNestingDepth`siz o'tib
> ketishini ko'rsatadi) — **hammasi PASS** (160 fayl OK; 3000-darajali nested nom LIMIT_FIELD_NESTING
> bilan 2ms'da rad; parts/fields/6MB rad; diskStorage qism fayllari tozalandi). Yangi
> `scripts/test-dependency-security-floors.mjs` (manifest + lock + `node_modules` HAQIQIY o'qiladi,
> ko'chirilgan konstanta emas) — **hammasi PASS**. Regressiya: DB build PASS · API build PASS
> (51 model / 24 enabled) · root build PASS · verify-public-copy **67/67** · plugin release contract
> **14/14** · plugin download state **10/10**.
> **PM2 7 / proxy dalillari:** yangi `scripts/pm2-jlist.mjs` — sof parse funksiyasi (destruktiv amal
> YO'Q; `pm2 kill` faqat eski `--reset` yo'lida qolgan). ⚠️ Bu sessiyada TOPILDI va TUZATILDI:
> "birinchi `[` dan o'qish" **sovuq daemon**da (`npm run pm2:reset`dan keyin) `[PM2] Spawning PM2
> daemon…` qatoriga tushib null qaytarardi — endi nomzod `[` o'rinlari navbat bilan sinaladi
> (izolyatsiyalangan `PM2_HOME`da haqiqiy chiqish bilan tasdiqlandi). Foydalanuvchining JONLI
> daemon chiqishida ham tasdiqlandi: `JSON.parse(stdout)` → NULL, yangi parser → OK. PM2 7.0.3
> izolyatsiyalangan `PM2_HOME`da start/jlist/delete/kill davrasi PASS; `ecosystem.config.cjs` aynan
> `assetflow-api/assetflow-web/assetflow-admin` beradi; **foydalanuvchi daemon'i/jarayonlari
> TEGILMADI** (uning xotira-daemon'i hamon 6.0.14 — `npm run pm2:reset` bilan o'zi yangilaydi).
> http-proxy-middleware 3.0.7 — 3100/3101 izolyatsiyalangan portlarda stub API bilan **8/8 PASS**
> (health proxy, `/api` funksiya-`pathRewrite` query bilan, `changeOrigin`, statik HTML).
> **Qoldiq (xavfsizlik EMAS):** Node 25'da dev proxy `DEP0060 util._extend` ogohlantirishi chiqadi —
> manba `node_modules/http-proxy@1.18.1` (hpm 3.x ichki bog'liqligi), bizning kod emas; funksionallik
> buzilmaydi. hpm 4.x uni `httpxy`ga almashtiradi, LEKIN 4.x `engines` Node 25'ni QO'LLAMAYDI
> (`^22.15 || ^24 || >=26`) → ataylab QILINMADI. Faqat lokal dev skriptlari (prod'da ishlatilmaydi).
> **Chegara:** bu — bog'liqlik xavfsizligi + upload qattiqlashtirish. To'liq ilova-xavfsizlik auditi
> yoki penetratsiya testi EMAS. Hech narsa push/deploy qilinmadi, production o'zgarmadi;
> `test-downloads/` repo'da yo'q, DB sxema/pul-zona/auth semantikasi diff'da YO'Q.

> ✅ **Launch Task B TUGADI (2026-07-21, push YO'Q, dizayn/layout O'ZGARMADI):** ochiq landing/
> pricing/plugin sahifalarni haqiqiy imkoniyat va dalilga mos qildik. Fayllar: `apps/api/src/lib/
> landing-config.ts`, `packages/assetflow-studio/platform/index.html`, yangi
> `scripts/verify-public-copy.mjs`.
> 1. **Media xato fallback:** yangi capture-phase `window.addEventListener('error', ...)`
>    (`platform/index.html` mount) — public `.va-media` rasm/video xatosida 1 marta cache-bust
>    bilan qayta urinadi, so'ng "Media unavailable" overlay (`.va-mediaerr`, allaqachon mavjud CSS)
>    ko'rsatib elementni yashiradi; `componentWillUnmount`da tozalanadi. Workspace galereyasidagi
>    mavjud `axMediaError`/`axMediaLoaded` (allaqachon to'g'ri ishlagan, ishonchli) TEGILMADI —
>    `onerror` atributi bor elementlar yangi listener'dan chetlab o'tiladi. Checked-in yopiq/xato
>    GCS media URL topilmadi (allaqachon bo'sh string default edi) — o'ylab chiqarilmadi.
> 2. **Miqdoriy da'volar:** server (`landing-config.ts`) va klient CMS-nusxa (`platform/index.html`)
>    default'laridagi **"10,000+ templates"** va **"Ae · Pr · DaVinci"** yorlig'i olib tashlandi →
>    timeless/haqiqiy qiymatlar ("Free AI credits to start", "Content categories — video, graphics,
>    LUTs, audio"). Dashboard quick-action va AI Studio quick-action'lardagi 3 xil qayta-qaytariq
>    **"10,000+ video templates" / "10,000+ AE, Premiere & Resolve packs"** ham tuzatildi (1 tasi
>    jonli statik HTML, qolgan 2 tasi — `quickActions`/`dashQuick` — o'lik kod edi, o'chirildi).
> 3. **Qo'llab-quvvatlanmagan va'dalar:** Pro/Studio tarif matnlaridan **"AE / Premiere plugin"**,
>    **"Team workspace (5 seats)"**, **"Brand kit and templates"**, **"Dedicated account manager"**
>    olib tashlandi (kodda/DB'da amalga oshirilmagan — grep tasdiqladi). 14 kunlik pul qaytarish
>    kafolati **SAQLANDI** (`refund.html` + `lemonsqueezy.ts` webhook — real, ishlaydigan siyosat).
> 4. **Demo shablon kartalari:** SHOWCASE FEED (landing masonry) — real katalog EMASLIGI aniq
>    yozildi ("Concept previews — styles you can create, not live catalog listings" + izoh
>    tuzatildi); fake `a:'Pr'/'Dr'` (Premiere/DaVinci) yorliqlari **`Ae`**ga to'g'rilandi (20 ta
>    yozuv — plagin faqat AE). CINEMA blokidagi soxta sana "FRAMEFLOW PREMIERE · 07/12" →
>    "CONCEPT PREVIEW"ga almashtirildi.
> 5. **Soxta testimonial'lar:** 3 ta fabrikatsiya qilingan mijoz sharhi (Dilnoza Karimova/Sardor
>    Aliyev/Madina Yusupova) — DOM'da hech qayerda bind qilinmagan **o'lik kod** ekani tasdiqlandi,
>    to'liq o'chirildi (`testimonials`/`testsRv` + bog'liq `authors`/`categoryTiles`/`footerCols`/
>    `pluginSteps`/`statsView`/`tips`/`carousel` — hammasi shu audit bilan aniqlangan o'lik kod).
> 6. **Plagin reliz xatti-harakati (commit 6eb5421/b29a93d/c1c3b01):** diff'da bu fayllarga hech
>    qanday o'zgarish YO'Q — tasdiqlandi (`git diff` bo'sh).
> **Tekshiruv:** `npm run build -w apps/api` OK · `node scripts/verify-public-copy.mjs` → **29/29
> o'tdi** (miqdoriy/imtiyoz/ism da'volari yo'q, fallback funksiyalari aniqlangan) · `platform/index.html`da
> **10 jami `<script>` tegi: 4 inline + 6 tashqi (`src=`)** — mustaqil sanoq bilan tasdiqlangan
> (avval bu yerda noto'g'ri "10 ta inline" deyilgan edi, TUZATILDI); har 4 inline skript tanasi
> `node --check`-ga teng tekshiruv bilan sintaksis OK · himoyalangan zona (pul/kredit/billing/auth/
> DB sxema/deploy) diff'da YO'Q · `test-downloads/` tegilmadi.
> ✅ Brauzer/mobil vizual QA keyinroq BAJARILDI — pastdagi "YAKUNIY BRAUZER QA" blokiga qara.
> ✅ **TUZATISH AUDITI (2026-07-21, push YO'Q):** mustaqil audit 2 ta faktik bloker topdi, ikkalasi
> ham tuzatildi:
> 1. Public marketing hali aniq **"14-day money-back guarantee"** da'vosini bergan edi
>    (`landing-config.ts` 4 joy + client CMS-fallback nusxasi + `platform/index.html` pricing
>    sahifasidagi 2 qattiq yozilgan joy) — `refund.html`ning o'zi 14 kunlik oyna/chegarani hali
>    **lawyer-review** ostida deydi, shuning uchun public sayt yakunlanmagan/shartsiz kafolatni
>    va'da qilishi MUMKIN EMAS edi. Barcha jonli marketing o'rinlar neytral haqiqiy matnga
>    almashtirildi ("Refund eligibility is explained in the Refund Policy"); 4-statistika
>    ("14 days / Money-back guarantee") timeless haqiqiy faktga almashtirildi (`1 connected
>    workflow — Web and After Effects`). `refund.html`, pul/kredit/billing/webhook/checkout/ledger
>    fayllari va tarif narxlari TEGILMADI. `scripts/verify-public-copy.mjs`ga aniq ibora regressiya
>    tekshiruvi qo'shildi (endi 38/38).
> 2. Yuqoridagi "barcha 10 ta inline `<script>`" yozuvi NOTO'G'RI edi — mustaqil sanoq: **10 jami
>    script tegi = 4 inline + 6 tashqi (`src=`)**. Yozuv tuzatildi (yuqorida); `verify-public-copy.mjs`
>    endi bu sonlarni va har bir inline skript tanasining `new Function()` sintaksisini avtomatik
>    tekshiradi.
> ✅ **TUZATISH AUDITI #2 — BRAUZER RUNTIME XATOSI (2026-07-21, push YO'Q):** Codex `dist/`ni
> `prepare-cf-pages.mjs` bilan qurib, `http://localhost:4173/`da MUSTAQIL takrorladi: sahifa
> ko'rinardi, lekin konsolda `ReferenceError: axMediaError is not defined`
> (`HTMLImageElement.onerror` + `HTMLVideoElement.onerror`). Ildiz-sabab: dc-runtime shablonni
> kompilyatsiya qilishdan OLDIN brauzer `<x-dc>` ichidagi xom DOM'ni parse qiladi va
> `onerror="{{ axMediaError }}"` atributi NATIVE JS sifatida bajariladi — `axMediaError` esa
> render qaytargan lokal funksiya, global identifikator EMAS. (Yon topilma: `onloadedmetadata`
> React'da hech qachon bog'lanmagan — `onLoadedmetadata` ≠ `onLoadedMetadata`.) Avvalgi tekshiruv
> "funksiya ta'rifi bormi" deb qarardi — bu FALSE-POSITIVE edi.
> **Tuzatish:** ikkala workspace media elementidan inline `onload`/`onerror`/`onloadedmetadata`
> atributlari OLIB TASHLANDI; hammasi `componentDidMount`dagi bitta capture-fazali delegatsiyaga
> ko'chirildi (`FF-MEDIA-DELEGATION` markerlari: `error` + `load` + `loadedmetadata`),
> `componentWillUnmount`da uchalasi ham tozalanadi. Global identifikator (window'ga yamoq)
> QO'ShILMADI. Xatti-harakat AYNI: yuklanganda skeleton olinadi, xatoda 1 marta cache-bust retry,
> so'ng "Media unavailable" qoplama + element yashiriladi; public-sahifa fallback'i saqlandi.
> **Regressiya testi kuchaytirildi** (`scripts/verify-public-copy.mjs`): endi (a) manba VA
> deploy-shaklidagi `dist/index.html`da avtomatik ishga tushadigan inline media atributi
> (`onload/onerror/onloadedmetadata/…`) BO'LMASLIGINI, (b) hech bir inline handler atributi
> `axMediaError/axMediaLoaded`ga murojaat qilmasligini va ular global sifatida e'lon
> qilinmasligini, (c) `FF-MEDIA-DELEGATION` blokini JONLI manbadan ajratib olib soxta DOM ustida
> HAQIQATAN bajarib (retry-once, qoplama, skeleton, public fallback) tekshiradi.
> **Tekshiruv:** `verify-public-copy.mjs` → **67/67 o'tdi** (eski, buzuq HEAD manbasida shu tekshiruv
> 5 ta native atributni topib FAIL beradi) · `prepare-cf-pages.mjs` OK, dist'dagi 4 inline skript
> ham sintaksis OK · Task A himoyalangan xatti-harakat buzilmadi:
> `test-plugin-release-contract.mjs` 14/14, `test-plugin-download-state.mjs` 10/10 · DB/API build
> KERAK EMAS (diff'da `apps/api`/`packages/database` fayli yo'q) · `dist/` commit QILINMADI
> (gitignore) · `test-downloads/` tegilmadi.
> ✅ **YAKUNIY BRAUZER QA — TUGADI (2026-07-21, Codex mustaqil bajardi, push YO'Q):** Launch Task B
> real-brauzer desktop/mobil vizual+konsol QA endi BAJARILDI (outstanding EMAS). Deploy-shakldagi
> `packages/assetflow-studio/dist` HEAD'dan qayta qurilib, SPA fallback bilan lokal `localhost:4174`da
> serv qilindi.
> - **Desktop 1440×900:** landing, pricing, plugin ekranlari vizual mutanosib; gorizontal overflow
>   YO'Q (document scrollWidth 1429 vs innerWidth 1440); hal qilinmagan `{{ }}` kontent YO'Q; bitta
>   ko'rinadigan asosiy ekran; fresh-tab brauzer error/warning logi BO'Sh.
> - **Mobil 390×844:** o'sha 3 ekran vizual mutanosib; responsiv header/menyu va kartalar sig'adi;
>   gorizontal overflow YO'Q (scrollWidth 379 vs innerWidth 390); fresh error/warning logi BO'Sh.
> - Avvalgi `ReferenceError: axMediaError/axMediaLoaded` QAYTALANMADI.
> - **Landing:** ko'rinadigan "CONCEPT PREVIEW" haqiqat yorlig'i saqlangan; fabrikatsiya mijoz ismlari
>   YO'Q; taqiqlangan Premiere Pro / DaVinci Resolve / 14-day money-back / 10,000+ / 5,000+ da'volari YO'Q.
> - **Pricing:** haqiqiy "Refund Policy" matni ko'rsatildi, 14 kunlik kafolat da'vosi YO'Q.
> - **Plugin:** "After Effects 2022+" ko'rsatildi, Premiere/DaVinci da'vosi YO'Q; ataylab o'chirilgan
>   lokal API ostida "Checking latest version…" → halol "Retry check / Can't reach the server" holatiga
>   o'tdi — konsol xatosisiz, jim/o'lik tugma YO'Q.
> - **5e06074'dan keyin mustaqil qayta yugurtirilgan tekshiruvlar:** database build PASS · API build
>   PASS (51 model / 24 enabled) · `verify-public-copy` **67/67** (dist regeneratsiyadan OLDIN ham,
>   KEYIN ham) · plugin release contract 14/14 · plugin download state 10/10 · `prepare-cf-pages` PASS.
> - **Operatsion haqiqat O'ZGARMADI:** hech narsa push/deploy qilinmadi, production o'zgarmagan;
>   imzolangan `.zxp` artefakt va real `PluginRelease` yozuvi hali YO'Q → public production plugin
>   download hali operatsion EMAS. Bu QA — lokal deploy-shakl brauzer QA, production QA EMAS.

> ✅ **Launch Task A TUGADI (2026-07-21, push YO'Q):** AE plagin reliz paketi + ommaviy download oqimi.
> `build-zxp.sh` staging'ga `css/` (tokens/ff-components/styles + `fonts/*.woff2`) yo'qolgan edi —
> imzolangan ZXP shriftsiz/uslubsiz ochilardi; endi to'liq. Qo'shildi `--unsigned` rejim (sertifikatsiz
> `.zip` tekshiruv paketi). Manifest host `[18.0,99.9]` → **`[22.0,99.9]`** (AE 2022+, so'rovnoma
> qarori bilan mos). Landing/Plugin sahifa "Premiere Pro" joriy-qo'llab-quvvatlash da'vosi
> "coming soon"ga almashtirildi (badge/versionNote AE 2022+ ga to'g'rilandi, server+klient default
> AYNI). Web "Download the plugin" tugmasi endi haqiqiy `GET /api/plugin/version` kontraktiga ulandi
> (`FFAPI.pluginVersion`, `platform/index.html` `loadPluginRelease`/`downloadPlugin`): loading/ready
> (haqiqiy artefakt URL'ga o'tadi)/unavailable ("beta hali chiqmagan")/error (retry) — hech qachon jim
> qolmaydi. Reliz hisob-kitobi `apps/api/src/lib/plugin-release-contract.ts`ga izolyatsiya qilindi +
> 2 standalone test (`apps/api/scripts/test-plugin-release-contract.mjs`,
> `packages/assetflow-studio/scripts/test-plugin-download-state.mjs`) — ikkalasi ham o'tdi.
> 🔴 **Productionга chiqarish uchun ega ishi (kod EMAS):** hozircha `PluginRelease` jadvalida HECH
> QANDAY reliz yo'q → prod'da tugma halol "Beta download not published yet" ko'rsatadi. Haqiqiy
> `.zxp`ni Admin → Plugin releases orqali R2/GCS'ga yuklab, versiya qatorini yaratish SHART (yoki
> `build-zxp.sh` bilan imzolangan paket + admin API). Bu — ega/operatsion qadam, kod bloker emas.

> ✅ **Launch Task A — TUZATISH AUDITI (2026-07-21, push YO'Q):** mustaqil audit 6 ta blokerni topdi,
> hammasi tuzatildi:
> 1. `manifest.xml` — ikkala `ExtensionList` versiyasi `1.1.0` qolib ketgan edi (bundle `1.1.1`);
>    endi ikkalasi ham **`1.1.1`** (bundle bilan bir xil).
> 2. `/api/plugin/version` presigned havola nomi `frameflow-plugin-<v>.zip` yozardi — mahsulot artefakti
>    imzolangan **`.zxp`**; endi `frameflow-plugin-<v>.zxp`. Admin reliz kontrakti (`POST
>    /admin/plugin-releases`) endi kalitning kengaytmasini ham tekshiradi — faqat `.zxp` (registrga
>    sezgir emas) qabul qilinadi, `.zip`/kengaytmasiz kalit rad etiladi. Pure funksiya
>    `isZxpReleaseKey()` → `plugin-release-contract.ts`, DB'siz test qo'shildi (6 ta yangi case).
> 3. "Creative Cloud" orqali o'rnatish da'vosi (qo'llab-quvvatlanmaydi) — plugin sahifa default
>    matnlari va dinamik "ready" holat matnidan olib tashlandi → **"Compatible ZXP installer"**
>    (3 o'rnatish qadami ham mos yangilandi). Faqat live `landing-config.ts` + `platform/index.html`;
>    arxiv mockuplarga tegilmadi.
> 4. Plugin promo 3 chip — "Premiere Pro / DaVinci — coming soon" (qo'llab-quvvatlanmagan kelajak va'da)
>    → haqiqiy joriy imkoniyatlarga almashtirildi: **"After Effects 2022+" · "In-panel catalog" ·
>    "AI Studio"**. Vizual joylashuv (3 chip) o'zgarmadi.
> 5. `build-zxp.sh` izohi `UNSIGNED=1` derdi, kod `UNSIGNED_ZXP` tekshirardi — izoh `UNSIGNED_ZXP=1`ga
>    to'g'rilandi; ichki bayroq o'zgaruvchisi `DO_UNSIGNED`ga qayta nomlandi (endi hujjatlashtirilgan
>    `UNSIGNED_ZXP` env bilan aralashmaydi), `--unsigned` va env ikkalasi ham ishlaydi.
> 6. Yangi `plugins/after-effects-cep/scripts/verify-zxp-package.mjs` — unsigned arxivni RUNTIME
>    referenslariga (manifest `MainPath`/`ScriptPath`, HTML lokal `<link>`/`<script>`, CSS `url()`
>    shriftlar) qarshi tekshiradi; yetishmagan fayl = FAIL (manfiy holat qo'lda tasdiqlandi — shrift
>    olib tashlanganda skript FAIL berdi). Yangi dependency yo'q (Node builtin + tizim `unzip`).
>    `--unsigned` arxivga qarshi ishga tushirildi: **34/34 referens tasdiqlandi, 0 FAIL**.
> Tekshiruv: DB+API build OK · `test-plugin-release-contract.mjs` 14/14 · `test-plugin-download-state.mjs`
> 10/10 · har ikkala plagin HTML'dagi barcha inline `<script>` (7+1, total 8) `node --check` bilan sintaksis
> tasdiqlandi · himoyalangan zona (pul/kredit/billing/auth/DB sxema/deploy) diff'da YO'Q.

> 🚧 **AKTIV — MUAMMOLAR V2 (jonli test muammolari).** 24 muammo (P1–P24) tahlil qilindi,
> har biri uchun self-contained Code prompt yozildi: `docs/MUAMMOLAR V2-2026-07-13.md`.
> Bajarish rejasi 3 faylga tartiblandi: `docs/V2-BAJARISH-HIGH-2026-07-14.md` (13 ta, Fable 5,
> tartib qat'iy: P1→P9→P5→P11→P17→P20→P23→P24→P22→P27→P28→P32→P35) · `V2-BAJARISH-MEDIUM`
> (14 ta, Sonnet 5, P18 P24'dan oldin) · `V2-BAJARISH-EASY` (8 ta).
> ✅ **EASY BLOKI TUGADI (2026-07-14, 8/8):** P4·P3·P7·P8·P10·P16·P25·P34 —
> commitlar 7922b9a·6f13ff4·41cc7ca·055161f·e70bc50·cc3c18c·ad6379d·530f4f9 (push YO'Q).
> BATCH6 #6 avval alohida checkpoint (1d9c729).
> ✅ **HIGH-1 TUGADI (2026-07-14, 5/5):** P1·P9·P17·P20·P23 (media+kredit o'zagi) — 5 commit,
> push+deploy qilingan. 🔴 ledger tasdiq (enhance 5-retry=1 debit). 2 backfill skript DRY_RUN —
> EGA ishga tushiradi. Watermark dvigateli endi UXLAYDI (0 chaquruvchi).
> ✅ **HIGH-2 TUGADI (2026-07-14, 4/4):** P5·P11·P27·P32 — 4 commit, push YO'Q. P5 paint-first
> +parallel boot · P11 shelf dedup (sc-runtime = React, kod bug EMAS) · P27 provayder timeout +
> slot xavfsizlik to'ri · P32 CORS hard-fail/monthStart UTC/atomik register/avatar sniff.
> 🔴 EGA ESLATMA: monthStart UTC = deploy'da oylik reset chegarasi 1 marta siljiydi.
> 👉 QOLDI: **USER PUSH (HIGH-2)** → **JONLI-TEST** (P22·P24·P35·P28, AE/Windows, ega ishtiroki,
> birma-bir: P22→P24→P35→P28) → **MEDIUM bloki** (14 ta, Sonnet 5; P18 P24'dan oldin).
> Cloudflare: HTTP/3 OFF + Always-Use-HTTPS ON (ega, 2026-07-14).
> ✅ **So'rovnoma qarorlari (2026-07-14):** plugin minimal host = **AE 2022+** (transpile yo'q)
> · audio sting **olib tashlanadi** (preview himoyasi = past bitreyt) · AI Stock preview =
> **toza + past-rez** (watermark dvigateli 0 chaqiruvchi, uxlaydi).
> 🔴 **INFRA — EGA QAT'IY QARORI (2026-07-14): Neon → Google Cloud SQL ko'chamiz. HOZIR EMAS**
> — muammolar (V2 + audit) tugagach, alohida. ✅ TO'LIQ REJA TAYYOR:
> `docs/MIGRATSIYA-NEON-CLOUDSQL-REJA.md` (6 faza, rollback, xarajat ~$50-70/oy, tekshiruv
> ro'yxati). Cloud SQL europe-west1 (Cloud Run bilan bir joy), Auth Proxy, pg_dump/restore,
> Secret Manager. ESLATMA: ko'chguncha Neon bepul 100-soat limiti XAVF; oraliq chora = Neon
> Launch 1 oyga (qarorni bekor qilmaydi).
> ✅ **NEON TOZALANDI (2026-07-14):** eski `assetflow` (US Virginia) loyiha O'CHIRILDI —
> prod = `assetflow-eu` (Frankfurt, jonli, tasdiqlangan). Ikki baza compute yeyayotgan edi →
> endi BITTA. Compute ~87 CU-hrs (Jul 1-15); bitta bazaga tushgach limit xavfi kamaydi.
> Storage 37MB (kichik). Bepulда qolish uzaydi — Neon Launch/Cloud SQL shoshilinch EMAS.
> 🔎 **Katta audit (2026-07-14):** 4 parallel tekshiruv → 10 yangi blok P25–P34
> (`docs/DIREKTOR-AUDIT-V2-2026-07-14.md`): eng muhimlari — sessiya-tugashda holat sizishi
> (P25) · to'lov UX teshiklari (P26) · provayder timeout'siz gen-pool qulflanishi (P27) ·
> plugin Windows'da ishlamasligi + 2 lokal in'ektsiya (P28) · admin "yolg'on" boshqaruvlari (P29).

### (Eski holat — 2026-07-13)

> ⚠️ **PARALLEL DIREKTOR IShI (2026-07-12/13) — `MUAMMOLAR` oqimi TUGADI.**
> Ega ikkinchi direktor bilan 30 ta muammoni tahlil qilib, **A→J 10 bo'lakda** hal qildi.
> Manba: `docs/MUAMMOLAR-1-POYDEVOR-PUL-MIQYOS.md` (poydevor·pul·miqyos) va
> `docs/MUAMMOLAR-2-MAHSULOT.md` (AI Studio·kompozer·katalog·kontent quvuri).
> **Bu bo'lim BATCH6/7/8 ishidan ALOHIDA — lekin `platform/index.html` va plaginda
> KESIShADI. BATCH ishi boshlanishidan oldin quyidagilarni O'QI.**

### ✅ BAJARILDI (A→J, ~40 commit, push+deploy qilingan)

**Infra/pul (1-qism):**
- **Baza Frankfurt'ga ko'chirildi** (Neon `us-east-1` → `eu-central-1`; Cloud Run `europe-west1`).
  Har SQL so'rovida ~100 ms Atlantika kechikishi YO'QOLDI. Eski baza 1 hafta zaxira.
- **CDN — Cloudflare Worker** `cdn.getframeflow.app` (`workers/cdn-proxy/`). GCS bucket **butunlay
  yopiq** (org-policy per-object public'ni taqiqlaydi). Worker `isPublicReadKey()` ruxsat ro'yxati
  bo'yicha faqat thumb/preview/scene/gen-derivativlarni beradi. **Isbot: `pack.zip` → 403.**
  🔴 Bu ro'yxatni BUZMA — pullik pack sizib ketadi.
- **Narx:** paketlar 250/600/1800 (zararda sotilardi) · Studio 3000 kredit · "Priority generation",
  "API access", "Priority render queue" — SOTILAYOTGAN, LEKIN YO'Q edi → **o'chirildi**.
  Boot-assertion: biror kanal xarajatdan arzon sotilsa — **server ko'tarilmaydi**.
- **Idempotentlik** `POST /gen` (ikki marta hisobdan chiqarish xavfi yopildi; ledger audit — yo'qotish yo'q).
- **Suv belgisi QURILDI** (avval reklama qilinardi, kodda YO'Q edi): Free → suv belgili AI eksport
  va stock preview; Pro → toza. Server tomonda, aylanib o'tib bo'lmaydi.
- **P19.5:** 20 daqiqa endi "refund" emas, **"provayderdan so'ra"** — tayyor bo'lsa natija yetkaziladi.
- **Xavfsizlik:** presigned upload kvota teshigi · 2FA xato kodi sessiyani o'chirardi · `TOKEN_EXPIRED`
  vs `FORBIDDEN` · 🔴 **`softenPromptForSafety` (provayder filtrini chetlab o'tish) TOPILDI va O'CHIRILDI**
  — Google/BytePlus shartnomasini buzardi, hisob yopilishi mumkin edi. **QAYTA QO'SHMA.**
- **Sybil himoyasi** (download IP/ASN/yosh klasterlash) · pool 50%→30% + INFRA chegiriladi ·
  30-kun payout hold · **Foyda paneli** (admin → Profit).

**Mahsulot (2-qism):**
- **AI Studio:** global qayta render to'xtatildi (scroll/timer/fake-progress `setState` → butun ilova
  qayta chizilardi) · media haqiqiy `<img>`/`<video>` (CSS-fon emas) · 1280px display derivative +
  srcset · lightbox qayta qurildi (haqiqiy nisbat, detal paneli, ←/→) · karta yuzasi (3 tema).
- 🔴 **REFERENS HOVUZI (P13):** model almashganda referens **O'CHMAYDI** — xira bo'ladi, sabab bilan;
  @raqamlar **HECH QACHON qayta raqamlanmaydi**. **Parallel generatsiya** (5 ish).
- **Kompozer:** bitta ⚙ sozlama chipi (Generate hech qachon wrap bo'lmaydi) · Generate kredit yetmasa
  **oldindan** o'chadi · drag&drop + paste + ✕-pill + Clear + **⌘Z undo**.
- **Enhance endi rasmlarni KO'RADI** (avval ko'r-ko'rona taxmin qilardi — klient `image_urls` yubormasdi).
- **Kreditlar ekrani** — haqiqiy `CreditLedger` (avval qaytarishlar UMUMAN ko'rinmasdi).
- **Katalog server tomonda** filtr/qidiruv/saralash/sahifalash. Ikkala klientdagi "hamma sahifani
  yuklab ol" sikli o'chirildi. Plagin virtualizatsiya (5000 karta AE'ni muzlatardi).
  📊 O'lchov: 50→5000 asset — javob **38 KB (o'zgarmaydi)**, TTFB 4.8 ms. Eski: 3.9 MB / 51 so'rov.
- **Kontent quvuri:** 6 kategoriya (Video Templates · LUTs · Graphics · Motion Graphics · Music · SFX).
  **Ikkinchi ingest quvuri — xom fayllar** (avval faqat `.zip` qabul qilinardi). ffprobe spec + AI
  metadata **yuklashda** (Vertex Gemini) + ko'p orientatsiya. Qayta tiklanadigan bulk-ingest ishchisi.
- **Katalog nomi/routing:** "Stock Catalog" · **haqiqiy manzillar** `/stock/<type>/<slug>-<id>` ·
  **OG link preview** (CF Function — Telegram/Twitter'da rasm) · kontekstga qarab filtrlar.
- **AI Stock zanjiri:** gen kartada "Add to Explore" → admin → katalog. Bepul (admin Pro qilishi mumkin),
  payout yo'q. Fayl **nusxalanadi** (havola emas).

### 🔴 QOLDI (ega ishi, kod EMAS)
Marja **2×** (hozir 1.2× — zarar!) · **Neon → Launch reja** (bepul 100 soat tugasa sayt o'ladi) ·
Sentry DSN · Neon parol rotatsiya · suv belgisi backfill · GCS lifecycle · **KONTENT** (katalogda 2 asset,
landing "5000+" deydi) · legal/email/Turnstile/LS-LIVE.

### ⚠️ Ochiq risk
Qidiruv **indekssiz ILIKE** — 5000'da 5 ms, lekin chiziqli. ~15-20k'dan keyin `pg_trgm` kerak.

---

## 5b. ESKI HOLAT (BATCH oqimi, 2026-07-10..12)

- ✅ **Butun mahsulot qurilgan:** kontent quvuri (F1–F6) · hardening/launch-readiness fazalari ·
  login/2FA/3-portal · ingliz-tarjima · QA-FIX 16 + BATCH2 21 · Site/Landing CMS · Artlist web
  redesign (A/B/C/D) · plagin redesign · admin redesign port (qisman) · Lemon Squeezy integratsiya.
- ✅ **BATCH3 TUGADI (13/13, 18 commit, PUSH YO'Q):** #10 Stock **S1** (upload kind-picker + `kind`/
  `stockType`/`templateType` + migratsiya) · #3 templates pill+filter · #11/#12/#13/#14 = Direktor-audit
  §D/§B/§A/§C tuzatishlari · #1/#5/#6/#7/#8 AI Studio composer (Artlist-ilhom) · #2 admin gen preview ·
  #9 plagin My Library ref. Pul-zona byte-for-byte; 2 additive migratsiya (`stock_kind_columns`,
  `plan_config_active`). Batafsil: batch fayl + `docs/DIREKTOR-AUDIT-2026-07-10.md`.
- ✅ **BATCH4 TUGADI (4/4, 11 commit, PUSH YO'Q, migratsiya YO'Q, pul-zona diff'siz):** #1 rasm Upscale
  (Vertex `imagegeneration@002` — ✦4/✦8) · #2 video Upscale (fal Topaz, tier ✦/s, server ffprobe imzoда) ·
  #4 ovoz Kokoro/OpenRouter → **Chirp 3 HD** (Cloud TTS, jonli ishladi; 0 enabled OpenRouter) · #3 **narx
  dvigateli** ("Apply 2× margin" tugma + enabled-only + sarf-chegараси). Kredit langari $0.019 (Pro 1000).
- ✅ **PUSH+DEPLOY TASDIQLANDI (2026-07-11, Direktor jonli tekshiruvi):** git 0 ahead/clean; prod
  `/health` ok (db+storage); katalog `kind`/`stockType` qaytaryapti → BATCH3 kod+migratsiya jonli;
  API boot bo'lgan → `COST_QUOTE_SECRET` o'rnatilgan; legal sahifalar LS; attestation server-enforce;
  bundle `com.frameflow`. ⚠️ Tashqaridan tekshirib BO'LMADI: **Apply target margin bosilganmi** (Admin →
  Pricing'da tasdiqla — Seedance 4k Apply'gача zararда!) · AE plagin jonli test · SENTRY/BACKUP/
  MODERATION/LS-LIVE env'lар prod'да o'rnatilganmi.
- 🔴 **ENG KATTA BLOKER — KONTENT:** prod katalogда FAQAT 1 shablon published (landing esa "5000+"
  deydi — nomuvofiqlik). Launch'дан oldин katalog to'ldirish yoki landing raqamlarини moslash SHART.
- 👉 **KEYINGI:** Stock **S2** (ingest quvuri) — `docs/STOCK-EXPANSION-PLAN.md` (S2→S6 hali yozilmagan).
- 🚧 **AKTIV — BytePlus/Seedance migratsiya** (`docs/FIX-PROMPTS-BATCH5-2026-07-11.md` + API sxema:
  `docs/BYTEPLUS-DOCS-MODELS.md` TO'LIQ tasdiqlangan): USER hisob ochdi, ModelArk ishlaydi, narx
  2-3.3× arzon. **USER QARORI: Seedance FAQAT BytePlus — fal-fallback YO'Q** (fal qimmat); yuzli
  referens → aniq xato + refund (BytePlus real yuzni bloklaydi; keyingi faza: Seedream zanjiri
  AI-yuzni ochadi). **Topaz 3201 fal'да QOLADI.** ⚠️ Seedance aktivatsiya = prepaid resource pack
  SHART (bepul token yo'q). Scope kengaydi: **video (Prompt #1) + RASM Seedream (Prompt #2)** —
  plagin+web ikkalasi bitta katalogdan avtomatik oladi; Vertex rasm modellari parallel qoladi.
  Region: **Johor (ap-southeast-1)** — Dublin EMAS (API key ham shu regionда).
  ✅ Bosqich 0 TUGADI (2026-07-11): pack olindi ($30.10, 7M token, 90 kun!) · Dreamina-Seedance-2.0
  + Dola-Seedream-5.0-Pro AKTIV (5.0-lite: 50 bepul rasm — activate qilinsin) · API key lokal .env'да.
  Eslatma: bulk-activate oynasi ishlamaydi (mini pack yo'q) — har modelni QATORIDAN yakka activate.
  ✅ **Prompt #1 BAJARILDI** (commit 17ece57, push YO'Q): byteplus.ts adapter · 3102→BytePlus
  ("Seedance 2.0" nom) · 3101 Fast disabled (pack yo'q) · JONLI TEST PASS (t2v 480p/4s, 70s,
  40,594 token — formula mos, pack'дан ≈$0.17). Token sarfida multiplier YO'Q — $4.30/1M pack
  narxi amal qiladi, jadval to'g'ri (birinchi invoice bilan yakuniy tasdiq).
  ✅ **Prompt #2 BAJARILDI** (commit 06f7bc7): byteplusImage() · 1020 Seedream 5.0 Lite
  (enabled:false — narx tasdiqlanmagan) · 1021 Seedream 5.0 Pro (enabled:true, 1K $0.045/2K $0.09) ·
  jonli test PASS ikkalasida (Lite 2K 32s / Pro 1K 115s, GCS'га tushdi). ⚠️ Lite'ni yoqish = kod
  o'zgarishi (admin toggle /gen gate'га ta'sir qilmaydi) — Lite rasmiy narxi topilгач.
  ✅ **Prompt #4 BAJARILDI:** rewriteMentionTokens (kadr-OFFSET fix: @img1+start-frame→"Image 2",
  BytePlus frame'ларни ham sanaydi!) + 12-case build-test + edit-preset chiplari (Replace/Edit/
  Inpaint, ikkala composer, SD2-EDIT-PRESETS marker bilan qo'lda sync).
  ✅ **BATCH5 KOD TO'LIQ TUGADI** — #1 adapter (17ece57) · #2 Seedream (06f7bc7) · #4 mention+preset ·
  #5 start/end kadr (c6abc9f) · #7 nisbat/piksel (96ab7c5) · #6 Dreamina pill-editor (34114f4).
  Faqat #3 cleanup qoldi (prod'да 1-2 hafta barqarorlikdan keyin). ⚠️ PROBLEM 3 kuchda: Seedance 2.0
  plaginда ko'rinmaydi (web-only) — ochish alohida qaror. 👉 **HOZIR: USER push** (7+ commit) →
  Actions deploy → WEB jonli E2E checklist: Seedance 2.0 video (kadr+@pill+preset chip) · Seedream
  ✅ **BATCH5 RASMAN YOPILDI (2026-07-12):** push+deploy OK · Apply target margin BOSILDI ·
  **web E2E PASS** (USER tasdig'i: Seedream nisbat, Seedance kadr, @ pill, preset-chiplar, video
  generatsiya — hammasi ishladi). Qoldiq: Fast pack (xohlaganda) · #3 cleanup (1-2 hafta keyin).
- 🚧 **BATCH6 — Higgsfield-ilhom redizayn** (`docs/BATCH6-REDESIGN-BRIEF.md` + promptlar:
  `docs/FIX-PROMPTS-BATCH6-2026-07-12.md`): ✅ Prompt #0 TUGADI (916c148) — TO'LIQ-sayt mockup
  `docs/mockups/batch6/index.html`: ✅ Prompt #0.5 vizual QA ham TUGADI (63b46dd) —
  **46 ekran × 3 tema (noir/neon/cold)**, real katalog verifikatsiya, kritik buglar tuzatilgan
  (qora katalog / ko'rinmas kompozer / footer), 25+ hover, 3 temada skrinshot-tasdiq.
  ✅ **USER QARORLARI:** 3 tema HAMMA JOYDA foydalanuvchi tanlovida · **default = A NOIR** ·
  token-first majburiy (hardcode rang = defekt, har prompt 3-temada tekshiriladi).
  ✅ Prompt #1 BAJARILDI (b216fab): PRODUCTION'да 3-tema tokenlar + compat-shim (lime→theme,
  hech narsa buzilmadi) + Space Grotesk/Inter/JetBrains Mono + nav/footer yangi chrome + tema-
  tanlagich (localStorage ff-theme, FOUC'siz). Qoldiq: 103 bo'lim-lime literal (keyingi
  promptlar hal qiladi) · mega-menyu Home promptiда · footer 4-ustun = CMS qarori.
  ✅ Prompt #2 (50ff85c) Home/landing 1:1 + mega-menyu, landing lime 103→0.
  ✅ Prompt #3 (c3b9cab) Templates katalog+detal+Pro-gate 1:1 (hero+⌘K qidiruv, All-pill, yopishqoq
  toolbar, player-bar, spec-list, inline gate→#pricing); scope lime 5→0; 1-element/empty holatlar halol.
  ✅ Prompt #4 (90a4971+6ffca7b): Dashboard+Projects+Credit-modal 1:1; app yuzasida 65 lime literal→
  token (3 tema ilova ichida ham to'g'ri); Sparky mascot tema-mos; BATCH5 chip-editor TEKSHIRILDI sog'.
  ⚠️ Kompozer/model-picker/history: tema-mos lekin 1:1 tasdiq REAL data bilan qilinmadi (lokal backend
  yo'q) — USER jonli saytда ko'radi, kamchilik chiqsa #4c mini-prompt.
  ✅ Prompt #5 (eee5b68): Auth+Account 1:1 — in-app auth split-layout (media-art+quote) ·
  account-head kicker+underline tabs · REAL kontent (250/600/1800, Studio 3000, ledger refund) ·
  standalone reset/verify/device sahifalari tema-tizim oldi · lime→0. ⚠️ `login.html` = Contributor
  konsoli — TEGILMADI (USER logini in-app; kontributor konsol reskini = alohida qaror).
  ✅ **Prompt #6 BAJARILDI (2026-07-14, commit 1d9c729) = BATCH6 YAKUNLANDI.** Pricing 1:1
  (REAL CMS narxlar: Free $0/50 · Pro $19/1000 · Studio $59/3000 — mockupdagi eskirgan
  matn ishlatilmadi) · Plugin sahifa 1:1 · help/terms/privacy/refund/dmca 3-tema token +
  nav/footer chrome · `#C2F04A` literal = 0 hamma joyda (`var(--lime)` 176 saqlangan) ·
  3 tema × 5 sahifa skrinshot-tasdiq. Eslatma: auto-commit hook 3 ta hujjat faylini (handoff,
  FIX-PROMPTS-BATCH6/8) shu commitga qo'shib yuborgan — zararsiz.
  ⚠️ Repo'да aralash unpushed commitlar (MUAMMOLAR 3 + BATCH6 + V2 boshlanishi) — push
  hammasini birga chiqaradi.
  👉 KEYINGI: **USER PUSH + jonli ko'rik** → V2-EASY combined (endi platform/index.html
  TOZA — BATCH6 guard to'sig'i yo'q) → BATCH7 CMS → BATCH8 plagin (#0-R mockup TAYYOR;
  USER 2026-07-15: **Dashboard B = default Home** + **1:1 web-parity QAT'IY talab**;
  ✅ #0.5 BAJARILDI (ecc1364): Pro-gate + gen-progress pane + 820/620/500 balandlik + popover
  polish; LEKIN parity'да 3 xato — Code BATCH6 maketни haqiqat deb oldi (Improve/modal-matn/
  chip-shakl production'дан farqli). 🔴 QOIDA: maket vs production farq qilsa —
  **production (`platform/index.html`) yutadi**. Port 2 promptда (SKIN ONLY, Fable 5 High).
  ✅ **PORT 1/2 BAJARILDI (584e6a1, push YO'Q):** mockup-fix + noir/neon/cold tokenlar
  (legacy-token alias'lar bilan — eski panellar buzilmaydi) + Space Grotesk/Inter/JetBrains
  lokal (12 woff2) + Dashboard B (real hook'lар: hmList/homeGo/kredit) + auth/device-code +
  install-cep.sh FIX (shriftlar hech qachon ko'chirilmasdi!).
  ✅ **PORT 2/2 BAJARILDI (34636f6, push YO'Q) = BATCH8 KOD TUGADI.** Asosiy topilma:
  plagin avvalgi batch'lардан allaqachon skin'langan ekan — qolgan ish: 30+ hardcode lime
  literal → tema-token (noir/cold'да lime oqishi tuzatildi) + "Enhance · ✦1" + "Choose a
  model" matnlari. 41-qatorlik 1:1 diff, mantiq/pul-zona tegilmagan, 7 inline script
  node--check OK. ⚠️ Deferred: model-sheet qidiruvi (xatti-harakat o'zgarishi = SKIN-ONLY
  taqiq — alohida qaror) · gen-progress kartalari offline tekshirib bo'lmadi (jonli testda).
  ✅ **Prompt #3 ham BAJARILDI (70ab4d4):** model-sheet qidiruvi (sanktsiyalangan kichik
  xatti-harakat) + app-bar maket anatomiyasi (brend + kontekst-label, id/handler'lар
  saqlangan). **PUSH BO'LDI** — origin/main = 70ab4d4. Seedance-plaginda-ochish = alohida
  mahsulot qarori (ochiq). 👉 QOLDI: **USER AE to'liq restart (⌘Q) + JONLI TEST**
  (login + Dashboard B + ↻ Sync + 1 generatsiya [progress kartasi!] + 1 import + 3 tema +
  model qidiruv). Solishtirish: `docs/mockups/batch8-plugin/compare.html`).
  🔴 **JONLI TEST NATIJASI (2026-07-16): USER skin-portni RAD ETDI** — tuzilish eski
  (launcher, karta-composer), maket bilan 1:1 emas. **USER QARORI: "faqat skin" (variant B)
  BEKOR → STRUKTURAVIY 1:1, xatti-harakat saqlanadi.** Reja: **#R1** (AI Studio workspace:
  launcher o'chadi, sessiya-lenta + dok-composer + mockup natija-kartalari) → USER jonli
  test → **#R2** (Browse/Library/Settings/States/Auth + eski qoldiqlar). Ikkalasi batch
  faylда tayyor (Fable 5 High). Feature-survival ro'yxati to'liq kuchda.
  ✅ **#R1 BAJARILDI (4e15e04, push YO'Q):** AI Studio 3 view (image/video/audio) mockup
  workspace anatomiyasiga qayta qurildi — sessiya-lenta + viewbar + stage + dok-composer;
  hamma id/handler saqlangan (rewire, rewrite EMAS), `.axws` scoped CSS. Kalta panel ≤560px
  = butun workspace scroll (Generate hech qachon kesilmaydi). ⚠️ #R2'ga qoldi: Upscale
  source-first composer (hozir halol toast) · Browse/Library/Settings/States/Auth tuzilishi.
  🔴 #R1 jonli AE'да BUZILDI (prompt ko'rinmas, layout rasvo) — #R1 QA sun'iy overlay'да
  o'tgan edi. ✅ **#R1-FIX BAJARILDI (b078d70):** 2 ildiz-sabab: (1) balandlik zanjiri
  cheklanmagan → composer fold'дан 1.5 ekran pastда; (2) chip-editor CSS `.pbox` scope'да
  qolib, ko'chirilgan promptга umuman uslub tegmagan (ko'rinmas 22px). 21-qator fix:
  #aiPage.axws-tool height:100% zanjiri + overflow-y:auto degradatsiya + .axws-promptwrap
  chipedit uslublari + Generate ichida cost-tag qaytarildi. In-place matritsa PASS.
  🔴 **USER QARORI (2026-07-16): STRATEGIYA O'ZGARDI — TAB-MA-TAB QAYTA QURISH.**
  Plagin UX/UI holati yomon; eski plagin ko'rinishi ENDI DIZAYN MANBASI EMAS. Direktor
  dizayner sifatida har tab uchun to'liq spetsifikatsiya yozadi (asos: tuzatilgan BATCH8
  mockup + production tokenlar), Code yangi namespace'да noldan quradi, USER har tabни
  ko'rib tasdiqlaydi, keyin keyingisiga o'tiladi. Tartib: **HOME (#H1)** → USER ko'rigi →
  keyingi tab (AI Studio / Catalog / Library / Settings). #R2 muzlatildi (bekor emas,
  strategiya almashdi).
  🔎 **DIREKTOR JONLI AUDIT (2026-07-16, computer-use bilan AE ichida, panel ≈345px):**
  HOME: chap-kesik (kritik layout bug) · balans 2x · hero dekorlari media ustida · kulrang
  CTA · tokcha meta xato. AI: pill'lar "MODEL V."/"OUT 16:..." gacha qisqargan · 6 boshqaruv
  1 qatorda · sessiya=xom prompt matn · audio bo'sh karta · app-bar yo'q (3 xil header).
  LIBRARY: har kartada 6 belgisiz ikonka · bo'sh placeholder'lar · yuklanish=qora ekran.
  CATALOG: har kartada Re-import tugma · pastda 2 texnik bar (build hash ko'rinadi) ·
  340px'da 3 ustun. YAXShI: Account sheet, tema tizimi, umumiy noir baza. #H1 prompt shu
  audit asosida qayta yozildi (6 defekt, Fable 5 Medium) — USER'ga berildi.
  🔴 **USER #H1'ni ham RAD ETDI — "eski plaginni yamash emas, YANGI dizayn kerak".**
  Direktor chuqur so'rovnoma o'tkazdi (3 bosqich). ✅ **YANGI STRUKTURA TASDIQLANDI
  (2026-07-16, USER so'rovnoma javoblari):** yagona tepa panel, 4 tab **Home · AI ·
  Stock · Ishlarim**; HOME = banner + so'nggi ishlar + shablon tanlovi (prompt YO'Q);
  AI = composer (rejim prompt yonida) + sessiya/Projects TO'LIQ qoladi + gen FONDA
  (erkin yurish, tugaganda xabar); ISHLARIM = AI ishlar + yuklab olganlar BIRGA
  (filtr + Projects + bulk); hisob/kredit/top-up/tema — BITTA avatar oynasida;
  texnik barlar Account ichiga. Eski launcher/marketing-Home/3xil header O'CHADI.
  ✅ **DIZAYN-USLUB HAM TASDIQLANDI (so'rovnoma):** referens = Higgsfield + Artlist/
  Frame.io · rang muhiti = DARK asosiy + LIGHT tanlov · aksent = BITTA rang: MOVIY-OSMON
  (sky blue, lime BEKOR) · zichlik = HAVODOR (katta bo'shliq, yirik element) · sarlavha =
  geometrik-zamonaviy (Space Grotesk qoladi). Eski #H1/#R2 promptlari BEKOR (eski strukturaga edi).
  ✅ **YANGI #H1 BAJARILDI (9448382, PUSH BO'LDI — origin/main=9448382):** Home tab clean-room
  `.fhome` (Direktor spec 1:1) — jonli model narxlari (`/gen/models`), real-katalog javoni
  (fallback yo'q), QA: 3 tema × 320/420/600 × 820/620/500 PASS, install-cep.sh bajarilgan.
  🆕 **R4 DAVRA (2026-07-20):** `docs/FIX-PROMPTS-R4-2026-07-20.md`.
  ✅ **R4_01 (f74c7ee):** Seedance 2.0 Mini (3103) — aktiv, e2e tasdiqlangan.
  ✅ **R4_02 (a7dd487):** Kling 3.0 to'g'ridan-API — YANGI provayder `kling.ts`; 5 model
  (3004 t2v/3005 Turbo/3008 Omni-video/1030 Image/1031 Image-Omni), 5/5 e2e tasdiqlangan,
  R2'ga tushdi. Eski fal placeholder 3004/3005 haqiqiy Kling bilan almashtirildi.
  ✅ **R4_03 (10f2d07):** Topaz POYDEVOR — `topaz.ts` adapter + dormant provayder yo'llari,
  0 model / 0 UI / pul-zona daxlsiz. Probe: auth PASS · 46 supportedModels · video-create
  PASS · 🔴 rasm 412 "No valid subscription" (EGA: Topaz obuna kerak). Manba:
  `docs/TOPAZ-API-NOTES.md` + `docs/topaz/*.yaml`.
  ✅ **R4_07 (5e4197d):** Topaz OPERATSIYA katalogi (composer modeli EMAS, opType-filtrli) —
  5001 Upscale Video (Proteus) ✅ · 5002 Upscale Image (Gigapixel) ✅ · 5003 RemoveBG ❌
  (Topaz'da 3/3 Failed — EGA: Topaz planда Matting/BG yoqilsin, kod tayyor). Narx marja
  qoidasi + `TOPAZ_USD_PER_CREDIT` env. Pul-zona daxlsiz, boot floor PASS.
  ✅ **R4_05 (d5a5eb6):** o'lchangan xarajat marja/panelga ulandi — Seedream Lite/4.5
  narx $0.50→$0.0705, marja **−229%→+54%**. Xavfsizlik: BytePlus rasm token→USD invoys
  bilan tasdiqlanmagan → o'lchov faqat video + jadvalsiz rasm(Lite/4.5)da ishlatiladi,
  tasdiqlangan jadvalni pasaytirmaydi. Control (Nano Banana) o'zgarmagan, floor PASS.
  ✅ **R4_06 (fd4a7ef):** Pricing panelда measured/table/estimate belgilar + "Measure cost"
  tugma (jonli probe) + "Measure all missing" + "cost rose" tasdiq-gate.
  ✅ **R4_08 (65331b5):** gen/library kartada bir-klik **Use ▸ Upscale** (plagin+web) —
  yangi `GET /gen/ops`. Gigapixel rasm E2E ishladi (✦11→done→R2). Topaz nihoyat userда.
  ✅ **R4_04 (4520fcb):** Google real-yuz rad etilishi → toza xabar (xom JSON yo'q) +
  real-yuz modeli taklifi (Omni→Seedance Fast); bad-params 400 over-match yo'q.
  🟢 **R4 DAVRA TUGADI — hammasi origin/main'da (e1aa2f5).** Topaz bir-klik: Gigapixel rasm
  + Proteus video 2×/4× yoqilgan; RemoveBG entitlement kutmoqda.
  🔑 EGA: (1) Topaz Matting/BG yoqilsin → 5003 enabled · (2) Seedream rasm narxini haqiqiy
  invoysga solishtir · (3) "Measure cost" faqat BytePlus (token); boshqalar jadvaldan.
  🔑 EGA: Topaz obuna aktivlashtirish · narxlarni 1-invoysdan keyin admin Apply-margin ·
  probe skriptlar qayta ishlatiladi (probe-kling/topaz/byteplus, e2e-gen-once).
  ✅ **SC-3 DAVRA TUGADI (2026-07-17): 13/13 (SC_41B–SC_53), 13 commit, PUSH YO'Q** —
  `docs/FIX-PROMPTS-SC3-2026-07-17.md` + `docs/SESSION-REPORT.md` (13-model PASS jadvali).
  Bo'sh-ekranlar o'chdi · Favorites olib tashlandi (backend jadval tegilmagan) · yagona
  chrome · ovoz pikeri · composer 3-qatorli anatomiya + ikonkali sig'im · sessiya/karta
  ochilishida chaqnash yo'q · Home 3→6 zona + admin New/Top rail (`home.rails` sxema) ·
  My Library masonry + Use ichida · web katalog fluid · motion tizimi.
  👉 QOLDIQ (EGA/keyingi davra): SC_50 Explore zonasi + CMS sarlavhalar + kategoriya
  sonlari · SC_52 web rail pariteti + admin drag-tartiblash · SC_49 prod favorites
  ma'lumot qarori · deploy (push → API → wrangler → CF Pages → migratsiya) → AE E2E.
  ✅ **SC-2 DAVRA TUGADI (2026-07-17): 16/16 (SC_25–SC_40), har biriga commit, PUSH
  qisman** — `docs/FIX-PROMPTS-SC2-2026-07-17.md` + jamlama `docs/SESSION-REPORT.md`
  (SC_30 amal-matritsasi + SC_27 13-model PASS jadvali shu yerda). Asosiylari: sessiya
  scoping/rename · Use ▾ amallari · bulk delete · qidiruv · CMS zanjiri (prod media =
  worker redeploy!) · auth audit · per-model payloadlar · to'liq-panel + jonli resize ·
  konstitutsiya passi · −34KB o'lik kod. 👉 EGA: (1) `wrangler deploy` cdn-proxy —
  prod CMS media shuni kutyapti · (2) push + API deploy (rename PATCH ham) · (3) bucket
  CORS (dev presign) · (4) jonli AE E2E (⌘Q: resize, CMS 5daq, har rejim 1 gen, Import,
  rename, bulk delete, search, sign-out/in). Plagin UI Konstitutsiyasi 4-bo'limda.
  ✅ **SC OQIMI TUGADI (2026-07-17): 23/23 bajarildi, 23 commit, PUSH YO'Q** —
  `docs/FIX-PROMPTS-SC-2026-07-16.md` + `docs/SESSION-REPORT.md`. Asosiylari: Plugin CMS
  (backend+admin+plagin wiring, `landing/` CDN 403 bug fix) · doimiy markaziy 3-tab seg ·
  History→My Library · session picker + toza nomlar · Upscale butunlay o'chirildi
  (pul-zona tegilmagan, cost-quote toza 400) · fon-generatsiya + toast · Home redesign
  jonlandi · katalog karta/detal/grid · composer + chip fix · compact/microcopy/skeleton
  sweep'lar. 👉 KEYINGI (EGA): push → API deploy → `wrangler deploy` (cdn-proxy) →
  CF Pages → prod migratsiya `plugin_content_config` → AE ⌘Q + jonli E2E (CMS edit→5daq
  plagin · gen→toast · import). Qo'lda: landing megamenyuda "Video Upscale · Topaz" qatori
  qoldi (ffl- scope tashqarisi edi). Web account compact — xohlasa alohida.
- ⏳ **Deferred:** headless admin E2E · BATCH5 Prompt #3 (fal Seedance cleanup — prod'да 1-2 hafta
  barqarorlikdan KEYIN) · **BATCH7 = Site CMS kengaytmasi** (BATCH6'dan KEYIN: help/legal(versiyali)/
  promo-strip/SEO-OG/ticker/cinema/presets/mega-model-ro'yxat admin'дан; page-builder EMAS) ·
  **BATCH8 = AE plagin redizayni web'ga moslash** (USER niyati 2026-07-12: BATCH6 tokenlar/naqshlar
  plaginга ko'chiriladi — 3 tema + Higgsfield-uslub composer; BATCH7'dan keyin).

---

## 6. HUJJATLAR XARITASI (tarix va tafsilot shu yerда)

**MUAMMOLAR oqimi (2026-07-12/13 — parallel direktor, TUGADI):**
- `docs/MUAMMOLAR-1-POYDEVOR-PUL-MIQYOS.md` — 30 muammoning yarmi: infra · pul · miqyos · xavfsizlik.
  **Boshida STATUS + A→J bo'laklar jadvali.** ⚠️ `P7.CDN` bo'limi — bucket'ni ochish PULLIK PACK'LARNI
  SIZDIRADI (Worker yechimi shu sabab).
- `docs/MUAMMOLAR-2-MAHSULOT.md` — AI Studio · kompozer · katalog · kontent quvuri · AI Stock.
  ⚠️ `P30` — **DIREKTOR QARORI: provayder xavfsizlik filtrini chetlab o'tish uchun hech narsa
  qurilmaydi** (hisob yopiladi). `P13` — referens hovuzi (qayta raqamlash = jimgina buzilish).
- `docs/PERF-BASELINE.md` — 50/500/5000 asset o'lchov raqamlari.
- `workers/cdn-proxy/README.md` — CDN Worker deploy.

- `docs/PROJECT-STATUS.md` — loyiha JORIY holatining yagona kod-tasdiqланган manbai.
- `docs/FIX-PROMPTS-BATCH3-2026-07-10.md` — **aktiv** fix promptlar.
- `docs/FIX-PROMPTS-2026-07-09.md` (16) · `docs/FIX-PROMPTS-BATCH2-2026-07-09.md` (21) — bajarилган batchlar.
- `docs/QA-FIX-PLAN.md` — 16-muammo QA rejasi (partiyalar tugagan).
- `docs/LAUNCH-READINESS.md` · `docs/THREAT-REGISTER.md` · `docs/HARDENING-FAZALAR.md` — audit/hardening.
- `docs/KONTENT-QUVURI-SXEMA.md` — kontent modeli (F1–F6).
- `docs/COMPOSER-MECHANISM-ANALYSIS.md` — Mister Horse mexanizm tahlili.
- `docs/FAL-*.md` — fal.ai migratsiya referenslari.
- `docs/SESSION-REPORT.md` — oxirги sessiya hisoboti.

---

## 7. FOYDALANUVCHI TASHQI LAUNCH QADAMLARI (kod EMAS — checklist)

Bular Code emas, foydalanuvchi o'zi qiladi (prod'да pulли ishga tushишдан oldin):

- `COST_QUOTE_SECRET` o'rnat (yo'q bo'lsa API boot bo'lmaydi) · `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`
- `PAYOUT_MODE` / `CONTRIBUTOR_POOL_SHARE` qaror · `SENTRY_DSN` (+ `npm i @sentry/node`)
- Backup bucket + versioning (`BACKUP_GCS_BUCKET`) · sir rotatsiya
- Turnstile kalitlari · Resend domen+DKIM/SPF+`EMAIL_FROM` (yo'q bo'lsa register/kredit fail-closed blok)
- `MODERATION_API_KEY` · `VIRUSTOTAL_API_KEY` · `MODERATION_MODERATE_OUTPUTS`
- Lemon Squeezy identity → LIVE · webhook qo'sh · `LEMONSQUEEZY_STORE_ID` + `LEMONSQUEEZY_WEBHOOK_SECRET`
- GCS `incoming/` CORS + 7-kun lifecycle · Cloud Run `--timeout=900`
- 2FA enrol → keyin `ADMIN_REQUIRE_2FA` · yurist legal ko'rigi · katalog kontent to'ldirish
- Eski buzuq shablonlarни QAYTA yuklash (asl zip o'chgan — P7)
