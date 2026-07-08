-- FAZA 2 (H7) — persistent per-user-per-UTC-day gen/helper cap (in-memory Map o'rniga).
-- ADDITIVE: yangi jadval, mavjud ma'lumotga tegmaydi.
CREATE TABLE "DailyUsageCounter" (
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyUsageCounter_pkey" PRIMARY KEY ("userId","day","kind")
);

CREATE INDEX "DailyUsageCounter_day_idx" ON "DailyUsageCounter"("day");
