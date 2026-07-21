-- Task 2 — platformaga xos plagin installer artefaktlari (ADDITIVE).
-- Mavjud PluginRelease qatorlari (legacy .zxp) SAQLANADI: hech narsa o'chirilmaydi,
-- faqat downloadKey ixtiyoriy bo'ladi va yangi jadval qo'shiladi.

ALTER TABLE "PluginRelease" ALTER COLUMN "downloadKey" DROP NOT NULL;

CREATE TABLE "PluginInstaller" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PluginInstaller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginInstaller_releaseId_platform_key" ON "PluginInstaller"("releaseId", "platform");
CREATE INDEX "PluginInstaller_releaseId_idx" ON "PluginInstaller"("releaseId");

ALTER TABLE "PluginInstaller" ADD CONSTRAINT "PluginInstaller_releaseId_fkey"
    FOREIGN KEY ("releaseId") REFERENCES "PluginRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
