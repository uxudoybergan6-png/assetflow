-- FAZA 4 (B) — dunning/risk holati (additive, null = sog'lom)
ALTER TABLE "PluginProfile" ADD COLUMN "billingIssue" TEXT;
ALTER TABLE "PluginProfile" ADD COLUMN "billingIssueAt" TIMESTAMP(3);
