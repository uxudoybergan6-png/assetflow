# PLUGIN UPDATE CHAIN — plagin yangilanish zanjiri (P11 + Task 2)

> Oxirgi yangilanish: 2026-07-22 (Task 2 — panel-ichi self-updater OLIB TASHLANDI,
> o'rniga platformaga xos installer + majburiy SHA-256 + OS'ga topshirish).
> Yagona haqiqat manbai: `apps/api/src/lib/plugin-release-contract.ts` (server kontrakti) va
> `plugins/after-effects-cep/AssetFlow_Plugin.html` `AF-UPDATER-BEGIN…AF-UPDATER-END` bloki (klient).
> Testlar shu ikkalasini AYNAN o'qiydi.

## Ikki kanal (muhim farq)

| Kanal | Nima o'zgaradi | Qanday yetadi | Reliz kerakmi |
|---|---|---|---|
| **1. Server-driven konfiguratsiya** | Modellar, tool'lar, narxlar, katalog | Plagin har fetch'da `/api/studio/gen/models`, `/api/plugin/catalog`dan oladi | ❌ YO'Q |
| **2. Plagin KODI** | UI, yangi tool kodi, tuzatishlar | `PluginRelease` + `PluginInstaller` → in-panel bildirishnoma → OS installeri | ✅ HA |

---

## 1. Xavfsizlik modeli (nima nimani himoya qiladi)

- **Panel HECH NARSA o'rnatmaydi.** Eski oqim (arxivni ochib, extension papkasi ustiga
  nusxalash) BEKOR: AE fayllarni band qiladi, papka huquqi bo'lmasligi mumkin, qisman
  yozilish panelni buzadi va yuklab olingan paketning imzosi klientda tekshirilmasdi.
- **Ishonch chegarasi — OS installeri.** macOS `.pkg` Installer.app'ga, Windows `.exe`/`.msi`
  OS/UAC'ga topshiriladi. Imzo/notarizatsiyani va ruxsatni OS tekshiradi.
- **Panel imtiyoz KO'TARMAYDI** (sudo/UAC chaqirmaydi, `/Library`ga yozmaydi).
- **SHA-256 MAJBURIY.** Yo'q yoki mos kelmasa — fayl o'chiriladi, hech narsa ishga tushmaydi.
- **Faqat HTTPS** artefakt havolasi (bizning storage'ning imzolangan URL'i).
- **Argument-massiv** bilan ishga tushirish (shell/string interpolatsiya yo'q).
- **Chegaralangan vaqtinchalik papka**: `os.tmpdir()/frameflow-update-XXXX`, fayl nomi
  server matnidan EMAS — versiya+kengaytmadan quriladi (traversal imkonsiz).
  Nosozlikda fayl va papka o'chiriladi.
- **Legacy `.zxp`** faqat QO'LDA yuklab olish uchun qoladi (veb sahifa). Panel `.zxp`ni
  **hech qachon** avtomatik o'rnatmaydi va extension papkasini almashtirishni taklif qilmaydi.

---

## 2. Artefakt kontrakti (Task 3 shu bo'yicha quradi)

| Platforma | Qabul qilinadigan kengaytma | OS'ga topshirish | Talab |
|---|---|---|---|
| `mac` (darwin) | `.pkg` **faqat** | `/usr/bin/open <file>` → Installer.app | Developer ID Installer bilan imzolangan + notarizatsiya |
| `win` (win32) | `.exe` yoki `.msi` | `.msi` → `msiexec.exe /i <file>` · `.exe` → to'g'ridan | Authenticode imzo (EV tavsiya) |
| boshqa (Linux…) | — | — | Halol xabar + yuklab olish sahifasi |

Har artefakt uchun **SHA-256 (aynan 64 hex)** SHART. Storage kaliti `releases/` ostida,
`..`/`\`/`//` bo'lmaydi. Kalit hech qachon ommaviy javobga chiqmaydi.

Installer nima qilishi kerak (Task 3): CEP extension papkasiga
(`~/Library/Application Support/Adobe/CEP/extensions/com.frameflow` /
`%APPDATA%\Adobe\CEP\extensions\com.frameflow`) mijoz flavor fayllarini yozadi —
`plugins/after-effects-cep/scripts/package-flavors.mjs` ro'yxati bo'yicha.

---

## 3. API

### `GET /api/plugin/version` (OMMAVIY)

So'rov: `?current=<klient versiyasi>&platform=mac|win`
`platform` berilmasa — brauzer `User-Agent`'idan aniqlanadi (plagin HAR DOIM aniq yuboradi).

```jsonc
{
  "latest": { "version": "1.2.0", "releaseNotes": "…", "publishedAt": "…", "checksum": null },
  "updateAvailable": true,
  "mandatory": false,
  "downloadUrl": "https://…",         // LEGACY .zxp (qo'lda) yoki null
  "platform": "mac",                   // aniqlangan allowlist platformasi yoki null
  "installer": {                       // FAQAT shu platforma uchun; storage kaliti YO'Q
    "platform": "mac", "ext": "pkg",
    "fileName": "frameflow-plugin-1.2.0-mac.pkg",
    "sizeBytes": 12345678,
    "sha256": "<64 hex>",
    "url": "https://…"                 // imzolangan, 1 soat
  },
  "installerStatus": "ok"              // ok | unsupported_platform | not_published | storage_unavailable
}
```

`installerStatus` — **halol** sabab: `installer` null bo'lsa panel jim qolmaydi, aniq
matn ko'rsatadi va yuklab olish sahifasini taklif qiladi. `status:"ok"` payload'siz
bo'lishi mumkin emas (fail-closed).

### Admin

- `GET /api/admin/plugin-releases` — tarix (+ har relizning installer platformalari,
  kengaytmasi, sha256, hajmi). **storageKey qaytarilmaydi.**
- `POST /api/admin/plugin-releases` — publish. `requireAdmin` + audit log
  (`plugin_release.publish`, meta'da installer platformalari/hajmi/sha).
- `DELETE /api/admin/plugin-releases/:id` — installerlar CASCADE bilan o'chadi.

**Publish qat'iy tekshiruvi (fail-closed, hammasi serverda):**
1. `version` semver, takrorlanmasin (409).
2. Har installer: platforma allowlist (`mac`/`win`) · kalit `releases/` ostida ·
   kengaytma platformaga mos (`.pkg` / `.exe`|`.msi`) · sha256 aynan 64 hex ·
   platforma takrorlanmasin.
3. Obyekt storage'da MAVJUD (HeadObject) va hajmi > 0, ≤ 512MB.
4. **SHA-256 storage'dan QAYTA hisoblanadi** (`sha256OfS3Object`, oqim bilan) va
   e'lon qilingan qiymatga mos bo'lishi SHART — aks holda 400.
5. Kamida bitta installer YOKI legacy `.zxp` bo'lishi shart.

---

## 4. Reliz chiqarish (admin, qadamma-qadam)

1. Versiyani bumping (IKKI joyda sinxron):
   `plugins/after-effects-cep/CSXS/manifest.xml` → `ExtensionBundleVersion` va
   `AssetFlow_Plugin.html` → `window.AF_PLUGIN_VERSION`.
2. Imzolangan installerlarni yig'ish (Task 3 skriptlari): macOS `.pkg` (Developer ID +
   notarize), Windows `.exe`/`.msi` (Authenticode).
3. **Admin → Releases**: versiya, release notes, kerak bo'lsa Mandatory / Min supported →
   **Upload macOS installer (.pkg)** va/yoki **Upload Windows installer (.exe/.msi)**.
   SHA-256 brauzerda hisoblanadi va serverda qayta tekshiriladi.
4. (Ixtiyoriy) qo'lda yuklab olish uchun imzolangan `.zxp` — veb sahifa uchun.
5. **Publish release.**

---

## 5. Foydalanuvchi tomonida nima bo'ladi

- Panel ochilganda (4s) va har 6 soatda `GET /api/plugin/version?current=…&platform=…`.
- Yangi versiya bo'lsa — markaziy modal: versiya, release notes, halol izoh
  ("installer AE tashqarisida ochiladi, tizim ruxsat so'rashi mumkin, tugagach AE
  qayta ishga tushirilishi kerak"), **Download & install** / **Later**.
- **Later** shu versiya uchun qayta bezovta qilmaydi (localStorage) — mandatory relizda
  Later/✕ YO'Q (o'zgarmagan).
- **Download & install** → yuklab olish (progress %) → **Verifying SHA-256…** →
  OS installeri ochiladi → "Installer opened" ekrani: tizim ruxsat so'rashi mumkin,
  tugagach AE'ni butunlay yopib qayta oching; panel shu paytgacha eski versiyada ishlaydi.
- **Har qanday nosozlikda** (platforma qo'llab-quvvatlanmaydi · installer e'lon qilinmagan ·
  http havola · checksum yo'q/mos emas · yuklab olish uzildi · ochib bo'lmadi) — aniq
  inglizcha xabar + **Open download page**. Extension papkasini qo'lda almashtirish
  HECH QACHON taklif qilinmaydi. Panel hech qachon buzilgan holatda qolmaydi.

---

## 6. DB

- `PluginRelease` — `downloadKey` endi **nullable** (legacy `.zxp` ixtiyoriy).
- `PluginInstaller` (YANGI) — `releaseId` + `platform` unique, `storageKey`, `sha256`,
  `sizeBytes`; `onDelete: Cascade`.
- Migratsiya: `20260722120000_plugin_installer_artifacts` (ADDITIVE — mavjud reliz
  qatorlari saqlanadi, hech narsa o'chirilmaydi).

---

## 7. Testlar

```bash
npm run test:release-contract        # server kontrakti (85 case)
npm run test:plugin-updater          # jonli AF-UPDATER bloki (64 case)
npm run test:plugin-download-state   # veb yuklab olish holat mashinasi (10 case)
npm run test:plugin-package          # paket/flavor xavfsizligi (47 case)
```

`test-updater-security.mjs` jonli HTML'dan updater blokini ajratib oladi va:
(A) taqiqlangan primitivlar (`unzip`, `cp`, `extensionDir`, `execSync`, `shell:true`,
qo'lda almashtirish maslahati, `.zxp` avto-o'rnatish) YO'Qligini, majburiy primitivlar
BORligini skanerlaydi; (B) blokni Node'da stub global'lar bilan ishga tushirib HAQIQIY
funksiyalarini (`window.__afUpdater`) musbat/salbiy holatlarda sinaydi; (C) **mutatsiya
fiksturalari** bilan tekshiruvlarning bo'sh emasligini isbotlaydi (buzilgan nusxada
test yiqilishi SHART).
