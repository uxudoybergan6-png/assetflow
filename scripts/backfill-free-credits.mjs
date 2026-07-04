#!/usr/bin/env node
/**
 * Bir martalik backfill: "yangi FREE foydalanuvchi 0 AI kredit bilan qolib
 * ketishi" bug'idan ta'sirlangan profillarni tuzatadi (ensurePluginProfile
 * endi create paytida aiCredits'ni ANIQ 50ga o'rnatadi — apps/api/src/lib/plugin-profile.ts,
 * lekin bug oldin yaratilgan profillarga bu ta'sir qilmaydi).
 *
 * HEURISTIKA (konservativ — legitim sarflab bo'lgan foydalanuvchini TEGMAYDI):
 *   1) plan = FREE, aiCredits = 0, role != ADMIN.
 *   2) CreditLedger'da userId uchun HECH QANDAY yozuv yo'q (na consume, na
 *      refund) — har bir haqiqiy sarf `consumeAiCredits` orqali atomik
 *      kamaytirish bilan BIRGA ledger yozuvi yaratadi (apps/api/src/lib/ledger.ts).
 *      Demak ledger yozuvi yo'q + balans 0 = balans HECH QACHON 50dan
 *      boshlanmagan (bug), sarflab bo'lingan emas.
 *   3) Profil `createdAt` >= LEDGER_SINCE (ledger mexanizmi joriy bo'lgan sana,
 *      migration 20260703140000_faza2_ledger_refund). Ledger'dan OLDIN
 *      yaratilgan profillar uchun "ledger yo'q" signali ishonchsiz (o'sha
 *      paytda sarflar umuman ledger'ga yozilmagan) — bunday profillar
 *      backfill qilinmaydi, alohida "qo'lda tekshirish" ro'yxatida chiqadi.
 *
 * DRY_RUN=1 (yoki env yo'q) — faqat hisobot, hech narsa yozilmaydi (default).
 * DRY_RUN=0 — topilgan profillarga aiCredits=50, aiCreditsResetAt=hozir yoziladi.
 *
 * AVVAL build kerak (dist'dan import qilinadi):
 *   npm run build -w apps/api
 *   DRY_RUN=1 node scripts/backfill-free-credits.mjs
 *   DRY_RUN=0 node scripts/backfill-free-credits.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { prisma } = await import("@creative-tools/database");
const { aiMonthlyAllotment } = await import(
  "../apps/api/dist/lib/plugin-profile.js"
);

const DRY_RUN = process.env.DRY_RUN !== "0";
// Ledger mexanizmi joriy bo'lgan migration sanasi (20260703140000_faza2_ledger_refund).
const LEDGER_SINCE = new Date("2026-07-03T14:00:00.000Z");

const candidates = await prisma.pluginProfile.findMany({
  where: {
    plan: "FREE",
    aiCredits: 0,
    user: { role: { not: "ADMIN" } },
  },
  select: { userId: true, createdAt: true, aiCreditsResetAt: true, user: { select: { email: true } } },
});

const freeAllot = aiMonthlyAllotment("FREE");
const toFix = [];
const skippedPredatesLedger = [];
const skippedHasLedgerActivity = [];

for (const p of candidates) {
  const ledgerCount = await prisma.creditLedger.count({ where: { userId: p.userId } });
  if (ledgerCount > 0) {
    skippedHasLedgerActivity.push(p);
    continue;
  }
  if (p.createdAt < LEDGER_SINCE) {
    skippedPredatesLedger.push(p);
    continue;
  }
  toFix.push(p);
}

console.log(`Nomzodlar (FREE, aiCredits=0, ADMIN emas): ${candidates.length}`);
console.log(`  → ledger faoliyati bor (legitim sarf, TEGILMAYDI): ${skippedHasLedgerActivity.length}`);
console.log(`  → ledger'dan oldin yaratilgan (qo'lda tekshiring): ${skippedPredatesLedger.length}`);
for (const p of skippedPredatesLedger) {
  console.log(`      - ${p.user.email} (createdAt=${p.createdAt.toISOString()})`);
}
console.log(`  → BACKFILL qilinadi (hech qachon kredit ololmagan, bug qurboni): ${toFix.length}`);
for (const p of toFix) {
  console.log(`      - ${p.user.email} (createdAt=${p.createdAt.toISOString()})`);
}

if (DRY_RUN) {
  console.log(`\nDRY_RUN=1 — hech narsa yozilmadi. Haqiqiy tuzatish uchun: DRY_RUN=0 node scripts/backfill-free-credits.mjs`);
} else {
  const now = new Date();
  for (const p of toFix) {
    await prisma.pluginProfile.update({
      where: { userId: p.userId },
      data: { aiCredits: freeAllot, aiCreditsResetAt: now },
    });
  }
  console.log(`\n${toFix.length} ta profil aiCredits=${freeAllot} ga tuzatildi.`);
}

await prisma.$disconnect();
process.exit(0);
