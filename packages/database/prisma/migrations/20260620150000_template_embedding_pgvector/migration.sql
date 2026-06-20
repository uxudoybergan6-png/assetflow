-- #11 (C1) Semantik qidiruv: in-memory cosine → pgvector (HNSW).
-- FAQAT ADDITIVE. Neon pgvector'ni qo'llaydi. preDeployCommand (#7) orqali GATED:
-- agar CREATE EXTENSION FAIL bo'lsa, deploy to'xtaydi, eski kod ishlayveradi.

-- 1) pgvector extension (Neon allowlist'da mavjud)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) bge-m3 = 1024-dim vektor ustuni (nullable; eski embedding JSONB SAQLANADI)
ALTER TABLE "ContributorTemplate" ADD COLUMN IF NOT EXISTS "embeddingVec" vector(1024);

-- 3) HNSW indeks — cosine masofa (1 - cosine_similarity) operatori <=>
CREATE INDEX IF NOT EXISTS "ContributorTemplate_embeddingVec_hnsw_idx"
  ON "ContributorTemplate" USING hnsw ("embeddingVec" vector_cosine_ops);
