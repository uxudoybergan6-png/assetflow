#!/usr/bin/env node
/**
 * P20 — MAVJUD nashr etilgan AI audio topshiriqlarining templateType'ini to'g'rilaydi:
 * eski AI SFX/Music itemlari templateType='ai-stock' (stockType 'sfx'|'music') bilan yozilgan edi;
 * endi ular Sound Effects / Music pill'lari ostida chiqishi uchun templateType 'sfx'|'music' bo'lishi
 * kerak. Rasm/video ('ai-stock') TEGILMAYDI. Faqat aiSource='ai' (Add-to-Explore) itemlari.
 *
 * Idempotent, kredit/billing'ga ALOQASIZ, faylga TEGMAYDI (faqat DB templateType). AVVAL build:
 *   npm run build -w apps/api   (dist emas — bu skript to'g'ridan @creative-tools/database ishlatadi)
 *   DRY_RUN=1 node scripts/backfill-ai-audio-type.mjs   # faqat ro'yxat (default)
 *   DRY_RUN=0 node scripts/backfill-ai-audio-type.mjs   # yozadi (owner qo'lda)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "apps/api/.env") });
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const DRY_RUN = process.env.DRY_RUN !== "0"; // default: dry-run

const rows = await prisma.contributorTemplate.findMany({
  where: {
    templateType: "ai-stock",
    stockType: { in: ["sfx", "music"] },
    metaJson: { path: ["aiSource"], equals: "ai" },
  },
  select: { id: true, stockType: true, name: true, published: true },
  orderBy: { createdAt: "asc" },
});

console.log(
  `\n=== P20 AI audio templateType backfill ===\n` +
    `${rows.length} ta AI audio item (templateType 'ai-stock' → '${"sfx/music"}')` +
    `${DRY_RUN ? " — DRY_RUN (o'zgarish yo'q)" : ""}\n`
);

let ok = 0;
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const target = r.stockType; // 'sfx' | 'music'
  const tag = `[${i + 1}/${rows.length}] ${r.id} ${r.stockType} ${r.published ? "(published)" : ""} ${r.name || ""}`.trim();
  if (DRY_RUN) { console.log(`${tag} — (dry) → templateType='${target}'`); continue; }
  await prisma.contributorTemplate.update({ where: { id: r.id }, data: { templateType: target } });
  ok++;
  console.log(`${tag} — ✓ templateType='${target}'`);
}

if (DRY_RUN) console.log(`\nDRY_RUN=1 — hech narsa yozilmadi. Haqiqiy: DRY_RUN=0 node scripts/backfill-ai-audio-type.mjs`);
else console.log(`\nTayyor: ${ok} yangilandi.`);

await prisma.$disconnect();
process.exit(0);
