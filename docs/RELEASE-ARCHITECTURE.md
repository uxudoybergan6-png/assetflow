# RELEASE ARCHITECTURE — FrameFlow AE plagini (paketlash va tarqatish)

> Amal qiladi: `plugins/after-effects-cep/`. Yagona haqiqat manbai —
> `plugins/after-effects-cep/scripts/package-flavors.mjs` (build, o'rnatma va testlar shundan o'qiydi).
> Oxirgi yangilanish: 2026-07-21 (Admin sirtini mijoz paketidan ajratish).

---

## 1. Xavfsizlik modeli — nima nimani himoya qiladi

**CEP kodi — DIZAYN BO'YICHA ochiq.** Adobe CEP paneli oddiy HTML/CSS/JS. `.zxp` — imzolangan
ZIP: foydalanuvchi uni ochib, o'rnatilgan papkadagi har bir faylni o'qiy oladi, CEP
DevTools bilan runtime'ni ko'ra oladi. Bu yo'qotilishi mumkin bo'lgan holat emas — platformaning
o'zi shunday.

- **Imzo (signing) MAXFIYLIK bermaydi — AUTENTIKLIK beradi.** `.zxp` imzosi "bu paket falon
  nashriyotdan keldi va yo'lda o'zgartirilmadi" degani. "Ichini hech kim ko'rmaydi" degani EMAS.
- **Minifikatsiya/obfuskatsiya xavfsizlik nazorati EMAS** va bu loyihada shunday deb
  hisoblanmaydi. U faqat hajm/o'qilishga ta'sir qiladi.
- **Haqiqiy chegara — server.** Sirlar (provayder API kalitlari, imzolash kalitlari, DB
  ma'lumotlari) va biznes avtorizatsiyasi (kim admin, kim Pro, kredit yechish, narx imzosi)
  FAQAT backendda yashaydi. Klientga faqat qisqa muddatli token beriladi; har admin marshruti
  serverda `requireAuth` + `requireAdmin` bilan qo'riqlanadi. Klient kodini o'qish bu
  tekshiruvlarni chetlab o'tishga imkon bermaydi.
- Shu sababli mijoz paketidan Admin panelini olib tashlash **maxfiylik uchun emas**, **hujum
  sirtini kichraytirish** uchun: ortiqcha imtiyozli UI, ortiqcha CEF imkoniyatlari va ortiqcha
  ichki ish oqimi har bir mijoz mashinasida turmasligi kerak.
- ⚠️ **"Ichki" (internal) = mijoz artefaktiga KIRMAYDI, "maxfiy" DEGANI EMAS.** Bu repo GitHub'da
  hozir **OCHIQ (public)** — ya'ni `AssetFlow_Admin.html` va `CSXS/manifest.admin.xml` manbasi
  baribir hamma uchun o'qiladi. Paketlash/imzolash manba maxfiyligini BERMAYDI va bunday deb
  taqdim etilmasin. Yagona haqiqiy himoya — serverdagi auth/avtorizatsiya va server tomonda
  yashaydigan sirlar (1-bandga qara).

---

## 2. Ikki alohida distributiv (flavor)

Bitta artefaktda ikkala extension ID **hech qachon** bo'lmaydi.

| | **customer** (ommaviy, default) | **admin** (ICHKI) |
|---|---|---|
| Extension ID | `com.frameflow.panel` | `com.frameflow.admin` |
| ExtensionBundleId | `com.frameflow` | `com.frameflow.internal.admin` |
| Manifest | `CSXS/manifest.xml` | `CSXS/manifest.admin.xml` |
| MainPath | `AssetFlow_Plugin.html` | `AssetFlow_Admin.html` |
| CEP papkasi | `…/CEP/extensions/com.frameflow` | `…/CEP/extensions/com.frameflow.internal.admin` |
| Artefakt | `frameflow-plugin-v<ver>[-unsigned]` | `frameflow-internal-admin-v<ver>[-unsigned]` |
| Kimga | obunachi mijozlar | faqat jamoa mashinalari |

- Papkalar va bundle ID'lar boshqa-boshqa → ichki panel mijoz o'rnatmasi ustiga tushmaydi va
  tasodifan o'rnatilmaydi.
- **`--disable-web-security` ikkala manifestdan ham olib tashlangan.** Admin ham mijoz paneli
  bilan bir xil birinchi-tomon HTTPS API + CORS kontraktidan foydalanadi. Buning evaziga backend
  CORS yoki auth **zaiflashtirilmagan**.
- Mijoz paneli Node/lokal-fayl CEF imkoniyatlarini saqlaydi — ular mijoz oqimi (import, pack
  yuklab olish/ochish) uchun haqiqatan kerak.
- Versiya `1.1.1` uch joyda sinxron: `CSXS/manifest.xml`, `CSXS/manifest.admin.xml`,
  `AssetFlow_Plugin.html` → `window.AF_PLUGIN_VERSION`. Test bu sinxronlikni tekshiradi.

---

## 3. Aniq build buyruqlari

Barcha artefaktlar `dist/zxp/` ga tushadi (git'da kuzatilmaydi).

### 3.1 Imzolanmagan MIJOZ QA arxivi (default)

```bash
bash plugins/after-effects-cep/scripts/build-zxp.sh --unsigned
# → dist/zxp/frameflow-plugin-v1.1.1-unsigned.zip
```

### 3.2 Imzolanmagan ICHKI Admin QA arxivi (aniq flag shart)

```bash
bash plugins/after-effects-cep/scripts/build-zxp.sh --admin --unsigned
# → dist/zxp/frameflow-internal-admin-v1.1.1-unsigned.zip
```

> `-unsigned` nomi ataylab: bu arxivlar **FAQAT lokal struktura/QA tekshiruvi uchun**.
> Ular AE'ga o'rnatilmaydi va hech qachon mijozga tarqatilmaydi.

### 3.3 Imzolangan build — kredensial TALAB qilinadi (fail-closed)

```bash
ZXP_CERT=/secure/path/frameflow.p12 ZXP_CERT_PASS=… \
  bash plugins/after-effects-cep/scripts/build-zxp.sh              # customer → .zxp

ZXP_CERT=/secure/path/frameflow.p12 ZXP_CERT_PASS=… \
  bash plugins/after-effects-cep/scripts/build-zxp.sh --admin      # internal admin → .zxp
```

- `ZXP_CERT` yoki `ZXP_CERT_PASS` berilmasa — build **artefakt yaratmasdan** aniq xato bilan
  to'xtaydi.
- Skript **o'z-o'zidan imzolangan sertifikat YARATMAYDI** va **standart/zaxira parol saqlamaydi**.
- Parol qiymati hech qachon ekranga/logga chiqarilmaydi. Sertifikat va parol repo'da, artefaktda,
  testda yoki hujjatda **hech qachon** saqlanmaydi — ular faqat operator muhitida yashaydi.
- **Eski chiqish darhol bekor qilinadi:** imzolangan build boshida shu flavor+versiya uchun
  kutilayotgan yakuniy `.zxp` **kredensial tekshiruvidan OLDIN** o'chiriladi — build to'xtaganda
  eski/qisman artefakt "yangi reliz" deb chalg'itmasin.
- **Hech qachon to'g'ridan yakuniy faylga imzolanmaydi:** imzo `dist/zxp/_signing.<flavor>.XXXXXX/`
  ichidagi vaqtinchalik faylga tushadi; faqat ZXPSignCmd **muvaffaqiyatli** tugab, fayl mavjud va
  bo'sh bo'lmasa — atomik `mv` bilan yakuniy nomga o'tadi. Nosozlikda **na yakuniy `.zxp`, na temp**
  qoladi; imzolanmagan arxivlar va boshqa flavor tegilmaydi.
- Staging (`_stage.<flavor>.XXXXXX`) va imzolash temp'i (`_signing.<flavor>.XXXXXX`) —
  chegaralangan va `trap` bilan EXIT/INT/TERM'da tozalanadi (keng `rm -rf` nishoni yo'q).

### 3.4 Lokal o'rnatma (AE)

```bash
bash plugins/after-effects-cep/scripts/install-cep.sh            # MIJOZ paneli (default)
bash plugins/after-effects-cep/scripts/install-cep.sh --admin    # ICHKI Admin (aniq opt-in)
```

### 3.5 Xavfsizlik/regressiya testi

```bash
npm run test:plugin-package
# yoki: node plugins/after-effects-cep/scripts/test-package-security.mjs
```

> ⚠️ **Test mavjud imzolangan relizni HECH QACHON buzmaydi.** U imzolash nosozliklarini isbotlash
> uchun `frameflow-*-v<ver>.zxp` yo'llariga vaqtinchalik nishon yozadi, shuning uchun ishga
> tushishdan OLDIN ikkala yo'lni tekshiradi: agar u yerda fayl bo'lsa — hech narsaga tegmasdan
> (o'chirmasdan, nomini/huquqini o'zgartirmasdan, o'qimasdan) xato bilan to'xtaydi. Operator
> artefaktni ko'chirib/arxivlab, testni qayta ishga tushiradi.

Test **haqiqiy arxivlarni quradi va haqiqiy build'ni ishga tushiradi** (mock emas) —
joriy holat **47/47 PASS**. Tekshiradi: har paketda aynan bitta kutilgan extension ID + mos
dispatch; barcha manifest/HTML/CSS runtime referenslari yechiladi; mijoz arxivida Admin
fayli/ID/UI matni/`af_admin_*` localStorage kalitlari YO'Q; hech bir manifestda
`--disable-web-security` yo'q; paketlangan matn fayllarida maxfiy kalit naqshlari yo'q (**faqat
fayl nomi** xabar qilinadi, topilgan qiymat hech qachon chop etilmaydi).

Imzolash fail-closed uch xil nosozlikda **haqiqiy build bilan** tekshiriladi — har safar avval
yakuniy `.zxp` o'rniga soxta "nishon" fayl qo'yiladi va u O'CHIRILGANI tasdiqlanadi:
sertifikatsiz · parolsiz · **imzolash buyrug'i yiqilganda** (test PATH'ga qo'yilgan soxta
`ZXPSignCmd` chiqish fayliga qisman bayt yozib, nolga teng bo'lmagan kod bilan tugaydi).
Oxirgi holatda yakuniy `.zxp` ham, `_signing.*`/`_stage.*` temp'lari ham qolmasligi va parol
qiymati chiqishda uchramasligi tasdiqlanadi. "Boshqa flavor tegilmadi" — ADMIN yo'liga qo'yilgan
nishonning **SHA-256'i har urinishdan keyin o'zgarmaganligi** bilan isbotlanadi (uning yo'qligi
bilan emas); imzolanmagan arxivlar ham hash bilan tekshiriladi. Negativ fiksturalar (mutatsiya qilingan arxivlar)
tekshiruvlar haqiqatan yiqilishini isbotlaydi; test o'z vaqtinchalik fayllarini process-exit
handler bilan ishonchli tozalaydi.

Bitta arxivning referens tekshiruvi alohida ham ishlaydi:

```bash
node plugins/after-effects-cep/scripts/verify-zxp-package.mjs [archive.zip]
```

---

## 4. Yangilanish (updater) — Task 2 (2026-07-22): SELF-UPDATER OLIB TASHLANDI

Panel-ichi **o'z-o'zini yozadigan** updater (zip yuklab olish → arxivni ochish → extension
papkasi ustiga nusxalash) **butunlay o'chirildi**. Sabab: CEP'da ishonchsiz (AE fayllarni band
qiladi, papka huquqi, qisman yozilish) va paket butunligi klientda majburiy tekshirilmasdi.

O'rniga — **platformaga xos installer + majburiy SHA-256 + OS'ga topshirish**:

- panel `GET /api/plugin/version?current=…&platform=mac|win` chaqiradi va FAQAT o'z
  platformasining artefaktini oladi (storage kaliti ochilmaydi);
- artefakt HTTPS'dan chegaralangan vaqtinchalik papkaga tushadi (nom versiyadan quriladi),
  **SHA-256 mos kelmasa yoki yo'q bo'lsa — o'chiriladi va hech narsa ishga tushmaydi**;
- fayl **argument-massiv** bilan OS'ga topshiriladi: mac `.pkg` → `/usr/bin/open`,
  win `.msi` → `msiexec /i`, win `.exe` → to'g'ridan. Panel imtiyoz ko'tarmaydi va
  AE ichida hech narsa o'rnatmaydi. **Ishonch chegarasi — OS installeri.**
- nosozlikda faqat tasdiqlangan installer / yuklab olish sahifasi taklif qilinadi;
  extension papkasini qo'lda almashtirish maslahati BERILMAYDI.

Legacy `.zxp` — faqat **qo'lda** yuklab olish uchun (veb sahifa). Panel `.zxp`ni hech qachon
avtomatik o'rnatmaydi (test buni majburlaydi).

Kontrakt, API shakli, admin publish qoidalari va foydalanuvchi oqimi:
**`docs/PLUGIN-UPDATE-CHAIN.md`**. Keyingi task (imzolangan `.pkg`/`.exe` artefaktlarini
qurish): **`docs/NEXT-TASK-INSTALLER-ARTIFACTS.md`**.

```bash
npm run test:plugin-updater      # jonli AF-UPDATER bloki — 64 case (mutatsiya isboti bilan)
npm run test:release-contract    # server kontrakti — 85 case
```

⚠️ Reliz hali ham CHIQMAGAN: imzolangan installer artefaktlari (Task 3) va `PluginRelease`
yozuvi yo'q — bu ega/operator ishi.

---

## 5. Qat'iy qoidalar

1. Mijoz artefaktiga `AssetFlow_Admin.html`, `com.frameflow.admin` yoki `af_admin_*` kalitlari
   **hech qachon** qo'shilmaydi.
2. Hech bir manifestga `--disable-web-security` (yoki web-security'ni o'chiruvchi boshqa bayroq)
   qaytarilmaydi. Kerak bo'lsa — server tomonida to'g'ri CORS, klientda emas.
3. Sertifikat, parol, xususiy kalit yoki token manbaga/artefaktga/logga/testga/hujjatga
   yozilmaydi.
4. Yangi runtime fayl qo'shilsa — `package-flavors.mjs` dagi flavor ro'yxatiga qo'shiladi
   (aks holda test "arxiv fayl ro'yxati flavor manbasiga mos" tekshiruvida yiqiladi).
5. Versiya o'zgarsa — uchala joy birga o'zgaradi (2-bo'lim).
