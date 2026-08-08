# FrameFlow — After Effects + Premiere Pro CEP

Browse panel: tasdiqlangan shablonlar katalogi (Free/Pro obunachilar).

## O‘rnatish (macOS)

```bash
chmod +x scripts/install-cep.sh
./scripts/install-cep.sh            # MIJOZ paneli (default) → …/CEP/extensions/com.frameflow/
./scripts/install-cep.sh --admin    # ICHKI Admin paneli → …/CEP/extensions/com.frameflow.internal.admin/
```

## Paketlash (flavor)

Mijoz paketi va ichki Admin paketi ALOHIDA — bitta artefaktda ikkala extension ID bo'lmaydi.
Buyruqlar, imzolash qoidalari va xavfsizlik modeli: **`docs/RELEASE-ARCHITECTURE.md`**.

```bash
bash scripts/build-zxp.sh --unsigned            # mijoz QA arxivi
bash scripts/build-zxp.sh --admin --unsigned    # ichki Admin QA arxivi
node scripts/test-package-security.mjs          # paket xavfsizlik regressiya testi
node scripts/test-premiere-cep-host.mjs         # Premiere adapter qat'iy kontrakti
node scripts/test-premiere-cep-integration.mjs  # panel → resolver → host oqimi
```

## API

Default: `http://localhost:4000` (`apps/api` — `npm run dev:api`).

Plugin token va katalog: `/api/plugin/*`, contributor sync: `/api/contributor/*`.

Tizim loglari: `POST /api/logs` (Admin, Contributor, plugin `assetflow-log.js`).

## Fayllar

| Fayl | Vazifa |
|------|--------|
| `AssetFlow_Plugin.html` | Asosiy Browse UI |
| `assetflow-local-store.js` | Lokal katalog / cache |
| `assetflow-client.js` | API ulanish |
| `assetflow-log.js` | Markaziy loglar |
| `jsx/host-bootstrap.jsx` | AE/PPRO hostini tanlaydigan bootstrap |
| `jsx/host.jsx` | After Effects ExtendScript adapteri |
| `jsx/host-premiere.jsx` | Premiere Pro ExtendScript adapteri |
| `CSXS/manifest.xml` | Dual-host CEP manifest — MIJOZ (`com.frameflow.panel`) |
| `CSXS/manifest.admin.xml` | CEP manifest — ICHKI Admin (`com.frameflow.admin`) |
| `scripts/package-flavors.mjs` | flavor'lar yagona manbai (build + install + test) |

Eski minimal stub (`index.html`, `js/app.js`) saqlanmagan — to‘liq AssetFlow demo plugin bilan almashtirildi.

O'rnatilgach Adobe hostini to'liq qayta ishga tushiring: AE yoki Premiere Pro →
`Window → Extensions → FrameFlow`. Ikkala host aynan bir HTML/CSS va bir xil hisob/sessiyani ishlatadi.

## Premiere capability va support holati

- Native `.mogrt` aktiv sequence CTI nuqtasiga `Sequence.importMGT()` bilan yuboriladi.
- Direct/ZIP `.prproj` yuklanadi, lekin yopiq project ichidagi sequence ID'larni CEP ishonchli
  aniqlay olmagani uchun FrameFlow soxta import success bermaydi: faylni ko'rsatadi va Premiere
  `File → Import` oqimini ishlatishni aytadi.
- Premiere Publisher panel ichida o'chirilgan; publish Contributor Studio orqali bajariladi.
- Remove faqat FrameFlow import javobida saqlangan barqaror item ID'lariga tegadi; eski nom
  bo'yicha keng delete qilinmaydi.
- Release artefakti manual Premiere va AE smoke tasdig'isiz production-ready deb belgilanmaydi.

CEP/ExtendScript support muddati Adobe hujjatlarida 2026-yil sentabrgacha ko'rsatilgan.
Shu sabab bu dual-host CEP qisqa muddatli compatibility yo'li; Premiere versiya matritsasi har
relizda qo'lda tekshiriladi, uzoq muddatli host migratsiyasi esa alohida loyiha hisoblanadi.
