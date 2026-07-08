/**
 * FAZA 5 (A2) — bir martalik backfill: barcha ContributorTemplate uchun S3 kalitlari
 * keshini (assetKeysJson) to'ldiradi. Kesh null bo'lganlar keyingi katalog o'qishida
 * o'zini lazy to'ldiradi, lekin katta katalogda birinchi so'rov sekin bo'lmasin deb
 * oldindan yuritish tavsiya etiladi.
 *
 * Ishga tushirish (env — API bilan bir xil: DATABASE_URL + AWS_* + S3_ENDPOINT):
 *   npm run build -w apps/api && node apps/api/dist/scripts/backfill-asset-keys.js
 *   node apps/api/dist/scripts/backfill-asset-keys.js --all   # mavjud keshni ham qayta yozadi
 */
import { prisma, Prisma } from "@creative-tools/database";
import { isS3Configured } from "../lib/s3.js";
import { syncTemplateAssetKeys } from "../lib/asset-state.js";

const CONCURRENCY = 5;

async function main() {
  if (!isS3Configured()) {
    console.error("S3/GCS sozlanmagan (AWS_S3_BUCKET/AWS_ACCESS_KEY_ID) — backfill ma'nosiz.");
    process.exit(1);
  }
  const all = process.argv.includes("--all");
  const rows = await prisma.contributorTemplate.findMany({
    where: all ? {} : { assetKeysJson: { equals: Prisma.DbNull } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Backfill: ${rows.length} ta shablon (${all ? "--all" : "faqat kesh yo'qlar"})`);
  let done = 0;
  let failed = 0;
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const row = queue.shift();
        if (!row) return;
        const keys = await syncTemplateAssetKeys(row.id);
        if (keys) done++;
        else failed++;
        if ((done + failed) % 50 === 0) {
          console.log(`  ${done + failed}/${rows.length} (xato: ${failed})`);
        }
      }
    })
  );
  console.log(`Tugadi: ${done} ok, ${failed} xato.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
