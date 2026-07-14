import { prisma } from "@creative-tools/database";

/**
 * Step 20 (D3) — INFRA xarajati (admin kiritgan oylik USD). Pool BAZASIDAN ayiriladi:
 *   pool = max(0, (obuna net − AI xarajati − INFRA)) × poolShare
 * va profit panelida (step 21) alohida qator. ProviderInvoice naqshi — admin qo'lda
 * kiritadi (GCP billing export bilan avtomatlashtirish keyin). FAQAT accounting;
 * money-zone consume/refund/HMAC'ga TEGMAYDI.
 *
 * INFRA = storage + egress (TRAFIK — ilgari umuman kuzatilmasdi) + compute.
 */

export type InfraCostBreakdown = {
  storageCents: number;
  egressCents: number;
  computeCents: number;
  totalCents: number;
  note: string | null;
  present: boolean; // shu oy uchun admin kiritganmi (false → 0, ogohlantirish)
};

function toCents(d: unknown): number {
  const n = Number(d);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Berilgan oy (YYYY-MM) uchun infra xarajatini centda qaytaradi (yo'q bo'lsa 0 + present=false). */
export async function getInfraCostForMonth(month: string): Promise<InfraCostBreakdown> {
  const empty: InfraCostBreakdown = {
    storageCents: 0,
    egressCents: 0,
    computeCents: 0,
    totalCents: 0,
    note: null,
    present: false,
  };
  if (!/^\d{4}-\d{2}$/.test(month)) return empty;
  const row = await prisma.infraCost.findUnique({ where: { periodMonth: month } });
  if (!row) return empty;
  const storageCents = toCents(row.storageUsd);
  const egressCents = toCents(row.egressUsd);
  const computeCents = toCents(row.computeUsd);
  return {
    storageCents,
    egressCents,
    computeCents,
    totalCents: storageCents + egressCents + computeCents,
    note: row.note ?? null,
    present: true,
  };
}

/** Admin oylik infra xarajatini kiritadi/yangilaydi (upsert, periodMonth unique). */
export async function upsertInfraCost(input: {
  periodMonth: string;
  storageUsd?: number;
  egressUsd?: number;
  computeUsd?: number;
  note?: string | null;
  createdById?: string | null;
}) {
  const clamp = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10000) / 10000 : 0;
  };
  const data = {
    storageUsd: clamp(input.storageUsd),
    egressUsd: clamp(input.egressUsd),
    computeUsd: clamp(input.computeUsd),
    note: input.note ?? null,
  };
  return prisma.infraCost.upsert({
    where: { periodMonth: input.periodMonth },
    create: { periodMonth: input.periodMonth, ...data, createdById: input.createdById ?? null },
    update: data,
  });
}

/** Ro'yxat — oxirgi N oy (admin ko'rinishi). */
export async function listInfraCosts(limit = 12) {
  return prisma.infraCost.findMany({
    orderBy: { periodMonth: "desc" },
    take: Math.max(1, Math.min(60, limit)),
  });
}
