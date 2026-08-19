#!/usr/bin/env node
import assert from "node:assert/strict";

const base = (process.env.FRAMEFLOW_API_URL || "https://api.getframeflow.app").replace(/\/+$/, "");
const email = String(process.env.FRAMEFLOW_READONLY_EMAIL || "").trim();
const password = String(process.env.FRAMEFLOW_READONLY_PASSWORD || "");

if (!email || !password) {
  console.error(
    "FRAMEFLOW_READONLY_EMAIL va FRAMEFLOW_READONLY_PASSWORD kerak; skript token/parolni chiqarmaydi va generation qilmaydi."
  );
  process.exit(2);
}

async function json(path, options = {}) {
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
  if (!response.ok) {
    throw new Error(`${path} → HTTP ${response.status} ${String(body.code || body.error || "").slice(0, 120)}`);
  }
  return body;
}

const publicHealth = await json("/health");
assert.equal(publicHealth.status, "ok", "production API health is not ok");
assert.equal(publicHealth.checks?.db, "ok", "production DB health is not ok");
assert.equal(publicHealth.checks?.storage, "ok", "production storage health is not ok");

let auth = null;
try {
  const login = await json("/api/plugin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.ok(typeof login.token === "string" && login.token.length > 20, "plugin login did not return a token");
  auth = { Authorization: `Bearer ${login.token}` };

  const [health, catalog, ops] = await Promise.all([
    json("/api/studio/gen/health", { headers: auth }),
    json("/api/studio/gen/models", { headers: auth }),
    json("/api/studio/gen/ops", { headers: auth }),
  ]);

  assert.equal(health.moderationReady, true, "production moderation is not ready");
  assert.equal(health.generationReady, true, "production generation is not ready");
  const requiredModes = ["image", "video", "voice", "sfx"];
  assert.ok(Array.isArray(health.availableModes), "health.availableModes missing");
  for (const mode of requiredModes) {
    assert.ok(health.availableModes.includes(mode), `production ${mode} mode is unavailable`);
  }
  assert.ok(catalog.catalogVersion, "deployed catalog has no catalogVersion (old build or drift)");
  assert.ok(catalog.providerStatus && typeof catalog.providerStatus === "object", "providerStatus missing");
  assert.ok(Array.isArray(catalog.models), "models payload missing");
  assert.ok(Array.isArray(catalog.unavailableModels), "unavailableModels payload missing");
  assert.equal(catalog.moderationReady, true, "model catalog moderation is not ready");
  assert.equal(catalog.generationReady, true, "model catalog generation is not ready");
  assert.equal(catalog.configured, true, "model catalog is not configured");
  assert.ok(catalog.models.length > 0, "no selectable production models are available");
  assert.ok(Array.isArray(ops.ops), "ops payload missing");
  assert.equal(ops.catalogVersion, catalog.catalogVersion, "models/ops catalogVersion drift");

  for (const model of catalog.models) {
    assert.equal(model.available, true, `selectable model ${model.id} is not available`);
    assert.ok(model.provider, `selectable model ${model.id} has no provider`);
    assert.equal(
      catalog.providerStatus[model.provider],
      true,
      `selectable model ${model.id} uses unavailable provider ${model.provider}`
    );
  }

  for (const mode of requiredModes) {
    const quoteModel =
      catalog.models.find((model) => model.mode === mode && model.refMode === "none" && !model.opType) ||
      catalog.models.find((model) => model.mode === mode && model.refMode !== "required" && !model.opType);
    assert.ok(quoteModel, `no reference-free ${mode} model exists for a read-only quote smoke`);
    const quote = await json("/api/studio/gen/cost-quote", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ modelId: Number(quoteModel.id), mode, params: {} }),
    });
    assert.ok(Number(quote.price) > 0 && typeof quote.signature === "string", `${mode} signed quote smoke failed`);
    assert.ok(quote.pricedParams && typeof quote.pricedParams === "object", `${mode} canonical pricedParams missing`);
  }

  console.log(
    `✓ production read-only — ${catalog.models.length} available, ${catalog.unavailableModels.length} unavailable, ` +
      `${requiredModes.length} modes, ${ops.ops.length} ops, catalog ${catalog.catalogVersion}; generation=0, credit delta=0`
  );
  console.log(`  provider health keys: ${Object.keys(health).filter((key) => !["catalogVersion"].includes(key)).sort().join(", ")}`);
} finally {
  // Login har safar yangi 30 kunlik token yaratadi. Deploy smoke token qoldirmasin.
  if (auth) await json("/api/plugin/logout", { method: "POST", headers: auth });
}
