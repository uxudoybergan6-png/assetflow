-- User.role indeksi (ADMIN/CONTRIBUTOR filtrlar uchun)
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- PluginProfile.lastSeenAt indeksi (faol foydalanuvchilar sortirovkasi)
CREATE INDEX IF NOT EXISTS "PluginProfile_lastSeenAt_idx" ON "PluginProfile"("lastSeenAt");

-- ContributorTemplate murakkab indeks (katalog query: reviewStatus+published+updatedAt)
CREATE INDEX IF NOT EXISTS "ContributorTemplate_reviewStatus_published_updatedAt_idx"
  ON "ContributorTemplate"("reviewStatus", "published", "updatedAt");
