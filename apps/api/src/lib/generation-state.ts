const ACTIVE_SESSION_GENERATION_STATUSES = new Set(["reserving", "queued", "running"]);

/**
 * Sessiyani o'chirish mumkin emasligini bildiradigan holatlar. `reserving` ham
 * faol: job qatori yaratilgan, lekin kredit/slot yakunlanayotgan bo'lishi mumkin.
 */
export function isActiveSessionGeneration(status: string): boolean {
  return ACTIVE_SESSION_GENERATION_STATUSES.has(status);
}

/**
 * Failed job `backfillUnrefundedFailures` refund reconciler'iga hali kerakmi.
 * Predicate ataylab reconciler query'si bilan bir xil: u o'chirilsa ledger-backed
 * kreditni qaytarish uchun kerak bo'lgan Generation settlement qatori yo'qoladi.
 */
export function hasUnsettledGenerationRefund(input: {
  status: string;
  cost: number;
  refunded: boolean;
  refundStatus: string | null;
}): boolean {
  return input.status === "failed" &&
    input.cost > 0 &&
    !input.refunded &&
    (input.refundStatus == null || input.refundStatus === "pending");
}
