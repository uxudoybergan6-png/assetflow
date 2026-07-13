/**
 * P4 (14b) — bir martalik backfill: bu o'zgarishdan OLDIN yaratilgan gen assetlar uchun
 * SUV BELGILI nusxa (`watermarkKey`) yaratadi. Yangi genlar buni EAGER (gen-processor'da)
 * oladi — bu skript faqat ESKI qatorlar uchun (ular hozircha FREE'ga kichik display fallback
 * beradi; backfill'dan keyin to'liq suv belgili yuklab olish).
 *
 * Idempotent: faqat watermarkKey=null qatorlarni ishlaydi. Asl TOZA fayl (resultKey) TEGILMAYDI.
 * ffmpeg + S3/GCS talab qiladi (API bilan bir xil env: DATABASE_URL + AWS_* + S3_ENDPOINT +
 * AWS_S3_BUCKET). Money-zone TEGILMAYDI (faqat yetkazish derivativi).
 *
 * Ishga tushirish:
 *   npm run build -w apps/api && node apps/api/dist/scripts/backfill-gen-watermarks.js
 *   DRY_RUN=1 node apps/api/dist/scripts/backfill-gen-watermarks.js    # faqat ro'yxat/sanoq
 *   LIMIT=200 node apps/api/dist/scripts/backfill-gen-watermarks.js    # bir yugurishda ko'pi bilan N
 */
import { prisma } from "@creative-tools/database";
import { isS3Configured } from "../lib/s3.js";
import { watermarkAssetAvailable } from "../lib/optimize-preview.js";
import { makeGenWatermarkFromKey, wmKindForAssetType } from "../lib/gen-watermark.js";

async function main() {
  if (!isS3Configured()) {
    console.error("S3/GCS sozlanmagan (AWS_S3_BUCKET/AWS_ACCESS_KEY_ID) — backfill ma'nosiz.");
    process.exit(1);
  }
  if (!watermarkAssetAvailable()) {
    console.error("Suv belgisi rasmi (apps/api/assets/watermark.png) topilmadi — backfill to'xtatildi.");
    process.exit(1);
  }
  const dryRun = process.env.DRY_RUN === "1";
  const limit = Math.max(0, Number(process.env.LIMIT) || 0); // 0 = cheksiz

  const where = { watermarkKey: null, resultKey: { not: null } } as const;
  const total = await prisma.genAsset.count({ where });
  console.log(`Suv belgisiz gen asset: ${total}${dryRun ? " (DRY_RUN — hech narsa yozilmaydi)" : ""}${limit ? `, LIMIT=${limit}` : ""}`);
  if (dryRun || total === 0) {
    process.exit(0);
  }

  let done = 0, made = 0, failed = 0;
  const batchSize = 25;
  // watermarkKey=null bo'yicha filtrlanadi — yozilgan qatorlar keyingi sahifada QAYTA chiqmaydi
  // (kursorsiz oddiy findMany take/loop; har iteratsiya yangi null'larni oladi).
  for (;;) {
    if (limit && done >= limit) break;
    const take = limit ? Math.min(batchSize, limit - done) : batchSize;
    const rows = await prisma.genAsset.findMany({
      where,
      select: { id: true, type: true, resultKey: true },
      orderBy: { createdAt: "asc" },
      take,
    });
    if (!rows.length) break;
    for (const r of rows) {
      done++;
      if (!r.resultKey) continue;
      const kind = wmKindForAssetType(r.type);
      const wmKey = await makeGenWatermarkFromKey(r.resultKey, kind);
      if (wmKey) {
        await prisma.genAsset.update({ where: { id: r.id }, data: { watermarkKey: wmKey } });
        made++;
        console.log(`  ✓ ${r.id} (${kind}) → ${wmKey}`);
      } else {
        failed++;
        console.warn(`  ✗ ${r.id} (${kind}) — suv belgili nusxa yaratilmadi (keyingi yugurishda qayta urinadi)`);
      }
    }
    console.log(`… ${done}/${total} (yaratildi ${made}, xato ${failed})`);
  }
  console.log(`Tugadi. Ishlangan ${done}, suv belgili nusxa yaratildi ${made}, xato ${failed}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
