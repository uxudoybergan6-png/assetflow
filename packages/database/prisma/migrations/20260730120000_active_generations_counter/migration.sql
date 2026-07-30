-- M6 (audit #40): `MAX_ACTIVE_GENERATIONS` check-then-act edi (count → create) → parallel
-- so'rovlar cheklovni chetlab o'tardi. Atomik slot hisoblagichi (consumeDownload naqshi:
-- guard WHERE'da, count===0 → rad). Drift bo'lsa `Generation` jadvalidagi haqiqiy sondan
-- o'zini tuzatadi (claim rad etilganda rekonsiliatsiya).
ALTER TABLE "PluginProfile" ADD COLUMN IF NOT EXISTS "activeGenerations" INTEGER NOT NULL DEFAULT 0;

-- Backfill: mavjud faol (queued/running) generatsiyalar soni.
UPDATE "PluginProfile" p
SET "activeGenerations" = COALESCE(g.cnt, 0)
FROM (
  SELECT "userId", COUNT(*)::int AS cnt
  FROM "Generation"
  WHERE status IN ('queued', 'running')
  GROUP BY "userId"
) g
WHERE p."userId" = g."userId";
