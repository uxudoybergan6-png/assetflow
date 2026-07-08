import { prisma } from "@creative-tools/database";

/**
 * FAZA 4 (A) — REAL daromad hisobi (RevenueEvent ledger).
 *
 * Lemon Squeezy webhook to'lov SUMMALARINI shu yerga yozadi (ilgari faqat
 * product/status o'qilib, summa tashlab yuborilardi). Bu ACCOUNTING qatlami —
 * kredit consume/refund/limit pul-zonasiga TEGMAYDI.
 *
 * IDEMPOTENTLIK: sourceKey @unique + createMany(skipDuplicates) → webhook
 * qayta yetkazilsa (yoki claim o'chirilib retry bo'lsa) IKKINCHI qator yozilmaydi.
 * Manfiy summalar = refund/chargeback (FAZA 4 B).
 */

export type RevenueKind =
  | "subscription_initial"
  | "renewal"
  | "credit_pack"
  | "refund"
  | "chargeback";

export type RevenueEventInput = {
  sourceKey: string;
  userId?: string | null;
  kind: RevenueKind;
  plan?: string | null;
  grossCents: number;
  taxCents?: number;
  feeCents?: number;
  currency?: string | null;
  lsOrderId?: string | null;
  lsSubscriptionId?: string | null;
  lsInvoiceId?: string | null;
  eventName?: string | null;
  occurredAt?: Date | null;
};

/**
 * LS payload'idan cent qiymatini o'qiydi: avval `<field>_usd` (LS USD'ga
 * normalizatsiya qilingan cent), bo'lmasa xom `<field>` (do'kon valyutasida cent).
 * LS summalari HAR DOIM integer cent.
 */
export function lsAmountCents(
  attrs: Record<string, unknown> | undefined,
  field: string
): number {
  const usd = Number((attrs as Record<string, unknown> | undefined)?.[`${field}_usd`]);
  if (Number.isFinite(usd)) return Math.round(usd);
  const raw = Number((attrs as Record<string, unknown> | undefined)?.[field]);
  return Number.isFinite(raw) ? Math.round(raw) : 0;
}

/** Idempotent yozuv — sourceKey allaqachon mavjud bo'lsa jim no-op (false qaytadi). */
export async function recordRevenueEvent(input: RevenueEventInput): Promise<boolean> {
  const gross = Math.round(input.grossCents);
  const tax = Math.round(input.taxCents ?? 0);
  const fee = Math.round(input.feeCents ?? 0);
  if (!Number.isFinite(gross) || gross === 0) return false; // bo'sh hodisa yozilmaydi
  try {
    const res = await prisma.revenueEvent.createMany({
      data: [
        {
          sourceKey: input.sourceKey,
          userId: input.userId ?? null,
          kind: input.kind,
          plan: input.plan ?? null,
          grossCents: gross,
          taxCents: tax,
          feeCents: fee,
          netCents: gross - tax - fee,
          currency: (input.currency || "USD").toUpperCase(),
          lsOrderId: input.lsOrderId ?? null,
          lsSubscriptionId: input.lsSubscriptionId ?? null,
          lsInvoiceId: input.lsInvoiceId ?? null,
          eventName: input.eventName ?? null,
          occurredAt: input.occurredAt ?? new Date(),
        },
      ],
      skipDuplicates: true,
    });
    return res.count > 0;
  } catch (e) {
    // Accounting BEST-EFFORT emas — xato chaqiruvchiga ko'tariladi (webhook claim
    // o'chib LS retry qiladi), lekin log ham qoldiramiz.
    console.error("recordRevenueEvent", e);
    throw e;
  }
}

type Range = { since?: Date; until?: Date };

function occurredAtWhere(range: Range) {
  if (!range.since && !range.until) return {};
  return {
    occurredAt: {
      ...(range.since ? { gte: range.since } : {}),
      ...(range.until ? { lt: range.until } : {}),
    },
  };
}

const SUBSCRIPTION_KINDS = ["subscription_initial", "renewal"] as const;

/**
 * Davr bo'yicha REAL daromad xulosasi (admin finance):
 * gross/net/tax, kind bo'yicha taqsim, obuna to'lovlarining plan bo'yicha taqsimi,
 * refund/chargeback jami (manfiy). MRR = davrdagi obuna NET tushumi (initial+renewal,
 * refundlar alohida ko'rsatiladi). // TODO: yillik to'lovlarni oyga normalizatsiya
 * qilish (hozircha yillik variant sotilmaydi).
 */
export async function revenueSummary(range: Range = {}) {
  const where = occurredAtWhere(range);
  const [byKind, byPlan] = await Promise.all([
    prisma.revenueEvent.groupBy({
      by: ["kind"],
      where,
      _sum: { grossCents: true, netCents: true, taxCents: true },
      _count: { _all: true },
    }),
    prisma.revenueEvent.groupBy({
      by: ["plan"],
      where: { ...where, kind: { in: [...SUBSCRIPTION_KINDS] } },
      _sum: { netCents: true },
      _count: { _all: true },
    }),
  ]);
  const kinds: Record<string, { grossCents: number; netCents: number; taxCents: number; events: number }> = {};
  let grossCents = 0;
  let netCents = 0;
  let taxCents = 0;
  let events = 0;
  for (const k of byKind) {
    const row = {
      grossCents: k._sum.grossCents ?? 0,
      netCents: k._sum.netCents ?? 0,
      taxCents: k._sum.taxCents ?? 0,
      events: k._count._all,
    };
    kinds[k.kind] = row;
    grossCents += row.grossCents;
    netCents += row.netCents;
    taxCents += row.taxCents;
    events += row.events;
  }
  const subscriptionNetCents =
    (kinds.subscription_initial?.netCents ?? 0) + (kinds.renewal?.netCents ?? 0);
  const refundsNetCents = (kinds.refund?.netCents ?? 0) + (kinds.chargeback?.netCents ?? 0);
  return {
    grossCents,
    netCents,
    taxCents,
    events,
    byKind: kinds,
    byPlan: byPlan.map((p) => ({
      plan: p.plan ?? "UNKNOWN",
      netCents: p._sum.netCents ?? 0,
      events: p._count._all,
    })),
    subscriptionNetCents,
    creditPackNetCents: kinds.credit_pack?.netCents ?? 0,
    refundsNetCents, // manfiy yoki 0
    mrrCents: subscriptionNetCents, // davr = oy bo'lsa: real oylik obuna tushumi
  };
}

/**
 * Davr uchun OBUNA net tushumi + shu obunalarga tegishli refundlar (pool bazasi,
 * FAZA 4 C). Kredit-paket tushumi/refundlari KIRMAYDI. Refund qatorining obunaga
 * tegishliligi: lsInvoiceId (invoice refund) yoki plan (obuna order refund) bor.
 */
export async function netSubscriptionRevenueCents(range: Range = {}): Promise<number> {
  const where = occurredAtWhere(range);
  const [subs, refunds] = await Promise.all([
    prisma.revenueEvent.aggregate({
      where: { ...where, kind: { in: [...SUBSCRIPTION_KINDS] } },
      _sum: { netCents: true },
    }),
    prisma.revenueEvent.aggregate({
      where: {
        ...where,
        kind: { in: ["refund", "chargeback"] },
        OR: [{ lsInvoiceId: { not: null } }, { plan: { not: null } }],
      },
      _sum: { netCents: true },
    }),
  ]);
  return (subs._sum.netCents ?? 0) + (refunds._sum.netCents ?? 0);
}
