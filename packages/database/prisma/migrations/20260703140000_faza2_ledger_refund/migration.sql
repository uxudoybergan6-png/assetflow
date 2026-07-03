-- Faza 2 (moliyaviy audit + refund guard) — ADDITIVE only, NON-destructive.
-- Hech qanday DROP / destructive ALTER yo'q: bitta yangi ustun + ikkita yangi jadval.

-- 2.3: idempotent refund guard — bir Generation IKKI marta refund qilinmasin.
-- Default false => barcha mavjud yozuvlar hali "refund qilinmagan" (xavfsiz).
ALTER TABLE "Generation" ADD COLUMN "refunded" BOOLEAN NOT NULL DEFAULT false;

-- 2.6: kredit consume/refund harakatlari uchun moliyaviy izi.
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationId" TEXT,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balanceAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditLedger_userId_idx" ON "CreditLedger"("userId");
CREATE INDEX "CreditLedger_generationId_idx" ON "CreditLedger"("generationId");
CREATE INDEX "CreditLedger_createdAt_idx" ON "CreditLedger"("createdAt");

-- 2.6: gen provayderga yuborilganda narx tahlili uchun izi.
CREATE TABLE "ProviderSpend" (
    "id" TEXT NOT NULL,
    "generationId" TEXT,
    "provider" TEXT NOT NULL,
    "modelId" INTEGER,
    "mode" TEXT,
    "credits" INTEGER,
    "estimatedCostUsd" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderSpend_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderSpend_generationId_idx" ON "ProviderSpend"("generationId");
CREATE INDEX "ProviderSpend_provider_idx" ON "ProviderSpend"("provider");
CREATE INDEX "ProviderSpend_createdAt_idx" ON "ProviderSpend"("createdAt");
