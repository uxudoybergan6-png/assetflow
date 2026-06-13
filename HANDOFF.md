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

## Ochiq muammolar va keyingi vazifalar

### 🔴 HIGH — tez hal qilish kerak

1. **Push + Render deploy** — `main` `origin/main`dan 4 commit oldinda (`3193352`, `3361478`, `43a1528`, `42c3f5b`). Foydalanuvchi `git push origin main` qiladi → Render auto-deploy → M1/M3/R2-stream productionga chiqadi. TOKEN placeholder remote URL bo'lgani uchun dastur push qila olmaydi.

2. **M2 ✅ — Faqat tanlangan `.mogrt` yuklab olish**: Yangi uploadlarda har `.mogrt` alohida R2 `templates/{id}/mogrt/{slug}.mogrt` ga yuklandi; `mogrtKey` + `mogrtUrl` catalog'da chiqadi; plugin `downloadSceneMogrt()` faqat tanlangan sahnani yuklab oladi (ZIP fallback backward-compat). **Deploy kerak** (commit shu sessiyada, push kutilmoqda).

3. **Stripe Pro tarif (HIGH, alohida vazifa)**: `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true` dev bypass bor. Productionda haqiqiy Stripe checkout + webhook + `subscription.status=ACTIVE` kerak. `assetflow-account.js:138` `requestCheckout`/`requestBillingPortal` plugin token bilan `/api/auth/*` chaqiradi — Studio JWT kerak bo'lishi mumkin (Stripe bilan birga hal qilinadi).

### 🟡 MEDIUM — muhim, lekin bloklanmaydi

4. ✅ **"Re-extract scenes" endpoint (HIGH)** — KODI YOZILDI (test kutilmoqda): `POST /api/contributor/admin/templates/:id/re-extract` (faqat admin). Pack ZIP'ni disk yoki R2'dan tmpdir'ga yuklab oladi (`downloadS3ToFile`), `.mogrt` sahnalarni qayta ajratadi va `scenes/{slug}.mp4|png` (previewKey) + `mogrt/{slug}.mogrt` (mogrtKey) R2'ga yozadi, `metaJson.scenes` ni yangilaydi. Progress mavjud `GET .../templates/:id/upload-progress` SSE orqali (per-`.mogrt`). Xatoda `{error, stage}` + SSE `[stage]` prefiks. Upload route bilan baham `storeMogrtScenesFromZip()` helper (duplikatsiya yo'q). Lokal test uchun root `.env`ga R2 kalitlari yozildi (oldin bo'sh edi → `isS3Configured()` false bo'lib, item 11 ni ham hal qildi). Fayllar: `apps/api/src/routes/contributor.ts`, `apps/api/src/lib/s3.ts`, `apps/api/src/lib/upload-progress.ts`.

5. **Upload DB retry (MED)**: `contributor.ts` upload handler'dagi yakuniy `prisma.contributorTemplate.update({metaJson})` — katta ZIP'lar (350MB+) uchun ~8 daqiqalik request oxirida DB connection timeout bo'lishi mumkin; hozirgi `catch` xatoni `console.warn` bilan yutadi, `metaJson.scenes` bo'sh qoladi, 200 qaytaradi. Yechim: retry (2–3 urinish, eksponensial backoff) yoki `prisma.$connect()` qayta ochish + alohida `finally` bloki; SSE'ga `error` yuborish lozim.

5. **Email bildirishnomalar** (MED): Approve/reject, yangi xabar, yangi obunachi uchun email yo'q. Nodemailer yoki Resend bilan ulash kerak (`/api/studio/messages/*` webhook hookiga qo'shish qulay).

6. **Orphan message threadlar** (MED): Shablon o'chirilganda `StudioMessageThread.templateId → NULL` (SetNull), thread + xabarlar qoladi. Tozalash yoki arxivlash logikasi yo'q.

7. **`avconvert` `.mov→.mp4`** (MED): `AssetFlow_Admin.html:2092` — yangi macOS da `avconvert` deprecated/yo'q. `ffmpeg` bilan almashtirish kerak (yoki bu funksiya olib tashlash).

### 🟢 LOW — kechiktirish mumkin

8. **ZXP packaging**: CEP extension faqat lokal `install-cep.sh` bilan o'rnatiladi. Tarqatish uchun ZXP + Adobe Exchange tayyorlash kerak.

9. **Contributor payout**: Hech qanday payout tracking yo'q. Kelajakda: `earningsTotal`, Stripe Connect yoki to'lov so'rovi UI.

10. **Plugin stale `downloaded[]`** (LOW): Shablon serverda o'chsa ham `prefs.json` `downloaded[]` va lokal cache qoladi. Sync bilan sinxronlanmaydi.

11. **Root `.env` `AWS_ACCESS_KEY_ID=""`** (LOW, lokal): Root `.env` bo'sh qiymat `apps/api/.env`ni soya qiladi — R2 yuklab olish lokal testda ishlamaydi (production'da muammo yo'q).

12. **Toast `__srv_<id>`** (LOW): Ba'zi toast'larda `packName` sifatida `__srv_<id>` ko'rinadi (to'liq-pack import, `downloadAll`) — past ustuvorlik.

### Doimiy ehtiyot bo'lish kerak

- **AE Admin CEP** — brauzer Admin (Vercel) ishonchliroq; CEP `Failed to fetch` = eski extension yoki `localhost` API.
- **Plugin Browse** — login + **↻ Sync**; API `https://assetflow-rqbq.onrender.com`; **Video Templates** tab (`nav: video`).
- **Pack yo'q** — `hasPack:false` bo'lsa katalogda ko'rinadi, import bloklanadi.
- `apps/web/public/studio` — `npm run studio:sync` bilan package dan sinxron saqlash.

### Claude Code sessiyasida qilingan (2026-06-13) — AE Plugin HIGH fixes ✅

- **Plugin sessiya interceptor ✅** (`assetflow-account.js`, `assetflow-catalog.js`): `handleAuthFailure()` — 401/403 da token tozalash + `assetflow:session-expired` CustomEvent → plugin "Sessiya tugadi — qayta kiring" toast + login oynasi avtomatik ochiladi. `fetchCatalog()` ham katalog 401 da event yuboradi.
- **Boot skeleton + Retry ✅** (`AssetFlow_Plugin.html`): `catalogLoadState` (idle/loading/error/ready); yuklanishda skeleton kartalar + "Server uyg'onmoqda (~60s)" xabari; xatoda ko'zga tashlanadigan **↻ Qayta urinish** tugmasi; filtr nol natija bersa "Filtrlarni tozalash"; shablon haqiqatan yo'q bo'lganda alohida empty state.
- **Toast navbat + ranglar ✅** (`AssetFlow_Plugin.html`): `showToast(msg,type)` — success/error/warning/info rang (yashil/qizil/sariq/ko'k border-left); navbat tizimi (xabarlar bir-birini bosmaydi). `friendlyError()` — `Failed to fetch`→O'zbekcha, `EvalScript error`→"AE skripti javob bermadi", `HTTP 5xx`→"Server javob bermayapti", 401/403→"Sessiya tugadi".
- **Download bekor qilish ✅** (`assetflow-catalog.js`, `AssetFlow_Plugin.html`): `cancelDownload()` — Node.js `http.get` stream'ni `req.destroy()` + `ws.destroy()`, qisman faylni o'chiradi; progress'da **Bekor qilish** tugmasi; `beforeunload`'da ham avtomatik bekor qilinadi.
- **Footer "Import qilish" ✅** (`AssetFlow_Plugin.html`): footer tugmasi "Download" → "Import qilish" (ikkala joy bir xil); hero tugmasi "↓ Hammasini import".
- **`importedScenes` kalit to'qnashuvi ✅** (`AssetFlow_Plugin.html`): `sceneStateKey(packKey, scene)` → `packKey::slug` kompozit kalit; ikki turli pack'da bir xil sahna nomi bo'lsa ham to'qnashuvdan xoli.
- **Featured strip `hasPack:false` filtri ✅** (`AssetFlow_Plugin.html`): `getFeaturedAssets` `hasPack:false` shablonlarni ko'rsatmaydi.
- **Admin "Admin Preview" preset auto-yaratish ✅** (`jsx/host.jsx`, `AssetFlow_Admin.html`): `afEnsureAdminPreviewPreset()` boot'da tekshiradi; yo'q bo'lsa H.264→.mp4 presetdan avto-yaratadi (loyiha `dirty` holatini tiklaydi); yaratib bo'lmasa aniq yo'riqnoma ko'rsatadi.
- **Admin data-loss himoya ✅** (`jsx/host.jsx`, `AssetFlow_Admin.html`): `afCloseCurrent(force)` `app.project.dirty` tekshiradi + JSON javob; `afCloseCurrentGuarded()` — saqlanmagan ish bor bo'lsa tasdiq dialogi (3 chaqiruv joyi; bekor qilsa import to'xtaydi).
- **Admin auth markazlashtirildi ✅** (`AssetFlow_Admin.html`): `api()` funktsiyasi login yo'lidan tashqari har 401/403 da `handleAuthError()` chaqiradi — `saveMetadata`, `deleteTemplate` va kelajakdagi barcha yo'llar himoyalangan.

**Commit:** `1e4d0d4` — 6 fayl, +493/-104 qator. Testdan o'tdi.

### Claude Code sessiyasida qilingan (2026-06-12)

- **.mogrt pack support** — ZIP ichidan papka nomidan qat'iy nazar `.mogrt` topish (`unzip -Z1` + kengaytma filter), har `.mogrt` ichidan video preview (`thumb.mp4`) va thumbnail (`thumb.png`) extraction, bir nechta `.mogrt` bo'lsa tanlab import (sahna kartalari UI). Contributor upload `.zip` ham qabul qiladi. Admin pack tekshiruvi `.aep` va `.mogrt` ni qo'llab-quvvatlaydi. **2026-06-12, testdan o'tdi.**
- **M1 ✅ — Server-side sahna preview** (`mogrt-extract.ts`, `contributor.ts`): ZIP upload paytida har `.mogrt`dan `thumb.mp4`/`thumb.png` chiqariladi; slug `sceneKey()` formatida (dash-lowercase, `template-files.js`); `previewKey` DB `metaJson.scenes[].previewKey`ga yoziladi; thumblar diskka (`scenes/`) + R2 (`templates/{id}/scenes/{key}.ext`) yuboriladi. `catalog-map.ts` `enrichScenesAsync` allaqachon `previewKey` ni URL ga aylantiradi — o'zgartirish shart emas edi. Bonus: `plugin.ts:126` ESM `require("path")` → `path.extname` (scene route oldin disk fallbackda 500 qaytarardi). Commit `43a1528`.
- **M3 ✅ — Plugin merge logikasi** (`assetflow-catalog.js`, `AssetFlow_Plugin.html`): `mergeMogrtItems` — server sahna ro'yxati (nom/preview/tartib) saqlanadi, keshdan faqat `mogrtPath` biriktiriladi; mos kelmasa eski xulq (kesh ro'yxati). `sceneSlugOf` qo'shildi. `applyMogrtItems` + `openPack` ikkala joy yangilandi. `importedScenes` (s.n) endi barqaror. Commit `43a1528`.
- **R2 stream upload** (`s3.ts`): `readFileSync` → `createReadStream` + `ContentLength`; xato aniq log + rethrow. Commit `3193352`.
- **M2 ✅ — Selective `.mogrt` download** (`mogrt-extract.ts`, `contributor.ts`, `catalog-map.ts`, `plugin.ts`, `assetflow-catalog.js`, `AssetFlow_Plugin.html`): upload paytida har `.mogrt` R2 `templates/{id}/mogrt/{slug}.mogrt` ga yuklanadi; `mogrtKey` + `mogrtUrl` catalog'da chiqadi; plugin `downloadSceneMogrt()` faqat tanlangan sahnani (MB) yuklab oladi, ZIP fallback backward-compat. `host.jsx` Timeline comp check bug ham tuzatildi (`app.activeViewer` fallback). Deploy kerak.
- **SSE upload progress ✅** (`upload-progress.ts` yangi, `contributor.ts`): `receive→sync(82)→db(88)→extract(90-97)→db(98)→done(100)` real vaqtda; barcha xato yo'llari (413/400/500) bosqich bilan SSE'ga chiqadi. Studio XHR 0-80%, server 80-100%.
- **Contributor dashboard professional ✅** (`studio-templates.js`, `contributor-views.js`, `app.css`): haqiqiy `downloadsCount`/`importsCount` (yangi migration `template_usage_counters`, Prisma); KPI overview; jadvalda importlar; admin xabarlar paneli; mobile responsive.
- **Migration** `20260612180000_template_usage_counters`: `downloadsCount`/`importsCount` ustunlari `ContributorTemplate`'da. Production deploy'da `npm run migrate:deploy -w @creative-tools/database` kerak.

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
| Shablon o'chirish (`contributor.ts` DELETE) | Shablon o'chirish endi R2 + disk fayllarini ham tozalaydi (`deleteTemplateAssets`, prefiks aniq `templates/{id}/`), fail-closed (R2 xatosida 502 + DB saqlanadi). **2026-06-11, production'da tasdiqlandi.** | `4220031` |

### Ma'lum xatolar (tekshirilgan, hali tuzatilmagan)

| Joy | Muammo |
|-----|--------|
| `assetflow-account.js:138` | `requestCheckout`/`requestBillingPortal` plugin token bilan `/api/auth/*` ni chaqiradi — Studio JWT talab qilinishi mumkin (Stripe ishlari bilan birga hal qilinadi) |
| `AssetFlow_Admin.html:2092` | `.mov→.mp4` konversiya `avconvert` bilan — yangi macOS da yo'q/deprecated (alohida vazifa) |
| Toast xabarlari | Ba'zi toast'larda `packName` sifatida `__srv_<id>` ko'rinadi (masalan to'liq-pack import, `downloadAll`) — past ustuvorlik |

---

*Yangilangan: 2026-06-13 — Plugin+Admin HIGH fixes ✅ (sessiya interceptor, boot skeleton, toast navbat, download cancel, import label, scene key, featured filter, admin preset auto-create, data-loss guard, admin auth). Commit `1e4d0d4`. Production deploy kerak (push → Render). Keyingi: Stripe Pro tarif, email bildirishnomalar, re-extract endpoint test.*
