-- #94 (A6) — tizim loglari fayldan (apps/api/data/system-logs.json) DB'ga.
-- Fayl Cloud Run'da ishonchsiz edi: konteyner o'chsa loglar yo'qoladi, ko'p
-- instansiyada esa har biri o'z faylini ko'radi (admin panel tasodifiy qism ko'rsatardi).
-- FAQAT ADDITIVE — mavjud jadvallarga tegmaydi.

CREATE TABLE IF NOT EXISTS "SystemLog" (
  "id"          TEXT NOT NULL,
  "ts"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level"       TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "sourceLabel" TEXT,
  "message"     TEXT NOT NULL,
  "action"      TEXT,
  "detail"      TEXT,
  "metaJson"    JSONB,
  "userId"      TEXT,
  CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- Admin ekrani ALWAYS `ORDER BY ts DESC` + manba/daraja filtri bilan o'qiydi.
CREATE INDEX IF NOT EXISTS "SystemLog_ts_idx" ON "SystemLog" ("ts");
CREATE INDEX IF NOT EXISTS "SystemLog_source_ts_idx" ON "SystemLog" ("source", "ts");
CREATE INDEX IF NOT EXISTS "SystemLog_level_ts_idx" ON "SystemLog" ("level", "ts");
