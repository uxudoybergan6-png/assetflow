-- FAZA 4 (C) — pool payout: earning turi + davr (additive, default mavjud satrlarga mos)
ALTER TABLE "ContributorEarning" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'download';
ALTER TABLE "ContributorEarning" ADD COLUMN "periodMonth" TEXT;
CREATE INDEX "ContributorEarning_kind_periodMonth_idx" ON "ContributorEarning"("kind", "periodMonth");
