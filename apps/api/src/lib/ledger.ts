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
