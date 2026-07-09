# PLUGIN UPDATE CHAIN — plagin yangilanish zanjiri (P11)

## Ikki kanal (muhim farq)

| Kanal | Nima o'zgaradi | Qanday yetadi | Reliz kerakmi |
|---|---|---|---|
| **1. Server-driven konfiguratsiya** | Modellar, tool'lar, narxlar, katalog | Plagin har fetch'da `/api/studio/gen/models`, `/api/plugin/catalog`dan oladi | ❌ YO'Q — admin katalogga model qo'shsa (docs/ADD-A-MODEL.md) darhol chiqadi |
| **2. Plagin KODI** | UI, yangi tool kodi, tuzatishlar | `PluginRelease` → in-panel bildirishnoma → Update | ✅ HA — shu hujjatdagi zanjir |

## Reliz chiqarish (admin)

1. **Paketni tayyorlash**: `plugins/after-effects-cep/` papkasini yig'ing —
   `CSXS/manifest.xml` zip ILDIZIDA bo'lsin:
   ```bash
   cd plugins/after-effects-cep && zip -r ../../frameflow-plugin-1.2.0.zip . \
     -x "*.git*" -x "_*mockup*.html" -x "scripts/*"
   ```
2. **Versiyani bumping** (IKKI joyda sinxron):
   - `plugins/after-effects-cep/CSXS/manifest.xml` → `ExtensionBundleVersion="1.2.0"`
   - `plugins/after-effects-cep/AssetFlow_Plugin.html` → `window.AF_PLUGIN_VERSION='1.2.0'`
3. **Admin panel → Plugin releases**: paket .zip'ni yuklang (presigned PUT, `releases/`
   papkasi), versiya + release notes kiriting, kerak bo'lsa **Mandatory** yoki
   **Min supported version** belgilang → **Publish release**.
4. (Ixtiyoriy) `shasum -a 256 frameflow-plugin-1.2.0.zip` → checksum maydoniga —
   updater o'rnatishdan oldin tekshiradi.

## Foydalanuvchi tomonida nima bo'ladi

- Panel ochilganda (va har 6 soatda) plagin `GET /api/plugin/version?current=<o'z versiyasi>`
  chaqiradi (ommaviy endpoint).
- Yangi versiya bo'lsa — markaziy modal: versiya, release notes, **Update now** / Later.
  "Later" shu versiya uchun qayta bezovta qilmaydi (localStorage).
- **Mandatory** (yoki klient minSupportedVersion'dan past) → modal yopilmaydi, faqat Update.
- **Update now** (CEP ichida): imzolangan URL'dan zip yuklab olinadi → (checksum bo'lsa
  tekshiriladi) → `unzip` bilan ochiladi → `CSXS/manifest.xml` bor ildiz topiladi →
  extension papkasi ustiga `cp -R` → "Restart After Effects" ko'rsatmasi.
- **Fallback** (har qanday xatoda): paket brauzerda ochiladi + qo'lda o'rnatish yo'riqnomasi
  (unzip qilib extension papkasini almashtirish). Plagin hech qachon buzilgan holatda qolmaydi
  — o'rnatish faylni almashtirguncha eski kod ishlayveradi.

## Xavfsizlik

- Faqat **bizning API** bergan imzolangan URL (first-party storage) va faqat
  **foydalanuvchi tugmani bosganda** o'rnatiladi; checksum ixtiyoriy qo'shimcha tekshiruv.
- Admin publish `requireAdmin` + audit-log (`plugin_release.publish`); paket mavjudligi
  HeadObject bilan tasdiqlanadi (bo'sh reliz e'lon qilinmaydi).

## API

- `GET /api/plugin/version?current=1.1.1` (ommaviy) →
  `{ latest:{version,releaseNotes,publishedAt,checksum}, updateAvailable, mandatory, downloadUrl }`
- `GET/POST /api/admin/plugin-releases`, `DELETE /api/admin/plugin-releases/:id` (admin).
- DB: `PluginRelease` (additive migratsiya `20260709150000_plugin_release`).
