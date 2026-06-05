-- Demo shablonlar faylsiz — plugin katalogida chalkashlikni oldini olish
UPDATE "ContributorTemplate"
SET published = false
WHERE "externalId" IN ('demo-kinetic-titles', 'demo-logo-reveal');
