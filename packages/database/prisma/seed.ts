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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
