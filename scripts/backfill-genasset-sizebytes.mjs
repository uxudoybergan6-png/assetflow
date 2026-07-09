#!/usr/bin/env node
/**
 * PROBLEM 7 — "Storage (AI results)" kam ko'rsatilishi: tarixiy GenAsset/
 * SavedReference qatorlarida sizeBytes null (ustun 2026-07-05 migratsiyasida
 * qo'shilgan) → kvota yig'indisида 0 deb hisoblanadi.
 *
 * Bu skript LOKAL/dev DB uchun; production'da Cloud Run ichidagi admin endpoint
 * ishlatiladi: GET /api/admin/maintenance/gen-sizebytes (diagnoz) +
 * POST /api/admin/maintenance/gen-sizebytes/backfill (tuzatish).
 *
 * Idempotent: faqat sizeBytes null/0 qatorlar; resultKey bor → storage
 * HeadObject haqiqiy hajmi, data-URI → base64'dan baholash. Kredit/billing'ga
 * ALOQASIZ.
 *
 * DRY_RUN=1 (default) — faqat hisobot; DRY_RUN=0 — yozadi.
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-genasset-sizebytes.mjs
 *   DRY_RUN=0 node scripts/backfill-genasset-sizebytes.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { diagnoseSizeBytes, backfillSizeBytes } = await import(
  "../apps/api/dist/lib/backfill-sizebytes.js"
);

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = Math.max(1, Number(process.env.LIMIT) || 5000);
const fmtMB = (b) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

console.log("— Diagnoz (oldin) —");
const before = await diagnoseSizeBytes();
for (const r of before.genAssets) {
  console.log(
    `  GenAsset type=${r.type}: jami=${r.total}, null/0=${r.nullOrZero}, backfill mumkin=${r.backfillable}, hisoblangan=${fmtMB(r.summedBytes)}`
  );
}
const sr = before.savedReferences;
console.log(`  SavedReference: jami=${sr.total}, null/0=${sr.nullOrZero}, backfill mumkin=${sr.backfillable}, hisoblangan=${fmtMB(sr.summedBytes)}`);

const result = await backfillSizeBytes({ limit: LIMIT, dryRun: DRY_RUN });
console.log(`\n— Backfill (dryRun=${result.dryRun}) —`);
console.log(`  ko'rildi=${result.scanned}, HeadObject'dan=${result.updated}, data-URI baholandi=${result.estimated}, topilmadi=${result.missing}`);
console.log(`  qo'shilgan hajm=${fmtMB(result.addedBytes)}, qolgan null/0=${result.remaining}`);

if (!DRY_RUN) {
  console.log("\n— Diagnoz (keyin) —");
  const after = await diagnoseSizeBytes();
  for (const r of after.genAssets) {
    console.log(
      `  GenAsset type=${r.type}: jami=${r.total}, null/0=${r.nullOrZero}, hisoblangan=${fmtMB(r.summedBytes)}`
    );
  }
  const sa = after.savedReferences;
  console.log(`  SavedReference: jami=${sa.total}, null/0=${sa.nullOrZero}, hisoblangan=${fmtMB(sa.summedBytes)}`);
} else {
  console.log("\nDRY_RUN=1 — hech narsa yozilmadi. Haqiqiy tuzatish: DRY_RUN=0 node scripts/backfill-genasset-sizebytes.mjs");
}

await prisma.$disconnect();
process.exit(0);
