/**
 * AssetFlow Studio demo foydalanuvchilar.
 * npm run seed:assetflow -w @creative-tools/database
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  PluginPlanTier,
  PrismaClient,
  TemplateReviewStatus,
  UserRole,
} from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(root, ".env") });
}

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

  const contributor = await prisma.user.findUnique({
    where: { email: "dilnoza.k@gmail.com" },
  });
  if (contributor) {
    const demos = [
      {
        externalId: "demo-kinetic-titles",
        name: "Kinetic Typography Pack (Demo)",
        description: "Onlayn katalog testi — pack yuklanguncha hasPack:false.",
        nav: "video",
        cat: "titleintro",
        catLabel: "Title / Intro",
        tags: ["demo", "kinetic", "4k"],
      },
      {
        externalId: "demo-logo-reveal",
        name: "Logo Reveal Pro (Demo)",
        description: "Browse panelda ko‘rinish uchun tasdiqlangan demo shablon.",
        nav: "video",
        cat: "logos",
        catLabel: "Logo Reveal",
        tags: ["demo", "logo"],
      },
    ];
    for (const d of demos) {
      await prisma.contributorTemplate.upsert({
        where: {
          contributorId_externalId: {
            contributorId: contributor.id,
            externalId: d.externalId,
          },
        },
        update: {
          name: d.name,
          description: d.description,
          reviewStatus: TemplateReviewStatus.APPROVED,
          published: false,
        },
        create: {
          contributorId: contributor.id,
          externalId: d.externalId,
          name: d.name,
          description: d.description,
          nav: d.nav,
          cat: d.cat,
          catLabel: d.catLabel,
          orient: "horizontal",
          res: "4k",
          tags: d.tags,
          reviewStatus: TemplateReviewStatus.APPROVED,
          published: false,
        },
      });
      console.log(`✓ template ${d.externalId}`);
    }
  }

  console.log("AssetFlow demo users + catalog templates ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
