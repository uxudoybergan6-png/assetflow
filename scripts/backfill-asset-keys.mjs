#!/usr/bin/env node
/**
 * #19 (T5.1) — `ContributorTemplate.assetKeysJson` bir martalik backfill.
 *
 * Nega: katalog o'qish yo'li endi HECH QACHON jonli S3 ListObjectsV2 qilmaydi
 * (asset-state.ts) — kesh yo'q qator fon navbatiga/reconciler'ga tushadi va
 * hasPack/hasPreview vaqtincha `false` ko'rinishi mumkin. Bu skript keshni bir
 * marta to'ldiradi, keyin fon ishi faqat yangi shablonlar uchun qoladi.
 *
 * Idempotent: FAQAT `assetKeysJson IS NULL` qatorlar; boshqa ustunga tegmaydi,
 * `updatedAt` bump BO'LMAYDI (persistTemplateAssetKeys raw SQL yozadi) →
 * katalog tartibi va cache-bust versiyasi o'zgarmaydi. Kredit/billing'ga aloqasiz.
 *
 * DRY_RUN=1 (default) — faqat nechta qator kutayotganini ko'rsatadi.
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-asset-keys.mjs
 *   DRY_RUN=0 node scripts/backfill-asset-keys.mjs
 * Ixtiyoriy: LIMIT=5000 (jami), BATCH=200 (bir o'qishda), CONCURRENCY=4 (S3 LIST).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { syncTemplateAssetKeys } = await import("../apps/api/dist/lib/asset-state.js");
const { isS3Configured } = await import("../apps/api/dist/lib/s3.js");

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = Math.max(1, Number(process.env.LIMIT) || 5000);
const BATCH = Math.min(1000, Math.max(1, Number(process.env.BATCH) || 200));
const CONCURRENCY = Math.min(16, Math.max(1, Number(process.env.CONCURRENCY) || 4));

if (!isS3Configured()) {
  console.error("✗ Storage sozlanmagan (AWS_*/S3_ENDPOINT yo'q) — backfill mumkin emas.");
  process.exit(1);
}

const pending = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS n FROM "ContributorTemplate" WHERE "assetKeysJson" IS NULL
`;
const total = pending?.[0]?.n ?? 0;
console.log(`assetKeysJson = NULL bo'lgan shablonlar: ${total}`);

if (DRY_RUN) {
  console.log(`\n(DRY_RUN — hech narsa yozilmadi. Yozish uchun: DRY_RUN=0 node scripts/backfill-asset-keys.mjs)`);
  await prisma.$disconnect();
  process.exit(0);
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await fn(items[i]);
      }
    })
  );
}

let done = 0;
let failed = 0;
let empty = 0;
/** Xato bergan id'lar — IS NULL bo'lib qolgani uchun cheksiz qayta o'qilmasin. */
const failedIds = new Set();

while (done + failed < LIMIT) {
  // Kursor kerak emas: to'ldirilgan qator keyingi o'qishda IS NULL shartiga
  // tushmaydi. Muvaffaqiyatsizlar cheksiz aylanmasin uchun ular ro'yxatdan
  // chiqarilib boriladi (skipIds).
  const take = Math.min(BATCH, LIMIT - done - failed);
  const rows = await prisma.$queryRaw`
    SELECT "id" FROM "ContributorTemplate"
    WHERE "assetKeysJson" IS NULL
    ORDER BY "updatedAt" DESC
    LIMIT ${take}
  `;
  const ids = rows.map((r) => r.id).filter((id) => !failedIds.has(id));
  if (!ids.length) break;

  await mapLimit(ids, CONCURRENCY, async (id) => {
    const keys = await syncTemplateAssetKeys(id);
    if (keys === null) {
      failed++;
      failedIds.add(id);
      return;
    }
    if (keys.size === 0) empty++;
    done++;
  });

  console.log(`  … ${done} to'ldirildi (bo'sh: ${empty}, xato: ${failed})`);
}

const after = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS n FROM "ContributorTemplate" WHERE "assetKeysJson" IS NULL
`;
console.log(
  `\n✓ To'ldirildi: ${done} (storage'da fayli yo'q: ${empty}) · xato: ${failed} · qolgan NULL: ${after?.[0]?.n ?? "?"}`
);
await prisma.$disconnect();
