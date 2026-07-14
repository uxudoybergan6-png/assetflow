/**
 * P4 — bir martalik backfill: mavjud NASHR ETILGAN stock (kind='stock') itemlar uchun
 * SUV BELGILI preview/thumb derivativlarini TOZA pack'dan qayta yaratadi. Video shablonlar
 * (kind='template') TEGILMAYDI (owner qarori — ular render, mahsulot emas). Idempotent:
 * qayta ishga tushirsa derivativni qayta yozadi va toza sibling'larni o'chiradi.
 *
 * Bugungi holatda nashr etilgan stock ~0 → arzon; lekin AI Stock hajmda kelganda kerak
 * (P4 talabi). Suv belgili derivativ ffmpeg talab qiladi → env'da ffmpeg + S3 kredit shart
 * (API bilan bir xil: DATABASE_URL + AWS_* + S3_ENDPOINT + AWS_S3_BUCKET).
 *
 * Ishga tushirish:
 *   npm run build -w apps/api && node apps/api/dist/scripts/backfill-stock-watermarks.js
 *   node apps/api/dist/scripts/backfill-stock-watermarks.js --all   # nashr etilmaganlarni ham
 *   node apps/api/dist/scripts/backfill-stock-watermarks.js <id> [<id> ...]  # aniq itemlar
 *   DRY_RUN=1 node apps/api/dist/scripts/backfill-stock-watermarks.js       # faqat ro'yxat
 */
import { prisma } from "@creative-tools/database";
import { isS3Configured } from "../lib/s3.js";
import { generateStockWatermarkedDerivatives } from "../lib/stock-derivatives.js";

async function main() {
  if (!isS3Configured()) {
    console.error("S3/GCS sozlanmagan (AWS_S3_BUCKET/AWS_ACCESS_KEY_ID) — backfill ma'nosiz.");
    process.exit(1);
  }
  // P1 (owner 2026-07-14): stock preview endi TOZA past-res — suv belgisi png shart emas.
  const dryRun = process.env.DRY_RUN === "1";
  const idArgs = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
  const all = process.argv.includes("--all");

  const rows = idArgs.length
    ? await prisma.contributorTemplate.findMany({
        where: { id: { in: idArgs }, kind: "stock" },
        select: { id: true, stockType: true, name: true },
      })
    : await prisma.contributorTemplate.findMany({
        where: all ? { kind: "stock" } : { kind: "stock", published: true },
        select: { id: true, stockType: true, name: true },
        orderBy: { createdAt: "asc" },
      });

  console.log(
    `\n=== P4 stock suv belgisi backfill ===\n` +
      `${rows.length} ta stock item (${idArgs.length ? "argument" : all ? "--all" : "faqat nashr etilgan"})` +
      `${dryRun ? " — DRY_RUN (o'zgarish yo'q)" : ""}\n`
  );
  if (!rows.length) {
    console.log("Ishlanadigan stock item yo'q.");
    return;
  }

  let ok = 0;
  let fail = 0;
  // KETMA-KET (ffmpeg og'ir — semaphore baribir cheklaydi; bu yerda xotira/download ni ham cheklaymiz).
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tag = `[${i + 1}/${rows.length}] ${r.id} (${r.stockType || "?"}) ${r.name || ""}`.trim();
    if (dryRun) {
      console.log(`${tag} — (dry) o'tkazib yuborildi`);
      continue;
    }
    try {
      const done = await generateStockWatermarkedDerivatives(r.id);
      if (done) {
        ok++;
        console.log(`${tag} — ✓ suv belgili derivativ yaratildi`);
      } else {
        fail++;
        console.warn(`${tag} — ⚠ o'tkazib yuborildi (pack yo'q / stock emas / suv belgisi yo'q)`);
      }
    } catch (e) {
      fail++;
      console.error(`${tag} — ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\nTayyor: ${ok} ✓ / ${fail} ⚠✗`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("\nXATO:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
