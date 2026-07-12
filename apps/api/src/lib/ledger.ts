import { prisma } from "@creative-tools/database";

/**
 * CreditLedger — kredit consume/refund harakatining moliyaviy izi (Faza 2 #2.6).
 * BEST-EFFORT: writeAuditLog kabi try/catch bilan o'ralgan — ledger yozuvi
 * muvaffaqiyatsiz bo'lsa ham foydalanuvchi amalini (consume/refund) BLOKLAMAYDI.
 * Faqat non-ADMIN uchun chaqiriladi (ADMIN kredit sarflamaydi — chaqiruvchi tomon gate qiladi).
 */
export async function writeCreditLedger(entry: {
  userId: string;
  generationId?: string | null;
  delta: number; // manfiy = consume, musbat = refund
  reason: string; // "consume" | "refund"
  balanceAfter?: number | null;
}): Promise<void> {
  try {
    await prisma.creditLedger.create({
      data: {
        userId: entry.userId,
        generationId: entry.generationId ?? null,
        delta: entry.delta,
        reason: entry.reason,
        balanceAfter: entry.balanceAfter ?? null,
      },
    });
  } catch (e) {
    console.error("writeCreditLedger", e);
  }
}

/**
 * ProviderSpend — gen provayderga yuborilganda narx tahlili izi (Faza 2 #2.6).
 * BEST-EFFORT: xato foydalanuvchi genini bloklamaydi.
 */
export async function writeProviderSpend(entry: {
  generationId?: string | null;
  provider: string;
  modelId?: number | null;
  mode?: string | null;
  credits?: number | null;
  estimatedCostUsd?: number | string | null;
}): Promise<void> {
  try {
    await prisma.providerSpend.create({
      data: {
        generationId: entry.generationId ?? null,
        provider: entry.provider,
        modelId: entry.modelId ?? null,
        mode: entry.mode ?? null,
        credits: entry.credits ?? null,
        estimatedCostUsd: entry.estimatedCostUsd ?? null,
      },
    });
  } catch (e) {
    console.error("writeProviderSpend", e);
  }
}

// P24 Tier 2 — BytePlus har javobda token count qaytaradi; sotib olingan pack rate ma'lum
// ($4.30 / 1M token). tokens × rate = O'SHA generatsiyaning ANIQ USD'i (invoice kutmasdan).
// Env bilan override (rate o'zgarsa). BATCH5 jonli test formulani tasdiqlagan.
export const BYTEPLUS_USD_PER_1M_TOKENS = Number(process.env.BYTEPLUS_USD_PER_1M_TOKENS || 4.3);
export function byteplusTokensToUsd(tokens: number | null | undefined): number {
  const t = Number(tokens);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return (t / 1_000_000) * BYTEPLUS_USD_PER_1M_TOKENS;
}

/**
 * P24 — real (o'lchangan) provider USD'ni gen'ning MAVJUD ProviderSpend qatoriga yozadi.
 * BEST-EFFORT, ANALITIKA: kredit/refund matematikasiga TEGMAYDI (money zone emas). confidence
 * "measured" (token/invoice'dan) — estimate ustidan yozadi, admin narx jadvali (P24 Step 4) uchun.
 */
export async function recordMeasuredProviderCost(
  generationId: string,
  measuredUsd: number,
  confidence: "measured" | "official" = "measured"
): Promise<void> {
  if (!generationId || !(measuredUsd > 0)) return;
  try {
    await prisma.providerSpend.updateMany({
      where: { generationId },
      data: { measuredCostUsd: measuredUsd, confidence },
    });
  } catch (e) {
    console.error("recordMeasuredProviderCost", e);
  }
}
