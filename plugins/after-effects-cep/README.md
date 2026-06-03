# AssetFlow — After Effects CEP

Browse panel: tasdiqlangan shablonlar katalogi (Free/Pro obunachilar).

## O‘rnatish (macOS)

```bash
chmod +x scripts/install-cep.sh
./scripts/install-cep.sh
```

Manba: `plugins/after-effects-cep/` → `~/Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo/`

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
| `CSXS/manifest.xml` | CEP manifest |

Eski minimal stub (`index.html`, `js/app.js`) saqlanmagan — to‘liq AssetFlow demo plugin bilan almashtirildi.
