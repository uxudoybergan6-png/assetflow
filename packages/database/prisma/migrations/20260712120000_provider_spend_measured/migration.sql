-- P24 — ProviderSpend'ga real o'lchangan USD + confidence (BytePlus token / invoice). Additive,
-- analitika; kredit matematikasiga aloqasi YO'Q.
ALTER TABLE "ProviderSpend" ADD COLUMN "measuredCostUsd" DECIMAL(10,4);
ALTER TABLE "ProviderSpend" ADD COLUMN "confidence" TEXT;
