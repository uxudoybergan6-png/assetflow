# AssetFlow / Creative Tools SaaS — handoff (Cursor → Claude Code)

Bu hujjat loyiha joylashuvi, arxitektura va **hozirgacha qilingan ishlar**ni qisqacha beradi. Claude Code shu repoda davom etishi mumkin.

## Loyiha joyi

```text
/Users/usmonov/Projects/creative-tools-saas
```

## Nima qilinmoqda

**AssetFlow** — Adobe After Effects uchun shablon marketplace (Pixflow/Envato uslubida):

1. **Contributor** Studio’da shablon yuklaydi (`.aep`, preview, pack zip).
2. **Admin** moderatsiya qiladi (approve/reject).
3. **Obunachi** AE ichidagi **Browse CEP plugin** orqali katalogni ko‘radi va import qiladi.
4. Tariflar: **Free** (limitli) va **Pro** (cheksiz, 4K).

## Texnologiyalar

| Qism | Texnologiya | Port |
|------|-------------|------|
| API | Express + Prisma + PostgreSQL | **4000** |
| Contributor Studio | Static HTML/JS (`assetflow-studio`) | **3000** (`/studio/`) |
| Admin | Static HTML/JS | **3001** |
| AE plugin | CEP (HTML/JS + ExtendScript `host.jsx`) | panel ichida |
| To‘lov | Stripe (web; plugin plan hozircha DB + dev bypass) | — |

## Papka tuzilishi (muhim)

```text
creative-tools-saas/
├── apps/
│   ├── api/                    # REST API, uploads/, routes/
│   │   └── src/routes/
│   │       ├── plugin.ts       # Katalog, login, /me, plan, usage
│   │       ├── contributor.ts  # Shablon CRUD, submit, review
│   │       ├── admin.ts        # + GET/PATCH plugin-subscribers
│   │       └── auth.ts
│   └── web/                    # Next.js (asosiy web; studio sync shu yerda ham)
├── packages/
│   ├── database/prisma/        # schema.prisma, migrations, seed-assetflow.ts
│   └── assetflow-studio/       # Admin + Contributor UI (manba)
│       ├── js/                 # studio-api.js, admin-views, contributor-views
│       └── admin/
├── plugins/
│   └── after-effects-cep/      # AE Browse plugin (ASOSIY plugin manba)
│       ├── AssetFlow_Plugin.html
│       ├── assetflow-catalog.js
│       ├── assetflow-account.js   # Login, Free/Pro, admin link
│       ├── assetflow-client.js
│       ├── assetflow-init.js
│       ├── jsx/host.jsx           # importSingleSceneFromAep, to‘liq pack import
│       └── scripts/install-cep.sh # → ~/Library/.../com.assetflow.demo/
├── ecosystem.config.cjs        # PM2
└── scripts/                    # pm2-start, check-stack, verify-pipeline
```

**AE plugin o‘rnatilgan nusxa (ishlaydigan nusxa):**

```text
~/Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo/
```

`install-cep.sh` manbadan nusxalaydi — kod o‘zgargach qayta ishga tushirish kerak.

## Ishga tushirish (tavsiya)

```bash
cd /Users/usmonov/Projects/creative-tools-saas
npm install
cp .env.example .env   # DATABASE_URL va boshqalar

npm run db:push
npm run seed:assetflow -w @creative-tools/database

npm run pm2:start      # API :4000, Studio :3000, Admin :3001
npm run check:stack
```

| URL | Vazifa |
|-----|--------|
| http://localhost:3000/studio/ | Contributor |
| http://localhost:3001/ | Admin |
| http://localhost:4000/health | API |

**AE plugin:**

```bash
./plugins/after-effects-cep/scripts/install-cep.sh
# After Effects → Window → Extensions → AssetFlow
```

## Demo hisoblar (seed)

| Rol | Email | Parol |
|-----|-------|-------|
| Admin | admin@assetflow.uz | admin123 |
| Contributor | dilnoza.k@gmail.com | contrib123 |
| AE obunachi (plugin) | user@assetflow.uz | user123 |

## Pipeline (qisqa)

```text
Contributor upload → PENDING_REVIEW → Admin approve + published
  → GET /api/plugin/catalog → AE plugin Sync → import .aep (zip ichidan .aep)
```

Pack fayllar: `apps/api/uploads/<templateId>/pack` (va `thumb`, `preview`).

## Amalga oshirilgan funksiyalar (status — Claude/Cursor uchun)

| Funksiya | Holat | Qayerda |
|----------|--------|---------|
| `GET /api/plugin/catalog` | ✅ Ishlaydi | `apps/api/src/routes/plugin.ts`, `assetflow-catalog.js` |
| Plugin login + token | ✅ Ishlaydi | `POST /api/plugin/login`, `assetflow-account.js`, prefs `client.token` |
| Pack download + unzip → `.aep` | ✅ Ishlaydi | `assetflow-catalog.js` `downloadPackToTemp`, `GET .../pack` |
| Filter UI (Category / Format / Resolution) | ✅ Ishlaydi | `AssetFlow_Plugin.html` dropdownlar, `initEnvFilterUi` |
| Foydalanuvchi profil paneli | ✅ Ishlaydi | Pastki chap profil → sheet: login, stats, Free/Pro |
| Admin panel link | ✅ Ishlaydi | Faqat `role === ADMIN`; `AssetFlowAccount.openAdminPanel()` |
| `host.jsx` import (to‘liq pack) | ✅ Ishlaydi | `importSingleSceneFromAep`, prune o‘chirilgan, `existingIds` |
| Admin obunachilar (haqiqiy DB) | ✅ Ishlaydi | `GET /api/admin/plugin-subscribers` |
| Usage yozish (download/import) | ✅ Ishlaydi | `POST /api/plugin/usage/download`, `/usage/import` |
| CSInterface `evalScript` | ✅ Tuzatilgan | `js/CSInterface.js` shim |

**Claude Code qo‘shgan (keyingi to‘lqin):** `hasPack:false` UI (badge, stripe, disabled import); pack hero video play; `GET /api/plugin/featured`; `rate-limit.ts` + `GET /api/admin/plugin-analytics`.

**Hali zaif / tekshirish kerak:** to‘liq Stripe ↔ Pro production; rate limit productionda Redis; mavjud TS xatolar (`contributor.ts` va boshqalar) alohida.

## Hozirgacha tuzatilgan / qo‘shilgan (Cursor sessiyasi)

### API + DB

- `PluginProfile` modeli: plan (FREE/PRO), status, downloadsTotal, downloadsMonth, importsTotal, lastSeenAt.
- `GET /api/plugin/login`, `/me`, `PATCH /plan`, `POST /usage/download|import`, `POST /heartbeat`.
- `GET /api/admin/plugin-subscribers` — admin uchun haqiqiy obunachilar ro‘yxati.
- Auth: JWT + `PluginToken` (CEP uchun).
- Contributor approve: admin JWT eskirganda 401; `demo:clear` dan keyin qayta login kerak.

### AE CEP plugin

- Server katalog: `assetflow-catalog.js` → `GET /api/plugin/catalog`.
- Zip pack → unzip → birinchi `.aep` (`downloadPackToTemp`).
- **To‘liq pack import** — `prune` o‘chirildi; butun loyiha Project panelga keladi.
- `importSingleSceneFromAep` — mavjud compni o‘chirmaydi (`existingIds` snapshot).
- **Foydalanuvchi paneli** — pastki chap profil → login, Free/Pro, statistika, admin link.
- **Filter UI** — Category / Format / Resolution dropdown (Tags olib tashlangan).
- `CSInterface.js` — `evalScript` shim; `install-cep.sh` muhim.

### Admin Studio

- Obunachilar bo‘limi API dan yuklanadi (`StudioApi.listPluginSubscribers`).
- `npm run studio:sync` — `packages/assetflow-studio` → `apps/web/public/studio`.

## Muhim fayllar (o‘zgartirishda)

| Vazifa | Fayl |
|--------|------|
| AE UI + import chaqiruv | `plugins/after-effects-cep/AssetFlow_Plugin.html` |
| AE ↔ API katalog | `plugins/after-effects-cep/assetflow-catalog.js` |
| AE login / plan | `plugins/after-effects-cep/assetflow-account.js` |
| AE ExtendScript import | `plugins/after-effects-cep/jsx/host.jsx` |
| Katalog mapping | `apps/api/src/lib/catalog-map.ts` |
| Plugin API | `apps/api/src/routes/plugin.ts` |
| Admin subscribers API | `apps/api/src/routes/admin.ts` |
| Plugin profile logic | `apps/api/src/lib/plugin-profile.ts` |
| Prisma | `packages/database/prisma/schema.prisma` |

## Ma’lum muammolar / tekshirish kerak

- Ko‘p shablonlarda `hasPack: false` — contributor haqiqiy `.aep` yuklamaguncha import ishlamaydi.
- Pack **faqat .zip** bo‘lsa, ichida `.aep` bo‘lishi shart.
- Pro tarif: local dev da `NODE_ENV !== production` yoki `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true` — productionda Stripe ACTIVE kerak.
- `demo:clear` barcha shablonlarni o‘chiradi — keyin `db:seed:assetflow` va admin/contributor qayta login.

## Foydali buyruqlar

```bash
npm run pm2:reset          # portlar tiqilib qolsa
npm run verify:pipeline    # contributor → admin → catalog
npm run studio:sync
bash plugins/after-effects-cep/scripts/install-cep.sh
```

## Claude Code uchun maslahat

1. Avval `README.md`, `SCOPE.md`, shu `HANDOFF.md` o‘qing.
2. Plugin ishi uchun: `plugins/after-effects-cep/` — `AssetFlow_Plugin.html` + `jsx/host.jsx`.
3. API o‘zgarishlaridan keyin Prisma migrate + API restart.
4. Plugin o‘zgarishlaridan keyin **doim** `install-cep.sh` (yoki fayllarni `com.assetflow.demo` ga nusxalash).
5. Cursor bilan parallel ishlaganda bir xil branch/commit; conflict ehtiyotkorlik bilan.

## Production deploy (2026-06-04)

| Xizmat | URL |
|--------|-----|
| API (Render) | https://assetflow-rqbq.onrender.com |
| Studio (Vercel) | https://assetflow-studio-one.vercel.app |
| Contributor | …/studio/login.html → …/studio/contributor/ |
| Admin | …/studio/admin-login.html → …/studio/admin/ |

**Vercel Root Directory:** `packages/assetflow-studio`

**Render env:** `API_PUBLIC_URL`, `ADMIN_URL`, `CORS_ORIGIN`, R2 (`AWS_*`, `S3_ENDPOINT`, `CDN_BASE_URL`).

### Claude Code sessiyasida qilingan (2026-06-04)

- **`catalog-map.ts`** — `templateAssetFlags()`: disk + R2 tekshiradi (Render ephemeral disk muammosi hal).
- **`s3.ts`** — `resolveS3AssetKey`, pack/preview kengaytma qidiruvi.
- **`serve-asset.ts`** — faqat mavjud R2 kalitga redirect.
- **`app-urls.ts`** — production fallback URL yordamchi moduli.
- **Plugin login** — javobida `apiBaseUrl` + `adminUrl` qaytadi.
- **`assetflow-env.js`** — default API Render (localhost emas); login dan keyin `apiBaseUrl` prefs ga yoziladi.
- **`AssetFlow_Admin.html`** — API maydoni login, `localhost→Render` auto-fix, `openWebAdmin()`.
- **Contributor `/studio/contributor/`** — Vercel 404 tuzatildi (`vercel.json` rewrite).
- **Demo statistika/soxta xabarlar** — olib tashlandi; haqiqiy API ulandi.
- **`studio-stats.js`, `studio-config.js`** — production API default.
- **Messaging + Audit log** — modellari, API yo'llari (`/api/studio/messages/*`, `/api/studio/audit`) va UI ulandi.
- **`seed-assetflow.ts`** — demo shablonlar `published: false`; migration `unpublish_demo_templates`.

### Tekshirilgan (production)

```bash
GET https://assetflow-rqbq.onrender.com/api/plugin/catalog
# → cmpzpnnyq0001oc1gzla3mzi5 "Football Championship..." hasPack:true, hasPreview:true
```

## Ochiq / ehtiyot bo'lish kerak

1. **Render deploy** — API o'zgarishlari push qilinmagan bo'lishi mumkin; `npm run build -w apps/api` keyin deploy.
2. **AE Admin CEP** — brauzer Admin (Vercel) ishonchliroq; CEP `Failed to fetch` = eski extension yoki `localhost` API.
3. **Plugin Browse** — login + **↻ Sync**; API `https://assetflow-rqbq.onrender.com`; **Video Templates** tab (`nav: video`).
4. **Pack yo'q** — `hasPack:false` bo'lsa katalogda ko'rinadi, import bloklanadi.
5. **Tez orada** (hali to'liq emas): Stripe tariflar, email bildirishnomalar, contributor payout.
6. `apps/web/public/studio` — `npm run studio:sync` bilan package dan sinxron saqlash.

### Claude Code sessiyasida qilingan (2026-06-11)

- **Plugin katalog muammosi hal** — AE plugin "Hali shablon yo'q" sababi: o'rnatilgan nusxa prefs'ida (`assetflow-data/prefs.json`) `client.apiBaseUrl` eski `http://localhost:4000` bo'lib qolgan edi → Render URL'ga almashtirildi. `AssetFlow_Plugin.html` dagi dublikat `assetflow-catalog.js` script tegi olib tashlandi (asl tegi fayl oxirida bor edi). Plugin `install-cep.sh` bilan qayta o'rnatildi.
- **host.jsx loop hal** — `applyBestVideoTemplate` loop `i=1` dan boshlanardi (`om.templates` 0-indexed JS massiv) → birinchi H.264 template o'tkazib yuborilardi. `i=0; i<length` ga tuzatildi (commit `7b5f9f7`).
- **"Mehmon" / token yo'qolish bug'i hal (asl ildiz)** — `persistUserPrefs()` prefs.json'ni `client`siz to'liq ustidan yozardi: har yuklab olish/import/favorite'dan keyin token, apiBaseUrl, downloadDir o'chib ketardi (shu sabab restart'da "Mehmon" va `recordImport` ham jim o'tkazilardi). Endi `loadPrefs()` bilan merge qilib, faqat o'z maydonlarini (favorites, downloaded, importedScenes, downloadedMeta) yangilaydi. Tekshirildi: login restart'dan keyin saqlanadi.
- **Boot'dagi fetchMe retry** — `refreshAccountFromApi` endi 4 urinish (0/2/5/10s backoff, Render cold start uchun), token bor paytda footer "Ulanmoqda…" ko'rsatadi, xato yutilmaydi; boot'da `await`siz (katalogni bloklamaydi). 401/403 da token tozalanib mehmon holatiga qaytadi.
- **Usage hisoblash ulandi** — `recordDownload` endi `downloadPackToTemp` ichida haqiqiy (keshsiz) yuklab olishda chaqiriladi; `recordImport` to'liq-pack yo'lida (`downloadAll`) ham qo'shildi. Server endpointlar curl bilan tekshirilgan (ishladi); `user@assetflow.uz` hisobida test izlari bor (bir nechta download/import, `deviceLabel:"curl-test"`).

### Hal bo'ldi (2026-06-11, testdan o'tdi)

| Joy | Muammo | Commit |
|-----|--------|--------|
| `AssetFlow_Plugin.html` Search tugmasi | Faqat `focus()` qilardi — endi qidiruvni ishga tushiradi (`runSearch()`) | `8e34bea` |
| `AssetFlow_Plugin.html` footer Download | Doim `'project'` mode edi — endi `selectedDropMode` (drop zone tanlovi) bilan ishlaydi, timeline ham | `b30b780` |
| `jsx/host.jsx` root papka tekshiruvi | `app.project.rootFolder` identity-taqqoslash o'rniga `parentFolder == null` | `b099a5e` |
| `assetflow-catalog.js` redirect | http/https moduli har redirect URL'iga qarab qayta tanlanadi; nisbiy `Location` yechiladi | `effbdc1` |
| Import papka nomi | `__srv_<id>` o'rniga shablon title'i (`pack.displayName`); nom band bo'lsa " (2)" suffiks (`uniqueRootFolderLabel`), ichki packKey mantig'i o'zgarmagan | `bddf185` |

### Ma'lum xatolar (tekshirilgan, hali tuzatilmagan)

| Joy | Muammo |
|-----|--------|
| `assetflow-account.js:138` | `requestCheckout`/`requestBillingPortal` plugin token bilan `/api/auth/*` ni chaqiradi — Studio JWT talab qilinishi mumkin (Stripe ishlari bilan birga hal qilinadi) |
| `AssetFlow_Admin.html:2092` | `.mov→.mp4` konversiya `avconvert` bilan — yangi macOS da yo'q/deprecated (alohida vazifa) |
| Toast xabarlari | Ba'zi toast'larda `packName` sifatida `__srv_<id>` ko'rinadi (masalan to'liq-pack import, `downloadAll`) — past ustuvorlik |

---

*Yangilangan: 2026-06-11 — Search tugma, footer timeline mode, rootFolder tekshiruvi, redirect protokoli va import papka nomi tuzatildi (testdan o'tdi); avvalroq: plugin katalog, token yo'qolish bug'i (persistUserPrefs), fetchMe retry, usage recording.*
