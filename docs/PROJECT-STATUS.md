> **STATUS:** ⚠️ QUYIDAGI §0-§9 ASOSAN 2026-06-21 HOLATI — INFRA/AI/BREND QISMLARI ESKIRGAN. Joriy haqiqat uchun avval **«§-3 · 2026-07-22 PLAGIN RELIZ ZANJIRI»**, **«§-2 · 2026-07-11 JONLI TEKSHIRUV»** va **«§-1 · 2026-07-03 YANGILANISH»** bloklarini o'qing (ular eski faktlarni bekor qiladi).

---

## §-3. 2026-07-22 PLAGIN RELIZ ZANJIRI — Task 2/3 masofada YASHIL

- Plagin installer/updater texnik zanjiri (Task 2 self-updater almashtirish + Task 3 `.pkg`/`.msi`
  quvuri) tugadi va masofada isbotlandi: `4293a6c` `origin/main`'da, CI run **29902381702**
  to'liq yashil, Windows job **88865831801** — qadalgan WiX, haqiqiy MSI build, `wix msi validate`,
  **"Per-user install → migration → uninstall proof"** — hammasi o'tdi (birinchi haqiqiy
  `msiexec` isboti). Lokal testlar: 135 · 244 · 47 · 118 · 108 · 10 (barchasi PASS).
- Jonli `GET api.getframeflow.app/api/plugin/version?platform=mac` →
  `installerStatus:"not_published"` — kontrakt ishlaydi, hali BIRORTA `PluginRelease` yo'q.
- **Shu reliz zanjiridagi yagona tashqi bloker (EGA ishi, kodda hal qilinmaydi):** Apple Developer ID Installer +
  notarizatsiya va Windows Authenticode imzolash kredensiallari yo'q.
- Tafsilot: `docs/SESSION-REPORT.md` · `docs/RELEASE-ARCHITECTURE.md` §3A.4 ·
  `docs/PLUGIN-UPDATE-CHAIN.md` · `docs/DIREKTOR-HANDOFF.md` §5.

---

## §-2. 2026-07-11 JONLI TEKSHIRUV (Direktor — prod'ga qarshi tasdiqlangan)

> Hujjat da'volariga ishonmasdan git + kod + jonli prod API tekshirildi. Bu blok §-1'dan yangi.

- **Deploy holati:** BATCH3 (13 fix) + BATCH4 (4 fix) + barcha 5 launch-faza — **push qilingan VA prod'da jonli** (git 0 ahead; `/health` db+storage ok; katalog javobida `kind`/`stockType` → `stock_kind_columns`/`plan_config_active` migratsiyalari qo'llangan).
- **Prod:** `api.getframeflow.app` (Cloud Run) · `getframeflow.app` (CF Pages) · landing CMS jonli (`/api/landing/config`).
- **Kodda tasdiqlangan:** `COST_QUOTE_SECRET` FATAL-check (API boot bo'lgani = o'rnatilgan) · Sentry real dep · `db-backup.yml` · legal HTML Lemon Squeezy · attestation server-enforce (`RIGHTS_REQUIRED` ×3) · `RevenueEvent` + refund/clawback/dunning · plagin bundle `com.frameflow`.
- **🔴 Asosiy amaliy bloker:** prod katalogda **faqat 1 published shablon** ("Football Championship Logo Reveal"); landing "5000+ templates" / Pro "10,000+" deydi — kontent to'ldirish yoki raqamlarni moslash SHART.
- **Tashqaridan tekshirib bo'lmagan (USER tasdig'i kerak):** prod env — `SENTRY_DSN`, `BACKUP_GCS_BUCKET`+versioning, `MODERATION_API_KEY`, `VIRUSTOTAL_API_KEY`, Lemon Squeezy LIVE · Admin → Pricing "Apply target margin" bosilgan-bosilmagani · AE plagin jonli E2E.
- Batafsil: `docs/LAUNCH-READINESS.md` (⭐ HOLAT) · `docs/SESSION-REPORT.md` · `docs/DIREKTOR-HANDOFF.md` §5.

# AssetFlow — Loyiha holati (yangi dasturchi uchun onboarding)

> **Maqsad:** bu hujjat yangi dasturchini loyiha bilan tanishtiradi. Mazmun **haqiqiy koddan** tekshirilgan (route'lar, Prisma schema, build skriptlari, env). Bu — loyiha joriy holati uchun **yagona kod-tasdiqlangan haqiqat manbai**; `docs/REJA-*` va `docs/STUDIO-GEN-*` reja/dizayn hujjatlari joriy holat EMAS. `HANDOFF.md` katta va ba'zi joylari eskirgan — ishonchli manba: kodning o'zi va shu hujjat.
>
> *Yangilangan: 2026-06-20 · Tekshirgan: kod tahlili (apps/api, packages/database, packages/assetflow-studio, plugins/after-effects-cep)*

---

## §-1. 2026-07-03 YANGILANISH — INFRA/AI/BREND KO'CHDI (eski §0-§9 ni bekor qiladi)

> Bu blok koddan tekshirilgan (`Dockerfile`, `deploy-cloudrun.sh`, `cloudrun-env.yaml`, `.github/workflows/`, `apps/api/src/lib/ai/*`, `functions/_middleware.js`). Pastdagi bo'limlar hali eski Render/R2/OpenRouter/AssetFlow deb yozadi — QUYIDAGI ustun.

### Nima o'zgardi (ESKI → HOZIR)

| Qism | ESKI (§0-§9) | HOZIR (kodda tasdiqlangan) |
|------|--------------|----------------------------|
| API hosting | Render (`assetflow-rqbq.onrender.com`) | **Google Cloud Run** — `europe-west1`, service `assetflow-api`, `https://api.getframeflow.app`. `min-instances 1` (cold-start yo'q). |
| Deploy | render.yaml auto | **GitHub Actions** `.github/workflows/deploy-cloudrun.yml` (WIF auth, kalitsiz). `main`'ga push → build (Docker) → **migrate-gate** (`migrate:deploy` yiqilsa deploy to'xtaydi) → deploy. Qo'lda: `deploy-cloudrun.sh`. |
| Storage | Cloudflare R2 | **GCS (S3-mos)** — bucket `assetflow-assets-2026`, `S3_ENDPOINT=https://storage.googleapis.com`, `AWS_*` = GCS HMAC. `s3.ts` `gcsKeyFromUrl/gcsUriFromUrl` bilan `gs://` chiqaradi (Vertex video input uchun). |
| DB | Neon PostgreSQL | Neon PostgreSQL — **o'zgarmagan** ✅ |
| Rasm AI | OpenRouter | **Vertex AI** (`vertex-image.ts`) — Imagen 4/Ultra + Nano Banana 2/Lite/Pro (5 model `enabled`). |
| Video AI | OpenRouter | **Vertex Omni Flash** (`vertex-omni.ts`, SINXRON) + **Veo** (`vertex.ts`, async) + **fal.ai** R2V (`fal.ts`, zaxira). |
| Ovoz/SFX | ElevenLabs | ElevenLabs — o'zgarmagan ✅ (SFX). Kokoro TTS OpenRouter'da (dormant). |
| Frontend | CF Pages `assetflow-20j.pages.dev` | **CF Pages `getframeflow.app`** + `admin.` / `studio.` subdomenlar (`functions/_middleware.js` host-router). Yangi **public platforma** (`platform/`, `ff-api.js`, `window.FFAPI`) — faqat USER roli. |
| To'lov | Stripe (yopiq) | Stripe kodi bor, lekin `STRIPE_*` kalitlari BO'SH → **to'lov amalda o'chiq**. (Reja: Paddle — `docs` / xotira.) |
| Brend | AssetFlow | **FrameFlow** (public UI/API/domen/email). Ichki JS klasslar hali `AssetFlow*`, `af_*` localStorage — texnik qarz. |

**Dormant (kodda bor, `enabled:false`):** OpenRouter (barcha modellar), fal.ai RASM modellari, Magnific. Vertex ustun.

### Yangi/qo'shilgan (2026-06-21 dan keyin)

- **Auth:** Google OAuth (web `login.html`), **Google device-code** (AE plagin — webview GIS yuklay olmaydi), **email-verify gate** (`consumeAiCredits` ichida, RESEND sozlangan → majburiy; eski userlar grandfather), **Turnstile** (register formalar). Rate-limiting (`middleware/rate-limit.ts`).
- **DB migratsiyalar (oxirgi):** `20260622_template_is_pro_tier` (per-shablon Free/Pro), `20260629_saved_references_ttl` (`SavedReference` TTL), `20260703_backfill_email_verified`, `20260703_plugin_device_code` (`PluginDeviceCode`). pgvector saqlanadi.
- **AI kredit oqimi (tekshirilgan, SOG'LOM):** imzolangan `cost-quote` (`gen-quote.ts`) → `consumeAiCredits` ATOMIK (`updateMany aiCredits>=cost`) → xato/timeout≠refund ajratilgan → `fail()` `updateMany count>0` bilan BIR MARTA refund (double-refund race yopiq) → ADMIN consume/refund'dan ozod (simmetriya). `gen.cost = price` (consume=refund summasi).
- **Env manbai:** `cloudrun-env.yaml` (git-ignored, hech qachon commit qilinmagan). Deploy'da GitHub secret `CLOUDRUN_ENV_YAML` dan yoziladi — YAML o'zgarsa `gh secret set CLOUDRUN_ENV_YAML` SHART.

### Hali ochiq / ehtiyot
- **Vertex Omni video** — kredit MANTIG'I sog'lom, lekin real GCP billing'da (~$1/video) end-to-end SINALMAGAN (`vertex-omni.ts` izohi). `>15MB` video referens uchun same-project GCS bucket yo'q (`OMNI_INLINE_VIDEO_MAX`).
- **`keepalive.yml`** — O'CHIRILDI (2026-07-03). Cloud Run `min-instances 1` bo'lgani uchun keraksiz edi.
- **`render.yaml`** — legacy, deploy qilinmaydi (referens uchun qolgan).
- **`cloudrun-env.yaml`** — jonli maxfiy kalitlar mahalliy diskda; commit qilinmasin, davriy rotatsiya tavsiya.
- **Faza 2 plagin AI tool'lar** (lip-sync/motion/slow-mo/video→SFX/restyle/draw) — UI tayyor, backend "Tez orada · fal.ai".

---

## 0. Audit + sessiya HANDOFF — YAKUNLANDI (2026-06-19/21)

> 2026-06-19 multi-agent audit (57 agent, 177 topilma → 34 tasdiqlangan). **Barcha 34 topilma hal qilindi, productionga deploy qilindi, `origin/main` bilan sinxron.** Bo'lim-bo'lim deploy, har biri read-only smoke-test (`/health` + `/api/plugin/catalog`); pul/auth/CSP/CI hech qachon buzilmagan. **Yangi (toza) sessiya shu §0 dan davom etadi.**

### A) Audit topilmalari — har band (✅ live · 🟡 qisman · ⏸️ ixtiyoriy)

**Pul / billing (5 ✅):** `#1` Free/Pro paywall server-tomon ATOMIK majburlash (`guardDownloadable`→`consumeDownload` baytlardan oldin; `/usage/*` analitika-only) · `#3` Stripe obuna tugasa→`PluginProfile.plan` FREE (`syncPluginPlanFromStripe` + reorder guard; `reconcile:plans`) · `#4` `/gen/describe`+`/enhance` kredit (1/2/3) + per-user kunlik cap + refund · `#12` `currentPeriodEnd` Stripe v18 `items.data[0]` + `apiVersion` pin + self-serve PRO fail-closed · `#16` webhook idempotency (`WebhookEvent` dedup).

**Xavfsizlik (3 ✅ + 1 🟡):** `#2` admin stored-XSS `esc()` (`admin-views.js`, `admin-subscribers.js`) + server cap · `#5` token revoke (`requireAuth` markaziy block check; `User.tokenVersion` JWT'da, reset/block'da increment + pluginToken o'chirish) · `#14` upload path-traversal `param('id')` cuid-guard + `UPLOADS_ROOT` containment · `#17` 🟡 JWT `sessionStorage` + global 401 interceptor + **CSP enforce** (HttpOnly cookie qoldi — E).

**Barqarorlik (4 ✅):** `#6` CDN cache-bust `?v=updatedAt` + Studio JS/CSS `immutable` olindi · `#11` semantik qidiruv → **pgvector HNSW** (`embeddingVec vector(1024)`, `$queryRaw <=>`, JSON-cosine fallback) · `#13` katalog/serve birxil + scene R2 PutObject muvaffaqdan keyin "saved" · `#15` inline ffmpeg → semaphore + fon transcode worker (`transcode-preview.ts`, `/preview-uploaded` signal, `previewTranscodeStatus` + UI badge).

**Infra / tozalash (5 ✅):** `#7` GitHub Actions CI + **migrate-gate** (`migrate:deploy` → `preDeployCommand`) · `#8` Premiere UXP o'chirildi · `#9` CF Pages build **manbadan self-regen** + drift artefaktlar untracked+gitignored · `#10` apps/web (Next.js) + packages/shared + o'lik Asset CRUD o'chirildi, lokal :3000 host → `dev-studio-server.mjs` (Asset/Download MODEL saqlandi — users.ts+seed) · `#18` docs.

### B) Deploy / infra holati
- **Render (API):** `render.yaml` — build (migratsiyasiz) → **`preDeployCommand: npm run migrate:deploy`** (gated: fail → deploy to'xtaydi, eski kod qoladi) → `start`. Migratsiyalar FAQAT additive. Env: `JWT_SECRET`, `DATABASE_URL` (Neon), R2 (`AWS_*`,`S3_ENDPOINT`,`CDN_BASE_URL`), `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `CF_ACCOUNT_ID`+`CF_AI_TOKEN`, `STRIPE_*`, `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false`.
- **CF Pages (Studio, assetflow-20j.pages.dev):** build `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs` — MANBADAN (`js/`,`styles/`,`*.html`) dist yasaydi, committed artefaktga BOG'LIQ EMAS. `_headers`: **CSP enforce** + cache; `_redirects`: /studio/*, /admin/* → manba.
- **Vercel (eski/zaxira):** `packages/assetflow-studio/vercel.json` → `prepare-vercel.mjs` (`studio:sync` ham shuni chaqiradi).
- **Lokal dev:** `npm run studio` → API :4000 + Contributor :3000 (`dev-studio-server.mjs`) + Admin :3001 (`dev-admin-server.mjs`), MANBANI to'g'ridan serv. **apps/web YO'Q.** PM2: `ecosystem.config.cjs` (assetflow-api/web/admin → dev:api/dev:studio-web/dev:studio-admin).
- **Push intizomi:** bosqichma-bosqich — backend+migratsiya alohida, studio/CF alohida (incident zonasi). Har deploy A smoke-test; studio o'zgarsa brauzer + konsol (CSP) tekshiruvi.

### C) Commit tarixi (audit, eng yangidan — hammasi origin/main'da)
```
ae28520 chore: docs + render-build cleanup (post-audit)
4e81018 chore: remove dead apps/web + packages/shared, lightweight local studio host (#10)
79ec2de chore(studio): untrack build artifacts now that CF build self-regenerates (#9)
2ff6ab4 chore(db): embeddingVec backfill script (manual, JSON->vector) (#11)
ff788e8 feat(studio): preview transcode status badge in contributor list (#15)
47297db chore(api): remove dead Asset CRUD admin handlers (#10 verified-dead; model kept)
32fa64d feat(studio): trigger preview transcode after upload (#15 frontend)
0550781 build(studio): CF Pages build regenerates artifacts from source (#9)
ca70156 chore: remove abandoned Premiere UXP plugin + dead /api/assets route (#8,#10)
f7bf5a0 feat(transcode): background preview transcode worker + status column (#15 backend)
998aab4 perf(search): pgvector HNSW semantic search with JSON-cosine fallback (#11)
0719fa6 security(studio): enforce Content-Security-Policy (#17 done)
d2e6ca9 security(studio): allow Google Fonts in CSP report-only (#17)
77ba0b6 security(studio): add Content-Security-Policy headers (#17 v3)
46c2a5d ci: gate migrations via preDeployCommand (separate from build) (#7)
a135b70 docs: project status + AI system + plan banners (re-apply #18)
57c4479 fix(studio): restore tracked CF Pages build artifacts (revert bad untrack) [INCIDENT FIX]
107c5da chore: untrack generated Studio artifact trees [INCIDENT SABABI — keyin revert]
7beecaf fix(stability): CDN cache-bust + unify catalog/serve + atomic month-reset + ffmpeg semaphore (#6,#11,#13,#15)
bf05195 fix(security): escape admin XSS + token revoke (tokenVersion) + cuid path-guard + JWT sessionStorage (#2,#5,#14,#17)
74b7a95 ci: add build/lint GitHub Actions workflow (#7)
5ba8c04 fix(billing): idempotent Stripe webhook via WebhookEvent dedup (#16)
e691f81 fix(billing): currentPeriodEnd from sub item + fail-closed self-serve PRO (#12)
a450104 fix(ai): charge credits + per-user daily cap on /gen describe & enhance (#4)
4871009 fix(billing): downgrade plan to FREE when Stripe subscription lapses (#3)
303ed60 fix(paywall): enforce Free/Pro download+import limits server-side (atomic) (#1)
```

### D) Operatsion bilim (yangi sessiya bilishi shart)
- **pgvector:** prodda FAOL; **5 APPROVED+published shablon embed** (6-si qoralama — published emas, search'da ko'rinmaydi). Migration `20260620150000_template_embedding_pgvector` qo'llangan (CREATE EXTENSION vector + embeddingVec + HNSW).
- **Reindex:** `POST /api/plugin/ai/reindex` — **ADMIN-only**, **kreditsiz**, Workers AI re-embed + dual-write (embedding+embeddingVec). Admin token: `POST /api/auth/login {admin@assetflow.uz/admin123}` → JWT (`Authorization: Bearer`).
- **backfill:embedvec:** `npm run backfill:embedvec` — mavjud JSON embedding → embeddingVec (re-embed YO'Q). Hozir **0 nomzod** (reindex hammasini to'ldirdi). `DRY_RUN=1` avval. Prod `DATABASE_URL` kerak → Render Shell.
- **Workers AI:** `configured: true` (CF_ACCOUNT_ID + CF_AI_TOKEN). `POST /api/plugin/ai/estimate {type:"search"}` → `{configured}`.
- **/search:** `POST /api/plugin/ai/search {query}` — **ACTIVE plugin USER** (`user@assetflow.uz/user123`, 1 kredit). ADMIN'da **402 `ACCOUNT_INACTIVE`** (admin plugin-obunachi emas — BUG EMAS). bge-m3 1024-dim. Tasdiqlangan: "grunge..." → grunge shablon 0.68. Render log'da `[ai:search] ... fallback` CHIQMASA = pgvector ishladi.
- **with_vec tekshiruv (Render Shell):** `node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$queryRawUnsafe(`SELECT count(*) FILTER (WHERE "embedding" IS NOT NULL) AS with_json, count(*) FILTER (WHERE "embeddingVec" IS NOT NULL) AS with_vec FROM "ContributorTemplate"`).then(r=>{console.log(JSON.stringify(r,(k,v)=>typeof v==="bigint"?Number(v):v));return p.$disconnect();})'`

### E) Qolgan ish (ixtiyoriy, kod-band EMAS)
- **#11 prod backfill** — hozir 0 nomzod (reindex bajardi); kelajakda eski/import qatorlar paydo bo'lsa `backfill:embedvec`.
- **#17 HttpOnly cookie** — faqat custom domen (`*.assetflow.uz`) bilan ishonchli (API `onrender.com` ≠ Studio `pages.dev` → 3rd-party cookie Safari ITP'da bloklanadi). CSP enforce hozircha yetarli. Infra (DNS) qarori.
- **`packages/assetflow-studio/README.md:13`** — eski `dev:web` eslatmasi (kichik; "studio package'ga tegma" cheklovi tufayli qoldirilgan → `dev:studio-web` ga yangilash mumkin).
- **`requireActiveSubscription`** (`apps/api/src/middleware/auth.ts`) — yetim export (0 call-site, auth-sensitive → qoldirilgan).
- **`render-build.sh`** o'chirilgan (havolasiz edi). Untracked research docs: `docs/AI-API-RESEARCH-2026.md`, `AI-MODELS-PRICING-2026.md`, `FIX-ROADMAP.md`, `MAGNIFIC-API-ANALYSIS.md` (commit qilinmagan).

### F) MUHIM SABOQLAR (incident oldini olish)
1. **Studio artefakt/build oqimiga tegadigan o'zgarish → ALOHIDA commit + ehtiyot deploy + brauzer/konsol test.** Bir marta CF Studio buzilgan: artefakt `git rm --cached` → CF stilsiz sahifa (`prepare-cf-pages` faqat nusxalardi) → revert `57c4479` → keyin self-regen `0550781` + xavfsiz untrack `79ec2de`.
2. **Migratsiyalar FAQAT additive** (CREATE/ADD COLUMN/EXTENSION/INDEX; DROP yo'q); preDeploy gate himoyalaydi (fail → eski kod qoladi). Migratsiyani lokal/prod DB'ga qo'lda DEPLOY QILMA — push'da Render o'zi qiladi.
3. **Pul/auth/CSP kodiga ehtiyot:** `consume*`, `guardDownloadable`, `syncPluginPlanFromStripe`, `WebhookEvent` dedup, `tokenVersion`, CSP `_headers` — har o'zgarishda saqlab qol; har deploy A smoke-test bilan tasdiqla.

---

## 1. Loyiha nima

**AssetFlow** — ikki katta qismdan iborat:

1. **AE shablon marketplace** — After Effects shablonlari uchun zanjir:
   `Contributor yuklaydi → Admin moderatsiya qiladi → AE plugin katalogida chiqadi → Obunachi import qiladi.`
2. **AI generatsiya studiyasi (Studio Gen)** — rasm / ovoz / video / SFX generatsiyasi (kredit asosida, OpenRouter + ElevenLabs + Cloudflare Workers AI orqali).

### Foydalanuvchi rollari (`UserRole` enum)

| Rol | Nima qiladi | Qayerda ishlaydi |
|-----|-------------|------------------|
| **CONTRIBUTOR** | Shablon yuklaydi (thumb, preview, pack), tekshiruvga yuboradi, admin bilan yozishadi | Contributor Studio (web) |
| **ADMIN** | Shablonlarni tasdiqlaydi/rad etadi, publish qiladi, obunachilarni boshqaradi, AI kredit beradi, audit/log ko'radi | Admin Console (web) + AE Admin panel |
| **USER** (obunachi) | AE plugin orqali katalogni ko'radi, import qiladi (Free/Pro limit), AI Tools'dan foydalanadi | AE CEP plugin |

---

## 2. Arxitektura va texnologiya

### Monorepo (npm workspaces, Node ≥ 20)

```
apps/
  api/                     → Express 5 + TypeScript API (asosiy backend)
packages/
  database/                → Prisma 6 schema + migratsiyalar + seed (PostgreSQL)
  assetflow-studio/        → Admin + Contributor static UI (HTML/CSS/JS, build tool YO'Q) + lokal dev serverlar (:3000/:3001)
plugins/
  after-effects-cep/       → AE CEP plugin (Browse panel + Admin panel)
scripts/                   → pm2, verify-pipeline, check-stack, seed tozalash
# apps/web (Next.js) va packages/shared o'chirildi (#10); premiere-uxp o'chirildi (#8).
```

### Texnologiya stack (haqiqiy versiyalar)

| Qism | Texnologiya | Versiya |
|------|-------------|---------|
| API | Express | 5.1.0 |
| API | TypeScript (tsx dev, tsc build) | 5.8.3 |
| Auth | jsonwebtoken / bcryptjs | 9.0.2 / 3.0.2 |
| Storage SDK | @aws-sdk/client-s3 (+ lib-storage, presigner) | 3.812.0 |
| Validatsiya | zod | 3.25.28 |
| Upload | multer | 2.0.1 |
| To'lov | stripe | 18.1.0 |
| DB ORM | Prisma | 6.8.2 |
| DB | PostgreSQL (prod: Neon.tech) | — |
| Studio UI | toza HTML/CSS/JS (build tool yo'q) | — |
| Process manager (lokal) | pm2 | 6.x |

### Har bo'lim nima qiladi

- **apps/api** — REST API. Auth, katalog, contributor CRUD/upload, admin moderatsiya, xabarlar, audit, AI Tools (`/plugin/ai`), Studio Gen (`/studio/gen`), Stripe. Kirish nuqtasi: `apps/api/src/index.ts`. Route'lar `apps/api/src/routes/*.ts` (11 ta fayl), kutubxonalar `apps/api/src/lib/*`.
- **packages/database** — Prisma schema (`prisma/schema.prisma`), 12 ta migratsiya, ikkita seed (`seed.ts`, `seed-assetflow.ts`).
- **packages/assetflow-studio** — Admin va Contributor brauzer UI. **Build tool yo'q** — toza static. `js/` va `styles/` (root) = MANBA; `studio/`, `admin/js`, `dist/` = artefakt (pastga qarang).
- **Lokal dev (Studio)** — `packages/assetflow-studio/scripts/dev-studio-server.mjs` (:3000, Contributor) + `dev-admin-server.mjs` (:3001, Admin) Studio MANBASINI to'g'ridan serv qiladi (+ `/api` proxy). Eski apps/web Next.js o'chirildi (#10).
- **plugins/after-effects-cep** — AE ichidagi CEP panel: Browse (`AssetFlow_Plugin.html`) + Admin (`AssetFlow_Admin.html`), ExtendScript `jsx/host.jsx`.

### Deploy topologiyasi

> ⚠️ ESKIRGAN — joriy topologiya (Cloud Run + GCS + `getframeflow.app`) uchun **§-1** ga qarang. Quyidagi jadval 2026-06-21 holati.

| Xizmat | Platforma | URL |
|--------|-----------|-----|
| API | Render | https://assetflow-rqbq.onrender.com |
| Studio (Admin+Contributor) | Cloudflare Pages | https://assetflow-20j.pages.dev |
| (eski) Studio | Vercel | render.yaml CORS'da hali ro'yxatda (`assetflow-studio-one.vercel.app`) — orqaga moslik uchun |
| Storage | Cloudflare R2 (S3-mos) | `S3_ENDPOINT` + `CDN_BASE_URL` |
| DB | Neon.tech PostgreSQL | `DATABASE_URL` |
| Git remote | GitHub | `github.com/uxudoybergan6-png/assetflow` |

> ✅ **CORS/ADMIN_URL tuzatildi (2026-06-18):** `render.yaml` da `CORS_ORIGIN` endi `https://assetflow-20j.pages.dev,https://assetflow-studio-one.vercel.app` (CF Pages birinchi, eski Vercel orqaga moslik uchun), `ADMIN_URL` = `https://assetflow-20j.pages.dev/admin/`. ⚠️ **Lekin:** Render dashboard'da bu env'lar qo'lda o'rnatilgan bo'lsa, ular yaml'dan ustun turadi — dashboard → Environment'da ham yangilang yoki "Sync" qiling.

---

## 3. NIMA ISHLAYDI (kod bilan tasdiqlangan)

### 3.1 Autentifikatsiya — JWT + Plugin Token
**Fayl:** `apps/api/src/middleware/auth.ts`
- **JWT** (Studio): `signToken()` 7 kun, `JWT_SECRET` bilan imzolanadi. Header `Authorization: Bearer <jwt>`. Payload `{ userId, email, role }`.
- **Plugin Token** (AE): `ensurePluginToken()` — `crypto.randomBytes(32)` (64 belgi), 30 kun TTL, `PluginToken` jadvalida saqlanadi. Status `BLOCKED`/`REMOVED` bo'lsa bekor qilinadi.
- Middleware: `requireAuth` (avval plugin token, keyin JWT), `requireAdmin`, `requireActiveSubscription`, `requireContributorOrAdmin`.

### 3.2 Katalog (plugin)
**Fayl:** `apps/api/src/routes/plugin.ts` + `apps/api/src/lib/catalog-map.ts`
- `GET /api/plugin/catalog` — faqat `APPROVED` + `published:true` shablonlar (paginatsiya).
- `GET /api/plugin/featured` — so'nggi tasdiqlanganlar.
- `templateAssetFlags()` `hasPack`/`hasPreview` ni **disk + R2** ikkalasidan tekshiradi (Render ephemeral disk muammosi shu yerda hal qilingan).

### 3.3 Contributor upload → moderatsiya → approve
**Fayl:** `apps/api/src/routes/contributor.ts`
- `POST /templates` (yaratish) → `POST /templates/:id/upload-url` (thumb/preview uchun **presigned PUT** to'g'ridan R2 ga, OOM oldini oladi) → `POST /templates/:id/assets` (pack multer orqali, server `.mogrt` sahnalarni ajratadi) → `POST /templates/:id/submit` (tekshiruvga).
- `POST /templates/:id/review` (admin) — approve/reject + izoh + ixtiyoriy publish.
- `GET /templates/:id/upload-progress` — SSE orqali upload bosqichi/foiz.
- **Preview optimizatsiya:** yangi upload'da preview `optimizePreviewForStreaming()` bilan 720p H.264 ga siqiladi (250MB·4K → ~3-8MB). **Eski previewlar** (tuzatishdan oldingilar) hali katta — backfill: `POST /admin/templates/:id/re-transcode-preview` (admin) yoki bulk `npm run retranscode:previews` (admin token bilan, ketma-ket; `scripts/retranscode-previews.mjs`).
- Status oqimi: `DRAFT → PENDING_REVIEW → APPROVED | REJECTED` (`TemplateReviewStatus` enum).

### 3.4 Plugin browse + import (AE CEP)
**Fayllar:** `plugins/after-effects-cep/assetflow-catalog.js`, `jsx/host.jsx`
- Login (`POST /api/plugin/login`) → token + `apiBaseUrl` + `adminUrl` qaytadi, prefs'ga yoziladi.
- Katalog tortiladi, pack yuklab olinadi (`/api/plugin/assets/:id/pack`).
- **Scene-aware import** (`host.jsx`): `importSingleSceneFromAep()` — proyekt sifatida import qiladi, `collectCompDependencies()` bilan kerakli comp/footage zanjirini yig'adi, `pruneToScene` rejimida faqat tanlangan comp + bog'liqliklarni qoldiradi. Hamma amallar `beginUndoGroup`/`endUndoGroup` ichida.

### 3.5 Free / Pro + limitlar
**Fayllar:** `apps/api/src/routes/plugin.ts`, schema `PluginProfile`
- `PluginProfile.plan` = `FREE | PRO` (`PluginPlanTier`).
- `POST /usage/download` va `POST /usage/import` — hisoblagichni oshiradi, limit oshsa 403.
- `downloadLimitOverride` / `importLimitOverride` — admin har bir obunachi uchun cheklovni alohida belgilashi mumkin.

### 3.6 Obunachi boshqaruvi (admin)
**Fayllar:** `apps/api/src/routes/admin.ts`, `packages/assetflow-studio/js/admin-subscribers.js`
- `GET /api/admin/plugin-subscribers` — faol AE foydalanuvchilar.
- `GET /api/admin/plugin-analytics` — yuklab olishlar, kunlik faollik grafigi.
- `PATCH /api/admin/plugin-subscribers/:userId` — plan/status/limit/**AI kredit** o'zgartirish.

### 3.7 Xabarlar + Audit
- `apps/api/src/routes/messages.ts` — threadlar, reply, **broadcast** (barcha contributor'larga).
- `apps/api/src/routes/audit.ts` — `GET /api/studio/audit` (admin), barcha amallar `StudioAuditLog` ga yoziladi.

### 3.8 Dizayn / temalar — DIQQAT: Studio va Plugin TURLICHA
Ikki kod bazasida ikki xil tema tizimi bor — aralashtirmang:

**STUDIO (web) — 2 tema.** Fayllar: `packages/assetflow-studio/styles/app.css`, `js/theme.js`.
- `dark` (default) ↔ `light`. CSS'da faqat `[data-theme="light"]` override, `theme.js` faqat dark↔light toggle.
- `localStorage` kaliti: `af-theme`, system preference (`prefers-color-scheme`) fallback bilan.

**PLUGIN (AE CEP) — 3 tema.** Fayllar: `plugins/after-effects-cep/css/tokens.css`, `AssetFlow_Plugin.html`.
- `tokens.css` da `[data-theme]` bo'yicha **3 ta**: `standart` (= `:root` default), `liquid-glass`, `light-glass`.
- Tanlash UI: Sozlamalardagi `.theme-pick` (Standart / Liquid Glass / Light Glass tugmalari) → `setTheme()` `html[data-theme]` ni o'zgartiradi (`AF_THEMES=['standart','liquid-glass','light-glass']`).
- ⚠️ Bu Studio'ning 2 temasidan MUSTAQIL — plugin temasini o'zgartirish Studio'ga, va aksincha, ta'sir qilmaydi.

### 3.9 Bandwidth — R2 CDN direct
- Yuklab olish/preview to'g'ridan R2/CDN (`CDN_BASE_URL`) yoki signed URL orqali (`apps/api/src/lib/s3.ts`), server orqali oqim emas → Render bandwidth tejaladi. Thumb/preview upload ham presigned PUT bilan to'g'ridan R2 ga (server xotirasini chetlab o'tadi).

### 3.10 AI Tools — eski `/plugin/ai` (Cloudflare Workers AI)
**Fayllar:** `apps/api/src/routes/ai.ts`, `apps/api/src/lib/ai/workers-ai.ts`
- `POST /api/plugin/ai/image` — text→image (Flux schnell), 5 kredit.
- `POST /api/plugin/ai/voiceover` — text→speech (MeloTTS), 3 kredit.
- `POST /api/plugin/ai/search` — **semantik qidiruv** (bge-m3 embedding, `aiEmbed` Workers AI'da — `routes/ai.ts:212`), 1 kredit.
- `POST /api/plugin/ai/reindex` (admin) — APPROVED+published shablonlarga embedding backfill.
- Env: `CF_ACCOUNT_ID`, `CF_AI_TOKEN`, `AI_MODEL_IMAGE/EMBED/TEXT/TTS`. Kalit yo'q bo'lsa → `503 AI_NOT_CONFIGURED`.

### 3.11 Studio Gen arxitekturasi (session / quote / job)
**Fayllar:** `apps/api/src/routes/studio-gen.ts`, `lib/gen-processor.ts`, `lib/gen-quote.ts`, `lib/gen-models.ts`, `lib/ai/openrouter.ts`
- **Oqim:** `POST /gen/sessions` (sessiya) → `POST /gen/cost-quote` (imzolangan narx, JWT 15 daqiqa) → `POST /gen` (quote tekshiriladi, kredit atomik bloklanadi, job `queued`) → fonda `processGeneration()` → natija R2 ga → `GET /gen/:jobId` (poll).
- **Imzolangan cost-quote:** `signCostQuote()` — `{modelId, mode, price, paramsHash}` JWT bilan imzolanadi; serverda generatsiyadan oldin signature + qiymatlar mosligi tekshiriladi (narxni klient o'zgartira olmaydi).
- Modellar `gen-models.ts` da raqamli ID bilan (1001 image, 2001 voice, 3001+ video, 4001 SFX). OpenRouter ulanishi haqiqiy: `openrouter.ts` → `BASE = https://openrouter.ai/api/v1`, `OPENROUTER_API_KEY`.
- Schema modellari: `GenSession`, `Generation`, `GenAsset`. Muvaffaqiyatsizlikda kredit qaytariladi (`refundAiCredits`).
- DB jadvallari, route'lar, kredit hisobi, R2 saqlash — **kod sifatida tayyor**. Lekin: 4-bo'limdagi ogohlantirishni o'qing.

---

## 4. NIMA QISMAN / TEST QILINMAGAN (halol)

### 4.1 OpenRouter generatsiya — model ID'lar TASDIQLANDI, end-to-end test hali yo'q ⚠️
- Kod to'liq yozilgan (`openrouter.ts`, `gen-processor.ts`). Haqiqiy ishlash uchun Render'da `OPENROUTER_API_KEY` o'rnatilgan va balansli bo'lishi kerak.
- ✅ **Model ID'lar 2026-06-18'da tasdiqlandi.** `gen-models.ts` dagi har bir OpenRouter `key` per-model `/api/v1/models/<key>/endpoints` (status=0) orqali jonli ekanligi tekshirildi — barchasi mavjud. DIQQAT: `/api/v1/models` ro'yxati TO'LIQ EMAS (rasm-gen/TTS/embedding ko'rsatmaydi), shuning uchun avtoritativ tekshiruv — per-model `/endpoints` (izoh `gen-models.ts` boshida).
- **Qolgan qadam:** har mode (image/voice/video/sfx) bo'yicha bitta real `/gen` chaqiruvi — kredit hisobi + R2 saqlashni end-to-end tasdiqlash (hali sinalmagan).

### 4.2 Generatsiya tarixi grid (vazifa "1e-3") — QILINMAGAN
- Backend `GET /api/studio/gen/history` va `GET /gen/sessions/:id/generations` mavjud, lekin Studio'da bu tarixni ko'rsatadigan **frontend grid** yo'q. Studio static UI'da umuman Studio Gen sahifasi topilmadi (AI gen UI faqat backend + AE plugin tomonda).

### 4.3 IKKI AI TIZIM — `/plugin/ai` vs `/studio/gen` (aralashtirmang)
Loyihada **ikkita butunlay alohida AI tizim** bor. Ikkalasi har xil route prefiksi, har xil provayder, har xil kalit ishlatadi:

| Tizim | Route prefiks | Provayder | Nima qiladi | Kalit |
|-------|---------------|-----------|-------------|-------|
| **AI Tools (eski)** | `/api/plugin/ai/*` | Cloudflare **Workers AI** | **Semantik qidiruv** (embedding), eski image/voiceover | `CF_ACCOUNT_ID` + `CF_AI_TOKEN` |
| **Studio Gen (yangi)** | `/api/studio/gen/*` | **OpenRouter** (+ **ElevenLabs** faqat SFX) | rasm / video / ovoz generatsiya | `OPENROUTER_API_KEY` (+ `ELEVENLABS_API_KEY`) |

- **Qidiruv embeddinglari = Workers AI** (`bge-m3`, `routes/ai.ts:212` `aiEmbed`). OpenRouter embedding (`qwen/qwen3-embedding-4b`, `gen-models.ts` `EMBED_MODEL`) faqat Studio Gen tomonida ichki ishlatiladi — qidiruv uni ishlatmaydi.
- **Plugin (AE CEP) hozir `/plugin/ai` (Workers AI) ni ishlatadi** — Browse qidiruvi va eski AI Tools shu yerda. `/studio/gen` (OpenRouter) plugin AI Tools'iga hali **to'liq ulanmagan** (4.1 va F-vazifa: tarix grid).
- **SFX = ElevenLabs** (`elevenlabs/sound-effects`) — OpenRouter SFX'ni qoplamaydi, shuning uchun alohida.
- Uchta provayder, uchta alohida kalit. Birini ikkinchisiga almashtirib bo'lmaydi.

### 4.4 Stripe / to'lov — to'liq emas
- Stripe kodi bor (`routes/stripe.ts`, `auth.ts` checkout/portal), lekin to'liq real checkout oqimi sinaб ko'rilmagan.
- **Bypass yopilgan:** `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=false` (render.yaml). Ya'ni Pro'ni Stripe'siz olish o'chirilgan — bu to'g'ri (xavfsiz), lekin haqiqiy to'lov hali to'liq emas.

### 4.5 Boshqa yarim/ochiq ishlar
- **AI gen frontend (Studio):** Static studio'da rasm/ovoz/video generatsiya UI yo'q — faqat admin AI-kredit boshqaruvi bor.
- **premiere-uxp:** minimal stub — login + obuna tekshirish + browse/download (tashqi brauzerda), comp import yo'q.
- **Email** (`RESEND_API_KEY`) — parol tiklash uchun kod bor, lekin kalit o'rnatilmaган bo'lsa ishlamaydi.
- **AE Admin CEP panel** — brauzer Admin'dan kamroq ishonchli (`Failed to fetch` muammolari, pastga qarang).

---

## 5. DEPLOY va ENV

### Production URL'lar
> ⚠️ ESKIRGAN — joriy: API `https://api.getframeflow.app` (Cloud Run), Frontend `https://getframeflow.app` (+ `admin.`/`studio.`). Batafsil **§-1**. Quyi qatorlar 2026-06-21 holati (eski Render/Pages hali CORS'da orqaga-moslik uchun).
- API: `https://assetflow-rqbq.onrender.com` (Render, auto-deploy `render.yaml` dan)
- Studio: `https://assetflow-20j.pages.dev` (Cloudflare Pages)

### Render build (render.yaml)
```
buildCommand: npm install --include=dev
  && npm run generate -w @creative-tools/database
  && npm run migrate:deploy -w @creative-tools/database   # ← migratsiyalar build'da deploy bo'ladi
  && npm run build -w @creative-tools/database
  && npm run build -w apps/api
startCommand: node apps/api/dist/index.js
healthCheckPath: /health
```

### CF Pages build
- **Build command:** `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs`
- **Output dir:** `packages/assetflow-studio/dist`

### Kerakli env'lar (va nima uchun)

| Env | Nima uchun | Eslatma |
|-----|-----------|---------|
| `DATABASE_URL` | PostgreSQL (Neon) ulanishi | Render'da `sync:false` |
| `JWT_SECRET` | JWT + cost-quote + plugin imzo | Render `generateValue:true`; lokalda default xavfli |
| `API_PORT` / `PORT` | Server porti | Render 10000 |
| `API_PUBLIC_URL` | OpenRouter Referer + URL fallback | `assetflow-rqbq.onrender.com` |
| `CORS_ORIGIN` | Ruxsatli frontend domen(lar), vergul bilan | CF Pages + eski Vercel (2026-06-18); birinchi qiymat `getWebUrl()` uchun |
| `ADMIN_URL` | Admin panel URL | render.yaml |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 kalitlari | `sync:false` |
| `AWS_S3_BUCKET` | R2 bucket nomi | — |
| `AWS_REGION` | `auto` (R2) | — |
| `S3_ENDPOINT` | `https://<acct>.r2.cloudflarestorage.com` | `sync:false` |
| `CDN_BASE_URL` | R2 public URL (`pub-xxx.r2.dev`) — bandwidth direct | `sync:false` |
| `OPENROUTER_API_KEY` | Studio Gen (rasm/video/ovoz/embed) | yo'q bo'lsa `/studio/gen` → 503 |
| `CF_ACCOUNT_ID` / `CF_AI_TOKEN` | Workers AI (eski `/plugin/ai`, qidiruv) | yo'q bo'lsa → 503 |
| `AI_MODEL_IMAGE/EMBED/TEXT/TTS` | Workers AI model nomlari | namunalar `.env.example` da |
| `ELEVENLABS_API_KEY` | SFX + ixtiyoriy ovoz | — |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | To'lov | to'liq emas |
| `PLUGIN_ALLOW_PRO_WITHOUT_STRIPE` | Stripe'siz Pro bypass | **`false`** (yopiq — to'g'ri) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Parol tiklash email | ixtiyoriy |

### Auto-deploy holati
- **API (Render):** `render.yaml` mavjud — git push'da avtomatik build + migrate:deploy. ⚠️ Push qilinmagan API o'zgarishlari productionда yo'q bo'lishi mumkin (avval `npm run build -w apps/api`).
- **Studio (CF Pages):** git push'da `prepare-cf-pages.mjs` ishlaydi.

---

## 6. LOKAL ISHGA TUSHIRISH

```bash
# 1. O'rnatish
npm install

# 2. Muhit
cp .env.example .env          # DATABASE_URL, JWT_SECRET, R2, AI kalitlarni to'ldiring
#   AI kalitlarsiz ham ishlaydi — AI route'lar 503 qaytaradi, qolgani normal.

# 3. Ma'lumotlar bazasi (PostgreSQL ishlab turishi kerak)
npm run db:generate           # Prisma client
npm run db:push               # schema'ni DB ga (yoki migrate:deploy)
npm run db:seed               # asosiy admin + namuna asset
npm run db:seed:assetflow     # AssetFlow demo (3 hisob + demo shablon)

# 4. Ishga tushirish (pm2: api + web + admin)
npm run pm2:start             # yoki: npm run dev:api / dev:studio-web / dev:studio-admin
npm run pm2:status
npm run check:stack           # stack holatini tekshirish

# 5. Pipeline tekshirish
npm run verify:pipeline
API_URL=https://assetflow-rqbq.onrender.com node scripts/verify-pipeline.mjs   # production'ga qarshi
```

### Portlar (pm2 / ecosystem.config.cjs)
- API: `4000` (lokal), Contributor Studio: `3000` (dev-studio-server), Admin Studio: `3001` (dev-admin-server).

### Seed hisoblar (seed-assetflow.ts)
| Rol | Email | Parol |
|-----|-------|-------|
| Admin | `admin@assetflow.uz` | `admin123` |
| Contributor | `dilnoza.k@gmail.com` | `contrib123` |
| Obunachi | `user@assetflow.uz` | `user123` |

> `seed.ts` alohida admin yaratadi: `admin@creativetools.local` / `admin12345`.

### Plugin (AE CEP)
```bash
bash plugins/after-effects-cep/scripts/install-cep.sh
# CEP debug rejimini yoqadi, fayllarni ~/Library/.../com.assetflow.demo/ ga ko'chiradi,
# build sanasi + git SHA ni HTML'ga yozadi, AE'ni qayta ishga tushiradi va panelni ochadi.
```

### Studio (static — manbadan build)
```bash
npm run studio:sync           # prepare-vercel: js/ + styles/ (root) → studio/, admin/ artefakt (Vercel)
# CF Pages: prepare-cf-pages.mjs (manbadan self-regen); lokal: dev-studio-server / dev-admin-server (manbani to'g'ridan serv)
```

---

## 7. MUHIM SABOQLAR / TUZOQLAR (yangi dev bilishi shart)

1. **CEP panel HTML hot-reload QILMAYDI.** O'zgartirishdan keyin: `install-cep.sh` qayta ishlat → AE `Cmd+Q` → qayta och. Panel build yorlig'i (sana + git SHA) HTML pastida ko'rinadi — eski yorliq = eski kod.
2. **`host.jsx` ExtendScript engine eski versiya.** Atomik `evalScript` ishlat yoki AE'ni qayta ishga tushir; murakkab JSX o'zgartirishlaridan keyin AE restart kerak bo'lishi mumkin.
3. **Studio manba `js/` va `styles/` (root)** — faqat shu yerga edit qil. `studio/js`, `studio/styles`, `admin/js`, `admin/styles`, `dist/` — **artefakt**; `prepare-vercel.mjs` / `prepare-cf-pages.mjs` / `studio:sync` ularni qayta yozadi. Artefaktga yozilgan o'zgarish yo'qoladi. Edit → `npm run studio:sync`.
4. **Render auto-deploy + `migrate:deploy` build'da.** Yangi migratsiya qo'shsang, push'da avtomatik deploy bo'ladi — lekin migratsiya xato bo'lsa butun build yiqiladi.
5. **Imzolangan cost-quote** — Studio Gen narxini klientga ishonma. Narx serverda `gen-quote.ts` da qayta tekshiriladi. Yangi model qo'shsang, narx hisobini (`computeGenCost`) ham yangila.
6. **Commit message'ga `Co-Authored-By` YOZMA** — Vercel/CF deploy'ni bloklaydi (xotira: `no-coauthored-by-commits`).
7. **AI provayderlarni aralashtirma:** qidiruv = Workers AI, Studio Gen = OpenRouter, SFX = ElevenLabs.

---

## 8. MA'LUM MUAMMOLAR / RISKLAR

1. **`hasPack:false`** — pack yo'q shablon katalogda **ko'rinadi, lekin import bloklanadi** (plugin import tugmasini o'chiradi). Sabab: Render bepul instance disk **ephemeral** (qayta deploy/uxlashda yo'qoladi), shuning uchun pack/preview faqat **R2** da turishi shart. `catalog-map.ts` → `templateAssetFlags()` `hasPack`/`hasPreview` ni **disk VA R2** ikkalasidan tekshiradi — R2 da bo'lsa `true`. Agar productionда `hasPack:false` ko'rinsa: pack R2 ga yuklanmagan yoki kalit (`__srv_<id>`) mos emas.
2. **Render cold-start** — ESKIRGAN: API Cloud Run'ga ko'chirildi (`min-instances 1`, cold-start yo'q). `.github/workflows/keepalive.yml` shu sababli 2026-07-03 da o'chirildi (endi keraksiz edi). Quyidagi izoh tarixiy referens sifatida qoldirilgan (Render'da bepul instance 15 daqiqa harakatsizlikdan keyin uxlardi; birinchi so'rov ~30-60s sekin edi; Upload XHR retry shu sababli qo'shilgan edi).
3. **OpenRouter end-to-end test yo'q** — model ID'lar tasdiqlandi (4.1), lekin real `/gen` chaqiruvi hali sinab ko'rilmagan.
4. **CORS_ORIGIN** — render.yaml tuzatildi (CF Pages + eski Vercel, 2026-06-18). Render dashboard'dagi qo'lda env yaml'dan ustun turishi mumkin — sinab ko'ring (2-bo'lim).
5. **AE Admin CEP `Failed to fetch`** — odatda eski extension yoki `localhost` API. Brauzer Admin ishonchliroq.
6. **Lokal `JWT_SECRET` default** — `change-me-in-production` xavfli; productionда Render `generateValue` ishlatadi.
7. **OOM riski + mitigatsiya** — Render instance kichik (512MB). RAM spike manbalari: katta thumb/preview/pack upload va generatsiya. **Mitigatsiya (mavjud):** (a) thumb/preview **presigned PUT** orqali to'g'ridan R2 ga — bayt API server xotirasidan o'tmaydi (`contributor.ts` upload-url); (b) yuklab olish/preview to'g'ridan R2/CDN (`s3.ts`), server orqali oqim emas; (c) upload concurrency cheklovi + XHR retry (5xx/uzilish → 2x). Pack (multer) hali server orqali o'tadi — katta `.aep/.zip` da ehtiyot bo'ling.

---

## 9. KEYINGI USTUVOR VAZIFALAR (yo'l xaritasi)

1. **OpenRouter end-to-end test** — model ID'lar tasdiqlandi (2026-06-18); qoldi: har mode (image/voice/video/sfx) bo'yicha bitta real generatsiya, kredit hisobi + R2 saqlashni tekshirish.
2. **CORS_ORIGIN** — render.yaml CF Pages'ga yangilandi (2026-06-18); qoldi: Render dashboard env'ini tasdiqlash (qo'lda qiymat yaml'dan ustun bo'lishi mumkin).
3. **Generatsiya tarixi grid (1e-3)** — Studio Gen frontend (history grid) yaratish (`GET /gen/history` allaqachon bor).
4. **End-to-end pipeline test** — Contributor upload → Admin approve → AE Sync → import (productionда).
5. **To'lov** — Stripe checkout/webhook to'liq oqimini sinash; contributor payout.
6. **Email bildirishnomalar** — `RESEND_API_KEY` ulash (approve/reject, parol tiklash).
7. **Tema** — Plugin'da allaqachon 3 tema bor (standart/liquid-glass/light-glass). Faqat **Studio** hozir 2 ta (dark/light); agar Studio'ga ham 3-tema kerak bo'lsa, `app.css` + `theme.js` ga qo'shiladi (3.8-bo'lim).
8. **AE Admin CEP barqarorligi** — `Failed to fetch` muammolarini hal qilish.

---

*Bu hujjat koddan tekshirilgan. Biror narsa moslashmasa — kodga ishon, hujjatni yangila.*
