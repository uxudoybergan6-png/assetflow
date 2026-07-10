-- Audit §C (ADDITIVE) — PlanConfig.active: admin "Active" toggle'i endi saqlanadi.
ALTER TABLE "PlanConfig" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
