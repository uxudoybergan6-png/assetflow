import { prisma } from "@creative-tools/database";

/**
 * Bosqich 4 #3 — Contributor payout / earnings (50% ulush mexanizmi).
 *
 * Shablonlar obunaga kiritilgan (cheksiz yuklab olish) → per-sotuv narx yo'q,
 * shu sabab attribution DEFAULT (sozlanadigan) formula bilan:
 *   HAR download hodisasi → contributor'ga qat'iy stavka (cent'da).
 *
 * ⚠️ EGA QARORI (kod default beradi, POLITIKANI QULFLAMAYDI):
 *   • Stavka: CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS (default 10 = $0.10/download).
 *   • Formula tanlovi: qat'iy-per-download (joriy) YOKI oylik daromad-pool ulushini
 *     har contributor'ning download ulushiga bo'lish — bu biznes qarori.
 *   • "50% ulush" sarlavhasini real raqamга moslashtirish (stavka × kutilgan
 *     downloadlar ≈ obuna daromadining 50%i) — ega hisoblab belgilaydi.
 *
 * Faqat "download" hodisalari earning beradi (import = qayta ishlatish, qo'shimcha
 * earning bermaydi). Idempotent: bir download hodisasi (downloadEventId @unique) IKKI
 * marta kredit BERMAYDI. Grant ADDITIVE va HECH QACHON manfiy emas (amountCents > 0).
 * BEST-EFFORT: xato yuklab olishni bloklamaydi (ledger naqshi).
 */
export function payoutPerDownloadCents(): number {
  const raw = Number(process.env.CONTRIBUTOR_PAYOUT_PER_DOWNLOAD_CENTS);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 10; // DEFAULT: $0.10 / download — EGA QARORI (flagged)
}

/**
 * Bitta download hodisasidan contributor earning yaratadi (idempotent, additive).
 * downloadEventId UNIQUE — takror chaqiruv (yoki race) IKKINCHI qatorni yaratmaydi.
 */
export async function grantContributorEarning(input: {
  downloadEventId: string;
  templateId: string;
  contributorId: string;
  kind: "download" | "import";
}): Promise<void> {
  // Import earning bermaydi — faqat download.
  if (input.kind !== "download") return;
  const amountCents = payoutPerDownloadCents();
  if (!Number.isFinite(amountCents) || amountCents <= 0) return; // hech qachon manfiy/0
  try {
    // createMany + skipDuplicates → downloadEventId UNIQUE bo'yicha idempotent
    // (P2002 throw qilmaydi; bir hodisa = bir earning kafolati).
    await prisma.contributorEarning.createMany({
      data: [
        {
          contributorId: input.contributorId,
          templateId: input.templateId,
          downloadEventId: input.downloadEventId,
          amountCents,
          currency: "USD",
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("grantContributorEarning", e);
  }
}

/**
 * Contributor earning xulosasi: jami topilgan, to'langan (payout), va balans
 * (to'lanmagan earninglar yig'indisi). Balans HECH QACHON manfiy bo'lmaydi.
 */
export async function getContributorEarningsSummary(contributorId: string) {
  const [totalAgg, unpaidAgg, paidAgg, downloadCount] = await Promise.all([
    prisma.contributorEarning.aggregate({
      where: { contributorId },
      _sum: { amountCents: true },
    }),
    prisma.contributorEarning.aggregate({
      where: { contributorId, payoutId: null },
      _sum: { amountCents: true },
    }),
    prisma.contributorPayout.aggregate({
      where: { contributorId, status: "paid" },
      _sum: { amountCents: true },
    }),
    prisma.contributorEarning.count({ where: { contributorId } }),
  ]);
  const totalCents = totalAgg._sum.amountCents ?? 0;
  const balanceCents = unpaidAgg._sum.amountCents ?? 0; // to'lanmagan earninglar
  const paidOutCents = paidAgg._sum.amountCents ?? 0;
  return {
    contributorId,
    currency: "USD",
    totalEarnedCents: totalCents,
    balanceCents: Math.max(0, balanceCents),
    paidOutCents,
    earningEvents: downloadCount,
    perDownloadCents: payoutPerDownloadCents(),
  };
}

/**
 * Admin payout qaydi: joriy to'lanmagan earninglarni bitta payout'ga bog'laydi va
 * ContributorPayout qatori yaratadi. Earning amountlari O'ZGARMAYDI (faqat payoutId
 * o'rnatiladi). Atomik tranzaksiya. amountCents = bog'langan earninglar yig'indisi.
 */
export async function recordContributorPayout(input: {
  contributorId: string;
  method?: string;
  reference?: string;
  note?: string;
  createdById?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const unpaid = await tx.contributorEarning.findMany({
      where: { contributorId: input.contributorId, payoutId: null },
      select: { id: true, amountCents: true },
    });
    const amountCents = unpaid.reduce((a, e) => a + e.amountCents, 0);
    if (amountCents <= 0) {
      return { ok: false as const, error: "To'lanmagan earning yo'q" };
    }
    const payout = await tx.contributorPayout.create({
      data: {
        contributorId: input.contributorId,
        amountCents,
        currency: "USD",
        method: input.method ?? "manual",
        reference: input.reference,
        note: input.note,
        status: "paid",
        createdById: input.createdById,
      },
    });
    await tx.contributorEarning.updateMany({
      where: { id: { in: unpaid.map((e) => e.id) } },
      data: { payoutId: payout.id },
    });
    return { ok: true as const, payout, linkedEarnings: unpaid.length };
  });
}
