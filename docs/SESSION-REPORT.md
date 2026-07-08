# Sessiya hisoboti — FAZA 2 (Xavfsizlik / Abuse hardening)

**Sana:** 2026-07-08 · Manba: docs/THREAT-REGISTER.md · docs/LAUNCH-READINESS.md (Faza 2)

6 commit (A–F, har soha alohida, push YO'Q, pul-zonasi TEGILMAGAN — consume/refund/limit/pricing baytdek):
- **A (H1/M7):** TemplateDownloadEvent `@@unique(userId,templateId,kind)` → qayta yuklab olish bir marta earning; self-exclusion + email-verify gate + admin/uncharged skip FAQAT earning'ni to'sadi; pack/mogrt rate-limit. Oylik download LIMITI o'zgarmadi.
- **B (H2/H3/M4):** /assets endi pack'ni skanlaydi (disk fayl, qayta yuklamaydi); download+approve gate null/pending = FAIL-CLOSED; approve null'ni self-heal qiladi.
- **C (H6/H7/H8/M6):** COST_QUOTE_SECRET prod FATAL; gen+helper cap DB'da (DailyUsageCounter); ceiling default-ON + DB-xato'da chegara ustida fail-closed; enabled model default USD + startup check; ref-upload storage kvotaga kiradi.
- **D (M1/M2/M3):** register→DOIM USER; legacy `/contributor/users/:id/role` o'chirildi; multer'dan OLDIN ownership.
- **E (L3/L4/L5):** SSE rate-limit+stream cap; /logs write rate-limit; admin upload-url folder whitelist + fileName sanitize.
- **F:** submit/auto-approve-create/ingest rights attestation SERVER-tomon majburiy (RIGHTS_REQUIRED).

Ochiq / jonli tekshirish kerak:
- ⚠️ **Backfill:** mavjud prod shablon `packScanStatus=null` bo'lsa download endi 409 (fail-closed) — deploy'dan keyin qayta skan / admin "Clear pack" kerak.
- ⚠️ **Prod env:** `COST_QUOTE_SECRET` (JWT'dan farqli) o'rnatilmasa API BOOT BO'LMAYDI (FATAL). `migrate:deploy` (2 additiv migr).
- `npm run build -w apps/api` yashil. TODO(M5): multi-account device/IP heuristika — bu fazadan tashqarida.
