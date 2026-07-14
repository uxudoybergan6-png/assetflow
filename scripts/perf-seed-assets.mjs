/**
 * Step 22 (MUAMMOLAR-1) — TEST MA'LUMOT GENERATORI.
 * Realistik taqsimotda N ta APPROVED+published katalog shabloni yaratadi (6 kategoriya,
 * turli hajm/orient/res/pro) — perf o'lchash uchun (50 → 500 → 5000).
 *
 * Barcha qatorlar externalId="perf-seed-<n>" bilan belgilanadi → toza o'chirish oson.
 *   node scripts/perf-seed-assets.mjs <count>          # qo'shadi (avval perf-seed'ni tozalaydi)
 *   node scripts/perf-seed-assets.mjs --clear          # faqat perf-seed rows'ni o'chiradi
 *
 * DIQQAT: FAQAT lokal/dev DB uchun. Money zonaga tegmaydi — faqat katalog qatorlari.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
const prisma = new PrismaClient();

const CONTRIB_ID = "perfseedcontributor0000000000";

// 6 realistik kategoriya (weight = nisbiy ulush). sizeMB = [min,max] fayl hajmi.
const CATEGORIES = [
  { templateType: "video-templates", kind: "template", stockType: null, cat: "lower-thirds", catLabel: "Lower Thirds", nav: "video", weight: 30, sizeMB: [80, 320], dur: [5, 30] },
  { templateType: "motion-graphics", kind: "template", stockType: null, cat: "transitions", catLabel: "Transitions", nav: "motion", weight: 18, sizeMB: [30, 180], dur: [1, 8] },
  { templateType: "graphics", kind: "stock", stockType: "photo", cat: "backgrounds", catLabel: "Backgrounds", nav: "graphics", weight: 20, sizeMB: [2, 28], dur: null },
  { templateType: "luts", kind: "template", stockType: null, cat: "cinematic", catLabel: "Cinematic LUTs", nav: "luts", weight: 8, sizeMB: [1, 3], dur: null },
  { templateType: "music", kind: "stock", stockType: "music", cat: "ambient", catLabel: "Ambient", nav: "music", weight: 14, sizeMB: [5, 16], dur: [60, 240] },
  { templateType: "sfx", kind: "stock", stockType: "sfx", cat: "whoosh", catLabel: "Whoosh", nav: "sfx", weight: 10, sizeMB: [0.2, 3], dur: [1, 5] },
];
const ORIENTS = ["horizontal", "vertical", "square"];
const ADJ = ["Cinematic", "Modern", "Bold", "Minimal", "Dynamic", "Elegant", "Retro", "Neon", "Corporate", "Organic"];
const NOUN = ["Intro", "Pack", "Kit", "Loop", "Scene", "Title", "Overlay", "Preset", "Grade", "Burst"];
const TAGWORDS = ["clean", "trendy", "smooth", "fast", "colorful", "dark", "light", "abstract", "geometric", "gradient", "vintage", "futuristic", "warm", "cool", "energetic"];

// Determenistik PRNG (mulberry32) — takror ishga tushirishda bir xil taqsimot.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(1337);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);

function weightedCategory() {
  const total = CATEGORIES.reduce((s, c) => s + c.weight, 0);
  let r = rand() * total;
  for (const c of CATEGORIES) { if ((r -= c.weight) <= 0) return c; }
  return CATEGORIES[0];
}

function dims(orient, res) {
  const long = res === "4k" ? 3840 : 1920;
  const short = res === "4k" ? 2160 : 1080;
  if (orient === "vertical") return [short, long];
  if (orient === "square") return [short, short];
  return [long, short];
}

async function clearSeed() {
  const del = await prisma.contributorTemplate.deleteMany({ where: { externalId: { startsWith: "perf-seed-" } } });
  return del.count;
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--clear") {
    const n = await clearSeed();
    console.log(`perf-seed: ${n} qator o'chirildi.`);
    await prisma.$disconnect();
    return;
  }
  const count = Math.max(1, Math.min(20000, Number(arg) || 50));

  // Perf contributor user (FK-siz denormalizatsiya — lekin katalog contributor join qiladi).
  await prisma.user.upsert({
    where: { id: CONTRIB_ID },
    create: { id: CONTRIB_ID, email: "perf-seed@example.com", name: "Perf Seed", role: "USER" },
    update: {},
  });

  const removed = await clearSeed();
  if (removed) console.log(`perf-seed: ${removed} eski qator tozalandi.`);

  const rows = [];
  for (let i = 0; i < count; i++) {
    const c = weightedCategory();
    const orient = pick(ORIENTS);
    const res = rand() < 0.45 ? "4k" : "hd";
    const [w, h] = dims(orient, res);
    const tags = Array.from(new Set(Array.from({ length: 4 + Math.floor(rand() * 3) }, () => pick(TAGWORDS))));
    const sizeMB = between(c.sizeMB[0], c.sizeMB[1]);
    rows.push({
      id: `perfseed${String(i).padStart(6, "0")}${Math.floor(rand() * 1e6)}`,
      contributorId: CONTRIB_ID,
      externalId: `perf-seed-${i}`,
      name: `${pick(ADJ)} ${c.catLabel} ${pick(NOUN)} ${i}`,
      description: `Realistic ${c.catLabel.toLowerCase()} asset for performance testing. High-quality ${c.templateType} with ${tags.join(", ")}.`,
      nav: c.nav,
      cat: c.cat,
      catLabel: c.catLabel,
      orient,
      res,
      tags,
      templateApp: "ae",
      kind: c.kind,
      stockType: c.stockType,
      templateType: c.templateType,
      durationSec: c.dur ? Math.round(between(c.dur[0], c.dur[1]) * 10) / 10 : null,
      width: w,
      height: h,
      fps: c.dur ? pick([24, 25, 30, 60]) : null,
      fileName: `perf_${i}.${c.kind === "stock" && c.stockType === "photo" ? "jpg" : c.templateType === "music" || c.templateType === "sfx" ? "wav" : c.templateType === "luts" ? "cube" : "aep"}`,
      fileSize: Math.round(sizeMB * 1024 * 1024),
      reviewStatus: "APPROVED",
      published: true,
      isPro: rand() < 0.3,
      // Sahna/asset kalitlari keshi — real katalogda LIST call'ni oldini oladi (bo'sh massiv OK).
      assetKeysJson: { thumb: `templates/perfseed${i}/thumb.jpg`, preview: `templates/perfseed${i}/preview.mp4`, keys: [] },
    });
  }

  let written = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await prisma.contributorTemplate.createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
    written += res.count;
    process.stdout.write(`\r  yozildi: ${written}/${count}`);
  }
  const total = await prisma.contributorTemplate.count({ where: { reviewStatus: "APPROVED", published: true, takedownAt: null } });
  console.log(`\nperf-seed: ${written} qator qo'shildi. Katalogdagi jami APPROVED+published: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
