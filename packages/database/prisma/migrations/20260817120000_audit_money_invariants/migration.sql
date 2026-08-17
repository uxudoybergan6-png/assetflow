-- Webhook processing is retryable after transient failures.
ALTER TABLE "WebhookEvent"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

UPDATE "WebhookEvent"
SET "status" = 'succeeded', "processedAt" = "createdAt"
WHERE "status" = 'processing';

ALTER TABLE "Generation"
  ADD COLUMN "refundStatus" TEXT,
  ADD COLUMN "refundApplied" INTEGER NOT NULL DEFAULT 0;

UPDATE "Generation"
SET "refundStatus" = 'applied', "refundApplied" = "cost"
WHERE "refunded" = TRUE;

ALTER TABLE "PluginProfile"
  ADD CONSTRAINT "PluginProfile_aiCredits_nonnegative" CHECK ("aiCredits" >= 0),
  ADD CONSTRAINT "PluginProfile_aiCreditsTopup_nonnegative" CHECK ("aiCreditsTopup" >= 0),
  ADD CONSTRAINT "PluginProfile_topup_within_balance" CHECK ("aiCreditsTopup" <= "aiCredits"),
  ADD CONSTRAINT "PluginProfile_activeGenerations_nonnegative" CHECK ("activeGenerations" >= 0),
  ADD CONSTRAINT "PluginProfile_downloads_nonnegative" CHECK ("downloadsTotal" >= 0 AND "downloadsMonth" >= 0),
  ADD CONSTRAINT "PluginProfile_imports_nonnegative" CHECK ("importsTotal" >= 0 AND "importsMonth" >= 0);

ALTER TABLE "Generation"
  ADD CONSTRAINT "Generation_cost_nonnegative" CHECK ("cost" >= 0),
  ADD CONSTRAINT "Generation_refundApplied_valid" CHECK ("refundApplied" >= 0 AND "refundApplied" <= "cost"),
  ADD CONSTRAINT "Generation_status_valid" CHECK ("status" IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  ADD CONSTRAINT "Generation_refundStatus_valid" CHECK ("refundStatus" IS NULL OR "refundStatus" IN ('pending', 'applied'));

ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT "WebhookEvent_status_valid" CHECK ("status" IN ('processing', 'succeeded', 'failed')),
  ADD CONSTRAINT "WebhookEvent_attempts_positive" CHECK ("attempts" > 0);
