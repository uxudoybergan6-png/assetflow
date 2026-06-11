# AssetFlow loyihasi — kontekst (Claude Code uchun)

Sen `/Users/usmonov/Projects/creative-tools-saas` monorepo ustida ishlayapsan. Bu **AssetFlow** — Contributor → Admin moderatsiya → AE Browse plugin zanjiri.

## Maqsad

1. Contributor Studio'da shablon yuklaydi (thumb, preview, pack .zip/.aep).
2. Admin tasdiqlaydi (approve/reject, published=true).
3. Tasdiqlangan shablonlar **Render API** orqali AE plugin katalogida chiqadi.
4. Obunachi AE ichida Browse paneldan import qiladi (Free/Pro limitlar).

## Production URL'lar

| Xizmat | URL |
|--------|-----|
| API (Render) | https://assetflow-rqbq.onrender.com |
| Studio (Vercel) | https://assetflow-studio-one.vercel.app |
| Contributor login | …/studio/login.html yoki …/studio/contributor/ |
| Admin login (brauzer) | …/studio/admin-login.html |
| Admin panel | …/studio/admin/ |

**Vercel Root Directory:** `packages/assetflow-studio` (boshqa papka bo'lsa 404).

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

## Hozirgacha qilingan ishlar (Claude Code sessiyasi — 2026-06-04)

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
6. `apps/web/public/studio` — `npm run studio:sync` bilan package dan sinxron.

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
- Production URL: `assetflow-rqbq.onrender.com`, Studio: `assetflow-studio-one.vercel.app`.
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

---

*Yangilangan: 2026-06-04*
