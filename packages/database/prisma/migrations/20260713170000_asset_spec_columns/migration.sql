-- P1 (step 30) — ContributorTemplate'ga ffprobe spec + ko'p-orientatsiya ustunlari (ADDITIVE).
-- Hammasi nullable / default bo'sh; eski qatorlar tegilmaydi (UI bo'sh qatorlarni ko'rsatmaydi).
ALTER TABLE "ContributorTemplate" ADD COLUMN "orientations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContributorTemplate" ADD COLUMN "durationSec" DOUBLE PRECISION;
ALTER TABLE "ContributorTemplate" ADD COLUMN "width" INTEGER;
ALTER TABLE "ContributorTemplate" ADD COLUMN "height" INTEGER;
ALTER TABLE "ContributorTemplate" ADD COLUMN "fps" DOUBLE PRECISION;
ALTER TABLE "ContributorTemplate" ADD COLUMN "hasAlpha" BOOLEAN;
ALTER TABLE "ContributorTemplate" ADD COLUMN "looped" BOOLEAN;
ALTER TABLE "ContributorTemplate" ADD COLUMN "videoCodec" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "audioCodec" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "audioBitrate" INTEGER;
ALTER TABLE "ContributorTemplate" ADD COLUMN "sampleRate" INTEGER;
