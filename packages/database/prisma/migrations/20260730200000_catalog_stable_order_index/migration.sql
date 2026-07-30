-- BATCH 3 · T3.4 — katalog BARQAROR tartibi uchun indeks (#53).
-- FAQAT ADDITIVE: ustun/jadval o'zgarmaydi.
--
-- Katalog default tartibi `updatedAt desc` dan `reviewedAt desc NULLS LAST,
-- createdAt desc, id desc` ga ko'chdi (bumpTemplateCounter `updatedAt` ni har
-- yuklab olishda ko'tarib kursor paginatsiyasini buzardi).
--
-- NULLS LAST'ni Prisma sxemasi ifodalay olmaydi (trigram/qisman indekslar kabi) →
-- bu indeks faqat shu yerda e'lon qilinadi. Ustunlar tartibi ORDER BY bilan
-- BIR XIL bo'lishi shart, aks holda planner external sort qiladi.
CREATE INDEX IF NOT EXISTS "ct_pub_rev_published_order_idx"
  ON "ContributorTemplate" (
    "published",
    "reviewStatus",
    "reviewedAt" DESC NULLS LAST,
    "createdAt" DESC,
    "id" DESC
  );
