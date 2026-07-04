-- Bosqich 4 #1 — REAL download/import tracking. ADDITIVE only, NON-destructive.
-- Bitta yangi jadval + indekslar. Hech qanday DROP / mavjud ustunga tegish yo'q.
-- Forgeable ContributorTemplate.downloadsCount/importsCount Int hisoblagich o'rniga
-- HAR yuklab olish/import uchun atomik hodisa qatori (o'lik `Download` modelidan farqli).

CREATE TABLE "TemplateDownloadEvent" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'download',
    "source" TEXT NOT NULL DEFAULT 'plugin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateDownloadEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TemplateDownloadEvent_templateId_idx" ON "TemplateDownloadEvent"("templateId");
CREATE INDEX "TemplateDownloadEvent_userId_idx" ON "TemplateDownloadEvent"("userId");
CREATE INDEX "TemplateDownloadEvent_contributorId_idx" ON "TemplateDownloadEvent"("contributorId");
CREATE INDEX "TemplateDownloadEvent_createdAt_idx" ON "TemplateDownloadEvent"("createdAt");
CREATE INDEX "TemplateDownloadEvent_templateId_kind_idx" ON "TemplateDownloadEvent"("templateId", "kind");
