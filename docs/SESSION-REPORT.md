# Sessiya hisoboti — 2026-07-31 (Neon → Cloud SQL: CI + deploy oqimi)

**Nima qilindi**
- CI qizil sababi: `test-ci-windows-installer.mjs` `node-version = "20"` ni QATTIQ kutardi,
  holbuki loyiha Node 22'ga ko'tarilgan (Dockerfile + engines + 4 workflow). Endi kutilgan
  major YAGONA manbadan (`package.json` → `engines.node`) olinadi + `Dockerfile` ↔ `engines`
  moslik tekshiruvi qo'shildi. 163→169 assert, 0 fail.
- `scripts/cloudsql-proxy.sh` (YANGI): Auth Proxy'ni qadalgan versiya + platforma SHA-256
  bilan ko'taradi va `/cloudsql/<INSTANCE>` socket'ini CI/Cloud Shell'da Cloud Run'dagidek
  qiladi → `DATABASE_URL` O'ZGARISHSIZ ishlatiladi (URL qayta yozilmaydi, parol qayta
  kodlanmaydi). Tayyorlik `/readiness` + socket fayli bilan TEKSHIRILADI.
- `deploy-cloudrun.yml` + `deploy-cloudrun.sh`: migratsiyadan oldin proxy, keyin
  `migrate:status` isboti, deploy'ga `--add-cloudsql-instances`.
- `db-backup.yml`: xuddi shu proxy (aks holda kunlik zaxira socket URL bilan yiqilardi).
- `render.yaml` allaqachon o'chirilgan edi (`7bf61bf`) — qolgan 2 eskirgan izoh tozalandi.

**Nima topildi**
- Yangi migratsiya soni — **8** ta (`20260730160000…240000`), 9 emas (9-si `migration_lock.toml`).
- Prisma socket URL'ni qabul qiladi (lokal: P1001 "socket yo'q", parse xatosi EMAS).
- `schema.prisma` izohlari hali "Neon pooled/pgbouncer" deydi — SXEMAGA TEGILMADI (topshiriq #5).

**Kutilmoqda:** deploy kuzatuvi → `migrate status` → `/health` db:ok → verify-pipeline.
