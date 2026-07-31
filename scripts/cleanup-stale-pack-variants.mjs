#!/usr/bin/env node
/**
 * #17 (T3.3) — MAVJUD yozuvlar uchun bir martalik tozalash: pack kengaytmasi
 * almashganda (masalan `.zip` → `.aep`) eski obyekt bulutda qolib ketardi va
 * `resolveS3AssetKey` tartibi bo'yicha ESKI fayl serve qilinardi (DB `.aep`
 * desa ham foydalanuvchi eski `.zip` baytlarini olardi). Yangi kod yozish
 * paytida o'zi tozalaydi — bu skript tarixiy qatorlar uchun.
 *
 * XAVFSIZLIK: DB'dagi `fileName` kaliti bulutda MAVJUD bo'lgandagina eski
 * variantlar o'chiriladi. Mos kelmasa (yagona obyekt boshqa kengaytmada)
 * FAQAT hisobot beriladi — hech narsa o'chirilmaydi.
 *
 * DRY_RUN=1 (default) — faqat hisobot; DRY_RUN=0 — o'chiradi.
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/cleanup-stale-pack-variants.mjs
 *   DRY_RUN=0 node scripts/cleanup-stale-pack-variants.mjs
 * Ixtiyoriy: LIMIT=5000, CONCURRENCY=4.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { syncTemplateAssetKeys } = await import("../apps/api/dist/lib/asset-state.js");
const { isS3Configured, listTemplateS3Keys, s3KeysForAsset, s3UploadKeyForFile, deleteS3Objects } =
  await import("../apps/api/dist/lib/s3.js");
// #96 (PL-d): hosila zip bilan uning sha256 yon-obyekti DOIM birga o'chiriladi.
const { packDownloadCacheKeys } = await import("../apps/api/dist/lib/serve-asset.js");

const DRY_RUN = process.env.DRY_RUN !== "0";
const LIMIT = Math.max(1, Number(process.env.LIMIT) || 5000);
const CONCURRENCY = Math.min(16, Math.max(1, Number(process.env.CONCURRENCY) || 4));

if (!isS3Configured()) {
  console.error("✗ Storage sozlanmagan (AWS_*/S3_ENDPOINT yo'q).");
  process.exit(1);
}

const rows = await prisma.contributorTemplate.findMany({
  where: { fileName: { not: null } },
  select: { id: true, name: true, fileName: true },
  orderBy: { updatedAt: "desc" },
  take: LIMIT,
});
console.log(`Tekshiriladi: ${rows.length} shablon (fileName bor)`);

let stalePacks = 0;
let cleaned = 0;
let mismatch = 0;

let next = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= rows.length) return;
      const t = rows[i];
      let keys;
      try {
        keys = await listTemplateS3Keys(t.id);
      } catch (e) {
        console.warn(`  ! LIST xato (${t.id}):`, e?.message || e);
        continue;
      }
      const expected = s3UploadKeyForFile(t.id, "pack", t.fileName);
      const variants = s3KeysForAsset(t.id, "pack").filter((k) => keys.has(k));
      if (!keys.has(expected)) {
        if (variants.length) {
          mismatch++;
          console.log(
            `  ? MOS EMAS ${t.id} — DB: ${t.fileName} (${expected}) yo'q, bulutda: ${variants.join(", ")}`
          );
        }
        continue;
      }
      const stale = variants.filter((k) => k !== expected);
      if (!stale.length) continue;
      stalePacks++;
      console.log(`  · ${t.id} "${t.name}" → saqlanadi ${expected}; eski: ${stale.join(", ")}`);
      if (DRY_RUN) continue;
      await syncTemplateAssetKeys(t.id, { ensure: [expected], prune: { pack: expected } });
      // Eski `.aep→.zip` yuklab olish keshi ham eski mazmunga ishora qiladi.
      await deleteS3Objects(packDownloadCacheKeys(t.id)).catch(() => {});
      cleaned++;
    }
  })
);

console.log(
  `\n${DRY_RUN ? "(DRY_RUN) " : ""}Eski variantli shablon: ${stalePacks} · tozalandi: ${cleaned} · DB↔bulut mos emas: ${mismatch}`
);
if (DRY_RUN && stalePacks) {
  console.log("O'chirish uchun: DRY_RUN=0 node scripts/cleanup-stale-pack-variants.mjs");
}
await prisma.$disconnect();
