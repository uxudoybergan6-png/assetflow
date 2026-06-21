#!/usr/bin/env node
/**
 * #11 backfill — eski shablonlarning `embeddingVec` (pgvector) ustunini to'ldiradi.
 *
 * Ko'p shablonda allaqachon `embedding` (JSON float[]) bor, lekin migratsiyadan
 * OLDIN yaratilgani uchun `embeddingVec` (vector(1024)) NULL. Workers AI ni QAYTA
 * chaqirmasdan (qimmat/sekin), mavjud JSON'ni '[n,n,...]'::vector literaliga
 * aylantirib UPDATE qiladi. embedding YO'Q bo'lganlar bu yerda QAMRALMAYDI —
 * ular uchun admin `POST /api/plugin/ai/reindex` (Workers AI) alohida ishlaydi.
 *
 * Xususiyatlar: idempotent (faqat embeddingVec IS NULL), xato-chidamli (bittasi
 * fail bo'lsa qolgani davom etadi), natijani loglaydi.
 *
 * Talab: migratsiya 20260620150000 prod'da qo'llangan (extension + embeddingVec).
 * Aks holda `::vector` cast har satrda xato beradi (skript exit 1).
 *
 * Ishlatish (QO'LDA — prod DB data operatsiyasi):
 *   DRY_RUN=1 npm run backfill:embedvec    # faqat nomzodlar sonini ko'rsatadi
 *   npm run backfill:embedvec              # haqiqiy backfill
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

/** number[] → pgvector literal '[n,n,...]' (injection-safe: faqat sonlar). */
function toVectorLiteral(vec) {
  const parts = vec.map((n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) throw new Error("embedding vektorida noto'g'ri qiymat");
    return x;
  });
  return `[${parts.join(",")}]`;
}

async function main() {
  // embedding(JSONB) bor, embeddingVec NULL — nomzodlar.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "embedding" FROM "ContributorTemplate" WHERE "embedding" IS NOT NULL AND "embeddingVec" IS NULL`
  );
  console.log(`Nomzodlar (embedding bor, embeddingVec NULL): ${rows.length}`);

  if (DRY_RUN) {
    console.log("DRY_RUN=1 — hech narsa yozilmadi.");
    await prisma.$disconnect();
    return;
  }

  let done = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    try {
      const emb = r.embedding; // JSONB → JS array
      if (!Array.isArray(emb) || emb.length === 0) { skipped++; continue; }
      const lit = toVectorLiteral(emb);
      await prisma.$executeRawUnsafe(
        `UPDATE "ContributorTemplate" SET "embeddingVec" = $1::vector WHERE "id" = $2`,
        lit,
        r.id
      );
      done++;
    } catch (e) {
      failed++;
      console.warn(`  ✗ ${r.id}: ${e.message}`);
    }
  }
  console.log(
    `Backfill tugadi: ${done} to'ldirildi, ${skipped} o'tkazib yuborildi (bo'sh), ${failed} xato (jami ${rows.length}).`
  );
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error("Backfill xato:", e);
  await prisma.$disconnect();
  process.exit(1);
});
