-- FAZA 4 (A) — RevenueEvent: real daromad hisobi (additive, hech narsani o'zgartirmaydi)
CREATE TABLE "RevenueEvent" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "plan" TEXT,
    "grossCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lsOrderId" TEXT,
    "lsSubscriptionId" TEXT,
    "lsInvoiceId" TEXT,
    "eventName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueEvent_sourceKey_key" ON "RevenueEvent"("sourceKey");
CREATE INDEX "RevenueEvent_userId_idx" ON "RevenueEvent"("userId");
CREATE INDEX "RevenueEvent_kind_idx" ON "RevenueEvent"("kind");
CREATE INDEX "RevenueEvent_occurredAt_idx" ON "RevenueEvent"("occurredAt");
