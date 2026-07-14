#!/usr/bin/env node
/**
 * P1 (owner qarori 2026-07-14) — MAVJUD stock previewlarni TOZA PAST-RES qilib qayta yaratadi
 * (eski SUV BELGILI preview/thumb obyektlarini ustiga yozadi). Suv belgisi (logo/sting) endi
 * ishlatilmaydi; DRM = rezolyutsiya/bitrate (video ≤720p, rasm ≤1280px, audio 96k). To'liq
 * sifat asl `pack` da private qoladi.
 *
 *   (a) STOCK preview/thumb — generateStockWatermarkedDerivatives(id) TOZA past-res qayta yozadi.
 *   (b) AI-GEN asl fayllar — HECH QANDAY o'zgarish shart emas (server endi watermarkKey bermaydi;
 *       asl toza fayl allaqachon o'z joyida). Bu skript AI-genga TEGMAYDI.
 *
 * Idempotent, kredit/billing'ga ALOQASIZ. ffmpeg + S3 (R2/GCS) env kerak. AVVAL build:
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-clean-previews.mjs          # faqat ro'yxat (default)
 *   DRY_RUN=0 node scripts/backfill-clean-previews.mjs          # qayta yozadi (owner qo'lda)
 *   DRY_RUN=0 ALL=1 node scripts/backfill-clean-previews.mjs    # nashr etilmaganlarni ham
 *   DRY_RUN=0 node scripts/backfill-clean-previews.mjs <id> ... # aniq itemlar
 *
 * Eslatma: production'da Cloud Run muhitida (S3 + DB env bilan) bir martalik job sifatida.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "apps/api/.env") });
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { isS3Configured } = await import("../apps/api/dist/lib/s3.js");
const { generateStockWatermarkedDerivatives } = await import(
  "../apps/api/dist/lib/stock-derivatives.js"
);

const DRY_RUN = process.env.DRY_RUN !== "0"; // default: dry-run (owner runs manually)
const ALL = process.env.ALL === "1";
const idArgs = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));

if (!isS3Configured()) {
  console.error("S3/GCS sozlanmagan (AWS_S3_BUCKET/AWS_ACCESS_KEY_ID) — backfill ma'nosiz.");
  process.exit(1);
}

const rows = idArgs.length
  ? await prisma.contributorTemplate.findMany({
      where: { id: { in: idArgs }, kind: "stock" },
      select: { id: true, stockType: true, name: true },
    })
  : await prisma.contributorTemplate.findMany({
      where: ALL ? { kind: "stock" } : { kind: "stock", published: true },
      select: { id: true, stockType: true, name: true },
      orderBy: { createdAt: "asc" },
    });

console.log(
  `\n=== P1 stock TOZA past-res preview backfill ===\n` +
    `${rows.length} ta stock item (${idArgs.length ? "argument" : ALL ? "ALL" : "faqat nashr etilgan"})` +
    `${DRY_RUN ? " — DRY_RUN (o'zgarish yo'q)" : ""}\n`
);

let ok = 0;
let fail = 0;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const tag = `[${i + 1}/${rows.length}] ${r.id} (${r.stockType || "?"}) ${r.name || ""}`.trim();
  if (DRY_RUN) {
    console.log(`${tag} — (dry) qayta yoziladi`);
    continue;
  }
  try {
    const done = await generateStockWatermarkedDerivatives(r.id);
    if (done) {
      ok++;
      console.log(`${tag} — ✓ toza past-res preview yozildi`);
    } else {
      fail++;
      console.warn(`${tag} — ⚠ o'tkazib yuborildi (pack yo'q / stock emas)`);
    }
  } catch (e) {
    fail++;
    console.error(`${tag} — ✗ ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (DRY_RUN) {
  console.log(`\nDRY_RUN=1 — hech narsa yozilmadi. Haqiqiy: DRY_RUN=0 node scripts/backfill-clean-previews.mjs`);
} else {
  console.log(`\nTayyor: ${ok} ✓ / ${fail} ⚠✗`);
}

await prisma.$disconnect();
process.exit(0);
