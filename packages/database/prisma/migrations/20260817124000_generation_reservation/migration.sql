ALTER TABLE "Generation" ADD COLUMN "idempotencyHash" TEXT;
ALTER TABLE "Generation" DROP CONSTRAINT IF EXISTS "Generation_status_valid";
ALTER TABLE "Generation"
  ADD CONSTRAINT "Generation_status_valid" CHECK ("status" IN ('reserving', 'queued', 'running', 'done', 'failed', 'cancelled'));
