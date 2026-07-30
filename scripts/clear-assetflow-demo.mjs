/**
 * Demo shablonlar, yuklamalar, loglar va (ixtiyoriy) demo email'larni tozalash.
 *
 * ⚠️  FAQAT LOKAL/DEV DB uchun. Production DATABASE_URL bilan ishga tushmaydi (guard).
 *
 * npm run demo:clear -- --dry-run   # faqat nima o'chirilishini sanaydi
 * npm run demo:clear -- --yes       # tasdiq so'ramasdan o'chiradi
 * npm run demo:clear -- --all-users # demo foydalanuvchilarni ham o'chiradi
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const DEMO_EMAILS = [
  "admin@assetflow.uz",
  "dilnoza.k@gmail.com",
  "sardor.fx@outlook.com",
];

/** Seed (`seed-assetflow.ts`) demo shablonlarini shu prefiks bilan yaratadi. */
const DEMO_EXTERNAL_ID_PREFIX = "demo-";

/** DATABASE_URL ichida shu belgilardan biri bo'lsa — bu prod, script ishlamaydi. */
const PROD_DB_MARKERS = ["neon.tech", "prod", "getframeflow", "frameflow.app", "supabase.co"];

const uploadsDir = path.join(root, "apps/api/uploads/contributor-templates");
const logsFile = path.join(root, "apps/api/data/system-logs.json");

/** Prod DB'ga qarab turgan bo'lsa — darhol to'xtat. */
function guardProdDatabase() {
  const url = process.env.DATABASE_URL || "";
  if (!url) {
    console.error("✗ DATABASE_URL o'rnatilmagan. Tozalash bekor qilindi.");
    process.exit(1);
  }
  const hit = PROD_DB_MARKERS.find((m) => url.toLowerCase().includes(m));
  if (hit) {
    console.error(
      [
        "",
        "🛑 TO'XTATILDI — DATABASE_URL production ma'lumotlar bazasiga qaragan.",
        `   Topilgan belgi: "${hit}"`,
        "",
        "   Bu script FAQAT lokal/dev DB uchun. Production'da ishga tushirilsa",
        "   butun marketpleys yo'qoladi.",
        "",
        "   Lokal DB bilan ishlash uchun .env dagi DATABASE_URL ni localhost'ga",
        "   yo'naltiring, so'ng qaytadan urinib ko'ring.",
        "",
      ].join("\n")
    );
    process.exit(1);
  }
  const host = url.replace(/^[^@]*@/, "").split(/[/?]/)[0] || "(noma'lum)";
  if (!/^(localhost|127\.0\.0\.1|::1|host\.docker\.internal|db)(:\d+)?$/i.test(host)) {
    console.warn(`⚠️  DATABASE_URL host: ${host} — localhost emas. Ehtiyot bo'ling.`);
  }
  return host;
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    console.error("✗ Interaktiv terminal yo'q. Tasdiq uchun `--yes` bayrog'ini uzating.");
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim().toLowerCase() === "ha" || answer.trim().toLowerCase() === "yes";
}

async function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  }
}

const prisma = new PrismaClient();

async function main() {
  const dbHost = guardProdDatabase();

  const dryRun = process.argv.includes("--dry-run");
  const autoYes = process.argv.includes("--yes");
  const delUsers = process.argv.includes("--all-users");

  // ── Ko'lam: faqat demo ma'lumot. `deleteMany({})` HECH QAYERDA ishlatilmaydi. ──
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true, email: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const templateWhere = {
    OR: [
      { contributorId: { in: demoUserIds } },
      { externalId: { startsWith: DEMO_EXTERNAL_ID_PREFIX } },
    ],
  };
  const demoTemplates = await prisma.contributorTemplate.findMany({
    where: templateWhere,
    select: { id: true },
  });
  const demoTemplateIds = demoTemplates.map((t) => t.id);

  const threadWhere = {
    OR: [
      { contributorId: { in: demoUserIds } },
      { templateId: { in: demoTemplateIds } },
    ],
  };
  const auditWhere = {
    OR: [
      { actorId: { in: demoUserIds } },
      { targetId: { in: demoTemplateIds } },
    ],
  };

  const counts = {
    templates: demoTemplates.length,
    threads: await prisma.studioMessageThread.count({ where: threadWhere }),
    messages: await prisma.studioMessage.count({ where: { thread: threadWhere } }),
    audit: await prisma.studioAuditLog.count({ where: auditWhere }),
    users: demoUsers.length,
  };

  console.log(`\nDB host: ${dbHost}`);
  console.log("O'chirilishi kutilayotgan demo ma'lumot:");
  console.log(`  • Shablonlar (demo-* yoki demo contributor): ${counts.templates}`);
  console.log(`  • Xabar thread'lari: ${counts.threads} (${counts.messages} xabar)`);
  console.log(`  • Audit log qatorlari: ${counts.audit}`);
  console.log(`  • Demo foydalanuvchilar: ${counts.users}${delUsers ? "" : " (--all-users bo'lmasa ham o'chiriladi)"}`);
  console.log(`  • Lokal papka: ${uploadsDir}`);
  console.log(`  • Log fayl: ${logsFile}`);

  if (dryRun) {
    console.log("\n(--dry-run) Hech narsa o'chirilmadi.");
    return;
  }

  if (!autoYes) {
    const ok = await confirm("\nDavom etilsinmi? (ha/yo'q): ");
    if (!ok) {
      console.log("Bekor qilindi.");
      return;
    }
  }

  const messages = await prisma.studioMessage.deleteMany({ where: { thread: threadWhere } });
  const threads = await prisma.studioMessageThread.deleteMany({ where: threadWhere });
  console.log(`✓ Studio xabarlar: ${messages.count} xabar, ${threads.count} thread`);

  const audit = await prisma.studioAuditLog.deleteMany({ where: auditWhere });
  console.log(`✓ Audit log: ${audit.count}`);

  const templates = await prisma.contributorTemplate.deleteMany({ where: templateWhere });
  console.log(`✓ Shablonlar o'chirildi: ${templates.count}`);

  await rmDir(uploadsDir);
  console.log(`✓ Yuklamalar papkasi tozalandi`);

  // #94 (A6) — loglar endi DB'da; eski fayl qolgan bo'lsa u ham tozalanadi.
  if (fs.existsSync(logsFile)) fs.rmSync(logsFile, { force: true });
  const sysLogs = await prisma.systemLog.deleteMany({});
  console.log(`✓ Tizim loglari tozalandi (${sysLogs.count} qator)`);

  const users = await prisma.user.deleteMany({
    where: { email: { in: DEMO_EMAILS } },
  });
  console.log(`✓ Demo foydalanuvchilar: ${users.count}`);

  console.log("\nBrauzerda sessionStorage tozalash: DevTools → Application → af_session");
  console.log("Keyin: http://localhost:3000/studio/login.html → Ro'yxatdan o'tish");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
