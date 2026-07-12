-- Katalog filtri indekslari (P7 #4 / P6 #6) — ADDITIVE, faqat CREATE INDEX.
-- Server-side filter (step 15) yozilishidan OLDIN kerak. Prefiks (published, reviewStatus)
-- barcha katalog so'rovlarida umumiy; keyin pill o'lchovlari; oxirida updatedAt (kursor).
CREATE INDEX "ct_pub_rev_kind_type_upd_idx" ON "ContributorTemplate"("published", "reviewStatus", "kind", "templateType", "updatedAt");
CREATE INDEX "ct_pub_rev_stock_upd_idx" ON "ContributorTemplate"("published", "reviewStatus", "stockType", "updatedAt");
CREATE INDEX "ct_pub_rev_app_upd_idx" ON "ContributorTemplate"("published", "reviewStatus", "templateApp", "updatedAt");
