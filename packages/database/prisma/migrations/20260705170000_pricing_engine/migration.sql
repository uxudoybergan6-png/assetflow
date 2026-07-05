-- Bosqich 3.4 NARX DVIGATELI + 3.5 NARX-DRIFT. ADDITIVE only, NON-destructive.
-- Uch yangi jadval: ModelPricing (DB-backed kredit narx), PricingConfig (global sozlama
-- singleton: creditUsdValue + marginTarget), ProviderInvoice (real oylik hisob-faktura).
-- Hech qanday DROP / mavjud ustunga tegish yo'q. Pul mantig'i (consume/refund/imzo) tegilmagan.
-- Seed startup'da gen-models.ts joriy qiymatlaridan (create-only) — narx BUGUNGI bilan bir xil.

-- CreateTable
CREATE TABLE "ModelPricing" (
    "id" TEXT NOT NULL,
    "modelId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "label" TEXT,
    "cost" INTEGER NOT NULL,
    "pricing" TEXT,
    "qualityCost" JSONB,
    "videoPerSec" JSONB,
    "estCostUsd" DECIMAL(10,4),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelPricing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModelPricing_modelId_key" ON "ModelPricing"("modelId");
CREATE INDEX "ModelPricing_mode_idx" ON "ModelPricing"("mode");

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "creditUsdValue" DECIMAL(12,6) NOT NULL DEFAULT 0.019,
    "marginTarget" DECIMAL(8,3) NOT NULL DEFAULT 1.8,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderInvoice" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "actualUsd" DECIMAL(12,4) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderInvoice_provider_periodMonth_key" ON "ProviderInvoice"("provider", "periodMonth");
CREATE INDEX "ProviderInvoice_periodMonth_idx" ON "ProviderInvoice"("periodMonth");
