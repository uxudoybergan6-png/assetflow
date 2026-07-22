# MARKETPLACE SUBMISSION — FrameFlow AE plagini (Adobe Developer Distribution)

> Operator qo'llanmasi. **Hech narsa Adobe'ga TOPSHIRILMAGAN.** Bu hujjat kod tomonidan
> bajarilishi mumkin bo'lgan hamma narsani va EGA qilishi kerak bo'lgan narsalarni ajratadi.
> Yagona haqiqat manbai: `plugins/after-effects-cep/CSXS/manifest.xml` +
> `scripts/package-flavors.mjs`. Paketlash/imzolash siyosati: `docs/RELEASE-ARCHITECTURE.md`.
> Oxirgi yangilanish: 2026-07-22.

## 0. Nima rasmiy fakt, nima emas

Faqat quyidagi uch manba tasdiqlangan; boshqa Adobe siyosati (ko'rib chiqish muddati, to'lov,
entitlement qoidalari, mosolik va'dalari) bu hujjatda **TAXMIN QILINMAYDI**:

1. Developer Distribution CEP/ZXP listingini qabul qiladi; CEP paketi (CSXS manifest + extension
   HTML) va **ZXPSignCmd** bilan imzolash oqimi talab qilinadi —
   <https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview>
2. Marketplace / Creative Cloud Desktop **bir bosishda o'rnatish** va **avtomatik yangilanish
   bildirishnomasi/o'rnatishini** beradi —
   <https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/best-practices>
3. Adobe CEP namunasi ZXPSignCmd'ni hujjatlaydi; **o'z-o'zidan imzolangan** yoki **tijorat**
   sertifikati mumkin —
   <https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/ReadMe.md>
   Vositaning o'zi (imzolash **va** `-verify` tekshiruvi) —
   <https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD>

---

## 1. Avtomatik buyruqlar (Claude Code tomoni — TAYYOR)

```bash
npm run preflight:marketplace              # QA STRUKTURA — kredensialsiz, ZXPSignCmd CHAQIRILMAYDI
npm run preflight:marketplace -- --release # RELIZ — imzolangan .zxp + ZXPSignCmd -verify SHART
npm run test:marketplace-preflight         # preflight regressiya/mutatsiya testi (100 case)
# vosita yo'li standart joylarda bo'lmasa (test/CI):
npm run preflight:marketplace -- --release --zxpsigncmd=/path/to/ZXPSignCmd
```

| Buyruq | ✅ o'tdi = nima | ❌ yiqildi = nima |
|---|---|---|
| `preflight:marketplace` (QA) | Jonli manifest ↔ flavor manbasi drifti yo'q; YANGI qurilgan mijoz arxivi tuzilma jihatdan to'g'ri (fayl ro'yxati aynan, referenslar yechildi, Admin/debug/sir/masofaviy kod yo'q) | Paket topshirishga yaroqsiz — chiqishdagi `✗ FAIL` qatorini tuzat |
| `preflight:marketplace -- --release` | Yuqoridagilar + **Adobe ZXPSignCmd `-verify` AYNAN topshiriladigan `.zxp` ustida MUVAFFAQIYATLI** (paket lokalda KRIPTOGRAFIK tasdiqlandi) + konteyner tanasi joriy payload baytlariga teng + ega metadata to'liq | Topshirish MUMKIN EMAS (ZXPSignCmd yo'q / `-verify` kodi ≠ 0 / imzo konverti yo'q / bayt mos emas / ega maydoni bo'sh) |
| `test:marketplace-preflight` | Preflight buzuq holatlarni haqiqatan ushlaydi (mutatsiya isboti) | Tekshiruvlar bo'shab qolgan — preflightga ishonib bo'lmaydi |

> ⚠️ **QA rejimi HECH QACHON "topshirishga tayyor" demaydi.** U imzolangan artefaktni ham,
> kriptografik imzoni ham tekshirmaydi (ZXPSignCmd'ni umuman chaqirmaydi) va buni chiqishda
> aniq aytadi.
>
> ℹ️ **CHEGARA (halol):** release rejimi paketni **Adobe'ning o'z vositasi bilan lokalda
> kriptografik tekshiradi** (`ZXPSignCmd -verify`). Bu **yakuniy qabul EMAS**: listingni qabul
> qilish, sertifikatga ishonch siyosati va tarqatish qarori — **Adobe portali / Creative Cloud**
> ixtiyorida qoladi. Konvert borligi (`META-INF/signatures.xml`) va konteyner baytlarining mosligi
> — ALOHIDA, arzonroq tekshiruvlar; ular **o'z-o'zidan** imzoni isbotlamaydi va hisobotda ham
> shunday nomlanadi ("imzo konverti mavjud", "konteyner tanasi … baytlariga teng").
>
> 🔐 ZXPSignCmd chiqishi (stdout/stderr) **hech qachon** chop etilmaydi — faqat o'tdi/yiqildi
> (chiqish kodi) va "vosita topilmadi" holati. `ZXP_CERT`/`ZXP_CERT_PASS` preflightda umuman
> o'qilmaydi; ega email'i ham hech qayerga chiqarilmaydi.

---

## 2. Koddan olingan aniq qiymatlar (2026-07-22 holati)

| Nima | Qiymat | Manba |
|---|---|---|
| Flavor | `customer` (ommaviy) | `scripts/package-flavors.mjs` |
| Extension ID | `com.frameflow.panel` | `CSXS/manifest.xml` |
| ExtensionBundleId | `com.frameflow` | `CSXS/manifest.xml` |
| ExtensionBundleName | `FrameFlow` | `CSXS/manifest.xml` |
| Versiya | **1.1.1** (3 joyda sinxron) | manifest · manifest.admin · `window.AF_PLUGIN_VERSION` |
| MainPath (extension HTML) | `./AssetFlow_Plugin.html` | `CSXS/manifest.xml` |
| ScriptPath | `./jsx/host.jsx` | `CSXS/manifest.xml` |
| **Host mosligi** | **FAQAT `AEFT` `[22.0,99.9]`** | `CSXS/manifest.xml` `<HostList>` |
| RequiredRuntime | `CSXS 11.0` | `CSXS/manifest.xml` |
| Paket fayllari | **36** (HTML + 7 JS + CSInterface + host.jsx + 3 CSS + 22 shrift + manifest) | `package-flavors.mjs` |
| Topshiriladigan artefakt | `dist/zxp/frameflow-plugin-v1.1.1.zxp` | `artifactName()` |
| QA arxivi (topshirilmaydi) | `dist/zxp/frameflow-plugin-v1.1.1-unsigned.zip` | `artifactName()` |

Ega metadata fayli: **`plugins/after-effects-cep/marketplace-submission.json`**
(kod qiymatlari u yerda TAKRORLANMAYDI — faqat ega qarorlari).

**Ma'lum, bloklovchi bo'lmagan kuzatuv:** paketdagi 6 ta `ibmplexmono-*` shrifti hech qanday
CSS'dan chaqirilmaydi (preflight `ⓘ` qatori bilan xabar qiladi). Bu faqat hajm masalasi;
payload ro'yxatini o'zgartirish installer hash isbotlariga tegadi, shuning uchun ALOHIDA ish.

---

## 3. Adobe portalida EGA qiladigan qadamlar (kod EMAS)

1. **Adobe Developer Distribution hisobi** — ro'yxatdan o'tish / kirish; nashriyot profilini
   to'ldirish. Faqat ega qila oladi (hisob, identifikatsiya, soliq/to'lov ma'lumotlari).
2. **Imzolash sertifikati + `ZXPSignCmd`** — `.p12` olish yoki yaratish (rasmiy fakt #3:
   o'z-o'zidan imzolangan yoki tijorat sertifikati mumkin) va Adobe vositasini o'rnatish
   (<https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD>). Vosita `PATH`da yoki
   `/Applications/Adobe Extension Manager CC/`, `~/bin/`, `<repo>/tools/` ichida bo'lsa
   avtomatik topiladi (aynan `build-zxp.sh` dagi joylar); aks holda `--zxpsigncmd=<path>`.
   **Sertifikat va parol repo'da HECH QACHON saqlanmaydi**; ular faqat operator muhitida yashaydi.
   Vosita yo'li — sir emas, sertifikat esa sir: preflight uni o'qimaydi ham.
3. **Imzolangan `.zxp` qurish** (kredensiallar faqat env'dan):
   ```bash
   ZXP_CERT=/secure/path/frameflow.p12 ZXP_CERT_PASS='…' \
     bash plugins/after-effects-cep/scripts/build-zxp.sh
   npm run preflight:marketplace -- --release
   ```
   `--release` shu artefakt ustida `ZXPSignCmd -verify` ni ISHGA TUSHIRADI; chiqish kodi 0
   bo'lmasa yoki vosita topilmasa — muvaffaqiyat xabari CHIQMAYDI (fail-closed).
4. **`marketplace-submission.json` ni to'ldirish** (4-bo'lim worksheet) va qayta
   `-- --release` ishga tushirish — HAMMASI ✓ bo'lguncha.
5. **Portalda listing yaratish**: nom, tavsif, kategoriya, kalit so'zlar, vizual assetlar,
   narx modeli, qo'llab-quvvatlash/maxfiylik havolalari → `.zxp` yuklash → topshirish.
6. **Ko'rib chiqish natijasini kutish.** Muddat/natija oldindan MA'LUM EMAS va bu yerda
   va'da qilinmaydi.

---

## 4. Listing matni worksheet (soxta da'vo TAQIQ)

Har maydonni `marketplace-submission.json` ga yoz. Preflight to'ldirilgan matnni skanerlaydi va
quyidagilar topilsa **YIQILADI**:

| ❌ TAQIQ | Sabab |
|---|---|
| Mijoz/yuklab olish soni ("12,000+ creators") | O'lchanmagan |
| Reyting/sharh ("4.9/5", "top-rated") | Hali reyting yo'q |
| Katalog hajmi ("5,000+ templates") | Prod katalogda bugun kam shablon bor |
| Qo'llab-quvvatlash kafolati ("24/7", "guaranteed", "money-back") | Kafolat berilmagan |
| Narx ("$9 per month", "free forever") | Narx portalda belgilanadi, matnda emas |
| "#1", "best", "world's leading" | Tasdiqlab bo'lmaydi |
| Manifestda yo'q ilova ("Premiere Pro", "DaVinci Resolve", …) | HostList faqat **After Effects** |

| ✅ RUXSAT (koddan tasdiqlanadi) | Manba |
|---|---|
| After Effects paneli, AE 22.0+ | `<HostList>` |
| Tasdiqlangan shablonlar katalogini ko'rish va import qilish | `assetflow-catalog.js`, `/api/plugin/catalog` |
| Panel ichida rasm/video/ovoz/SFX generatsiyasi (kredit asosida) | `/api/studio/gen*`, `lib/gen-models.ts` |
| Hisob/kredit balansi paneldan ko'rinadi | `assetflow-account.js`, `/api/studio/credits` |

To'ldiriladigan maydonlar: `listing.shortDescription`, `listing.longDescription`,
`listing.category`, `listing.keywords`, `listing.pricingModel`
(`free` | `paid` | `free-with-in-app-purchase`).
`owner.publisherAccountEmail` **email shaklida** bo'lishi shart (`n/a`, `owner-at-example.com`,
`owner@localhost` — release rejimida yiqiladi). Qiymatning o'zi hech qayerga chop etilmaydi
va uzatilmaydi — chiqishda faqat "shakl noto'g'ri" deyiladi.
`listing.name` **`FrameFlow`** bo'lib qoladi — manifest `ExtensionBundleName` bilan bir xil
bo'lishi majburlanadi.

### Vizual assetlar — **OWNER VISUAL INPUT**

Repo'da tasdiqlangan Marketplace vizual asseti **YO'Q**. Quyidagilarni ega tayyorlaydi va
`visualAssets.*` ga repo'ga nisbatan yo'lini yozadi (release rejimida fayl MAVJUDLIGI
tekshiriladi):

| Kalit | Nima kerak | Holat |
|---|---|---|
| `visualAssets.icon` | Listing ikonkasi | **OWNER VISUAL INPUT** — yo'q |
| `visualAssets.screenshot1` | Panel skrinshoti (katalog ko'rinishi) | **OWNER VISUAL INPUT** — yo'q |
| `visualAssets.screenshot2` | Panel skrinshoti (AI generatsiya ko'rinishi) | **OWNER VISUAL INPUT** — yo'q |

Aniq o'lcham/format talablari Adobe portalining yuklash formasida ko'rsatiladi — bu yerda
taxmin qilinmaydi.

---

## 5. Xavfsizlik chegarasi (buzilmaydi)

- **Topshirishga FAQAT imzolangan `.zxp` ketadi.** `-unsigned.zip` — lokal QA artefakti;
  nomi ataylab shunday va preflight uni topshiriladigan deb ko'rsatishga yo'l qo'ymaydi.
  Imzolanmagan zip imzolangan nom ostida turса — preflight YIQILADI.
- **"Imzo konverti bor" ≠ "imzolangan".** Har qanday zip'ga `META-INF/signatures.xml` qo'shish
  mumkin. Shu sababli release rejimi konvert/bayt tekshiruvlariga TAYANMAYDI: yakuniy hukmni
  Adobe'ning `ZXPSignCmd -verify` chiqish kodi beradi. Vosita yo'q bo'lsa tekshiruv
  **o'tkazib yuborilmaydi** — reliz bloklanadi.
- **Mijozga debug rejimi yoki qo'lda papka ko'chirish ko'rsatmasi BERILMAYDI.**
  `PlayerDebugMode`, `.debug` va `--disable-web-security` paketda bo'lishi TAQIQ (majburlanadi).
  Marketplace o'rnatishi bir bosishda ishlaydi (rasmiy fakt #2) — foydalanuvchidan Adobe
  xavfsizlik sozlamasini pasaytirish so'ralmaydi.
- **Marketplace kanali uchun Apple yoki Windows sertifikati KERAK EMAS.** U yerda faqat
  ZXP imzosi ishlatiladi (rasmiy fakt #1/#3). Apple Developer ID Installer + notarizatsiya va
  Windows Authenticode — FAQAT to'g'ridan `.pkg`/`.msi` kanali uchun; u **keyingi zaxira kanal**
  bo'lib qoladi (`acknowledgements.directInstallerChannel: "backup-later"` majburlanadi).
- **Sertifikat/parol hech qachon repo'da, artefaktda, logda yoki testda saqlanmaydi.**
  Preflight sertifikat YARATMAYDI va `ZXP_CERT*` ni umuman o'qimaydi (test majburlaydi).
- **Yangilanish kanallari birga yashaydi.** Marketplace/CC Desktop avtomatik yangilaydi
  (rasmiy fakt #2), panelda esa o'z yangilanish bildirishnomasi bor
  (`docs/PLUGIN-UPDATE-CHAIN.md`). Ega buni `acknowledgements.inPanelUpdaterCoexistence` da
  ANIQ tan olishi shart: `accepted-both-may-notify` (ikkalasi ham eslatishi mumkin) yoki
  `in-panel-updater-disabled-in-separate-task` (alohida ish sifatida o'chiriladi).
  **Bu vazifada panel updater xatti-harakati O'ZGARTIRILMADI.**

---

## 6. Versiya yangilash / rollback checklist

**Yangi versiya chiqarishda (uchala joy BIRGA):**

1. `CSXS/manifest.xml` → `ExtensionBundleVersion` **va** `<Extension … Version="…">`
   (ikkinchisi ilgari tekshirilmasdi — endi preflight uni majburlaydi).
2. `CSXS/manifest.admin.xml` → `ExtensionBundleVersion`.
3. `AssetFlow_Plugin.html` → `window.AF_PLUGIN_VERSION`.
4. `npm run preflight:marketplace` → ✓ (versiya sinxronligi shu yerda ushlanadi).
5. Imzolangan build → `npm run preflight:marketplace -- --release` → ✓.
6. Portalda yangi versiyani yuklash.

**Rollback:**

- Adobe listingidan versiyani qaytarish — **portal amali, ega qiladi**; kodda avtomatlashtirilmagan.
- Lokalda: `dist/zxp/frameflow-plugin-v<eski>.zxp` saqlab qo'yilgan bo'lsa, o'sha faylni
  qayta yuklash. Artefaktlar `dist/` ostida va **git'da kuzatilmaydi** — reliz artefaktini
  ega xavfsiz joyda arxivlashi kerak.
- Kod tomonida qaytish: versiyani uchala joyda oldingi qiymatga qaytar → preflight → qayta imzo.
- ⚠️ `npm run test:plugin-package` mavjud imzolangan artefakt turgan bo'lsa **hech narsaga
  tegmasdan to'xtaydi** (u imzolash nosozliklarini isbotlash uchun o'sha yo'lga vaqtinchalik
  fayl yozadi). Artefaktni ko'chirib/arxivlab, testni qayta ishga tushir.

---

## 7. Hozirgi holat (halol)

- ✅ Kod tomoni tugadi: preflight (QA + release), mutatsiya testi (**100/100**), ega metadata
  skeleti, hujjat.
- ✅ `npm run preflight:marketplace` (QA) **o'tadi** (67 tekshiruv, 0 fail).
- 🔴 **Yagona kod-yondosh tashqi bloker:** bu mashinada `ZXPSignCmd` ham (PATH · Extension
  Manager · `~/bin` · `<repo>/tools` — hech qayerda yo'q), imzolash identikasi ham YO'Q →
  imzolangan `.zxp` qurilmagan va kriptografik tekshiruv BAJARIB BO'LMAYDI. Shuning uchun
  `-- --release` **ataylab yiqiladi** (exit 1) va bu holat **zaiflashtirilmaydi**.
  Tekshirildi: soxta `META-INF/signatures.xml` qo'shilgan oddiy zip ham release rejimidan
  **O'TMAYDI** (vosita yo'q → fail-closed).
- 🔴 Ega ishi: Adobe hisobi, sertifikat + `ZXPSignCmd`, listing matni, vizual assetlar,
  portal topshirig'i. Yakuniy qabul — Adobe portali / Creative Cloud.
