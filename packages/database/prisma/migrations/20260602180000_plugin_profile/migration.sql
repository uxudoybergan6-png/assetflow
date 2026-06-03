-- CreateEnum
CREATE TYPE "PluginPlanTier" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "PluginAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'REMOVED');

-- CreateTable
CREATE TABLE "PluginProfile" (
    "userId" TEXT NOT NULL,
    "plan" "PluginPlanTier" NOT NULL DEFAULT 'FREE',
    "status" "PluginAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "downloadsTotal" INTEGER NOT NULL DEFAULT 0,
    "downloadsMonth" INTEGER NOT NULL DEFAULT 0,
    "importsTotal" INTEGER NOT NULL DEFAULT 0,
    "monthResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "deviceLabel" TEXT,
    "aeVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "PluginProfile_status_idx" ON "PluginProfile"("status");

-- CreateIndex
CREATE INDEX "PluginProfile_plan_idx" ON "PluginProfile"("plan");

-- AddForeignKey
ALTER TABLE "PluginProfile" ADD CONSTRAINT "PluginProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
