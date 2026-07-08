import { prisma } from "@creative-tools/database";
import { netSubscriptionRevenueCents } from "./revenue.js";

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

// ── FAZA 4 (C) — REVENUE-SHARE POOL payout ──────────────────────────────────
// Qat'iy per-download stavka real daromaddan uzilgan (farm/ortiqcha to'lov riski).
// POOL modeli: pool = (davr obuna NET tushumi − attributsiyalangan AI provayder
// xarajati) × CONTRIBUTOR_POOL_SHARE; taqsimot har contributor'ning LEGITIM
// download ulushi bo'yicha. Legitim = Faza 2 gate'laridan o'tgan hodisalar
// (dedup unique, self-exclusion, email-verify, admin emas) — ular kind="download"
// ContributorEarning qatori sifatida qayd etiladi (pool rejimida amount=0 MARKER).
//
// PAYOUT_MODE = "pool" (DEFAULT — flat stavkani almashtiradi) | "per_download"
// (eski xatti-harakat, config ortida saqlanadi). To'lov IJROSI qo'lda qoladi
// (recordContributorPayout) — bu faqat HISOBLAB KO'RSATADI, pul ko'chirmaydi.
// ⚠️ Rejimni davr O'RTASIDA almashtirish shu davrda ikkala turdagi qatorni
// aralashtiradi — admin davr yakunida recompute bilan tekshirsin.

export type PayoutMode = "pool" | "per_download";

export function payoutMode(): PayoutMode {
  return process.env.PAYOUT_MODE === "per_download" ? "per_download" : "pool";
}

/** Pool ulushi (0..1], default 0.50 — EGA QARORI (CONTRIBUTOR_POOL_SHARE env). */
export function contributorPoolShare(): number {
  const raw = Number(process.env.CONTRIBUTOR_POOL_SHARE);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return 0.5;
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
  // FAZA 4 (C): pool rejimida amount=0 MARKER qatori yoziladi — legitimlik
  // attributioni (Faza 2 gate'lari) BIR kod yo'lida qoladi; pool taqsimoti shu
  // markerlarni sanaydi. per_download rejimida — eski flat stavka (o'zgarmagan).
  const amountCents = payoutMode() === "pool" ? 0 : payoutPerDownloadCents();
  if (!Number.isFinite(amountCents) || amountCents < 0) return; // hech qachon manfiy
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
          kind: "download",
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("grantContributorEarning", e);
  }
}

/**
 * FAZA 4 (C) — davr (YYYY-MM) uchun POOL hisoblab taqsimlaydi.
 *   pool = max(0, (obuna NET tushumi − AI provayder xarajati)) × poolShare
 *   contributor ulushi = (uning legitim downloadlari / jami legitim) × pool (floor)
 *
 * persist=true → ContributorEarning kind="pool" qatorlari yoziladi; idempotent:
 * downloadEventId = "pool:<month>:<contributorId>" @unique → qayta chaqiruv
 * IKKINCHI qator yaratmaydi. recompute=true → shu davrning TO'LANMAGAN pool
 * qatorlari o'chirib qayta hisoblanadi (payout'ga bog'langanlariga TEGILMAYDI).
 * Pul KO'CHIRILMAYDI — faqat hisob; ijro mavjud recordContributorPayout'da qo'lda.
 */
export async function computePoolForMonth(
  month: string,
  opts: { persist?: boolean; recompute?: boolean } = {}
) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false as const, error: "month must be YYYY-MM" };
  }
  const [y, m] = month.split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 1, 1));
  const until = new Date(Date.UTC(y, m, 1));
  const share = contributorPoolShare();

  const [netSubCents, spendAgg, downloadRows] = await Promise.all([
    netSubscriptionRevenueCents({ since, until }),
    prisma.providerSpend.aggregate({
      where: { createdAt: { gte: since, lt: until }, estimatedCostUsd: { not: null } },
      _sum: { estimatedCostUsd: true },
    }),
    // Legitim downloadlar — Faza 2 gate'laridan o'tib yozilgan kind="download"
    // earning qatorlari (per_download davri uchun ham, pool marker uchun ham to'g'ri).
    prisma.contributorEarning.groupBy({
      by: ["contributorId"],
      where: { kind: "download", createdAt: { gte: since, lt: until } },
      _count: { _all: true },
    }),
  ]);
  const providerCostCents = Math.round(Number(spendAgg._sum.estimatedCostUsd ?? 0) * 100);
  const poolCents = Math.max(0, Math.floor((netSubCents - providerCostCents) * share));
  const totalDownloads = downloadRows.reduce((a, r) => a + r._count._all, 0);
  const contributors = downloadRows
    .map((r) => ({
      contributorId: r.contributorId,
      downloads: r._count._all,
      // floor — qoldiq cent taqsimlanmaydi (pool foydasiga qoladi)
      amountCents:
        totalDownloads > 0 ? Math.floor((poolCents * r._count._all) / totalDownloads) : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  let written = 0;
  if (opts.persist) {
    if (opts.recompute) {
      await prisma.contributorEarning.deleteMany({
        where: { kind: "pool", periodMonth: month, payoutId: null },
      });
    }
    const data = contributors
      .filter((r) => r.amountCents > 0)
      .map((r) => ({
        contributorId: r.contributorId,
        templateId: `pool:${month}`,
        downloadEventId: `pool:${month}:${r.contributorId}`, // davr+contributor idempotent
        amountCents: r.amountCents,
        currency: "USD",
        kind: "pool",
        periodMonth: month,
      }));
    if (data.length) {
      const res = await prisma.contributorEarning.createMany({ data, skipDuplicates: true });
      written = res.count;
    }
  }
  return {
    ok: true as const,
    month,
    mode: payoutMode(),
    poolShare: share,
    netSubscriptionCents: netSubCents,
    providerCostCents,
    poolCents,
    totalLegitimateDownloads: totalDownloads,
    contributors,
    written,
    persisted: !!opts.persist,
  };
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
    // FAZA 4 (C): earningEvents = LEGITIM download hodisalari (pool taqsimot
    // qatorlari hodisa emas — sanalmaydi).
    prisma.contributorEarning.count({ where: { contributorId, kind: "download" } }),
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
    payoutMode: payoutMode(),
    poolShare: contributorPoolShare(),
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
      return { ok: false as const, error: "No unpaid earnings" };
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
