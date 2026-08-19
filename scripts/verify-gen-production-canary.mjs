#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";

const base = (process.env.FRAMEFLOW_API_URL || "https://api.getframeflow.app").replace(/\/+$/, "");
const email = String(process.env.FRAMEFLOW_READONLY_EMAIL || "").trim();
const password = String(process.env.FRAMEFLOW_READONLY_PASSWORD || "");

if (!email || !password) {
  console.error(
    "FRAMEFLOW_READONLY_EMAIL va FRAMEFLOW_READONLY_PASSWORD kerak; skript token/parolni chiqarmaydi."
  );
  process.exit(2);
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function json(path, options = {}) {
  const result = await request(path, options);
  if (!result.response.ok) {
    throw new Error(
      `${path} → HTTP ${result.response.status} ${String(result.body.code || result.body.error || "").slice(0, 120)}`
    );
  }
  return result.body;
}

let auth = null;
let sessionId = "";
let creditsBefore = null;
try {
  const login = await json("/api/plugin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.ok(typeof login.token === "string" && login.token.length > 20, "plugin login did not return a token");
  auth = { Authorization: `Bearer ${login.token}` };

  const initialCredits = await json("/api/studio/credits", { headers: auth });
  creditsBefore = Number(initialCredits.aiCredits);
  assert.ok(Number.isFinite(creditsBefore), "initial credit balance is invalid");

  const [health, catalog] = await Promise.all([
    json("/api/studio/gen/health", { headers: auth }),
    json("/api/studio/gen/models?mode=image", { headers: auth }),
  ]);
  assert.equal(health.moderationReady, true, "production moderation is not ready");
  assert.equal(health.generationReady, true, "production generation is not ready");
  for (const mode of ["image", "video", "voice", "sfx"]) {
    assert.ok(health.availableModes?.includes(mode), `production ${mode} mode is unavailable`);
  }
  assert.equal(catalog.configured, true, "image model catalog is not configured");
  assert.ok(Array.isArray(catalog.models) && catalog.models.length > 0, "no image model is selectable");

  const model = catalog.models.find((item) => item.refMode === "none" && !item.opType) ||
    catalog.models.find((item) => item.refMode !== "required" && !item.opType);
  assert.ok(model, "no reference-free image model exists for the canary");

  const quote = await json("/api/studio/gen/cost-quote", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ modelId: Number(model.id), mode: "image", params: {} }),
  });
  assert.ok(Number(quote.price) > 0 && quote.pricedParams, "canary quote is invalid");

  const session = await json("/api/studio/gen/sessions", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ mode: "image", title: "Deployment safety canary" }),
  });
  sessionId = String(session.id || "");
  assert.ok(sessionId, "canary session was not created");

  // `/gen` moderatsiyani quote imzosidan OLDIN, kreditni esa undan KEYIN tekshiradi.
  // Ataylab yaroqsiz imzo real Vertex/dedicated moderation chaqirig‘ini isbotlaydi,
  // lekin Generation row, kredit rezervi yoki provider job yaratmaydi.
  const started = Date.now();
  const canary = await request("/api/studio/gen", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      sessionId,
      mode: "image",
      prompt: "A plain blue ceramic cup on a clean white table.",
      modelId: Number(model.id),
      params: quote.pricedParams,
      price: Number(quote.price),
      costQuoteSignature: "invalid-deployment-canary-signature",
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  assert.equal(canary.response.status, 400, `canary returned HTTP ${canary.response.status}`);
  assert.equal(canary.body.code, "BAD_QUOTE", `moderation path stopped at ${canary.body.code || "unknown"}`);

  console.log(
      `✓ production zero-spend canary — plugin login, ${catalog.models.length} image models, ` +
      `moderation ${Date.now() - started}ms; generation=0, credit delta=0`
  );
} finally {
  const cleanupErrors = [];
  if (sessionId) {
    try {
      const cleanup = await request(`/api/studio/gen/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: auth,
      });
      assert.equal(cleanup.response.status, 200, "canary session cleanup failed");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (auth && creditsBefore != null) {
    try {
      const finalCredits = await json("/api/studio/credits", { headers: auth });
      assert.equal(Number(finalCredits.aiCredits), creditsBefore, "zero-spend canary changed the credit balance");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (auth) {
    try {
      await json("/api/plugin/logout", { method: "POST", headers: auth });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "canary cleanup or zero-spend verification failed");
}
