-- Stock kengayishi S1 (ADDITIVE) — ContributorTemplate'ga mahsulot turi ustunlari.
-- kind: 'template' | 'stock'; stockType: 'video'|'music'|'sfx'|'photo' (faqat stock);
-- templateType: 'video-templates'|'motion-graphics'|'graphics'|'luts' (web pill'lari).
-- Eski qatorlar default bilan template/video-templates bo'lib qoladi — xulq buzilmaydi.
ALTER TABLE "ContributorTemplate" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'template';
ALTER TABLE "ContributorTemplate" ADD COLUMN "stockType" TEXT;
ALTER TABLE "ContributorTemplate" ADD COLUMN "templateType" TEXT NOT NULL DEFAULT 'video-templates';
