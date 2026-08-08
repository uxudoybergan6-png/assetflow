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
assert.equal(publicHealth.db || publicHealth.checks?.db, "ok", "production DB health is not ok");

const login = await json("/api/plugin/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
assert.ok(typeof login.token === "string" && login.token.length > 20, "plugin login did not return a token");
const auth = { Authorization: `Bearer ${login.token}` };

const [health, catalog, ops] = await Promise.all([
  json("/api/studio/gen/health", { headers: auth }),
  json("/api/studio/gen/models", { headers: auth }),
  json("/api/studio/gen/ops", { headers: auth }),
]);

assert.ok(catalog.catalogVersion, "deployed catalog has no catalogVersion (old build or drift)");
assert.ok(catalog.providerStatus && typeof catalog.providerStatus === "object", "providerStatus missing");
assert.ok(Array.isArray(catalog.models), "models payload missing");
assert.ok(Array.isArray(catalog.unavailableModels), "unavailableModels payload missing");
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

const quoteModel = catalog.models.find((model) => model.refMode !== "required" && !model.opType);
assert.ok(quoteModel, "no reference-free model exists for a read-only quote smoke");
const quote = await json("/api/studio/gen/cost-quote", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ modelId: Number(quoteModel.id), mode: quoteModel.mode, params: {} }),
});
assert.ok(Number(quote.price) > 0 && typeof quote.signature === "string", "signed quote smoke failed");

console.log(
  `✓ production read-only — ${catalog.models.length} available, ${catalog.unavailableModels.length} unavailable, ` +
    `${ops.ops.length} ops, catalog ${catalog.catalogVersion}; generation=0, credits=0`
);
console.log(`  provider health keys: ${Object.keys(health.providers || health).sort().join(", ")}`);
