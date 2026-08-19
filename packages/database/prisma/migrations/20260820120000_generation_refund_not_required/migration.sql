-- `not_required` marks terminal failures that never consumed credits. The API uses
-- it to keep refund reconciliation finite and to allow safely deleting settled
-- sessions. Expand the existing invariant without weakening any other status.
ALTER TABLE "Generation"
  DROP CONSTRAINT IF EXISTS "Generation_refundStatus_valid";

ALTER TABLE "Generation"
  ADD CONSTRAINT "Generation_refundStatus_valid"
  CHECK ("refundStatus" IS NULL OR "refundStatus" IN ('pending', 'applied', 'not_required'));
