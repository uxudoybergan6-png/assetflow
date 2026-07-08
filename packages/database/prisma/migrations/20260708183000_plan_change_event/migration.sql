-- FAZA 4 (D) — plan o'zgarishi hodisalari (churn/conversion metrikalari, additive)
CREATE TABLE "PlanChangeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromPlan" TEXT NOT NULL,
    "toPlan" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'billing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChangeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanChangeEvent_userId_idx" ON "PlanChangeEvent"("userId");
CREATE INDEX "PlanChangeEvent_createdAt_idx" ON "PlanChangeEvent"("createdAt");
CREATE INDEX "PlanChangeEvent_toPlan_idx" ON "PlanChangeEvent"("toPlan");
