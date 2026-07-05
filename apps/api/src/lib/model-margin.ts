/**
 * MARJA HISOBI (Bosqich 3.4/3.5) — READ-ONLY analitika. Pul mutatsiyasi YO'Q.
 *
 *   marja = daromad_usd / real_narx_usd
 *   daromad_usd  = yechilgan_kreditlar × creditUsdValue   (langar: PRO $19/1000 = $0.019)
 *   real_narx_usd = Σ ProviderSpend.estimatedCostUsd       (Bosqich 1 estimator)
 *
 * Har model + jami marja; maqsad marjadan (default 1.8x) past yoki narx MA'LUMOTI
 * to'liq bo'lmagan (estimatedCostUsd=null — masalan "Nano Pro price TAXMINIY") modellar
 * bayroqlanadi. Mavjud ProviderSpend/kredit ma'lumoti ustidan o'qiydi — hech nima yozmaydi.
 */
import { prisma } from "@creative-tools/database";
import { getModelById } from "./gen-models.js";
import { getPricingConfig } from "./model-pricing.js";

export type MarginRow = {
  modelId: number | null;
  label: string;
  provider: string | null;
  mode: string | null;
  gens: number; // ProviderSpend qatorlari soni
  credits: number; // yechilgan jami kredit
  revenueUsd: number;
  realCostUsd: number;
  margin: number | null; // real narx 0/noma'lum → null
  missingCostRows: number; // estimatedCostUsd=null bo'lgan qatorlar
  belowTarget: boolean;
  missingCost: boolean; // narx ma'lumoti to'liq emas (null qator bor yoki real narx 0)
};

export type MarginReport = {
  creditUsdValue: number;
  marginTarget: number;
  since: string | null;
  until: string | null;
  aggregate: {
    gens: number;
    credits: number;
    revenueUsd: number;
    realCostUsd: number;
    margin: number | null;
    belowTarget: boolean;
  };
  models: MarginRow[]; // eng past marja birinchi
  flagged: MarginRow[]; // belowTarget yoki missingCost
};

function round(n: number, d = 4): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

/**
 * Berilgan oynada (since/until) model va jami marja. Oyna berilmasa — butun tarix.
 */
export async function computeMargins(opts?: {
  since?: Date;
  until?: Date;
}): Promise<MarginReport> {
  const { creditUsdValue, marginTarget } = await getPricingConfig();
  const where: Record<string, unknown> = {};
  if (opts?.since || opts?.until) {
    where.createdAt = {
      ...(opts?.since ? { gte: opts.since } : {}),
      ...(opts?.until ? { lte: opts.until } : {}),
    };
  }

  const [grouped, nullCost] = await Promise.all([
    prisma.providerSpend.groupBy({
      by: ["modelId"],
      where,
      _sum: { credits: true, estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.providerSpend.groupBy({
      by: ["modelId"],
      where: { ...where, estimatedCostUsd: null },
      _count: { _all: true },
    }),
  ]);

  const nullByModel = new Map<number | null, number>();
  for (const n of nullCost) nullByModel.set(n.modelId, n._count._all);

  const rows: MarginRow[] = grouped.map((g) => {
    const model = g.modelId != null ? getModelById(g.modelId) : undefined;
    const credits = g._sum.credits ?? 0;
    const realCostUsd = round(g._sum.estimatedCostUsd == null ? 0 : Number(g._sum.estimatedCostUsd));
    const revenueUsd = round(credits * creditUsdValue);
    const margin = realCostUsd > 0 ? round(revenueUsd / realCostUsd, 3) : null;
    const missingCostRows = nullByModel.get(g.modelId) ?? 0;
    const missingCost = missingCostRows > 0 || realCostUsd <= 0;
    return {
      modelId: g.modelId,
      label: model?.label ?? (g.modelId == null ? "(unknown)" : `model ${g.modelId}`),
      provider: model?.provider ?? null,
      mode: model?.mode ?? null,
      gens: g._count._all,
      credits,
      revenueUsd,
      realCostUsd,
      margin,
      missingCostRows,
      belowTarget: margin != null && margin < marginTarget,
      missingCost,
    };
  });

  // Eng "og'riyotgan" birinchi: marja bor bo'lganlar o'sish tartibida, marjasizlar (noma'lum) oxirida.
  rows.sort((a, b) => {
    if (a.margin == null && b.margin == null) return b.credits - a.credits;
    if (a.margin == null) return 1;
    if (b.margin == null) return -1;
    return a.margin - b.margin;
  });

  const totCredits = rows.reduce((s, r) => s + r.credits, 0);
  const totReal = round(rows.reduce((s, r) => s + r.realCostUsd, 0));
  const totRev = round(totCredits * creditUsdValue);
  const aggMargin = totReal > 0 ? round(totRev / totReal, 3) : null;

  return {
    creditUsdValue,
    marginTarget,
    since: opts?.since ? opts.since.toISOString() : null,
    until: opts?.until ? opts.until.toISOString() : null,
    aggregate: {
      gens: rows.reduce((s, r) => s + r.gens, 0),
      credits: totCredits,
      revenueUsd: totRev,
      realCostUsd: totReal,
      margin: aggMargin,
      belowTarget: aggMargin != null && aggMargin < marginTarget,
    },
    models: rows,
    flagged: rows.filter((r) => r.belowTarget || r.missingCost),
  };
}

/**
 * Provider bo'yicha tizim TAXMINI (ProviderSpend.estimatedCostUsd yig'indisi) — Bosqich 3.5
 * reconciliation real invoice bilan solishtirish uchun ishlatadi.
 */
export async function spendByProvider(opts?: {
  since?: Date;
  until?: Date;
}): Promise<Array<{ provider: string; gens: number; credits: number; estimatedUsd: number }>> {
  const where: Record<string, unknown> = {};
  if (opts?.since || opts?.until) {
    where.createdAt = {
      ...(opts?.since ? { gte: opts.since } : {}),
      ...(opts?.until ? { lte: opts.until } : {}),
    };
  }
  const grouped = await prisma.providerSpend.groupBy({
    by: ["provider"],
    where,
    _sum: { credits: true, estimatedCostUsd: true },
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    provider: g.provider,
    gens: g._count._all,
    credits: g._sum.credits ?? 0,
    estimatedUsd: round(g._sum.estimatedCostUsd == null ? 0 : Number(g._sum.estimatedCostUsd)),
  }));
}
