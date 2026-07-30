#!/usr/bin/env node
/**
 * #50 (T3.4) — YETIM `incoming/` fayllari uchun bir martalik tozalash.
 *
 * Ingest muvaffaqiyatli tugasa yoki DOIMIY rad etilsa manba zip o'chiriladi, lekin
 * retry limiti tugagan yo'l uni o'chirmasdi (endi o'chiradi) — shu bois tarixiy
 * yetimlar bulutda qolgan. Bundan tashqari presigned PUT bilan yuklanib `/ingest`
 * chaqirilmagan fayllar ham shu yerda to'planadi.
 *
 * Xavfsiz: faqat DAYS kundan eski VA navbatda (queued/processing) turmagan kalitlar.
 * Ishchi (ingest-worker) ham shu supurishni davriy bajaradi — bu skript qo'lda.
 *
 * DRY_RUN=1 (default) · DRY_RUN=0 — o'chiradi · DAYS=7 · MAX=5000
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/cleanup-orphan-incoming.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { isS3Configured, listS3ObjectsWithMeta, deleteS3Objects } = await import(
  "../apps/api/dist/lib/s3.js"
);

const DRY_RUN = process.env.DRY_RUN !== "0";
const DAYS = Math.max(0, Number(process.env.DAYS) || 7);
const MAX = Math.max(1, Number(process.env.MAX) || 5000);

if (!isS3Configured()) {
  console.error("✗ Storage sozlanmagan (AWS_*/S3_ENDPOINT yo'q).");
  process.exit(1);
}

const cutoff = Date.now() - DAYS * 86_400_000;
const { objects, truncated } = await listS3ObjectsWithMeta("incoming/", MAX);
const old = objects.filter((o) => (o.lastModified?.getTime() ?? Date.now()) < cutoff);
console.log(
  `incoming/ jami: ${objects.length}${truncated ? " (ro'yxat kesildi)" : ""} · ${DAYS} kundan eski: ${old.length}`
);

if (!old.length) {
  await prisma.$disconnect();
  process.exit(0);
}

const active = await prisma.ingestJob.findMany({
  where: { key: { in: old.map((o) => o.key) }, status: { in: ["queued", "processing"] } },
  select: { key: true },
});
const activeKeys = new Set(active.map((a) => a.key));
const stale = old.filter((o) => !activeKeys.has(o.key));
const bytes = stale.reduce((s, o) => s + o.size, 0);
console.log(
  `Navbatda turgani (tegilmaydi): ${activeKeys.size} · yetim: ${stale.length} (${(bytes / 1048576).toFixed(1)} MB)`
);
for (const o of stale.slice(0, 20)) console.log(`  · ${o.key}`);
if (stale.length > 20) console.log(`  … va yana ${stale.length - 20} ta`);

if (DRY_RUN) {
  console.log("\n(DRY_RUN — hech narsa o'chirilmadi. O'chirish: DRY_RUN=0 node scripts/cleanup-orphan-incoming.mjs)");
} else {
  const keys = stale.map((o) => o.key);
  for (let i = 0; i < keys.length; i += 1000) await deleteS3Objects(keys.slice(i, i + 1000));
  console.log(`\n✓ O'chirildi: ${keys.length} fayl (${(bytes / 1048576).toFixed(1)} MB bo'shadi)`);
}
await prisma.$disconnect();
