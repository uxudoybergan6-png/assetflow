-- P11: plagin reliz kanali (ADDITIVE)
CREATE TABLE "PluginRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "downloadKey" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "minSupportedVersion" TEXT,
    "checksum" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "PluginRelease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PluginRelease_version_key" ON "PluginRelease"("version");
CREATE INDEX "PluginRelease_publishedAt_idx" ON "PluginRelease"("publishedAt");
