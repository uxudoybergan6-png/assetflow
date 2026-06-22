-- Per-template Pro/Free tier (catalog) — ADDITIVE only, NON-destructive.
-- Default false => barcha mavjud shablonlar FREE bo'lib qoladi (xavfsiz).
-- Admin per-shablon PRO ni PATCH /api/contributor/templates/:id { isPro: true } orqali belgilaydi.
ALTER TABLE "ContributorTemplate" ADD COLUMN "isPro" BOOLEAN NOT NULL DEFAULT false;
