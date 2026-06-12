-- Per-shablon haqiqiy statistika: AE plugin yuklab olish / import hisoblagichlari
ALTER TABLE "ContributorTemplate" ADD COLUMN "downloadsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContributorTemplate" ADD COLUMN "importsCount" INTEGER NOT NULL DEFAULT 0;
