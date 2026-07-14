import { prisma, PluginPlanTier } from "@creative-tools/database";
import { revenueSummary } from "./revenue.js";
import { computePoolForMonth } from "./earnings.js";
import { getInfraCostForMonth, listInfraCosts } from "./infra-cost.js";
import { computeMargins } from "./model-margin.js";
import { checkPricingFloors } from "./assert-pricing-floors.js";

/**
 * Step 21 (P26.8) — FOYDA PANELI. Bitta ekran: "FOYDA KO'RYAPMANMI?".
 *
 *   Daromad           (RevenueEvent: obuna + kredit paketlari, NET)
 *   − AI provayder    (ProviderSpend — o'lchangan, taxminiy EMAS afzal)
 *   − LS komissiyasi  (~5% + $0.50/tranzaksiya — TAXMINIY, LS webhook fee bermaydi)
 *   − Infra           (InfraCost — admin kiritadi: storage+egress+compute)
 *   − Contributor     (pool to'lovlari)
 *   ─────────────────
 *   = FOYDA
 *
 * 🔴 BEPUL foydalanuvchi krediti DAROMAD EMAS — u "MIJOZ JALB QILISH XARAJATI" (CAC):
 *   free-plan generatsiyalariga sarflangan provayder puli, daromadi $0.
 *
 * FAQAT O'QISH — pul matematikasiga (consume/refund/HMAC/computeGenCost) TEGMAYDI.
 */

const LS_FEE_PCT = 0.05; // Lemon Squeezy MoR ~5%
const LS_FEE_FIXED_CENTS = 50; // + $0.50 / tranzaksiya

type Range = { since?: Date; until?: Date };

function monthRange(month?: string): Range {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return {};
  const [y, m] = month.split("-").map(Number);
  return { since: new Date(Date.UTC(y, m - 1, 1)), until: new Date(Date.UTC(y, m, 1)) };
}

function toCents(usd: number): number {
  return Math.round((Number(usd) || 0) * 100);
}

/**
 * Davr (YYYY-MM yoki butun tarix) uchun to'liq foyda hisoboti.
 */
export async function computeProfitStatement(month?: string) {
  const range = monthRange(month);
  const spendWhere = range.since || range.until
    ? { createdAt: { ...(range.since ? { gte: range.since } : {}), ...(range.until ? { lt: range.until } : {}) } }
    : {};

  // ── Daromad (RevenueEvent) ──
  const revenue = await revenueSummary(range);
  const grossCents = revenue.grossCents;
  const netCents = revenue.netCents; // gross − tax − fee (fee LS'da 0 → gross−tax)

  // ── AI provayder xarajati (measured afzal, aks holda estimate) + confidence ──
  const spendRows = await prisma.providerSpend.findMany({
    where: spendWhere,
    select: { generationId: true, estimatedCostUsd: true, measuredCostUsd: true, confidence: true },
  });
  let aiCostCents = 0;
  let measuredCents = 0;
  let estimatedOnlyCents = 0;
  const confCount = { measured: 0, official: 0, estimated: 0 };
  for (const s of spendRows) {
    const est = Number(s.estimatedCostUsd ?? 0);
    const meas = s.measuredCostUsd != null ? Number(s.measuredCostUsd) : null;
    const usd = meas != null ? meas : est;
    const cents = toCents(usd);
    aiCostCents += cents;
    if (meas != null) {
      measuredCents += cents;
      if (s.confidence === "official") confCount.official++;
      else confCount.measured++;
    } else {
      estimatedOnlyCents += cents;
      confCount.estimated++;
    }
  }

  // ── CAC: BEPUL foydalanuvchilar generatsiyalarига sarflangan provayder puli ──
  // gen → user → plan. FREE plan gen'lari daromad keltirmaydi (kredit ≠ pul).
  const genIds = [...new Set(spendRows.map((s) => s.generationId).filter((x): x is string => !!x))];
  let cacFreeCents = 0;
  let paidUserAiCents = 0;
  if (genIds.length) {
    const gens = await prisma.generation.findMany({
      where: { id: { in: genIds } },
      select: { id: true, userId: true },
    });
    const genUser = new Map(gens.map((g) => [g.id, g.userId]));
    const userIds = [...new Set(gens.map((g) => g.userId))];
    const profiles = userIds.length
      ? await prisma.pluginProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, plan: true } })
      : [];
    const planByUser = new Map(profiles.map((p) => [p.userId, p.plan]));
    for (const s of spendRows) {
      if (!s.generationId) continue;
      const uid = genUser.get(s.generationId);
      const plan = uid ? planByUser.get(uid) : undefined;
      const meas = s.measuredCostUsd != null ? Number(s.measuredCostUsd) : null;
      const cents = toCents(meas != null ? meas : Number(s.estimatedCostUsd ?? 0));
      if (plan === PluginPlanTier.FREE || plan == null) cacFreeCents += cents;
      else paidUserAiCents += cents;
    }
  }

  // ── LS komissiyasi (TAXMINIY) — musbat sotuv hodisalari ustidan ──
  const byKind = revenue.byKind || {};
  const saleKinds = ["subscription_initial", "renewal", "credit_pack"] as const;
  let saleGrossCents = 0;
  let saleEvents = 0;
  for (const k of saleKinds) {
    const row = byKind[k];
    if (row) {
      saleGrossCents += Math.max(0, row.grossCents);
      saleEvents += row.events;
    }
  }
  const lsFeeCents = Math.round(saleGrossCents * LS_FEE_PCT) + saleEvents * LS_FEE_FIXED_CENTS;

  // ── Infra (admin kiritadi) ──
  let infraCents = 0;
  let infraPresent = false;
  let infraBreakdown = { storageCents: 0, egressCents: 0, computeCents: 0 };
  if (month) {
    const infra = await getInfraCostForMonth(month);
    infraCents = infra.totalCents;
    infraPresent = infra.present;
    infraBreakdown = { storageCents: infra.storageCents, egressCents: infra.egressCents, computeCents: infra.computeCents };
  } else {
    const all = await listInfraCosts(60);
    for (const r of all) {
      infraBreakdown.storageCents += toCents(Number(r.storageUsd));
      infraBreakdown.egressCents += toCents(Number(r.egressUsd));
      infraBreakdown.computeCents += toCents(Number(r.computeUsd));
    }
    infraCents = infraBreakdown.storageCents + infraBreakdown.egressCents + infraBreakdown.computeCents;
    infraPresent = all.length > 0;
  }

  // ── Contributor pool (period accrual) ──
  let contributorCents = 0;
  let poolNegative = false;
  if (month) {
    const pool = await computePoolForMonth(month);
    if (pool.ok) {
      contributorCents = pool.poolCents;
      poolNegative = pool.poolNegative;
    }
  } else {
    const agg = await prisma.contributorEarning.aggregate({ _sum: { amountCents: true } });
    contributorCents = Math.max(0, agg._sum.amountCents ?? 0);
  }

  // ── FOYDA ──
  const profitCents = netCents - aiCostCents - lsFeeCents - infraCents - contributorCents;

  // ── Zararli modellar (marja < 1.0× = tannarxdan past) + narx-poli banneri ──
  const margins = await computeMargins(range.since || range.until ? { since: range.since, until: range.until } : undefined);
  const lossMaking = margins.models.filter((m) => m.margin != null && m.margin < 1.0);
  const floors = checkPricingFloors();

  return {
    month: month || null,
    revenue: {
      grossCents,
      netCents,
      byKind,
      byPlan: revenue.byPlan,
      subscriptionNetCents: revenue.subscriptionNetCents,
      creditPackNetCents: revenue.creditPackNetCents,
      refundsNetCents: revenue.refundsNetCents,
    },
    costs: {
      aiCents: aiCostCents,
      aiMeasuredCents: measuredCents,
      aiEstimatedCents: estimatedOnlyCents,
      aiConfidence: confCount, // {measured, official, estimated} — necha qator
      lsFeeCents,
      lsFeeBasis: { saleGrossCents, saleEvents, pct: LS_FEE_PCT, fixedCents: LS_FEE_FIXED_CENTS },
      infraCents,
      infraPresent,
      infraBreakdown,
      contributorCents,
      poolNegative,
    },
    // 🔴 Bepul foydalanuvchi krediti — DAROMAD EMAS. Alohida CAC.
    customerAcquisition: {
      freeUserAiCents: cacFreeCents, // sarflangan, daromad $0
      paidUserAiCents,
    },
    profitCents,
    lossMakingModels: lossMaking.map((m) => ({
      modelId: m.modelId,
      label: m.label,
      provider: m.provider,
      mode: m.mode,
      margin: m.margin,
      revenueUsd: m.revenueUsd,
      realCostUsd: m.realCostUsd,
      credits: m.credits,
    })),
    pricingFloors: floors, // {floorUsd, channels[], violations[]}
    generatedAt: new Date(),
  };
}
