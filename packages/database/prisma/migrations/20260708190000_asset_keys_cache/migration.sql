-- FAZA 5 (A2): S3 asset kalitlari keshi — listing S3'ga chiqmasin (N+1 fix). Additive.
ALTER TABLE "ContributorTemplate" ADD COLUMN "assetKeysJson" JSONB;
