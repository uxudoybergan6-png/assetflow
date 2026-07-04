-- Bosqich 4 #3 — Contributor payout / earnings. ADDITIVE only, NON-destructive.
-- Ikkita yangi jadval + indekslar. Hech qanday DROP / mavjud ustunga tegish yo'q.
-- Earning grant idempotent (downloadEventId UNIQUE) + hech qachon manfiy emas.

CREATE TABLE "ContributorEarning" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "downloadEventId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributorEarning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContributorEarning_downloadEventId_key" ON "ContributorEarning"("downloadEventId");
CREATE INDEX "ContributorEarning_contributorId_idx" ON "ContributorEarning"("contributorId");
CREATE INDEX "ContributorEarning_payoutId_idx" ON "ContributorEarning"("payoutId");
CREATE INDEX "ContributorEarning_templateId_idx" ON "ContributorEarning"("templateId");
CREATE INDEX "ContributorEarning_createdAt_idx" ON "ContributorEarning"("createdAt");

CREATE TABLE "ContributorPayout" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributorPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContributorPayout_contributorId_idx" ON "ContributorPayout"("contributorId");
CREATE INDEX "ContributorPayout_status_idx" ON "ContributorPayout"("status");
CREATE INDEX "ContributorPayout_createdAt_idx" ON "ContributorPayout"("createdAt");
