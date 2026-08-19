import crypto from "crypto";
import { AiGenerationStatus, prisma } from "@creative-tools/database";
import { ensurePluginProfile, refundAiCredits } from "./plugin-profile.js";

export type AssistKind = "enhance" | "describe";
export type AssistHttpResult = { status: number; body: unknown };

export type AssistIdentity = {
  id: string;
  requestHash: string;
  consumeSourceKey: string;
  refundSourceKey: string;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Raw idempotency kalitini DB'ga yozmaydi; user+kind bilan namespacelangan digest ishlatadi. */
export function assistIdentity(
  userId: string,
  kind: AssistKind,
  requestKey: string,
  payload: unknown
): AssistIdentity {
  const digest = crypto.createHash("sha256").update(`${userId}:${kind}:${requestKey}`).digest("hex");
  const id = `assist_${digest.slice(0, 36)}`;
  const requestHash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  return {
    id,
    requestHash,
    consumeSourceKey: `assist:${id}:consume`,
    refundSourceKey: `assist:${id}:refund`,
  };
}

function parseStoredResult(raw: string | null): AssistHttpResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { status?: unknown; body?: unknown };
    if (!Number.isInteger(parsed.status) || Number(parsed.status) < 100 || Number(parsed.status) > 599) return null;
    return { status: Number(parsed.status), body: parsed.body };
  } catch {
    return null;
  }
}

function withReplayMetadata(body: unknown, creditsLeft: number): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { result: body, creditsLeft, idempotentReplay: true };
  }
  return { ...(body as Record<string, unknown>), creditsLeft, idempotentReplay: true };
}

export type AssistReplay =
  | { state: "missing" }
  | { state: "conflict"; result: AssistHttpResult }
  | { state: "pending"; result: AssistHttpResult }
  | { state: "settled"; result: AssistHttpResult };

/**
 * Boshqa Cloud Run instansidagi operatsiya tugashini qisqa kutadi va durable javobni qaytaradi.
 * PENDING uzoq davom etsa 409 qaytariladi; u provider'ni ikkinchi marta chaqirmaydi.
 */
export async function readAssistReplay(
  userId: string,
  identity: AssistIdentity,
  waitMs = 12_000
): Promise<AssistReplay> {
  const deadline = Date.now() + Math.max(0, waitMs);
  for (;;) {
    const row = await prisma.aiGeneration.findUnique({ where: { id: identity.id } });
    if (!row) return { state: "missing" };
    if (row.userId !== userId || row.prompt !== `assist:v1:${identity.requestHash}`) {
      return {
        state: "conflict",
        result: {
          status: 409,
          body: {
            error: "Idempotency key was already used for a different AI request",
            code: "IDEMPOTENCY_CONFLICT",
            retryable: false,
          },
        },
      };
    }
    const stored = parseStoredResult(row.resultKey);
    if (stored && (row.status === AiGenerationStatus.DONE || row.status === AiGenerationStatus.FAILED)) {
      const profile = await ensurePluginProfile(userId);
      return {
        state: "settled",
        result: { status: stored.status, body: withReplayMetadata(stored.body, profile.aiCredits) },
      };
    }
    if (Date.now() >= deadline) {
      return {
        state: "pending",
        result: {
          status: 409,
          body: {
            error: "This AI assist request is already being processed — wait a moment before trying again",
            code: "IDEMPOTENCY_IN_PROGRESS",
            retryable: true,
          },
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Natijani faqat hali PENDING bo'lsa yozadi; stale-refund bilan poygada late success yutmaydi. */
export async function settleAssistOperation(
  userId: string,
  identity: AssistIdentity,
  result: AssistHttpResult
): Promise<boolean> {
  const status = result.status >= 200 && result.status < 300
    ? AiGenerationStatus.DONE
    : AiGenerationStatus.FAILED;
  const changed = await prisma.aiGeneration.updateMany({
    where: {
      id: identity.id,
      userId,
      prompt: `assist:v1:${identity.requestHash}`,
      status: AiGenerationStatus.PENDING,
    },
    data: { status, resultKey: JSON.stringify(result) },
  });
  return changed.count > 0;
}

/**
 * Process/instance provider chaqiruvi o'rtasida o'lsa, assist PENDING qoladi. Gen reconciler
 * buni bounded vaqtda FAILED qiladi va aynan original consume ledgerigacha refund beradi.
 * FAILED+null — oldingi pass statusni claim qilib, refunddan oldin o'lgan holat; qayta olinadi.
 */
export async function reconcileStaleAssistOperations(): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(60_000, Number(process.env.ASSIST_STALE_MS) || 10 * 60_000));
  const rows = await prisma.aiGeneration.findMany({
    where: {
      id: { startsWith: "assist_" },
      OR: [
        { status: AiGenerationStatus.PENDING, createdAt: { lt: cutoff } },
        { status: AiGenerationStatus.FAILED, resultKey: null },
      ],
    },
    select: { id: true, userId: true, credits: true, status: true },
    take: 100,
  });
  let repaired = 0;
  for (const row of rows) {
    if (row.status === AiGenerationStatus.PENDING) {
      const claimed = await prisma.aiGeneration.updateMany({
        where: { id: row.id, status: AiGenerationStatus.PENDING },
        data: { status: AiGenerationStatus.FAILED },
      });
      if (!claimed.count) continue;
    }
    const consumeSourceKey = `assist:${row.id}:consume`;
    const refundSourceKey = `assist:${row.id}:refund`;
    try {
      const creditsLeft = await refundAiCredits(row.userId, row.credits, {
        generationId: row.id,
        consumeSourceKey,
        sourceKey: refundSourceKey,
      });
      const refundLedger = await prisma.creditLedger.findUnique({ where: { sourceKey: refundSourceKey } });
      const creditsRefunded = refundLedger?.userId === row.userId && refundLedger.reason === "refund"
        ? Math.max(0, refundLedger.delta)
        : 0;
      await prisma.aiGeneration.update({
        where: { id: row.id },
        data: {
          resultKey: JSON.stringify({
            status: 503,
            body: {
              error: "AI assist was interrupted — your credits were refunded. Start a new request.",
              code: "ASSIST_INTERRUPTED",
              retryable: false,
              creditsLeft,
              creditsRefunded,
            },
          }),
        },
      });
      repaired += 1;
    } catch (error) {
      console.error(`[assist] stale refund failed (${row.id}):`, error);
    }
  }
  return repaired;
}
