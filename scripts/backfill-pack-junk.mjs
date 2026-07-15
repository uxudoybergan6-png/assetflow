#!/usr/bin/env node
/**
 * P35 — MAVJUD (nashr etilgan) zip pack'larda `metaJson.packJunkEntries`ni
 * TO'LDIRADI: muallif zipga qo'shgan preview/thumbnail marketing fayllari va OS
 * axlati (isMarketingJunkEntry). Aynan INGEST'dagi detektor + preview/thumb
 * tanlash (openStreamingIngestZip) qayta ishlatiladi — guess-free. Populatsiyadan
 * keyin server yuklab-olish nusxasidan (pack.dl.zip) shu entrylarni chiqaradi.
 *
 * TEGMAYDI: asl `pack.zip` (private, byte-bir-xil). Faqat metaJson maydoni +
 * eskirgan `templates/{id}/pack.dl.zip` keshini o'chiradi (keyingi yuklab olishda
 * yangi filtrlangan nusxa quriladi). Kredit/billing'ga ALOQASIZ, idempotent.
 *
 * AVVAL build: npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-pack-junk.mjs           # faqat ro'yxat (default)
 *   DRY_RUN=0 node scripts/backfill-pack-junk.mjs           # yozadi (owner qo'lda)
 *   DRY_RUN=0 ALL=1 node scripts/backfill-pack-junk.mjs     # nashr etilmaganlarni ham
 *   DRY_RUN=0 node scripts/backfill-pack-junk.mjs <id> ...  # aniq itemlar
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "apps/api/.env") });
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const {
  isS3Configured,
  resolveS3AssetKey,
  getS3ObjectMeta,
  readS3ObjectRange,
  createS3RangeStream,
  deleteS3Objects,
} = await import("../apps/api/dist/lib/s3.js");
const { openStreamingIngestZip, computePackJunkEntries } = await import(
  "../apps/api/dist/lib/ingest-zip.js"
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
      where: { id: { in: idArgs } },
      select: { id: true, name: true, metaJson: true },
    })
  : await prisma.contributorTemplate.findMany({
      where: ALL ? {} : { published: true },
      select: { id: true, name: true, metaJson: true },
      orderBy: { createdAt: "asc" },
    });

console.log(
  `\n=== P35 pack marketing-junk backfill ===\n` +
    `${rows.length} ta shablon (${idArgs.length ? "argument" : ALL ? "ALL" : "faqat nashr etilgan"})` +
    `${DRY_RUN ? " — DRY_RUN (o'zgarish yo'q)" : ""}\n`
);

/** Ikki ro'yxat aynan bir xilmi (tartib muhim emas). */
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

let updated = 0;
let skipped = 0;
let fail = 0;
const affected = [];

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const tag = `[${i + 1}/${rows.length}] ${r.id} ${r.name || ""}`.trim();
  let zip = null;
  try {
    const packKey = await resolveS3AssetKey(r.id, "pack");
    if (!packKey || !/\.zip$/i.test(packKey)) {
      skipped++;
      continue; // raw .aep / .mogrt / stock media — zip pack emas
    }
    const meta = await getS3ObjectMeta(packKey);
    if (meta.sizeBytes == null) {
      skipped++;
      console.warn(`${tag} — ⚠ pack bulutda topilmadi`);
      continue;
    }
    zip = await openStreamingIngestZip({
      size: meta.sizeBytes,
      read: (s, e) => readS3ObjectRange(packKey, s, e),
      stream: (s, e) => createS3RangeStream(packKey, s, e),
    });
    const junk = computePackJunkEntries(zip); // AYNAN ingest bilan bir xil qoida

    const existingMeta = (r.metaJson && typeof r.metaJson === "object") ? r.metaJson : {};
    const prior = Array.isArray(existingMeta.packJunkEntries)
      ? existingMeta.packJunkEntries.filter((x) => typeof x === "string")
      : [];

    if (junk.length === 0) {
      skipped++;
      continue; // chiqariladigan narsa yo'q
    }
    if (sameSet(prior, junk)) {
      skipped++;
      continue; // allaqachon to'g'ri yozilgan
    }

    affected.push(r.id);
    if (DRY_RUN) {
      console.log(`${tag} — (dry) ${junk.length} entry: ${junk.join(", ")}`);
      continue;
    }
    await prisma.contributorTemplate.update({
      where: { id: r.id },
      data: { metaJson: { ...existingMeta, packJunkEntries: junk } },
    });
    // Eskirgan filtrlanmagan (yoki eski) yuklab-olish keshini o'chiramiz.
    await deleteS3Objects([`templates/${r.id}/pack.dl.zip`]).catch(() => {});
    updated++;
    console.log(`${tag} — ✓ ${junk.length} entry yozildi + pack.dl.zip tozalandi`);
  } catch (e) {
    fail++;
    console.error(`${tag} — ✗ ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (zip) { try { zip.close(); } catch {} }
  }
}

if (DRY_RUN) {
  console.log(
    `\nDRY_RUN=1 — hech narsa yozilmadi. ${affected.length} ta shablon ta'sirlanadi.` +
      `\nHaqiqiy: DRY_RUN=0 node scripts/backfill-pack-junk.mjs`
  );
} else {
  console.log(`\nTayyor: ${updated} ✓ yozildi / ${skipped} o'tkazildi / ${fail} ✗`);
}

await prisma.$disconnect();
process.exit(0);
