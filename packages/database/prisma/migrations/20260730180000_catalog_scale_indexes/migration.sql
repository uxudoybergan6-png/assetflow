-- BATCH 5 · T5.3 — katalog miqyos indekslari (#58 / #59 / #60).
-- FAQAT ADDITIVE: hech qanday ustun/jadval o'zgarmaydi, faqat indeks qo'shiladi.
-- Barchasi IF NOT EXISTS — qayta ishga tushirish xavfsiz.

-- ── #58 — stale transcode supurishi ────────────────────────────────────────
-- `previewTranscodeStatus = 'pending' AND updatedAt < cutoff` so'rovi ilgari HAR
-- `GET /api/contributor/templates` da ishlardi (endi cron'da, template-reconcile.ts).
-- Ustun selektivligi juda past ('pending' qatorlar ozchilik) → QISMAN indeks:
-- indeksga faqat 'pending' qatorlar tushadi (bir necha KB), to'liq jadval skani yo'q.
CREATE INDEX IF NOT EXISTS "ct_transcode_pending_upd_idx"
  ON "ContributorTemplate" ("updatedAt")
  WHERE "previewTranscodeStatus" = 'pending';

-- ── #59 — qidiruv: ILIKE '%q%' uchun pg_trgm GIN ───────────────────────────
-- `q` katalog qidiruvi (plugin.ts catalogWhere) name/description/catLabel bo'yicha
-- `contains + mode:"insensitive"` → SQL `ILIKE '%q%'`. Prefiks bo'lmagani uchun
-- oddiy btree ISHLAMAYDI — har so'rov to'liq skan. gin_trgm_ops ILIKE'ni qo'llaydi.
-- Neon allowlist'ida pg_trgm bor; extension yiqilsa deploy gate (#7) to'xtatadi.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ct_name_trgm_idx"
  ON "ContributorTemplate" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ct_description_trgm_idx"
  ON "ContributorTemplate" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ct_catlabel_trgm_idx"
  ON "ContributorTemplate" USING gin ("catLabel" gin_trgm_ops);

-- `tags: { has: q }` → SQL `"tags" @> ARRAY[$1]`. Massiv uchun GIN (trgm emas).
CREATE INDEX IF NOT EXISTS "ct_tags_gin_idx"
  ON "ContributorTemplate" USING gin ("tags");

-- ── #60 — `sort=az|za` (ORDER BY name) ─────────────────────────────────────
-- Prefiks (published, reviewStatus) barcha katalog so'rovlarida bir xil; keyin name,
-- oxirida id (kursor tiebreaker) → sort bo'yicha to'liq indeks-skan, external sort yo'q.
-- Bu indeks schema.prisma'da ham e'lon qilingan (ct_pub_rev_name_idx).
CREATE INDEX IF NOT EXISTS "ct_pub_rev_name_idx"
  ON "ContributorTemplate" ("published", "reviewStatus", "name", "id");
