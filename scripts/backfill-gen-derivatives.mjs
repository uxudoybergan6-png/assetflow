#!/usr/bin/env node
/**
 * P9 / P9.2 — MAVJUD generatsiyalar uchun display (1280 WebP) + preview (720p)
 * derivativlarini backfill qiladi (eski gen'lar "soft" ko'rinmasin).
 *
 * Idempotent, kredit/billing'ga ALOQASIZ. ffmpeg + S3 (R2/GCS) env kerak.
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-gen-derivatives.mjs      # faqat hisobot
 *   DRY_RUN=0 node scripts/backfill-gen-derivatives.mjs      # yozadi
 *   LIMIT=50 DRY_RUN=0 node scripts/backfill-gen-derivatives.mjs   # partiya
 *
 * Eslatma: bu skript LOKAL/dev DB uchun; production'da uni Cloud Run muhitida
 * (S3 + DB env bilan) yoki bir martalik job sifatida ishga tushiring.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "apps/api/.env") });
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { diagnoseDerivatives, backfillDerivatives } = await import(
  "../apps/api/dist/lib/backfill-derivatives.js"
);

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = Math.max(1, Number(process.env.LIMIT) || 2000);

console.log("— Diagnoz (oldin) —");
const before = await diagnoseDerivatives();
console.log(`  Rasm: jami=${before.images.total}, display kerak=${before.images.needDisplay}, o'lcham kerak=${before.images.needDims}`);
console.log(`  Video: jami=${before.videos.total}, preview kerak=${before.videos.needPreview}, o'lcham kerak=${before.videos.needDims}`);

const r = await backfillDerivatives({ limit: LIMIT, dryRun: DRY_RUN });
console.log(`\n— Backfill (dryRun=${r.dryRun}) —`);
console.log(`  ko'rildi=${r.scanned}, display=${r.displayMade}, preview=${r.previewMade}, poster=${r.posterMade}, o'lcham=${r.dimsFilled}, o'tkazildi=${r.skipped}, xato=${r.failed}, qolgan=${r.remaining}`);

if (DRY_RUN) {
  console.log("\nDRY_RUN=1 — hech narsa yozilmadi. Haqiqiy: DRY_RUN=0 node scripts/backfill-gen-derivatives.mjs");
}

await prisma.$disconnect();
process.exit(0);
