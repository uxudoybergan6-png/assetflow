# Hammasini onlayn (test)

Repo: https://github.com/uxudoybergan6-png/assetflow

Loyiha 4 qismdan iborat. Test uchun minimal stack:

| Qism | Qayerda | Nima uchun |
|------|---------|------------|
| PostgreSQL | [Neon](https://neon.tech) (bepul) | DB |
| API | [Render](https://render.com) (`render.yaml`) | Katalog, login, upload |
| Studio + Admin | Vercel yoki Render Static | Brauzerdan moderator |
| AE plugin | Kompyuteringizda | API URL ni onlayn qilasiz |

---

## 1. Neon — ma'lumotlar bazasi

1. https://neon.tech → Sign up → **New Project** → `assetflow`
2. **Connection string** nusxalang (`postgresql://...?sslmode=require`)

---

## 2. Render — API

1. https://dashboard.render.com → **New** → **Blueprint** (yoki Web Service)
2. GitHub ulan: `uxudoybergan6-png/assetflow`
3. `render.yaml` avtomatik ko‘rinadi → **Apply**
4. **Environment** (majburiy):

```env
DATABASE_URL=<neon connection string>
NODE_ENV=production
API_PORT=10000
JWT_SECRET=<64 ta tasodifiy belgi>
API_PUBLIC_URL=https://assetflow-api.onrender.com
PLUGIN_ALLOW_PRO_WITHOUT_STRIPE=true
CORS_ORIGIN=*
```

`CORS_ORIGIN=*` — faqat **test** uchun. Productionda aniq URL lar.

5. Deploy tugagach: `https://SIZNING-SERVICE.onrender.com/health` → `{"status":"ok"}`

6. Bir marta migratsiya + seed (Render Shell yoki lokal):

```bash
DATABASE_URL="..." npm run db:push
DATABASE_URL="..." npm run db:seed:assetflow -w @creative-tools/database
```

---

## 3. Studio + Admin (brauzer)

### Variant A — tez (Vercel, 2 ta loyiha)

**Contributor Studio**

1. https://vercel.com → Import `uxudoybergan6-png/assetflow`
2. Root: `packages/assetflow-studio`
3. Build: `npm run sync:web -w @creative-tools/assetflow-studio` (yoki repo root dan `npm run studio:sync`)
4. Output: `packages/assetflow-studio` static — Vercel **Other** → Build Command bo‘sh, output papka `packages/assetflow-studio`
5. Environment: yo‘q
6. `index.html` yoki `hub.html` ga redirect

Oddiyroq: **Vercel** da butun monorepo, **Root Directory** = `packages/assetflow-studio`, Framework = Other.

HTML ichida API:

`packages/assetflow-studio/index.html` (yoki `login.html`) `<head>` ga qo‘shing:

```html
<meta name="assetflow-api" content="https://SIZNING-API.onrender.com">
```

**Admin** — xuddi shu repo, ikkinchi Vercel project:

- Root: `packages/assetflow-studio`
- Start/command: `node scripts/dev-admin-server.mjs` — Vercel Node server sifatida (yoki Render Web Service)

Admin uchun Render qulayroq:

- **Web Service**, Start: `node packages/assetflow-studio/scripts/dev-admin-server.mjs`
- Env: `API_URL=https://SIZNING-API.onrender.com`, `PORT=10000`

### Variant B — hozircha faqat API + lokal Studio

API onlayn, Studio/Admin `localhost:3000/3001` — `studio-config.js` da `meta assetflow-api` yoki `.env` orqali Render URL.

---

## 4. AE plugin → onlayn API

After Effects ichida plugin **Settings** yoki prefs:

- **API base URL:** `https://SIZNING-API.onrender.com`

Kod: `assetflow-account.js` / `assetflow-catalog.js` — `client.apiBaseUrl` prefs.

O‘rnatish: `bash plugins/after-effects-cep/scripts/install-cep.sh`

---

## 5. Tekshirish ro‘yxati

| URL | Kutilgan |
|-----|----------|
| `.../health` | `ok` |
| `.../api/plugin/catalog` | JSON `items` |
| Studio login | Contributor kirish |
| Admin | `admin@assetflow.uz` / `admin123` (seed) |
| AE plugin | Sync → server shablonlar |

---

## Xavfsizlik (testdan keyin)

- Repo **Public** → Settings → **Private**
- `CORS_ORIGIN` ni `*` dan haqiqiy domenlarga
- `.env` hech qachon GitHub ga commit qilinmasin (`.gitignore` ✅)

---

## Tez buyruqlar (lokal, onlayn DB bilan)

```bash
cp .env.cloud.example .env
# DATABASE_URL va API_PUBLIC_URL to'ldiring
npm run db:push
npm run db:seed:assetflow -w @creative-tools/database
```
