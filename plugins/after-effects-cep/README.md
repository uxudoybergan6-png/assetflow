# AssetFlow — After Effects CEP

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
| `jsx/host.jsx` | ExtendScript (import) |
| `CSXS/manifest.xml` | CEP manifest — MIJOZ (`com.frameflow.panel`) |
| `CSXS/manifest.admin.xml` | CEP manifest — ICHKI Admin (`com.frameflow.admin`) |
| `scripts/package-flavors.mjs` | flavor'lar yagona manbai (build + install + test) |

Eski minimal stub (`index.html`, `js/app.js`) saqlanmagan — to‘liq AssetFlow demo plugin bilan almashtirildi.
