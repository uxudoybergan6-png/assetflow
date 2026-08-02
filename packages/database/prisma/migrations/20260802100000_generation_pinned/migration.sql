-- D6 — gen natijasini "qadash": qadalganlar ro'yxatlarda DOIM birinchi chiqadi.
-- Additive: NOT NULL + DEFAULT false → mavjud qatorlar o'zgarmaydi, pul zonasiga tegmaydi.
ALTER TABLE "Generation" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- (userId, pinned, createdAt) — "qadalganlar avval, keyin yangilari" saralashi indeksdan o'qiydi.
CREATE INDEX "Generation_userId_pinned_createdAt_idx" ON "Generation"("userId", "pinned", "createdAt");
