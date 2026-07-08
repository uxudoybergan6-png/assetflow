import type { RequestHandler } from "express";
import { createHash, createPublicKey, verify } from "crypto";
import { prisma } from "@creative-tools/database";
import { processGenerationInBackground } from "../lib/gen-processor.js";
import { captureException } from "../lib/sentry.js";

const FAL_JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const FAL_JWKS_TTL_MS = 24 * 60 * 60 * 1000;
const FAL_WEBHOOK_MAX_SKEW_SEC = 300;

type FalWebhookBody = {
  request_id?: string;
  gateway_request_id?: string;
  status?: "OK" | "ERROR";
  payload?: unknown;
  error?: string;
  payload_error?: string;
};

type FalStoredWebhook = {
  provider: "fal";
  requestId: string;
  status: "OK" | "ERROR";
  payload?: unknown;
  error?: string;
  payloadError?: string;
  receivedAt: string;
};

type JwkEd25519 = {
  kty?: string;
  crv?: string;
  x?: string;
  [key: string]: unknown;
};

let falJwksCache: JwkEd25519[] = [];
let falJwksCacheUntil = 0;

async function getFalJwks(): Promise<JwkEd25519[]> {
  if (falJwksCache.length && Date.now() < falJwksCacheUntil) return falJwksCache;
  const res = await fetch(FAL_JWKS_URL);
  if (!res.ok) throw new Error(`fal JWKS HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: JwkEd25519[] };
  const keys = Array.isArray(body.keys)
    ? body.keys.filter(
        (k): k is JwkEd25519 =>
          !!k &&
          typeof k === "object" &&
          k.kty === "OKP" &&
          k.crv === "Ed25519" &&
          typeof k.x === "string" &&
          k.x.length > 0
      )
    : [];
  if (!keys.length) throw new Error("fal JWKS bo'sh");
  falJwksCache = keys;
  falJwksCacheUntil = Date.now() + FAL_JWKS_TTL_MS;
  return keys;
}

function mustHeader(req: Parameters<RequestHandler>[0], name: string): string {
  const value = req.get(name)?.trim();
  if (!value) throw new Error(`${name} header yo'q`);
  return value;
}

async function verifyFalWebhook(
  req: Parameters<RequestHandler>[0]
): Promise<{ body: FalWebhookBody; requestId: string }> {
  const rawBody =
    Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");
  if (!rawBody.length) throw new Error("Webhook body bo'sh");

  const requestId = mustHeader(req, "X-Fal-Webhook-Request-Id");
  const userId = mustHeader(req, "X-Fal-Webhook-User-Id");
  const timestamp = mustHeader(req, "X-Fal-Webhook-Timestamp");
  const signatureHex = mustHeader(req, "X-Fal-Webhook-Signature");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("Webhook timestamp noto'g'ri");
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > FAL_WEBHOOK_MAX_SKEW_SEC) {
    throw new Error("Webhook muddati o'tgan");
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(signatureHex, "hex");
  } catch {
    throw new Error("Webhook signature noto'g'ri");
  }
  if (!signature.length) throw new Error("Webhook signature bo'sh");

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from(
    `${requestId}\n${userId}\n${timestamp}\n${bodyHash}`,
    "utf8"
  );
  const jwks = await getFalJwks();
  const valid = jwks.some((jwk) => {
    try {
      const key = createPublicKey({ key: jwk as never, format: "jwk" });
      return verify(null, message, key, signature);
    } catch {
      return false;
    }
  });
  if (!valid) throw new Error("Webhook imzosi tasdiqlanmadi");

  const body = JSON.parse(rawBody.toString("utf8")) as FalWebhookBody;
  if (body.request_id && body.request_id !== requestId) {
    throw new Error("Webhook request_id mos emas");
  }
  if (body.status !== "OK" && body.status !== "ERROR") {
    throw new Error("Webhook status noto'g'ri");
  }
  return { body, requestId };
}

function readFalRequestId(params: unknown): string {
  if (!params || typeof params !== "object") return "";
  const box = params as Record<string, unknown>;
  const job = box.__providerJob;
  if (job && typeof job === "object" && typeof (job as Record<string, unknown>).requestId === "string") {
    return String((job as Record<string, unknown>).requestId);
  }
  const hook = box.__providerWebhook;
  if (hook && typeof hook === "object" && typeof (hook as Record<string, unknown>).requestId === "string") {
    return String((hook as Record<string, unknown>).requestId);
  }
  return "";
}

async function findGenerationByFalRequestId(requestId: string) {
  const rows = await prisma.generation.findMany({
    where: { mode: "video" },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, status: true, params: true },
  });
  return rows.find((row) => readFalRequestId(row.params) === requestId) ?? null;
}

export const falWebhookHandler: RequestHandler = async (req, res) => {
  try {
    const { body, requestId } = await verifyFalWebhook(req);
    const gen = await findGenerationByFalRequestId(requestId);
    if (!gen) {
      console.warn(`[fal-webhook] generation topilmadi: ${requestId}`);
      res.status(200).json({ received: true, matched: false });
      return;
    }

    if (gen.status === "done" || gen.status === "failed") {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    const params =
      gen.params && typeof gen.params === "object"
        ? ({ ...(gen.params as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const hook: FalStoredWebhook = {
      provider: "fal",
      requestId,
      status: body.status === "ERROR" ? "ERROR" : "OK",
      payload: body.payload,
      error: typeof body.error === "string" ? body.error : undefined,
      payloadError:
        typeof body.payload_error === "string" ? body.payload_error : undefined,
      receivedAt: new Date().toISOString(),
    };
    params.__providerWebhook = hook;
    await prisma.generation.update({
      where: { id: gen.id },
      data: { params: params as object },
    });

    processGenerationInBackground(gen.id);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[fal-webhook] reject:", error);
    captureException(error, { area: "fal-webhook" });
    res.status(401).json({ error: "Invalid fal webhook" });
  }
};
