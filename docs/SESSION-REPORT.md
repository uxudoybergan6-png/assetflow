# Sessiya hisoboti — 2026-07-31 (BATCH 10 — INFRA / DEPLOY / RELIABILITY)

**Manba:** `docs/REJA-CLAUDE-2026-07-30.md`, 8-bosqich. **Bajarildi 13/13.** Yangi migratsiya YO'Q.

- **Runtime:** #34 `SIGTERM`/`SIGINT` graceful shutdown (`/health` darhol 503 "draining" → LB chiqaradi,
  `server.close` + Prisma disconnect, 10s qattiq shift) · #111 `/health` 5s kesh + umumiy `in-flight`
  promise (probe stampede tugadi) · #108 productionда `SENTRY_DSN` yo'qligi endi boot ogohlantirishi.
- **Atomiklik (migratsiyasiz — mavjud ustunlar ijara sifatida):** #109 `running` generatsiyalar `updatedAt`
  ijarasi bilan egallanadi + heartbeat (ikki instans bir jobni ikki marta ishlamaydi) · #110 transcode va
  embedding rekonsileri `find-then-touch` emas, shartli `updateMany` (10 instans = 10 ffmpeg tugadi) ·
  #154 oylik narx rekonsiliatsiyasi absolyut UTC 03:00 ga bog'landi + `SystemLog.id` bilan oyiga bir marta
  (ilgari boot-drift tufayli HECH QACHON ishlamasdi; xatoda claim qaytariladi).
- **Deploy:** #33 `deploy-cloudrun.sh` — migratsiya gate + o'zgarmas commit-SHA teg + qo'lda-deploy
  ogohlantirishi · #153 `deploy-ingest-worker.sh` `--env-vars-file` + `--set-env-vars` (o'zaro inkor →
  job hech qachon yaratilmasdi) vaqtinchalik yaml nusxasi bilan tuzatildi · #113 Docker `npm install`
  → `npm ci` (soxta stub manifestlar olindi, `.dockerignore` haqiqiy `package.json`larni kiritadi) ·
  #114 Node 20 (EOL) → **Node 22**: Dockerfile, `ci.yml` ×2, `deploy-cloudrun.yml`, `engines`.
- **CI:** #36 ilgari 8 ta `test:*` dan faqat 1 tasi ishlardi → qolgan 7 tasi + yangi `test:dep-floors`
  qadaldi · #112 yangi `deploy-cdn-worker.yml` (`public-keys.ts` yoki Worker o'zgarsa avto-deploy,
  secret yo'q bo'lsa fail-closed) · #152 `migration_lock.toml` allaqachon bor va git'da — ish kerak emas.
- **#35** `verify-pipeline.mjs` endi lokal bo'lmagan API'ni BLOKLAYDI (`--allow-remote` shart) va test
  shablon + hisobni oxirida (xatoda ham) tozalaydi; hujjatlardagi buyruq yangilandi.
- **Testlar:** 7 ta paket testi ✓ (installers 262 · preflight 100 · package 59 · updater 118 ·
  release 110 · responsive · download-state) · dep-floors ✓ · `npm run build -w apps/api` ✓ ·
  cdn-proxy `typecheck` ✓ · `npm ci --dry-run` lockfile sinxron ✓.

⚠️ **Egasidan kerak:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secretlari (aks holda CDN
Worker workflow'i ataylab yiqiladi) va `SENTRY_DSN`. Docker build lokal daemon yo'qligi sababli
sinalmadi — `npm ci` mosligi `--dry-run` bilan tekshirildi.
⚠️ **Migratsiya kutilmoqda** (oldingi batchlardan, prod'ga QO'LLANMAGAN, 8 ta — `20260730160000…20260730240000`).
