-- CreateTable
CREATE TABLE "PluginDeviceCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pluginToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginDeviceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PluginDeviceCode_code_key" ON "PluginDeviceCode"("code");

-- CreateIndex
CREATE INDEX "PluginDeviceCode_expiresAt_idx" ON "PluginDeviceCode"("expiresAt");
