-- FAZA 2 (H1/M7) — TemplateDownloadEvent earning dedup.
-- Attribution per (userId, templateId, kind): qayta yuklab olish BITTA earning beradi.
-- Oylik download LIMITI (PluginProfile.consumeDownload) ALOHIDA — bu constraint unga tegmaydi.
--
-- ADDITIVE + xavfsiz: unique index qo'yishdan OLDIN mavjud dublikatlarni tozalaymiz
-- (eng ESKI qatorni saqlab qolamiz — dastlabki earning shu qatorga bog'langan).
DELETE FROM "TemplateDownloadEvent" a
USING "TemplateDownloadEvent" b
WHERE a."userId" = b."userId"
  AND a."templateId" = b."templateId"
  AND a."kind" = b."kind"
  AND (a."createdAt" > b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

CREATE UNIQUE INDEX "TemplateDownloadEvent_userId_templateId_kind_key"
  ON "TemplateDownloadEvent" ("userId", "templateId", "kind");
