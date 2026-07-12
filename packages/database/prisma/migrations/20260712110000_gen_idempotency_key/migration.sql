-- Idempotentlik kaliti (P18) — POST /gen qayta yuborilganda ikkinchi charge/job bo'lmasin.
-- Additive: yangi nullable ustun + unique (userId, idempotencyKey). Postgres unique NULL'ni
-- distinct sanaydi → mavjud (NULL) qatorlar to'qnashmaydi. Money-zone TEGMAYDI.
ALTER TABLE "Generation" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Generation_userId_idempotencyKey_key" ON "Generation"("userId", "idempotencyKey");
