/**
 * AssetFlow Studio demo foydalanuvchilar.
 * npm run seed:assetflow -w @creative-tools/database
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PluginPlanTier, PrismaClient, UserRole } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const prisma = new PrismaClient();

async function main() {
  const bcrypt = await import("bcryptjs");

  const users = [
    {
      email: "admin@assetflow.uz",
      password: "admin123",
      name: "Admin Nazarov",
      role: UserRole.ADMIN,
    },
    {
      email: "dilnoza.k@gmail.com",
      password: "contrib123",
      name: "Dilnoza Karimova",
      role: UserRole.CONTRIBUTOR,
    },
    {
      email: "user@assetflow.uz",
      password: "user123",
      name: "Demo Obunachi",
      role: UserRole.USER,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const isDemoSubscriber = u.email === "user@assetflow.uz";
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        passwordHash,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        subscription: {
          create: {
            status: isDemoSubscriber ? "INCOMPLETE" : "ACTIVE",
          },
        },
      },
    });
    if (isDemoSubscriber) {
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, status: "INCOMPLETE" },
        update: { status: "INCOMPLETE" },
      });
    }
    await prisma.pluginProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: PluginPlanTier.FREE,
      },
      update: isDemoSubscriber ? { plan: PluginPlanTier.FREE } : {},
    });
    console.log(`✓ ${u.email} (${u.role})`);
  }

  await prisma.contributorPlatformSettings.upsert({
    where: { id: "platform" },
    update: { requireApproval: true },
    create: {
      id: "platform",
      requireApproval: true,
      categoriesJson: [
        { value: "logos", label: "Logo Reveal" },
        { value: "intros", label: "Title / Intro" },
        { value: "lowerthirds", label: "Lower Thirds" },
        { value: "transitions", label: "Transitions" },
        { value: "social", label: "Social Media" },
      ],
      contributorInstructions:
        "Yuklashdan keyin moderatsiya. Tasdiqlangach AE Browse katalogida chiqadi.",
    },
  });

  console.log("AssetFlow demo users ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
