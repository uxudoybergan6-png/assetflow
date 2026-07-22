# RELEASE ARCHITECTURE — FrameFlow AE plagini (paketlash va tarqatish)

> Amal qiladi: `plugins/after-effects-cep/`. Yagona haqiqat manbai —
> `plugins/after-effects-cep/scripts/package-flavors.mjs` (build, o'rnatma va testlar shundan o'qiydi).
> Oxirgi yangilanish: 2026-07-22 (Task 3 · `windows-latest` CI job'i masofada TO'LIQ YASHIL — §3A.4).

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

## 3A. Installer artefaktlari (Task 3) — mijozga tarqatiladigan `.pkg` / `.msi`

`.zxp` — qo'lda o'rnatish formati. Panel yangilanishi esa **OS installeri** orqali boradi
(`docs/PLUGIN-UPDATE-CHAIN.md` §2). Installerlar `dist/installers/` ga tushadi (git'da yo'q).

Payload — **FAQAT mijoz flavor'i**, ro'yxat yana `package-flavors.mjs` dan
(`scripts/installer-payload.mjs` yagona kirish nuqtasi). Ichki Admin flavor'ini installer
qilishga urinish **rad etiladi** (kod darajasida, bayroq bilan ham ochilmaydi).

| | macOS | Windows |
|---|---|---|
| Format | `.pkg` (productbuild distribution) | `.msi` (WiX Toolset v5, `Scope="perUser"`) |
| Nishon | `~/Library/Application Support/Adobe/CEP/extensions/com.frameflow` | `%APPDATA%\Adobe\CEP\extensions\com.frameflow` |
| Imtiyoz | `auth="none"` + `enable_currentUserHome` — **administrator paroli so'ralmaydi** | per-user — **UAC so'ralmaydi** |
| O'chirish | `pkgutil --forget com.frameflow.plugin` + papkani o'chirish | "Apps & features" (MSI o'zi olib tashlaydi) |
| Imzo | `productsign` (Developer ID Installer) → `notarytool submit --wait` → `stapler staple` | `signtool sign /fd sha256 /tr <ts> /td sha256` |

### 3A.1 Imzolanmagan QA installerlar

```bash
bash plugins/after-effects-cep/scripts/build-installer-mac.sh --unsigned
# → dist/installers/frameflow-plugin-<ver>-mac-unsigned.pkg (+ .sha256)

node plugins/after-effects-cep/scripts/build-installer-win.mjs --unsigned
# → dist/installers/frameflow-plugin-<ver>-win-unsigned.msi (+ .sha256)   [Windows/CI]
```

> Nomi ataylab `-unsigned`: mijozga tarqatilmaydi. Imzosiz payload'da CEP imzo konverti
> bo'lmaydi, shuning uchun **AE bu panelni faqat operator o'sha mashinada CEP dasturchi
> rejimini (`PlayerDebugMode`) O'ZI QO'LDA yoqgan bo'lsa yuklaydi** (lokal QA sozlamasi —
> masalan `scripts/install-cep.sh` dev oqimi bilan). **Installer bu sozlamani hech qachon
> o'zgartirmaydi** — na imzosiz, na imzolangan yo'lda hech qanday `defaults write` yoki
> `com.adobe.CSXS.*` yozuvi yo'q. Ya'ni imzosiz QA paketi mijoz mashinasida Adobe
> xavfsizlik sozlamasini pasaytirmaydi.

### 3A.2 Imzolangan reliz (fail-closed — kredensiallar FAQAT env'dan)

```bash
# 0) avval imzolangan .zxp (CEP imzo konverti shundan olinadi)
ZXP_CERT=/secure/ff.p12 ZXP_CERT_PASS='…' bash plugins/after-effects-cep/scripts/build-zxp.sh

# 1) macOS
FF_MAC_INSTALLER_IDENTITY='Developer ID Installer: … (TEAMID)' \
FF_SIGNED_ZXP=dist/zxp/frameflow-plugin-v<ver>.zxp \
FF_NOTARY_KEY_ID=… FF_NOTARY_ISSUER_ID=… FF_NOTARY_KEY_PATH=/secure/AuthKey.p8 \
  bash plugins/after-effects-cep/scripts/build-installer-mac.sh

# 2) Windows (Windows mashinasi / windows-latest CI)
FF_WIN_CERT_SHA1=<thumbprint>  FF_SIGNED_ZXP=…\frameflow-plugin-v<ver>.zxp \
  node plugins/after-effects-cep/scripts/build-installer-win.mjs
```

Muqobil kredensiallar: notarizatsiya uchun `FF_NOTARY_APPLE_ID` + `FF_NOTARY_TEAM_ID` +
`FF_NOTARY_PASSWORD`; Windows uchun `FF_WIN_CERT` (.pfx) + `FF_WIN_CERT_PASS`
(EV token/HSM bo'lsa `FF_WIN_CERT_SHA1` afzal — parol argv'ga tushmaydi).
Timestamp: `FF_WIN_TIMESTAMP_URL` (default DigiCert).

- Kredensial YO'Q yoki **QISMAN** bo'lsa — build aniq xato bilan to'xtaydi, artefakt
  yaratilmaydi. O'z-o'zidan imzolangan sertifikat YARATILMAYDI, standart parol YO'Q.
- **Reliz payload'i `FF_SIGNED_ZXP` SIZ qurilmaydi.** `.zxp` dan payload'ga FAQAT imzo
  konverti — aniq ikki yo'l: `META-INF/signatures.xml` va `mimetype` (yopiq ro'yxat;
  `META-INF/` ostidagi boshqa har qanday yo'l → rad). Konvert QABUL QILINISHIDAN OLDIN
  arxivning qolgan HAR BIR fayli allaqachon yig'ilgan lokal payload bilan **bayt-ba-bayt
  (SHA-256)** solishtiriladi — nom ro'yxati mos, bayt boshqa bo'lsa ham build to'xtaydi
  (aks holda imzo o'rnatilayotgan baytlarni qamramagan bo'lardi).
- **Arxiv `unzip -d` bilan YOYILMAYDI.** ZIP markaziy katalogi xom, tartiblangan ro'yxat
  sifatida o'qiladi va har yozuv tekshiriladi: takrorlangan nom · `..`/absolyut/buzuq yo'l ·
  symlink yoki qurilma yozuvi · shifrlash · noma'lum siqish · CRC-32 — hammasi rad sababi.
  Faqat tasdiqlangan konvert fayllari oddiy fayl sifatida yoziladi.
- **Windows chiqishi haqiqatan MSI ekani tekshiriladi** — WiX'dan keyin ham, `signtool`dan
  keyin ham: eng kam mazmunli hajm + OLE compound sarlavhasi (`d0 cf 11 e0 a1 b1 1a e1`).
  "Bo'sh emas" yetarli emas; ixtiyoriy baytlar rad etiladi.
- **macOS paketida `preinstall` YO'Q.** Ishlayotgan panel yangi payload muvaffaqiyatli
  joylashishidan OLDIN hech qachon o'chirilmaydi. `postinstall` — o'rnatma tugagach FAQAT
  aniq nomli eski fayllarni (ichki Admin sirti + `.debug*`) olib tashlaydi; `find`/`rm -rf`/
  joker belgi YO'Q, `assetflow-data` va qolgan hamma narsa tegilmaydi.
- **Windows migratsiyasi — MSI'dan OLDINGI qoldiqlar (`RemoveFile`).** `MajorUpgrade` FAQAT
  MSI o'zi o'rnatgan komponentlarni olib tashlaydi, shuning uchun qo'lda nusxalangan yoki
  `.zxp` orqali o'rnatilgan eski papkadagi ICHKI fayllar (`.debug`, `.debug.admin`,
  `AssetFlow_Admin.html`, `CSXS/manifest.admin.xml`) MSI'dan keyin ham qolardi. Endi
  `installer-wix.mjs` **`obsoleteInstallFiles()` (yagona manba)** ro'yxatidagi har bir yo'l
  uchun AYNAN bitta standart `<RemoveFile ... On="install"/>` qatorini generatsiya qiladi:
  nishon papka **`Directory=`** orqali (ildiz → `INSTALLFOLDER`, ichma-ich yo'l → o'sha
  papkaning daraxtdagi deterministik Id'si, masalan `D_CSXS_…`), Id to'liq nisbiy yo'l
  hash'idan. Qatorlar bitta per-user komponentda (`FF_LegacyCleanup`, HKCU keypath,
  `ComponentRef` bilan har o'rnatmada bajariladi). **Joker (`*`/`?`) YO'Q · CustomAction/
  skript YO'Q · rekursiv `RemoveFolderEx` YO'Q.** Joriy payload va `assetflow-data`
  TEGILMAYDI — ro'yxat payload bilan kesishsa generator fail-closed to'xtaydi. MSI
  `RemoveFiles` amali `InstallFiles` dan oldin ishlaydi, ya'ni qoldiq yangi payload
  joylashishidan avval ketadi (macOS'dagi `postinstall` siyosatining aynan ekvivalenti).
  ⚠️ WiX **`Subdirectory=` ATAYLAB ISHLATILMAYDI:** u avto-Id'li QO'SHIMCHA `Directory`
  qatori yasaydi, unga `RemoveFolder` biriktirib bo'lmaydi va ICE64 uni rad etadi (pastga qara).
- **Profil papkalari (`RemoveFolder`) — ICE64 talabi.** Windows Installer qoidasi: foydalanuvchi
  profili (`AppDataFolder`) ostida paket E'LON QILGAN **har bir** `Directory` qatori `RemoveFile`
  jadvalida bo'lishi SHART (FileName NULL = WiX `<RemoveFolder>`), aks holda MSI validatsiyasi
  `error WIX0204: ICE64` bilan **RAD ETADI**. Shuning uchun generator DOIM alohida per-user
  komponent (`FF_ProfileFolders`, HKCU keypath) chiqaradi: har papka uchun AYNAN bitta
  `<RemoveFolder ... On="uninstall"/>`, chuqurdan yuzaga (`css/fonts` → `css` → `INSTALLFOLDER`
  → `extensions` → `CEP` → `Adobe`). **Bu foydalanuvchi ma'lumotini yo'qotmaydi:** MSI bunday
  papkani FAQAT **BO'SH** bo'lsa o'chiradi — `assetflow-data` bor nishon papka ham, boshqa
  kengaytmasi bor umumiy `…\Adobe\CEP\extensions` ham JOYIDA qoladi (CI isboti buni tekshiradi).
  ⚠️ **Cheklov:** lokal (macOS) kafolat generatsiya darajasida qoladi — `.wxs` `xmllint`
  bilan to'g'ri va tarkibi testda qulflangan. Haqiqiy `wix build`, ICE validatsiyasi va
  eski o'rnatma ustidan haqiqiy o'rnatish **`windows-latest` CI job'ida** bajariladi
  (quyida §3A.4) — lekin u **push qilinmaguncha va yashil bo'lmaguncha isbotlanmagan**.
- Eski yakuniy artefakt tekshiruvlardan OLDIN o'chiriladi; imzo/notarizatsiya chegaralangan
  `dist/installers/_build.<platform>.XXXXXX/` ichida bajariladi va faqat HAMMASI muvaffaqiyatli
  tugagach atomik `mv` bilan yakuniy nomga o'tadi. Nosozlikda na artefakt, na temp qoladi;
  boshqa platforma/flavor artefakti tegilmaydi.
- Har artefakt yoniga **`<fayl>.sha256`** (64 kichik hex, `shasum -a 256 -c` formatida) va
  versiya bo'yicha `frameflow-plugin-v<ver>-installers.json` yoziladi — admin Releases
  formasiga tayyor qiymatlar (server SHA-256'ni storage'dan qayta hisoblab solishtiradi).
- `FF_INSTALLERS_DIR` — faqat chiqish papkasini ko'chiradi (test/CI izolyatsiyasi), siyosatga
  ta'siri yo'q.

### 3A.3 Installer testi

```bash
npm run test:plugin-installers
```

**244/244 PASS.** Haqiqiy skriptlar va haqiqiy payload (mock YO'Q): macOS'da HAQIQIY
`pkgbuild`/`productbuild` bilan `.pkg` quriladi va ichi ochib tekshiriladi (per-user
install-location · `auth="none"` · faqat currentUserHome domeni · payload cpio ro'yxati
flavor ro'yxatiga teng · AppleDouble `._` yozuvi yo'q · Admin sirti yo'q · `preinstall`
YO'Q · `postinstall`da `defaults`/`PlayerDebugMode`/`rm -rf`/`find` YO'Q); imzo bog'lash
uchun buzg'unchi arxiv fiksturalari (nom bir xil–bayt boshqa · takrorlangan nom ·
`..`/absolyut yo'l · symlink yozuvi · yot `META-INF` yo'li) va MSI tuzilma tekshiruvi
(ixtiyoriy baytlar rad, imzodan keyin ham qayta tekshiriladi) · WiX Id to'qnashuvi
(`css/fonts` ↔ `js/fonts`) · **Windows migratsiyasi** (har eski yo'l uchun AYNAN bitta
`RemoveFile`, aniq `Name` + e'lon qilingan `Directory`, `On="install"`, joker/CustomAction
YO'Q, joriy payload va `assetflow-data` tozalanmaydi — bu blok 1cc01ad generatorida
20 tekshiruv bilan yiqiladi) · **ICE64 qamrovi** (e'lon qilingan HAR bir profil papkasi uchun
AYNAN bitta `<RemoveFolder On="uninstall"/>`, chuqurdan yuzaga tartib, `Subdirectory=`
ISHLATILMAGANI, papka komponenti eski ro'yxatdan mustaqil) va **per-user doirasi**
(`Scope="perUser"` bir marta, `ALLUSERS`/`Privileged`/`perMachine`/Program Files YO'Q,
yagona `StandardDirectory` = `AppDataFolder`, ICE bostiruvchi avtorlash YO'Q) — bu ikki blok
d1e44e8 generatorida yiqiladi; fail-closed uch
holatda (kredensialsiz · qisman notarizatsiya kredensiali · imzolash buyrug'i yiqilganda)
haqiqiy build ishga tushiriladi va yakuniy artefakt YO'Qligi, temp QOLMAGANI, parol/identika
chop etilmagani tasdiqlanadi. "Boshqa artefakt tegilmadi" — ichki Admin arxivi va boshqa
platforma nishonining **SHA-256'i o'zgarmaganligi** bilan isbotlanadi. Windows toolchain
(`wix`, `signtool`) macOS'da yo'q — testda PATH orqali soxta buyruq qo'yiladi (build-zxp.sh
testidagi soxta `ZXPSignCmd` naqshining aynan o'zi), skriptning qolgan hamma qismi haqiqiy.

### 3A.4 Windows CI job'i — HAQIQIY MSI (`.github/workflows/ci.yml` → `windows-installer`)

Yuqoridagi soxta-toolchain testi macOS'da tekshirib **bo'lmaydigan** narsalarni qoplamaydi:
`wix build` haqiqatan ishlaydimi, MSI ICE validatsiyasidan o'tadimi va MSI'dan OLDINGI
o'rnatma ustidan migratsiya **haqiqatan** ishlaydimi. Shu bo'shliq uchun har `pull_request`
va `main` push'ida **`windows-latest`** job'i ishlaydi:

| Qadam | Nima bo'ladi |
|---|---|
| 1 | `actions/checkout@v4` · `actions/setup-node@v4` (Node 20) · `actions/setup-dotnet@v4` (8.0.x) — hammasi birinchi tomon |
| 2 | **QADALGAN** WiX: `dotnet tool install --global wix --version $env:WIX_VERSION` (`WIX_VERSION: "5.0.2"`) — `latest`/`--prerelease` ATAYLAB ishlatilmaydi; keyin `wix --version` qadalgan qiymatga solishtiriladi (mos kelmasa job yiqiladi) |
| 3 | **Haqiqiy** imzolanmagan QA MSI: `node build-installer-win.mjs --unsigned` (soxta `wix` YO'Q, MSI baytlari qo'lda yasalmaydi) |
| 4 | **Rasmiy validatsiya:** `wix msi validate <msi>` — hech qanday ICE bostirilmaydi (`-sval`/`-sw`/`-sice` na workflow'da, na build skriptida; `continue-on-error`/`try-catch` ham YO'Q) |
| 5 | `ci-verify-win-install.ps1` — ephemeral runner'da haqiqiy per-user o'rnatish/o'chirish (pastda) |

**Migratsiya isboti (5-qadam).** O'rnatishdan OLDIN nishon papkaga AYNAN
`obsoleteInstallFiles()` qaytargan MSI'dan-oldingi qoldiqlar (`.debug`, `.debug.admin`,
Admin HTML, `CSXS/manifest.admin.xml`) + ALOHIDA `assetflow-data/…` sentinel ekiladi. So'ng:

- `msiexec /i … /qn /norestart` — chiqish kodi **AYNAN 0** bo'lishi shart (`Start-Process -Wait`);
- o'rnatilgan fayl ro'yxati manbadan yig'ilgan mijoz payload'iga **AYNAN teng** va har fayl
  **SHA-256 bo'yicha bayt-ba-bayt** bir xil (ortiqcha fayl ham, kam fayl ham = yiqilish);
- to'rtala eski qoldiq **O'CHGAN**; `assetflow-data` sentinel **BAYT-BA-BAYT saqlangan**;
- migratsiya komponentining HKCU keypath'i haqiqatan yozilgan; `Program Files`ga hech narsa
  yozilmagan (per-user isboti);
- `msiexec /x … /qn` — chiqish kodi AYNAN 0; MSI o'z payload'ini olib tashlaydi,
  `assetflow-data` sentinel **YANA saqlanadi**, HKCU keypath yo'qoladi;
- ICE64 papka qatorlari BO'SH papkaga cheklangani: ma'lumot bor **nishon papka** ham,
  umumiy **`…\Adobe\CEP\extensions`** ham o'chirishdan keyin JOYIDA turishi tekshiriladi.

**Xavfsizlik chegaralari (kod darajasida majburlangan):**

- Ro'yxatlar CI'da **takrorlanmaydi** — PowerShell ularni mavjud yagona manbadan CLI orqali
  o'qiydi: `installer-payload.mjs payload-files|stale-files|stage`,
  `package-flavors.mjs field customer installDirName`, `installer-wix.mjs cleanup-registry`.
- Skript `GITHUB_ACTIONS=true` bo'lmasa **umuman ishlamaydi**; nishon yo'l qattiq tekshiriladi
  (`%APPDATA%\Adobe\CEP\extensions\<installDirName>`, foydalanuvchi profili ichida, mavjud
  o'rnatma ustida ishlash RAD ETILADI); ish papkasi `RUNNER_TEMP` ichida bo'lishi SHART.
- Tozalash `finally`da: MSI ro'yxatdan olinadi va **FAQAT** o'sha tekshirilgan per-user papka
  (`Remove-Item -LiteralPath $target`) o'chiriladi. Joker YO'Q · `$env:APPDATA`/profil ildizi
  YO'Q · `Program Files` YO'Q · registr/`PlayerDebugMode`/`com.adobe.CSXS` TEGILMAYDI.
- **Sir, sertifikat va imzolash YO'Q:** job `secrets.*` ishlatmaydi, sertifikat o'rnatmaydi/
  yaratmaydi, `signtool` chaqirmaydi. **Imzolanmagan `.msi` artefakt sifatida YUKLANMAYDI**
  (`upload-artifact` YO'Q) — u runner bilan birga yo'q bo'ladi.
- Workflow ruxsati minimal (`permissions: contents: read`), concurrency + `timeout-minutes` bor,
  har action birinchi tomon (`actions/*@vN`) — uchinchi tomon action ishlatilsa to'liq SHA shart.
- **Fail-closed:** asbob yo'qligi · versiya mos emasligi · build xatosi · validator xatosi ·
  nolga teng bo'lmagan `msiexec` kodi · kutilmagan/yetishmayotgan fayl · hash nomuvofiqligi ·
  qolib ketgan eski fayl · sentinel yo'qolishi — hammasi job'ni YIQITADI.
  ⚠️ Agar qadalgan WiX'da `wix msi validate` bo'lmasa job **ataylab** yiqiladi — yechim
  validatsiyani o'chirish EMAS, uni beradigan WiX versiyasini qadash.

Linux job (`build`) o'zgarmadi; unga faqat bitta statik regressiya qadami qo'shildi:

```bash
npm run test:ci-windows-installer     # 135 case — Windows job shartnomasi
```

Bu test JONLI `ci.yml` + `ci-verify-win-install.ps1` + `build-installer-win.mjs` fayllarini
o'qiydi va CLI kontraktlarini HAQIQATAN bajaradi — ya'ni Windows job qadalgan WiX'ni, haqiqiy
build'ni, validatorni, jimgina o'rnatish/o'chirishni, aniq eski ro'yxatni, sentinel
tekshiruvini, artefakt yuklamaslikni yoki xavfsiz tozalashni yo'qotsa — **macOS/Linux'da ham**
darhol yiqiladi (6 mutatsiya bilan isbotlangan).

> ✅ **JORIY MASOFAVIY HOLAT (halol).** Uch masofaviy iteratsiya bo'ldi, uchinchisi YASHIL:
>
> 1. `d1e44e8` → run **29878659236**: MSI qurildi, lekin **4-qadam** (`wix msi validate`)
>    **10 marta** `error WIX0204: ICE64: … is in the user profile but is not listed in the
>    RemoveFile table` bilan yiqildi (exit **204**). Sabab: generator 9 ta profil papkasini
>    `RemoveFolder`siz e'lon qilar + `Subdirectory="CSXS"` avto-Id'li 10-chi qator yasardi.
>    `a99edb7` bilan tuzatildi (§3A.2 "Profil papkalari").
> 2. `a99edb7` → run **29901585416** (job **88863312477**): **ICE64 MASOFAVIY YOPILDI** —
>    `wix msi validate` faqat `warning WIX1076: ICE91` bilan davom etdi va **5-qadamga yetdi**.
>    Lekin `ci-verify-win-install.ps1` **111-qatorda** `cleanup-registry kontrakti kutilmagan
>    shaklda: S` bilan yiqildi. Bu MSI nuqsoni EMAS — PowerShell skalyar-unroll xatosi:
>    `(Invoke-NodeLines …)[0]` bir qatorlik chiqishda BIRINCHI HARFNI qaytarardi. Tuzatildi
>    (`Invoke-NodeLine` fail-closed o'qigichi + 18 regressiya tekshiruvi).
>
> 3. `4293a6c` → run **29902381702** (job **88865831801**, 1m16s): **TO'LIQ YASHIL**.
>    Barcha qadam o'tdi: qadalgan WiX, haqiqiy imzolanmagan MSI build, `wix msi validate`
>    (faqat ICE91 ogohlantirishi bilan), va 5-qadam — **"Per-user install → migration →
>    uninstall proof"**. Build job **88865831812** yashil, Cloudflare Pages check yashil.
>
> ICE91 (36 ta) — **ogohlantirish**, per-user paket uchun MUQARRAR (`AppDataFolder` `ALLUSERS`ga
> qarab o'zgarmaydi), chiqish kodiga ta'sir qilmaydi va **bostirilmaydi**.
> **HOLAT: haqiqiy `msiexec` MASOFADA BIRINCHI MARTA MUVAFFAQIYATLI ISHLADI** — o'rnatish,
> MSI'dan oldingi qoldiqlardan migratsiya, aynan payload/hash mos kelishi, `assetflow-data`
> sentinel saqlanishi va o'chirish — barchasi run 29902381702'da isbotlandi.

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
**`docs/PLUGIN-UPDATE-CHAIN.md`**. Panel kutayotgan artefaktlarni qurish quvuri —
yuqoridagi **3A-bo'lim** (Task 3, 2026-07-22).

```bash
npm run test:plugin-updater         # jonli AF-UPDATER bloki — 118 case (mutatsiya isboti bilan)
npm run test:release-contract       # server kontrakti — 108 case
npm run test:plugin-installers      # installer quvuri — 244 case
npm run test:ci-windows-installer   # Windows CI job shartnomasi — 135 case (§3A.4)
```

⚠️ Reliz hali ham CHIQMAGAN: installer quvuri TAYYOR, lekin **imzolangan** artefaktlar
(Developer ID Installer + notarizatsiya · Authenticode) va `PluginRelease` yozuvi yo'q —
bu ega/operator ishi (sertifikatlar repo'da hech qachon bo'lmaydi).

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
   Installer payload'i ham AYNAN shu ro'yxatdan quriladi — alohida ro'yxat yozilmaydi.
5. Versiya o'zgarsa — uchala joy birga o'zgaradi (2-bo'lim). Installer paketi versiyani
   manifestdan oladi; skriptlarga versiya qattiq yozilmaydi (test buni majburlaydi).
6. Installer FAQAT per-user CEP papkasiga yozadi. `/Library`, `Program Files`, boshqa Adobe
   sozlamalari yoki root/UAC imtiyozi — TAQIQ (mac `auth="none"`, win `Scope="perUser"`).
