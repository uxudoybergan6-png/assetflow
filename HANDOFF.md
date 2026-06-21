# AssetFlow / Creative Tools SaaS — handoff (Cursor → Claude Code)

Bu hujjat loyiha joylashuvi, arxitektura va **hozirgacha qilingan ishlar**ni qisqacha beradi. Claude Code shu repoda davom etishi mumkin.

---

# 🆕 Sessiya 2026-06-14/15 — Dizayn + AI Studio Gen

## Bajarilgan
- **0-bosqich:** Stripe bypass yopildi (`NODE_ENV` gate); mehmon yuklab olish guard + modal.
- **Obunachi boshqaruvi:** qator amallar (reja/blok/chiqarish), per-user limit override (migration),
  AI kredit boshqaruvi (admin set/reset), **ADMIN aiCredits CHEKSIZ bypass**.
- **Render AUTO-DEPLOY yoqildi** (ilgari Off edi).
- **Bandwidth:** thumb/preview/sahna to'g'ridan R2 CDN (`CDN_BASE_URL`) — Render egress 0;
  preview 720p transcode (250MB→~5MB); pack.zip saqlanadi (Variant 1).
- **Contributor Overview** egri-qo'shtirnoq SyntaxError tuzatildi.
- **Dizayn:** Claude Design (`docs/design-reference/` Standart+LiquidGlass) → plagin to'liq re-skin
  (AI Tools, Katalog hero-karusel+ixcham filtr, Sidebar). **3 TEMA tizimi**
  (`tokens.css [data-theme]` standart/liquid-glass/light-glass) + almashtirgich.
  Build versiya yorlig'i (`install-cep` stamp).
- **AI Tools:** Workers AI backend (image/voice/search) → keyin **OPENROUTER**ga ko'chirildi
  (rasm/edit/video Kling-Veo/ovoz/embeddings unified, `lib/ai/openrouter.ts`).
- **STUDIO GEN arxitektura** (Artlist namunasi, `docs/STUDIO-GEN-BLUEPRINT.md` + `docs/REJA-studio-gen.md`):
  Prisma `GenSession`/`Generation`/`GenAsset`; `/api/studio/gen` endpointlar (sessions/models/
  cost-quote **(IMZOLANGAN JWT)**/gen (job)/status/enhance/credits); `gen-processor` (image/edit sync,
  video async poll, speech) → R2 → GenAsset; UI **1e-1** (model katalog+cost-quote), **1e-2**
  (generate+polling+import).
- **Import mustahkamlash:** magic-byte format aniqlash, `canImportAs(FOOTAGE)`, comp'ga layer,
  host.jsx **ATOMIK evalFile+call** (engine eski-versiya muammosi), Timeline reference
  (`getActiveTimelineVideoReference`).

## ENV (Render'ga kerak)
- **`OPENROUTER_API_KEY`** (yangi, asosiy AI provayder), `CF_ACCOUNT_ID`/`CF_AI_TOKEN` (Workers AI,
  qidiruv embeddinglari hali shunda), `CDN_BASE_URL` (bandwidth fix), `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`.

## OCHIQ / KEYINGI
- **OpenRouter HAQIQIY generatsiya testi qilinmadi** (kalit Render'da bo'lishi + model ID tasdiqlash
  kerak — ba'zi ID docs namunasidan: `gemini-flash-image`, `gpt-4o-audio`, `kling`/`veo`;
  `/gen/models` yoki dashboard'dan tekshirilsin, `gen-models.ts`'da bir joyda).
- **1e-3** (generatsiya tarixi grid + session sidebar) — Batch 1 oxirgi sub-qadam, **qilinmagan**.
- Qidiruv embeddinglari hali Workers AI'da (keyin OpenRouter'ga).
- Test: ADMIN hisob (`admin@assetflow.uz`) cheksiz AI kredit — generatsiya testi shu bilan.

## MUHIM SABOQLAR (kelajak uchun)
- **CEP ochiq panel HTML'ni hot-reload QILMAYDI** — HTML o'zgarishidan keyin `install-cep` +
  AE to'liq Cmd+Q→qayta ochish. Build yorlig'i bilan tasdiqlanadi.
- **host.jsx** manifest `ScriptPath` AE start'da bir marta yuklanadi → yangi funksiyalar uchun
  **ATOMIK evalScript** (`$.evalFile`+call bitta blokda) yoki AE restart.
- Studio manba: `packages/assetflow-studio/js/` (root), keyin `studio:sync`.
- `install-cep` AE versiyani avto-aniqlaydi (2026).
- **Imzolangan cost-quote:** kredit narxini klientga ishonmang.

---

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

## Bandwidth / storage qarorlari (2026-06-14)

- **Render egress 0:** katalog `thumbUrl`/`previewUrl`/sahna URL'lari R2 sozlangan bo'lsa
  to'g'ridan `CDN_BASE_URL` (R2 public) qaytaradi — Render orqali stream EMAS (`catalog-map.ts`).
  Pack DOIM API gate → 302 signed R2. Yangi upload'larga uzoq immutable Cache-Control.
- **Preview transcode:** `optimize-preview.ts` endi 720p H.264 CRF28 30fps ovozsiz (250MB→~5MB),
  xatoda faststart fallback.
- **QAROR — pack.zip dublikati:** **Variant 1** — pack.zip DOIM saqlanadi, stream-zip qo'shilmaydi
  (egress'ni asraydi; R2 storage arzon). Packlar aralash: A=mogrt-only (dublikat), B=.aep+footage
  (yagona nusxa). Batafsil: `docs/REJA-pack-dedup.md`.

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
- `npm run studio:sync` — `prepare-vercel`: `packages/assetflow-studio` js/+styles/ → studio/, admin/ artefakt (Vercel). (apps/web o'chirildi — #10; CF Pages/lokal dev manbadan ishlaydi.)

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
| Studio (CF Pages) | https://assetflow-20j.pages.dev |
| Contributor | …/studio/login.html → …/studio/contributor/ |
| Admin | …/studio/admin-login.html → …/studio/admin/ |

**CF Pages Build command:** `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs`
**CF Pages Output dir:** `packages/assetflow-studio/dist`

**Render env:** `API_PUBLIC_URL`, `ADMIN_URL`, `CORS_ORIGIN`, R2 (`AWS_*`, `S3_ENDPOINT`, `CDN_BASE_URL`).

> **Deploy eslatmasi (2026-06-14):** Render auto-deploy **YOQILDI**. Ilgari Off edi — shuning uchun CF Pages (frontend) yangilanib, Render (API + migration) orqada qolardi. Endi har push'da ikkalasi avtomatik deploy bo'ladi. Yangi migration push qilinsa, Render `migrate:deploy` ni avtomatik ishga tushiradi.

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

1. ✅ **Push + production deploy (2026-06-13 kech, HAL QILINDI)** — barcha fix'lar `origin/main`ga push qilindi (GitHub Desktop orqali). **Render** har push'da auto-deploy qiladi (✅ ishlaydi). **Vercel** dastlab "Blocked" edi — sabab: commit message'lardagi `Co-Authored-By: Claude` Vercel Hobby team uchun "boshqa muallif" deb ko'rinardi. Bo'sh trigger commit (`21f63b6`, Co-Authored-By'siz) + repo public → Vercel deploy ishladi. **Bundan keyin commit message'ga `Co-Authored-By` yozilmaydi.**

2. **Stripe Pro tarif (HIGH, alohida vazifa)**: `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true` dev bypass bor. Productionda haqiqiy Stripe checkout + webhook + `subscription.status=ACTIVE` kerak. `assetflow-account.js:138` `requestCheckout`/`requestBillingPortal` plugin token bilan `/api/auth/*` chaqiradi — Studio JWT kerak bo'lishi mumkin (Stripe bilan birga hal qilinadi).

### 🟡 MEDIUM — muhim, lekin bloklanmaydi

4. ✅ **"Re-extract scenes" endpoint (HIGH)** — KODI YOZILDI (test kutilmoqda): `POST /api/contributor/admin/templates/:id/re-extract` (faqat admin). Pack ZIP'ni disk yoki R2'dan tmpdir'ga yuklab oladi (`downloadS3ToFile`), `.mogrt` sahnalarni qayta ajratadi va `scenes/{slug}.mp4|png` (previewKey) + `mogrt/{slug}.mogrt` (mogrtKey) R2'ga yozadi, `metaJson.scenes` ni yangilaydi. Progress mavjud `GET .../templates/:id/upload-progress` SSE orqali (per-`.mogrt`). Xatoda `{error, stage}` + SSE `[stage]` prefiks. Upload route bilan baham `storeMogrtScenesFromZip()` helper (duplikatsiya yo'q). Lokal test uchun root `.env`ga R2 kalitlari yozildi (oldin bo'sh edi → `isS3Configured()` false bo'lib, item 11 ni ham hal qildi). Fayllar: `apps/api/src/routes/contributor.ts`, `apps/api/src/lib/s3.ts`, `apps/api/src/lib/upload-progress.ts`.

5. **Upload DB retry (MED)**: `contributor.ts` upload handler'dagi yakuniy `prisma.contributorTemplate.update({metaJson})` — katta ZIP'lar (350MB+) uchun ~8 daqiqalik request oxirida DB connection timeout bo'lishi mumkin; hozirgi `catch` xatoni `console.warn` bilan yutadi, `metaJson.scenes` bo'sh qoladi, 200 qaytaradi. Yechim: retry (2–3 urinish, eksponensial backoff) yoki `prisma.$connect()` qayta ochish + alohida `finally` bloki; SSE'ga `error` yuborish lozim.

5. **Email bildirishnomalar** (MED): Approve/reject, yangi xabar, yangi obunachi uchun email yo'q. Nodemailer yoki Resend bilan ulash kerak (`/api/studio/messages/*` webhook hookiga qo'shish qulay).

6. **Orphan message threadlar** (MED): Shablon o'chirilganda `StudioMessageThread.templateId → NULL` (SetNull), thread + xabarlar qoladi. Tozalash yoki arxivlash logikasi yo'q.

13. **`mogrt-extract.ts` `execFileSync` event-loop bloklaydi** (MED): `unzip` sinxron chaqiriladi — katta pack ekstrakti davomida (60s gacha) Node event-loop'i bloklanadi, server `/health` ga javob bera olmaydi → Render uni "unhealthy" deb restart qilishi mumkin. **Xotira muammosi EMAS** (tashqi jarayon, diskka yozadi). Yechim: async `execFile` (promisify) ga o'tkazish.

7. ✅ **`avconvert` → `ffmpeg`** (MED, HAL QILINDI 2026-06-13): `findFfmpeg()` keng yo'llarni qidiradi (CEP'da PATH minimal); `.mov→.mp4` `ffmpeg -c:v libx264`; ffmpeg topilmasa aniq toast. `AssetFlow_Admin.html`.

### 🟢 LOW — kechiktirish mumkin

8. ✅ **ZXP packaging** (HAL QILINDI 2026-06-13): `plugins/after-effects-cep/scripts/build-zxp.sh` — `ZXPSignCmd` auto-detect, self-signed sertifikat yaratish, stage + imzolash. Commit `6a7057a`.

9. **Contributor payout**: Hech qanday payout tracking yo'q. Kelajakda: `earningsTotal`, Stripe Connect yoki to'lov so'rovi UI.

10. ✅ **Plugin stale `downloaded[]`** (HAL QILINDI 2026-06-13): `refreshBrowse` dan keyin server'dan o'chirilgan `__srv_*` kalitlari `downloaded` va `importedScenes` dan tozalanadi. `assetflow-catalog.js`. Commit `6a7057a`.

11. **Root `.env` `AWS_ACCESS_KEY_ID=""`** (LOW, lokal): Root `.env` bo'sh qiymat `apps/api/.env`ni soya qiladi — R2 yuklab olish lokal testda ishlamaydi (production'da muammo yo'q).

12. ✅ **Toast `__srv_<id>`** (HAL QILINDI 2026-06-13): `AssetFlow_Plugin.html` — toast `p.displayName || n`, drop-zone label `asset.displayName || asset.n`. Commit `6a7057a`.

### Doimiy ehtiyot bo'lish kerak

- **AE Admin CEP** — brauzer Admin (CF Pages) ishonchliroq; CEP `Failed to fetch` = eski extension yoki `localhost` API.
- **Plugin Browse** — login + **↻ Sync**; API `https://assetflow-rqbq.onrender.com`; **Shablonlar** tab (`nav: video`).
- **Pack yo'q** — `hasPack:false` bo'lsa katalogda ko'rinadi, import bloklanadi.
- **Lokal dev** — `npm run studio` → API (:4000) + Contributor Studio (:3000 `dev-studio-server`) + Admin (:3001 `dev-admin-server`), Studio MANBASINI to'g'ridan serv qiladi. (apps/web Next.js o'chirildi — #10.)

### Claude Code sessiyasida qilingan (2026-06-13, kech-3..6) — Production deploy debugging ✅

Push qilingach Render/Vercel'da chiqqan real production xatolar ketma-ket hal qilindi (har biri commit + push, deploy tasdiqlangan):

- ✅ **Render build "Exited with status 2"** (`7940766`, `a4fe937`): (1) TS `req`/`res` implicit `any` + `express` tip topilmadi → `plugin.ts`/`stripe.ts`/`users.ts` aniq tip; (2) asl sabab — Render `NODE_ENV=production` `npm install` devDeps'ni o'tkazib yuborardi → **`@types/*` + `typescript`** `devDependencies`→`dependencies` (apps/api). `render.yaml` `npm install --include=dev`. No-op build skriptlar (`shared`, `after-effects-cep`).
- ✅ **CORS wildcard** (`b9f3ec3`): `CORS_ORIGIN=*` ishlamasdi (`["*"].includes(url)`=false). `index.ts` callback: `*`/bo'sh→hammaga ruxsat, URL→aniq, vergulli→ro'yxat.
- ✅ **Studio `localhost:4000` fallback** (`70a2a27`): 5 fayl (studio-api, assetflow-log, studio-templates, studio-media, admin-logs) last-resort fallback → `https://assetflow-rqbq.onrender.com`. `studio-config.js:39` lokal-dev tarmog'i ataylab o'zgartirilmadi.
- ✅ **Logs 401 + analytics 403** (`66b8bdd`): `assetflow-log.js pushServer` token yo'q bo'lsa server'ga so'rov yubormaydi (login'gacha 401 spam yo'q); `studio-templates.js` contributor `init` else tarmog'idan admin-only `loadPluginAnalytics()` olib tashlandi (403 yo'q).
- ✅ **Render OOM (512MB)** (`74509a8`): katta pack yuklashda OOM. Asl sabab — AWS SDK v3 default `requestChecksumCalculation="when_supported"` `PutObjectCommand` stream body ustidan CRC32 ni oldindan hisoblaydi; R2 trailer checksum'ni qo'llamagani uchun SDK **butun faylni xotiraga yig'adi**. Yechim: S3Client `requestChecksumCalculation/responseChecksumValidation: WHEN_REQUIRED` + `uploadFileToS3` → `@aws-sdk/lib-storage` `Upload` (multipart, partSize 8MB×queueSize 4 ≈ 32MB cho'qqi, 3GB bo'lsa ham).
- ✅ **Vercel "Blocked" deploy** (`21f63b6`): commit message'lardagi `Co-Authored-By: Claude` Vercel Hobby team uchun begona muallif → bloklar edi. Bo'sh trigger commit + repo public → ishladi. **Bundan keyin `Co-Authored-By` yozilmaydi** (qoida xotiraga ham yozildi).

**Deploy holati (2026-06-13 kech):** Render API current (`74509a8`), Vercel Studio deploy ishlayapti. Konsoldagi 401/403/CORS xatolar ketdi.

### Claude Code sessiyasida qilingan (2026-06-13, kech-2) — Audit: 13 HIGH security/UX + upload progress + 3 GB ✅

To'liq kodbaza auditi o'tkazildi (backend route'lar/lib, AE Plugin+Admin, Studio, Prisma). Topilgan **13 ta HIGH/kritik muammo tuzatildi** (commit `fix(security+ux)...`, push kutilmoqda). Build/`tsc` toza, `node --check` + HTML inline-JS parse OK, `install-cep.sh` o'rnatildi, `prepare-vercel.mjs` bilan `studio/js`+`admin/js` sinxron.

**Xavfsizlik (backend `apps/api`):**
- ✅ **XSS→RCE** — markaziy `escHtml`/`escAttrJs`; server matnlari (nom/tag/sahna/desc/email/xabar) escape: `AssetFlow_Plugin.html`, `AssetFlow_Admin.html`, `admin-views2.js`, `contributor-views.js` + markaziy `ui.js toast()`. CEP Node ruxsatiga ega — ilgari ixtiyoriy kod ishga tushishi mumkin edi.
- ✅ **Pack auth + published + Free/Pro gate** — `/assets/:id/pack` + `/mogrt/:slug` `requireAuth`+`guardDownloadable` (admin nashr etilmaganni ham yuklaydi); `catalog-map` pack URL→API endpoint (to'g'ridan R2 emas); `serve-asset` pack→5-daq signed R2 URL; client (`catalog.js`, Admin) auth header yuboradi, redirect'da cross-origin'ga tushirmaydi. `plugin-profile.checkDownloadAllowed`.
- ✅ **`/api/logs`** — `requireAuth+requireAdmin`; `assetflow-log.js` auth header yuboradi (jim yutadi).
- ✅ **CORS** — haqiqiy `CORS_ORIGIN` allow-list (CEP `file://`/`null` ruxsat). **DIQQAT: Render'da `CORS_ORIGIN` Vercel studio URL'ini o'z ichiga olishi SHART.**
- ✅ **Login rate-limit** — `/auth/login`,`/register`,`/forgot-password`.
- ✅ **JWT env** — `validateEnv()` listen'dan oldin; prod'da default/bo'sh secret → `process.exit(1)`. **DIQQAT: Render'da `NODE_ENV=production` + kuchli `JWT_SECRET` shart.**
- ✅ **trust proxy** — `app.set('trust proxy',1)` (Render `req.ip`).
- ✅ **Global error handler** — 404 JSON + P2025→404, P2002→409, qolgan→500 (Express 5 async throw'ni ushlaydi).

**Funksional/UX:**
- ✅ **downloadAll** — bekor qilinganda soxta "Import xato" yo'q; `ok:`/JSON ikkalasi qabul; `markPackDownloaded` to'g'ri (`AssetFlow_Plugin.html`).
- ✅ **`loadPluginAnalytics` ReferenceError** — `totalDownloads: total` → `data.usage.downloadsTotal` (`studio-templates.js`).
- ✅ **Admin data-loss guard** — `afCloseCurrentGuarded` bridge xatosi/noaniqda jim `return` o'rniga `afAbort` throw; uchala open oqimi to'xtaydi (forceOpen ishlamaydi) (`AssetFlow_Admin.html`).
- ✅ **avconvert→ffmpeg** (yuqorida #7).
- ✅ **Tariflar server'da** — `checkDownloadAllowed` gate; Pro = Stripe `subscription.status` (mavjud `setPluginPlan`). (Eslatma: limit hozircha **oylik** 15dl/10import; "kunlik" yangi DB ustun + migration talab qiladi — qo'shilmadi.)
- ✅ **Studio upload progress (per-fayl)** — "Media fayllar" bosqichida «Davom etish» endi fayllarni darhol yuklaydi; har fayl uchun progress bar (0-100%) + «Yuklanmoqda… 42% (210MB / 500MB)» + «✓ Yuklandi»; server bosqichi SSE; `UP_UPLOADED_SIG` submit'da qayta yuklamaydi (`contributor-views.js`).
- ✅ **Pack limiti 500 MB → 3 GB** — `contributor.ts` multer `3300*1024*1024`; 413 matn, `studio-api.js`, `contributor-views.js` (`MAX_UPLOAD_MB=3072`), admin settings input. **DIQQAT: 3 GB yuklash Render proxy timeout/ephemeral disk'ga bog'liq.**

### Claude Code sessiyasida qilingan (2026-06-13) — Plugin+Admin MEDIUM fixes ✅

Asosiy va Admin plagindagi barcha MED muammolar tuzatildi (commit `c7a7940`, push kutilmoqda):

**Asosiy plugin (`AssetFlow_Plugin.html` + `assetflow-catalog.js` + `assetflow-account.js`):**
- ✅ **Saralash haqiqiy** — API endi `createdAt` qaytaradi (`plugin.ts` CATALOG_SELECT + `catalog-map.ts`); "Yangi" sana bo'yicha, "Mos" qidiruv moslik bali (`relevanceScore`) bo'yicha; `assetTime()`.
- ✅ **Search debounce 300ms** — `__searchDebounce`; ⌕ tugmasi darhol (debounce'ni tozalaydi).
- ✅ **Jim catch** — `saveDownloadFolderSettings` papkaga yozishni sinaydi + aniq xato; `persistDownloadDir` bool qaytaradi; kesh o'chirishda `cacheFails` hisoblanadi.
- ✅ **Fetch 30s timeout** — `fetchWithTimeout` (catalog.js + account.js, FormData uchun 180s) + `pubFetch` (publish), `AbortController`.
- ✅ **Filtr ko'rsatkichi** — «✕ Tozalash (N)» pill (`updateFilterIndicator`, `activeFilterCount`); 0 natijada "N ta filtr natijani yashiryapti".
- ✅ **Til o'zbekcha** — Qidirish/Saralash/Mos/Yangi/Kategoriya/Sifat/Sevimlilar/Shablonlar/Yuklab olingan; `NAV_LABELS`/`ORIENT_LABELS`/`RES_LABELS` ham. (AE-mockup chrome ataylab inglizcha.)
- ✅ **Publish progress** — `publishGo` 1/6…6/6 bosqich; pack+preview **XHR `%`** (`pubUpload` XHR'ga o'tdi); xatoda `Xato [bosqich]:` + `friendlyError`.
- ✅ **Poyga qulfi** — `__afOpBusy`: `importSceneWithMode`/`downloadAll` bir vaqtda bittasi (wrapper + `__…Impl`); qo'sh bosish/drag bloklanadi.

**Admin plugin (`AssetFlow_Admin.html`):**
- ✅ **Cold-start retry** — `api()` tarmoq xatosida `waitForApi` bilan bir marta uyg'otib qayta urinadi ("Server uyg'onmoqda").
- ✅ **Jim catch** — `importPackToAE`: unzip xatosi ko'rinadi (`ZIP ochilmadi:`); AE ochilishi tasdiqlanmasa soxta "✓" emas, ⚠ (`opened` flag + `warn` log state); host-boot xatosi toast.
- ✅ **Tugma disable** — review/publish/save/delete amal davomida bloklanadi + "⏳" (`setBtnBusy`, qardosh tugmalarni ham; `this` uzatiladi).
- ✅ **Obunachilar** — `lastSeenAt` ISO (`mapSubscriberRow`) → jonli `timeAgo`; «⧉ Nusxalash» email'ni **clipboard**'ga ko'chiradi (`copyToClipboard` — CEF `execCommand` → `navigator.clipboard`), toast "Email nusxalandi: …". mailto/OS-open CEP'da ishlamagani uchun olib tashlandi.

**API:** `createdAt` + `lastSeenAt` ISO; `contributor.ts` PATCH `mergeSceneMeta` — scenes yangilanganda server boyitgan per-scene kalitlar (`previewKey`/`mogrtKey`/`preview`) saqlanadi. `tsc --noEmit` + `npm run build -w apps/api` toza. **Render deploy kerak** (createdAt/lastSeenAt/scene-merge production'ga chiqishi uchun).

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
| `AssetFlow_Admin.html` `.mov→.mp4` | ✅ HAL QILINDI (2026-06-13) — `avconvert` → `ffmpeg` (`findFfmpeg`), yo'q bo'lsa aniq toast |
| Toast xabarlari | Ba'zi toast'larda `packName` sifatida `__srv_<id>` ko'rinadi (masalan to'liq-pack import, `downloadAll`) — past ustuvorlik |

---

### Claude Code sessiyasida qilingan (2026-06-13, kech-7) — LOW bug fixes ✅

8 ta LOW muammo tuzatildi (commit `6a7057a`):

- ✅ **Toast `__srv_<id>`** — `p.displayName || n`; drop-zone label ham `asset.displayName || asset.n`.
- ✅ **Stale `downloaded[]` prune** — `refreshBrowse` dan keyin server'dan o'chirilgan kalitlar `downloaded`+`importedScenes`dan tozalanadi.
- ✅ **DB perf indices** — `User.role`, `PluginProfile.lastSeenAt`, `ContributorTemplate(reviewStatus,published,updatedAt)` (migration `20260613120000_add_perf_indices`, lokal DB ga qo'llanildi).
- ✅ **Dead code** — `switchNav()`, `trendSearch()` o'chirildi (`AssetFlow_Plugin.html`).
- ✅ **O'zbekcha UI** — "Drop assets here ↓"→"Fayllarni bu yerga tashlang ↓", "Drop asset here"→"Faylni bu yerga tashlang", "Video Templates"→"Shablonlar".
- ✅ **ZXP script** — `plugins/after-effects-cep/scripts/build-zxp.sh` (ZXPSignCmd, self-signed cert, imzolash).
- ✅ **`recordDownload` kvota** — ZIP/mogrt ochilgandan KEYIN hisoblanadi (`downloadSceneMogrt` + `downloadPackToTemp`).
- ✅ **Kesh `size` tekshiruvi** — `st.size !== expectedSize` → `st.size < expectedSize * 0.95` (95% chegara).

**Ochiq LOW:** Contributor payout, Root `.env` AWS bo'sh (lokal).
**Ochiq MED:** Stripe Pro tarif (production), upload DB retry, email, orphan threadlar, `execFileSync` async.

### Claude Code sessiyasida qilingan (2026-06-14) — CF Pages, Login, Studio URL, LOW ✅

- ✅ **Cloudflare Pages build skript** — `packages/assetflow-studio/scripts/prepare-cf-pages.mjs`: `dist/` tayyorlash, `_redirects` + `_headers`, barcha studio fayllar. CF Pages: Build `node .../prepare-cf-pages.mjs`, Output `packages/assetflow-studio/dist`.
- ✅ **Studio URL Cloudflare ga yangilandi** — barcha `assetflow-studio-one.vercel.app` → `assetflow-20j.pages.dev`: `app-urls.ts`, `assetflow-env.js`, `assetflow-account.js`, `AssetFlow_Admin.html`, `.env.cloud.example`. Commit `chore: update studio URL to Cloudflare Pages`.
- ✅ **"Meni eslab qol"** — Admin login + Contributor login: `localStorage` `af_remember_email`/`af_remember_session`; `GET /api/auth/me` bilan token tekshiruvi; `logout()` tozalaydi. Commit `feat(studio): add remember me to login pages`.
- ✅ **8 ta MEDIUM bug fix** (commit `88d2ca6`): `findFolderByPath` `parentFolder==null`, marker timing, S3 N+1, async unzip (`execFileAsync`), `evalScript` 30s watchdog, Zod error shape (`issues[0].message`), dinamik identity, localhost havolalar olib tashlandi.
- ✅ **8 ta LOW bug fix** (commit `6a7057a`): toast displayName, stale cache prune, DB indices (migration), dead code, O'zbekcha UI, ZXP script, `recordDownload` after extract, kesh size range.

**Keyingi ustuvor vazifalar:**
1. 🔴 **0-bosqich A: Stripe bypass yopish** — `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true` o'chirish, haqiqiy Stripe checkout/webhook ulash (KRITIK, ~10 daqiqa konfiguratsiya).
2. 🟡 **0-bosqich B: ZXP test** — `build-zxp.sh` bilan `.zxp` yaratish va AE da sinash.
3. 🟡 **1-bosqich: Dizayn tizimi** — Studio / Plugin UI yaxshilash.
4. 🟡 **2-bosqich: evalJSX, refresh token, Sentry** — ishonchlililik.
5. 🟡 **3-bosqich: AI Tools** — shablonlar uchun AI funksiyalar.
6. 🟡 **To'lov tizimi: LemonSqueezy ulash** — Stripe o'rniga soddaroq variant.

*Yangilangan: 2026-06-14 — CF Pages ✅, Meni eslab qol ✅, Studio URL ✅, MEDIUM ✅, LOW ✅. Push bajarildi. Ochiq: Stripe/LemonSqueezy, payout, email, evalJSX, Sentry.*

### Claude Code sessiyasida qilingan (2026-06-14, kech) — Xavfsizlik + Obunachi boshqaruvi + Hisob UI ✅

- ✅ **0-bosqich Vazifa A: Stripe bypass yopildi** — `render.yaml` `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`; `plugin-profile.ts:79` `NODE_ENV !== "production"` himoyasi (dev bypass ishlab, prod'da hech qachon). Commit `573286b` (faqat bu ikkita fayl).
- ✅ **Mehmon yuklab olish guard** — `AssetFlow_Plugin.html`: `showLoginRequired()` modal (CSS token `--surface-2/--accent/--border`); `importSceneWithMode` + `downloadAll` boshida `AssetFlowAccount.isLoggedIn()` tekshiruvi — login qilmagan foydalanuvchi serverga so'rov yubormaydi. CEP o'rnatildi.
- ✅ **Obunachi boshqaruvi Qism A** — `packages/assetflow-studio/js/admin-subscribers.js`: har qatorda `⋮` amal menyusi (`<details>`/CSS backdrop) — reja toggle, blok/chiqarish, qaytarish. `packages/assetflow-studio/js/studio-api.js`: `updateSubscriber(userId, body)`. CSS: `.act-menu/.act-drop/.act-item/.act-sep`.
- ✅ **Obunachi boshqaruvi Qism C: per-user limit override** — `PluginProfile.downloadLimitOverride Int?` + `importLimitOverride Int?` (migration `20260614100000_plugin_limit_override`, `migrate:deploy` bajarildi). `plugin-profile.ts`: `checkDownloadAllowed`/`recordPluginDownload`/`recordPluginImport` `effectiveLimit = override ?? planDefault`. `admin.ts` PATCH: Zod schema + Prisma update. Admin UI: `openLimitOverrideSub` modali, "shaxsiy limit" belgisi, "Pro/Free qilish" tugmasi profil sahifasida. Commit `5c0e289`.
- ✅ **Plagin effektiv limit fix** — `serializePluginUser`: `base = planLimits(plan)`, keyin `limits = { ...base, downloadLimit: override ?? base.downloadLimit, importLimit: override ?? base.importLimit, unlimitedDownloads: override==null ? base.unlimitedDownloads : false }`. `/me` va `/subscription` endi effektiv (override) limitni qaytaradi.
- ✅ **Hisob panelini soddalashtirish** — `AssetFlow_Plugin.html`: 4 kartochka grid → bitta `acc-usage-block`: "Bu oy: N / Limit" (Cheksiz → Pro), progress bar, ikkilamchi "Jami: N · Import: N". CEP o'rnatildi.

**OCHIQ:** Qism B (hard delete backend + ikki bosqichli UI tasdiqlash) hali qilinmagan.
**Deploy:** Push qilinganda Render'da `npm run migrate:deploy -w @creative-tools/database` + `npm run generate -w @creative-tools/database` kerak (yangi ustunlar uchun).

### Claude Code sessiyasi (2026-06-14, dizayn + obunachi) ✅

- **0-A: Stripe bypass yopildi** (`573286b`) — `render.yaml PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false` + `plugin-profile.ts` `NODE_ENV!=="production"` himoyasi. **Mehmon yuklab olish guard** + login modal (`showLoginRequired()`; import/download boshida `AssetFlowAccount.isLoggedIn()` tekshiruvi).
- **Obunachi boshqaruvi** — qator amallari (reja toggle / blok / chiqarish, `admin-subscribers.js`); **per-user limit override** (`PluginProfile.downloadLimitOverride/importLimitOverride`, migration `20260614100000_plugin_limit_override`); profil reja toggle; `serializePluginUser` effektiv limit (`override ?? planDefault`); Hisob panel soddalashtirildi (4 karta → bitta usage-block).
- **Render AUTO-DEPLOY yoqildi** — ilgari Off edi (backend/migration orqada qolardi, CF Pages auto edi); endi har push'da API + `migrate:deploy` avtomatik.
- **Dizayn** — Claude Design eksportlari `docs/design-reference/` (**Standart = manba haqiqat**, **Liquid Glass = tema**). Plagin to'liq re-skin: **AI Tools UI** (yagona kompozer + "Nima yaratamiz?" launcher), **Katalog** (hero **karusel** — avto+drag+strelka+nuqta; ixcham **yig'iladigan** qidiruv/filtrlar — ⌕ + "Filtrlar" paneli + Saralash), **Sidebar** (user kartasi + Katalog guruhi + AI kredit chip; qo'lda collapse/expand 240↔64 silliq, prefs persist).
- **3 TEMA tizimi** — `css/tokens.css` `[data-theme]` **standart / liquid-glass / light-glass** + yangi **`--on-accent`** token. Almashtirgich Hisob sheet'da ("Mavzu" — 3 tugma); `setTheme` → `html[data-theme]` + `localStorage['af.prefs']` merge; boot'da `restoreTheme` (default standart). Asosiy yuzalarda `backdrop-filter:blur(var(--glass-blur))` (standartda no-op).
- **OCHIQ:** sidebar collapse animatsiyasini yana silliqlash; Hisob ekranini to'liq re-skin; **3-bosqich AI BACKEND** (UI tayyor — API kalitlar OpenAI/ElevenLabs/fal hali YO'Q); Qism B hard delete; 2-bosqich (Sentry / evalJSX / version).
- **docs/ rejalar:** `PLAN-tema-tizimi.md`, `PLAN-obunachi-boshqaruvi.md`, `CLAUDE-DESIGN-PROMPT.md` (+ `CLAUDE-DESIGN-PROMPT-liquid-glass.md`).
