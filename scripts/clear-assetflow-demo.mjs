/**
 * Demo shablonlar, yuklamalar, loglar va (ixtiyoriy) demo email'larni tozalash.
 * npm run demo:clear
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const prisma = new PrismaClient();

const DEMO_EMAILS = [
  "admin@assetflow.uz",
  "dilnoza.k@gmail.com",
  "sardor.fx@outlook.com",
];

const uploadsDir = path.join(root, "apps/api/uploads/contributor-templates");
const logsFile = path.join(root, "apps/api/data/system-logs.json");

async function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  }
}

async function main() {
  const delUsers = process.argv.includes("--all-users");

  const templates = await prisma.contributorTemplate.deleteMany({});
  console.log(`✓ Shablonlar o'chirildi: ${templates.count}`);

  await rmDir(uploadsDir);
  console.log(`✓ Yuklamalar papkasi tozalandi`);

  fs.mkdirSync(path.dirname(logsFile), { recursive: true });
  fs.writeFileSync(logsFile, "[]\n", "utf8");
  console.log(`✓ Tizim loglari tozalandi`);

  if (delUsers) {
    const users = await prisma.user.deleteMany({
      where: { email: { in: DEMO_EMAILS } },
    });
    console.log(`✓ Demo foydalanuvchilar: ${users.count}`);
  } else {
    const users = await prisma.user.deleteMany({
      where: { email: { in: DEMO_EMAILS } },
    });
    console.log(`✓ Ma'lum demo email'lar: ${users.count}`);
  }

  console.log("\nBrauzerda sessionStorage tozalash: DevTools → Application → af_session");
  console.log("Keyin: http://localhost:3000/studio/login.html → Ro'yxatdan o'tish");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
