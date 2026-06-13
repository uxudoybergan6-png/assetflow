# AssetFlow (Creative Tools SaaS)

Adobe **After Effects** uchun shablon marketplace (Pixflow / Envato uslubida).

Zanjir: **Contributor yuklaydi → Admin moderatsiya qiladi → AE plugin katalogida chiqadi → obunachi import qiladi (Free / Pro).**

> Joriy holat va keyingi vazifalar uchun: **`CLAUDE.md`**, **`HANDOFF.md`**, **`docs/LAUNCH-PLAN.md`**.

## Holat (2026-06-05)

| Qism | Holat |
|------|-------|
| API (Render) | ✅ Live — https://assetflow-rqbq.onrender.com |
| Studio + Admin (CF Pages) | ✅ Live — https://assetflow-20j.pages.dev |
| DB (Neon PostgreSQL) | ✅ Ulangan |
| Fayl saqlash (Cloudflare R2) | ✅ Ishlaydi |
| AE CEP plugin | 🟠 Ishlaydi, lekin faqat DEV o'rnatish (ZXP yo'q) |
| Stripe to'lov | 🔴 Kod tayyor, hali ulanmagan |

Loyiha mantig'i ishlaydi (upload → moderate → import). Tarqatish (ZXP), to'lov,
huquqiy va infra qismlari to'liq emas — `docs/LAUNCH-PLAN.md` ga qarang.

## Stack

| Qism | Texnologiya |
|------|-------------|
| API | Node.js + Express + Prisma |
| DB | PostgreSQL (Neon) |
| Studio + Admin | Static HTML/JS (`packages/assetflow-studio`) |
| After Effects plugin | CEP (HTML/JS + ExtendScript `host.jsx`) |
| Fayl saqlash | Cloudflare R2 (S3-mos) + CDN |
| To'lov | Stripe (hali to'liq ulanmagan) |

## Production URL'lar

| Xizmat | URL |
|--------|-----|
| API | https://assetflow-rqbq.onrender.com |
| Studio (CF Pages) | https://assetflow-20j.pages.dev |
| Contributor login | …/studio/login.html → …/studio/contributor/ |
| Admin login | …/studio/admin-login.html → …/studio/admin/ |

**CF Pages Build command:** `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs`
**CF Pages Output dir:** `packages/assetflow-studio/dist`

## Lokal ishga tushirish

```bash
cd /Users/usmonov/Projects/creative-tools-saas
npm install
cp .env.example .env          # DATABASE_URL va boshqalar

npm run db:push
npm run db:seed:assetflow -w @creative-tools/database

npm run pm2:start             # API :4000, Studio :3000, Admin :3001
npm run check:stack
```

| URL | Vazifa |
|-----|--------|
| http://localhost:3000/studio/ | Contributor |
| http://localhost:3001/ | Admin |
| http://localhost:4000/health | API |

## AE plugin (DEV o'rnatish)

```bash
bash plugins/after-effects-cep/scripts/install-cep.sh
# After Effects → Window → Extensions → AssetFlow
```

> ⚠️ Hozir plugin faqat `PlayerDebugMode` + `install-cep.sh` bilan ishlaydi (DEV).
> Oddiy foydalanuvchi uchun ZXP paketlash kerak — `docs/LAUNCH-PLAN.md` 1-bo'lim.

## Demo hisoblar (seed)

| Rol | Email | Parol |
|-----|-------|-------|
| Admin | admin@assetflow.uz | admin123 |
| Contributor | dilnoza.k@gmail.com | contrib123 |
| AE obunachi (plugin) | user@assetflow.uz | user123 |

## Papka tuzilishi

```
apps/
  api/                       Express REST API, routes/, lib/
  web/                       Next.js (studio sync shu yerda ham)
packages/
  database/                  Prisma schema + migrations + seed-assetflow.ts
  assetflow-studio/          Admin + Contributor UI (manba)
plugins/
  after-effects-cep/         AE Browse + Admin CEP panel (asosiy plugin)
docs/                        Deploy yo'riqnomalari + LAUNCH-PLAN
```

## Hujjatlar

- **`CLAUDE.md`** — Claude Code uchun kontekst (joriy)
- **`HANDOFF.md`** — to'liq topshirish hujjati
- **`docs/LAUNCH-PLAN.md`** — bozorga chiqish rejasi (~60% tayyor)
- **`docs/DEPLOY-STUDIO-VERCEL.md`** — Studio/Admin Vercel deploy
- **`SCOPE.md`** — loyiha doirasi
