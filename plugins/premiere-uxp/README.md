# FrameFlow — Premiere Pro UXP plagini

Adobe Premiere Pro (UXP, `manifestVersion: 5`) uchun FrameFlow paneli.
Interfeys After Effects CEP plaginidan **1:1 ko'chirilgan** — ikkalasi ham
`plugins/after-effects-cep/` dagi YAGONA manbadan chiqadi.

| | |
|---|---|
| Plagin ID | `com.frameflow.premiere` |
| Minimal Premiere | 25.6.0 |
| Kirish nuqtasi | `panel.html` (plagin ILDIZIDA — pastdagi tuzoqqa qara) |
| Panel o'lchami | dok 420×760, suzuvchi 560×820, min 320×400 |

---

## 1. Papkalar

```
manifest.json        UXP manifesti (ID, host, ruxsatlar, panel o'lchami)
panel.html           ← GENERATSIYA. Kirish nuqtasi, plagin ILDIZIDA.
ported/              ← GENERATSIYA QILINADI. Qo'lda TEGMA.
  ae.css             AE CSS'ining UXP'ga moslashtirilgan varianti
  ae-inline-0N.js    AE HTML ichidagi inline skriptlar (ajratilgan)
  ae-src/            AE `assetflow-*.js` modullari
  host-copy.js       Premiere host API chaqiruvlari
js/ae-shim/          UXP runtime bo'shliqlarini yopadigan shim'lar (QO'LDA)
js/log.js, bytes.js  kichik yordamchilar (QO'LDA)
icons/               panel ikonkalari (@1x/@2x)
scripts/             build + QA vositalari (paketga KIRMAYDI)
dist/                chiqqan .ccx (gitignore)
spike/, dev/         FAZA 0 tajribalari, lokal QA harness'i (paketga KIRMAYDI)
```

> **MUHIM:** `ported/` — build artefakti. U yerga yozilgan har qanday
> o'zgarish keyingi `node scripts/ae-port.mjs` da yo'qoladi. Interfeys
> o'zgarishi AE manbasiga yoki `scripts/ae-port.mjs` transformiga kiritiladi.

---

## 2. Portni qayta qurish

```bash
node plugins/premiere-uxp/scripts/ae-port.mjs
```

AE `AssetFlow_Browse.html` + CSS + `assetflow-*.js` ni o'qib `ported/` ni
qaytadan yozadi. Asosiy transformlar:

- CSS `gap` → `margin` (UXP flex gap'ni qo'llab-quvvatlamaydi),
- `::before`/`::after` psevdolariga gap kompensatsiyasi (zichlik qoidalari
  gap'ni o'zgartirganda psevdo ham yangilanadi),
- inline `<script>` va `onclick` larni tashqi faylga chiqarish (UXP CSP),
- `require`, `CSInterface`, `<button>` quti modeli va media atributlari uchun
  shim ulash.

Oxirida statistika bosiladi (qoidalar soni, gap→margin, psevdo gap …).

### UXP'ning ikki qimmat tuzog'i

> **1. Nisbiy yo'l plagin ILDIZIDAN yechiladi, hujjat papkasidan emas.**
> Kirish nuqtasi `ported/index.html` bo'lganda `href="ae.css"` → `/ae.css`
> (yo'q) bo'lib ketardi, `../js/…` esa ildizdan tashqariga chiqardi: Premiere
> panelni BUTUNLAY stilsiz va skriptsiz ko'rsatardi (brauzerda esa hammasi
> to'g'ri edi — brauzer hujjat papkasidan yechadi). Shu sabab hujjat ildizga
> ko'chirildi: `panel.html`. Endi ikkala yechim qoidasi bir xil natija beradi.
> Yangi fayl qo'shsangiz yo'l ILDIZDAN yozilsin (`js/…`, `ported/…`).
>
> **2. `border-radius` KLAMPLANMAYDI.** Spetsifikatsiya radius quti yarmidan
> oshsa qisqartirishni talab qiladi; UXP qilmaydi va `999px` (`var(--r-full)`,
> AE'da 160+ qoida) bergan har bir pill "linza" bo'lib qo'shni elementga chiqib
> ketadi. To'g'ri qiymat `min(w,h)/2` — faqat ish vaqtida ma'lum, shuning uchun
> port `__AF_PILLC` ro'yxatini yig'adi va `js/ae-shim/pill-radius.js` klamplaydi.
> CSS qiymati O'ZGARTIRILMAYDI, brauzerdagi QA etaloni buzilmasin.

---

## 3. Dev o'rnatish (UDT'siz)

```bash
node plugins/premiere-uxp/scripts/install-uxp-dev.mjs
```

`~/Library/Application Support/Adobe/UXP/Plugins/External/<id>_<version>/`
ga nusxalaydi va `PluginsInfo/v1/premierepro.json` ga ro'yxatdan o'tkazadi.
**Premiere'ni qayta ishga tushiring**, so'ng `Window → Extensions → FrameFlow`.

Adobe UXP Developer Tool ishlatmoqchi bo'lsangiz: UDT → *Add Plugin* →
shu papkadagi `manifest.json`.

---

## 4. `.ccx` yig'ish va tekshirish

```bash
node plugins/premiere-uxp/scripts/build-ccx.mjs
node plugins/premiere-uxp/scripts/verify-ccx.mjs
```

**build-ccx.mjs** — `manifest.main` dan boshlab HTML/CSS havolalarini
rekursiv kuzatib fayl ro'yxatini O'ZI hisoblaydi (qo'lda yozilgan allowlist
yo'q), keyin ZIP ni xom baytlardan yozadi (tashqi `zip` CLI kerak emas).
Chiqish: `dist/frameflow-premiere-<versiya>-<flavor>.ccx` + `.sha256`.

Foydali bayroqlar:

```bash
node scripts/build-ccx.mjs --list              # nima paketlanishini ko'rish
node scripts/build-ccx.mjs --flavor=standalone # faqat bitta flavor
SOURCE_DATE_EPOCH=1735689600 node scripts/build-ccx.mjs   # takrorlanuvchi build
```

**Flavorlar.** Marketplace va standalone kanallariga BIR XIL ID jo'natilmaydi.
Marketplace varianti faqat `FF_PR_MARKETPLACE_ID` berilganda yig'iladi:

```bash
FF_PR_MARKETPLACE_ID=<adobe-bergan-id> node scripts/build-ccx.mjs
```

**verify-ccx.mjs** — paketning O'Z baytlarini tekshiradi: `..`/absolyut yo'l,
symlink, shifrlash, `scripts/`/`spike/`/`dev/` qoldig'i, sourcemap, secret
naqshlari, `manifest.main` va HTML havolalarining paket ichida mavjudligi,
`network.domains` da lokal manzil yo'qligi.

`localhost` uchrashlari `LOCAL_OK` jadvalida SANOQ bilan qayd etilgan —
soni o'zgarsa tekshiruv yiqiladi va holat qayta ko'rib chiqiladi.

---

## 5. 1:1 parity QA

AE va port bir xil ekranlarni ko'rsatadi; harness ikkalasining DOM
geometriyasini o'lchab **imzo** sifatida solishtiradi.

```bash
node plugins/premiere-uxp/scripts/qa-proxy.mjs      # imzo saqlagichi (:4000)
```

Ikki brauzer tabi: AE etaloni va port. Har o'lchovdan keyin:

```js
QAPfx('')        // keng rejim (900×1000)
QAPfx('n_')      // tor rejim (440×900)
QASweep('cmp')   // 19 ta ekranni o'lchaydi (~2.5 daqiqa)
QABad()          // faqat farqi bor ekranlar
```

Farq `[dx, dy, dw, dh] = port − AE`.

> **Tuzoq:** iframe o'lchami imzo olingandagi bilan AYNAN bir xil bo'lishi
> shart. 100px farq butun ekran bo'ylab soxta `[0,0,0,-100]` beradi.
> Prefiks `sessionStorage` da saqlanadi — iframe reload'dan omon qoladi.

**Joriy holat:** 19/19 ekran, tor va keng rejimda 0 farq.

> **Harness nimani KO'RMAYDI:** imzo — geometriya (x, y, w, h). Faqat chizishga
> ta'sir qiladigan farq (rang, radius, soya, shrift render) o'lchovda 0 chiqadi.
> `border-radius` klampi shu sababdan brauzer QA'sidan o'tib ketgan va faqat
> Premiere skrinshotida ko'ringan. Reliz oldidan panelni JONLI ko'zdan kechir.

---

## 6. QA ro'yxati (reliz oldidan)

- [ ] `node scripts/ae-port.mjs` — xatosiz
- [ ] `QASweep` tor + keng: `QABad()` bo'sh
- [ ] `node scripts/build-ccx.mjs` — yig'ildi
- [ ] `node scripts/verify-ccx.mjs` — toza
- [ ] Premiere'da: panel STILLI ochiladi (kirish ekrani pill tugmalari yumaloq),
      login ishlaydi, tema (dark/light) mos
- [ ] Katalog `?app=pr` bilan to'ladi, `hasPack` to'g'ri
- [ ] `.mogrt` import → Essential Graphics'da paydo bo'ladi
- [ ] Konsolda yangi xato yo'q

---

## 7. Chegaralar

- Plagin faqat mavjud API endpoint'larini CHAQIRADI. Narx, limit, kredit va
  entitlement — hammasi serverda hal bo'ladi; mijoz hech narsa hisoblamaydi.
- UXP runtime'da `child_process`, `zlib`, `http/https`, npm modullari YO'Q.
  Bunday kod faqat `scripts/` ichidagi build vositalarida bo'lishi mumkin.
- `.ccx` — oddiy, dunyoga ochiq ZIP. Ichiga hech qanday secret solinmaydi.
