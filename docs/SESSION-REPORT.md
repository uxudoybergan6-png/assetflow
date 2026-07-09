# Sessiya hisoboti — FIX-PROMPTS partiyasi · 2026-07-09

## PROBLEM 7 — Storage (AI results) kam ko'rsatilishi ✅

- **Ildiz sabab:** `GenAsset.sizeBytes` ustuni 2026-07-05 migratsiyada qo'shilgan —
  undan OLDINGI barcha assetlar (katta videolar ham) `null` → kvota yig'indisida 0.
  Joriy yozish yo'llari (persist → buf.length, image/audio/video) TO'G'RI ishlaydi.
- **Tuzatish:** (1) `hydrateGenAssets` lazy self-heal — HeadObject qilinganda hajm DB'ga
  yoziladi; (2) `lib/backfill-sizebytes.ts` — idempotent backfill (HeadObject + data-URI
  baholash, GenAsset + SavedReference); (3) admin endpointlar:
  `GET /api/admin/maintenance/gen-sizebytes` (diagnoz) va `POST .../backfill` (audit-log
  bilan); (4) `scripts/backfill-genasset-sizebytes.mjs` (DRY_RUN default).
- **Tekshirildi:** dev DB'da 5 null qator → 186 B ×5 to'ldirildi, qayta ishga tushirish 0
  qator (idempotent); `getUserUsedBytes`=930 ✓; build toza; money-zone TEGILMADI.
- **Kutilmoqda:** production deploy'dan keyin admin backfill endpointini ishga tushirish.

## PROBLEM 14 — Yangi user'da admin email ✅

- `notifyAdminNewUser` (notify.ts, ADMIN_NOTIFY_EMAIL yo'q→no-op, safe fire-and-forget);
  3 yaratish nuqtasiga ulandi: register (web), Google web isNew, Google plugin device-code
  isNew. E2E: register→1 xabar, takroriy login→0, mail xatosi signup'ni buzmaydi ✓.
