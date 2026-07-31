# Sessiya hisoboti — 2026-07-31 (Neon → Cloud SQL: CI + deploy oqimi)

**Nima qilindi**
- CI qizilligi #1: `test-ci-windows-installer.mjs` `node-version = "20"` ni QATTIQ kutardi
  (loyiha Node 22'da). Kutilgan major endi YAGONA manbadan (`package.json` → `engines.node`)
  olinadi + `Dockerfile` ↔ `engines` moslik tekshiruvi. 163→169 assert.
- CI qizilligi #2: panel ikonalari `zlib.deflateSync` bilan yozilardi — chiqish zlib
  VERSIYASIGA bog'liq (lokal Node 25 ≠ CI Node 22) → "bayt-ba-bayt bir xil" testi qizil.
  Endi PNG IDAT "stored" bloklar bilan qo'lda yoziladi → har qanday Node'da bir xil bayt.
  Pikselllar o'zgarmadi (IDAT inflate solishtirildi), fayl 227B → 2.2KB.
  **CI endi YASHIL** (ikkala ish) — `c79a19d` dan beri birinchi marta.
- `scripts/cloudsql-proxy.sh` (YANGI): Auth Proxy qadalgan versiya + SHA-256 bilan
  `/cloudsql/<INSTANCE>` socket'ini CI/Cloud Shell'da Cloud Run'dagidek qiladi →
  `DATABASE_URL` O'ZGARISHSIZ ishlatiladi. CI'da ishga tushdi va tayyor bo'ldi ✅
- `deploy-cloudrun.yml` + `deploy-cloudrun.sh`: proxy → migratsiya → `migrate:status` isboti →
  deploy'da `--add-cloudsql-instances`. `db-backup.yml` ham xuddi shu proxy'ga o'tdi.

**Nima topildi (BLOKER — ega hal qiladi)**
- Migratsiya `P1013: invalid port number` bilan yiqildi. Sabab: `CLOUDRUN_ENV_YAML`
  sirida DB parolida kodlanmagan **`/`** bor. URL'da `/` authority'ni tugatadi →
  xost `frameflow_app`, port `<parol boshi>`. Bu migratsiyani ham, JONLI konteynerni ham yiqitadi.
- Kerak: parolda `/` → `%2F` (yoki parolni faqat harf/raqamga almashtirish), so'ng
  `gh secret set CLOUDRUN_ENV_YAML` va deploy qayta ishga tushirish.
- `scripts/check-db-url.mjs` qo'shildi — sabab endi qiymatni chop etmasdan aniq aytiladi.

**Kutilmoqda:** sir tuzatilgach → deploy → `migrate status` → `/health` db:ok → verify-pipeline.
Hozir `/health` = `degraded`, `db: down` (Neon o'lik, Cloud SQL'ga hali ulanmadi).
