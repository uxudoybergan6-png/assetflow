-- Normalize measured provider spend before it is allowed to drive retail pricing.
-- Existing measuredCostUsd rows are intentionally NOT backfilled: their duration/tier is unknown.
ALTER TABLE "ProviderSpend"
  ADD COLUMN "measuredUnitCostUsd" DECIMAL(12,6),
  ADD COLUMN "measuredUnit" TEXT,
  ADD COLUMN "measuredQuantity" DECIMAL(12,4),
  ADD COLUMN "measurementTier" TEXT,
  ADD COLUMN "measurementMetaJson" JSONB;

CREATE INDEX "ProviderSpend_modelId_measuredUnit_measurementTier_idx"
  ON "ProviderSpend"("modelId", "measuredUnit", "measurementTier");
