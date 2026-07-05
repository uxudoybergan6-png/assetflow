import { PrismaClient, AssetType } from "@prisma/client";

const prisma = new PrismaClient();

const sampleAssets = [
  {
    title: "Cinematic Glitch Transition",
    slug: "cinematic-glitch-transition",
    description: "Smooth glitch transition for Premiere Pro",
    type: AssetType.TRANSITION,
    category: "Transitions",
    tags: ["glitch", "cinematic", "modern"],
    fileKey: "assets/samples/glitch-transition.mogrt",
    thumbnailKey: "thumbnails/samples/glitch-transition.jpg",
    fileSize: 2048000,
    published: true,
  },
  {
    title: "Neon Light Leak Overlay",
    slug: "neon-light-leak-overlay",
    description: "Vibrant neon light leak VFX overlay",
    type: AssetType.VFX_OVERLAY,
    category: "VFX",
    tags: ["neon", "light leak", "overlay"],
    fileKey: "assets/samples/neon-leak.mp4",
    thumbnailKey: "thumbnails/samples/neon-leak.jpg",
    fileSize: 5120000,
    published: true,
  },
  {
    title: "Warm Film LUT Pack",
    slug: "warm-film-lut-pack",
    description: "Professional warm film color grading LUT",
    type: AssetType.LUT,
    category: "LUTs",
    tags: ["lut", "film", "warm"],
    fileKey: "assets/samples/warm-film.cube",
    thumbnailKey: "thumbnails/samples/warm-film.jpg",
    fileSize: 512000,
    published: true,
  },
];

async function main() {
  const bcrypt = await import("bcryptjs");
  const adminHash = await bcrypt.hash("admin12345", 12);
  await prisma.user.upsert({
    where: { email: "admin@creativetools.local" },
    update: {},
    create: {
      email: "admin@creativetools.local",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
      subscription: { create: { status: "ACTIVE" } },
    },
  });

  for (const asset of sampleAssets) {
    await prisma.asset.upsert({
      where: { slug: asset.slug },
      update: asset,
      create: asset,
    });
  }
  console.log("Seeded sample assets");

  // FAZA 2 #13 — PlanConfig: bugungi kod konstantalariga TENG qiymatlar
  // (xatti-harakat o'zgarmasin). Mavjud qator YANGILANMAYDI (admin tahriri saqlanadi).
  const planConfigs = [
    { plan: "FREE", label: "Free", aiMonthlyCredits: 50, downloadLimit: 15, importLimit: 10, maxResolution: "1080p", priceMonthlyCents: 0, priceYearlyCents: 0 },
    { plan: "PRO", label: "Pro", aiMonthlyCredits: 1000, downloadLimit: null, importLimit: null, maxResolution: "4K", priceMonthlyCents: 1900, priceYearlyCents: 19000 },
    { plan: "STUDIO", label: "Studio", aiMonthlyCredits: 6000, downloadLimit: null, importLimit: null, maxResolution: "4K", priceMonthlyCents: 5900, priceYearlyCents: 58800 },
  ] as const;
  for (const cfg of planConfigs) {
    await prisma.planConfig.upsert({
      where: { plan: cfg.plan },
      update: {},
      create: { ...cfg },
    });
  }
  console.log("Seeded plan configs");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
