# AssetFlow loyihasi — kontekst (Codex uchun)

Sen `/Users/usmonov/Projects/creative-tools-saas` monorepo ustida ishlayapsan. Bu **AssetFlow** — Contributor → Admin moderatsiya → AE Browse plugin zanjiri.

## Maqsad

1. Contributor Studio'da shablon yuklaydi (thumb, preview, pack .zip/.aep).
2. Admin tasdiqlaydi (approve/reject, published=true).
3. Tasdiqlangan shablonlar **Render API** orqali AE plugin katalogida chiqadi.
4. Obunachi AE ichida Browse paneldan import qiladi (Free/Pro limitlar).
5. Obunachi AE ichida **Studio Gen AI** bilan rasm/video/ovoz/SFX generatsiya qiladi (kredit asosida) — pastdagi "Studio Gen AI tizimi" bo'limiga qara.

> **HAQIQAT MANBAI:** loyihaning JORIY holati uchun yagona kod-tasdiqlangan manba — `docs/PROJECT-STATUS.md`. `docs/REJA-*` va `docs/STUDIO-GEN-*` hujjatlari KELAJAK reja / dizayn referenslari (bajarilgan deb o'qima). Har doim kod + `PROJECT-STATUS.md` ustun.

## Production URL'lar

| Xizmat | URL |
|--------|-----|
| API (Render) | https://assetflow-rqbq.onrender.com |
| Studio (CF Pages) | https://assetflow-20j.pages.dev |
| Contributor login | …/studio/login.html yoki …/studio/contributor/ |
| Admin login (brauzer) | …/studio/admin-login.html |
| Admin panel | …/studio/admin/ |

**CF Pages Build command:** `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs`
**CF Pages Output dir:** `packages/assetflow-studio/dist`

**Render env:** `API_PUBLIC_URL`, `ADMIN_URL`, `CORS_ORIGIN`, R2 (`AWS_*`, `S3_ENDPOINT`, `CDN_BASE_URL`).

## Seed hisoblar

| Rol | Email | Parol |
|-----|-------|-------|
| Admin | admin@assetflow.uz | admin123 |
| Contributor | dilnoza.k@gmail.com | contrib123 |
| Plugin obunachi | user@assetflow.uz | user123 |

## Arxitektura (qisqa)

```
packages/assetflow-studio/  → Admin + Contributor static UI (Vercel manba)
apps/api/                   → Express API, Prisma, R2 upload
packages/database/          → Prisma schema + migrations
plugins/after-effects-cep/  → AE Browse + AssetFlow Admin CEP panel
~/Library/.../com.assetflow.demo/  → o'rnatilgan CEP (install-cep.sh)
```

**Asosiy API yo'llar:**

- `POST /api/auth/login` — Studio JWT
- `POST /api/plugin/login` — Plugin token
- `GET /api/plugin/catalog` — tasdiqlangan shablonlar (`APPROVED` + `published: true`)
- `/api/contributor/templates` — CRUD, upload, submit, review
- `GET /api/contributor/admin/overview` — admin statistika
- `GET /api/admin/plugin-subscribers`, `/api/admin/plugin-analytics`
- `/api/studio/messages/*` — xabarlar (threads, broadcast)
- `GET /api/studio/audit` — audit log

## Studio Gen AI tizimi (REAL — eslab qol, qayta rejalashtirma)

> Bu tizim ALLAQACHON kodga yozilgan va ishlaydi. `docs/REJA-*` va `docs/STUDIO-GEN-*` hujjatlari KELAJAK/DIZAYN rejasi — joriy holat EMAS. Joriy holatni kod va `docs/PROJECT-STATUS.md` belgilaydi.

AE plagin ichidagi (USER roli) kredit-asosli generativ studiya. Rasm / rasm-edit / video / ovoz / SFX generatsiyasi + shablon semantik qidiruvi.

**Provayderlar** (`apps/api/src/lib/ai/`):
- **OpenRouter** (`openrouter.ts`) — rasm (text-to-image, image-edit), video (text-to-video, image-to-video).
- **ElevenLabs** (`elevenlabs.ts`) — SFX (text-to-sfx) va ovoz.
- **Cloudflare Workers AI** (`workers-ai.ts`) — shablon embeddinglari (`@cf/baai/bge-m3`) + zaxira rasm/matn/TTS.

**Endpointlar** (`apps/api/src/routes/`):
- `studio-gen.ts` → `/api/studio` ostida: `POST /gen` (job yaratish), `POST /gen/sessions`, `GET /gen/history`, `GET /gen/models`, `POST /gen/cost-quote` (imzolangan narx), `POST /gen/prompt/enhance`, `POST /gen/describe`, `GET|DELETE /gen/:jobId`, `GET /gen/health`, `GET /credits`.
- `ai.ts` → `/api/plugin/ai` ostida: `POST /estimate`, `/image`, `/voiceover`, `/search` (semantik), `/reindex`.

**Kredit tizimi:** `lib/plugin-profile.ts` (`consumeAiCredits`, `refundAiCredits`, `ensurePluginProfile`) + `lib/gen-models.ts` (model katalogi, `computeGenCost` — video `cost` = soniya/kredit). Oqim: imzolangan `cost-quote` → atomik kredit yechish → muvaffaqiyatsizlikda refund. `gen-processor.ts` job'ni qayta ishlaydi.

**Kirish:** AI faqat AE plagin ichida (`requireAuth`, USER); `/gen/describe` va `/gen/enhance` ham kredit/cap bilan himoyalangan (audit #4 tuzatilgan — TEGMA).

## Hozirgacha qilingan ishlar (Codex sessiyasi — 2026-06-04)

### Dashboard / Studio

- Contributor `/studio/contributor/` Vercel 404 tuzatildi: `prepare-vercel.mjs`, `studio/contributor/index.html`, `vercel.json` rewrite.
- Demo statistika va soxta xabarlar olib tashlandi; haqiqiy API (`plugin-analytics`, audit, `activityByDay`).
- `studio-stats.js`, `studio-config.js` production API default.

### API / R2

- **Muammo:** Katalog faqat diskni tekshirardi → `hasPack: false` (Render ephemeral disk).
- **Tuzatish:** `catalog-map.ts` → `templateAssetFlags()` (disk + R2).
- `s3.ts` — `resolveS3AssetKey`, pack/preview kengaytma; `serve-asset.ts` faqat mavjud R2 ga redirect.
- `app-urls.ts` — production fallback URL.
- Plugin login javobida `apiBaseUrl` + `adminUrl`.

### AE Plugin

- `assetflow-env.js` — default API Render (localhost emas).
- Login dan keyin `apiBaseUrl` prefs ga yoziladi.
- Katalog `packKey = __srv_<id>` (nom takrori).
- `AssetFlow_Admin.html` — API maydoni login, localhost → Render auto-fix, `Failed to fetch` xabarlari, `openWebAdmin()`.
- `install-cep.sh` — extension qayta o'rnatish.

### DB

- Demo shablonlar `published: false` (seed + migration `unpublish_demo_templates`).
- Messaging, audit log modellari va UI ulangan.

### Tekshirilgan (ishlaydi)

```bash
GET https://assetflow-rqbq.onrender.com/api/plugin/catalog
# → cmpzpnnyq0001oc1gzla3mzi5 "Football Championship..." hasPack:true, hasPreview:true
```

## Ochiq / ehtiyot bo'lish kerak joylar

1. **Render deploy** — API o'zgarishlari push qilinmagan bo'lishi mumkin; avval `npm run build -w apps/api` va deploy.
2. **AE Admin CEP** — brauzer Admin (Vercel) ishonchliroq; CEP `Failed to fetch` = eski extension yoki `localhost` API.
3. **Plugin Browse** — login + **↻ Sync**; API `https://assetflow-rqbq.onrender.com`; **Video Templates** tab (`nav: video`).
4. **Pack yo'q** bo'lsa katalogda ko'rinadi lekin import bloklanadi (`hasPack:false`).
5. **Tez orada** (hali to'liq emas): Stripe tariflar (localStorage), email bildirishnomalar, contributor payout.
6. **Lokal dev**: `npm run studio` → API (:4000) + Contributor Studio (:3000, `dev-studio-server.mjs`) + Admin (:3001, `dev-admin-server.mjs`), Studio MANBASINI to'g'ridan serv qiladi. (apps/web Next.js o'chirildi — audit #10; CF Pages/Vercel manbadan build qiladi.)

## Studio manba fayllari (MUHIM)

```
packages/assetflow-studio/js/      ← MANBA (shu yerga edit qil)
packages/assetflow-studio/styles/  ← MANBA (shu yerga edit qil)
```

`studio/js/`, `studio/styles/`, `admin/js/`, `admin/styles/` — **build artefakti**.
`prepare-vercel.mjs` (`copyDir root/js → root/studio/js`) va `studio:sync` bu papkalarni QAYTA YOZADI.
Artefaktlarga yozilgan o'zgarishlar yo'qoladi. HAR DOIM root `js/` va `styles/` ga edit qil, so'ng `npm run studio:sync`.

## Foydali buyruqlar

```bash
npm run pm2:start
npm run check:stack
npm run verify:pipeline
API_URL=https://assetflow-rqbq.onrender.com node scripts/verify-pipeline.mjs
npm run studio:sync
bash plugins/after-effects-cep/scripts/install-cep.sh
npm run migrate:deploy -w @creative-tools/database
npm run demo:clear   # demo shablonlar + xabarlar tozalash
```

## Kod uslubi

- Minimal diff, mavjud konventsiyaga mos.
- Commit faqat foydalanuvchi so'rasa.
- O'zbekcha UI matnlari.
- Production URL: `assetflow-rqbq.onrender.com`, Studio: `assetflow-20j.pages.dev`.
- Har diagnostika/tuzatish tugaganda qisqa natijani `docs/SESSION-REPORT.md` ga yoz (almashtirib): nima qilindi, nima topildi, nima kutilmoqda. Maks 15 qator.

## Keyingi ustuvor vazifalar

1. Render/Vercel deploy holatini tasdiqlash (katalog `hasPack` productionda).
2. AE plugin ↔ API ulanishini CEP da barqaror qilish.
3. Contributor upload → Admin approve → AE Sync end-to-end test.
4. "Tez orada" bo'limlar: Stripe, email, payout.

## Muhim fayllar (boshlash uchun)

Avval quyidagilarni o'qi:

- `HANDOFF.md`
- `packages/assetflow-studio/vercel.json`
- `apps/api/src/routes/plugin.ts`
- `apps/api/src/lib/catalog-map.ts`
- `plugins/after-effects-cep/assetflow-catalog.js`

## fal.ai migratsiya hujjatlari (faza 2 backend — MAJBURIY o'qi)

fal.ai provayder backend yozilаётганda (fal.ts adapter, gen-models/processor/quote) — quyidagilar
yagona haqiqat manbai. fal.ai'ни QAYTA tekshirma/taxmin qilma, shulardan foydalan:

- `docs/FAL-AI-CATALOG.md` — qaysi tool → qaysi fal model (KEEP/REPLACE/ADD/REMOVE verdict)
- `docs/FAL-DOCS-CORE.md` — API mexanikasi (auth `Authorization: Key`, queue/submit, webhook ED25519, CDN→R2, billing/refund)
- `docs/FAL-DOCS-MODELS.md` — HAR model aniq schema (param nomlari, input format, output shakli, narx)
- `docs/FAL-API-NOTES.md` — qisqa eslatma + aniq model ID'lar
- `docs/HIGGSFIELD-ANALYSIS.md` — UX naqsh + Project-panel auto-load texnikasi (faza 1 manbasi)

Eslatma: faza 1 (plagin UX, launcher + auto-load + 6 yangi tool pane) BAJARILDI — yangi tool'lar
hozir "Tez orada · keyingi faza" placeholder. Faza 2 = ularni fal.ai'ga ulash.

---

*Yangilangan: 2026-06-24*
