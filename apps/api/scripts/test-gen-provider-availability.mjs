import assert from "node:assert/strict";
import {
  GEN_MODELS,
} from "../dist/lib/gen-models.js";
import {
  resolveModelAvailability,
  noteProviderFailure,
  noteProviderSuccess,
  genCatalogVersion,
} from "../dist/lib/gen-provider-availability.js";
import fs from "node:fs";

const providers = [
  "openrouter",
  "freepik",
  "elevenlabs",
  "magnific",
  "fal",
  "vertex",
  "vertex-omni",
  "vertex-image",
  "google-tts",
  "byteplus",
  "kling",
  "topaz",
];
const none = Object.fromEntries(providers.map((p) => [p, false]));
const enabled = GEN_MODELS.filter((m) => m.enabled !== false);

for (const model of enabled) {
  assert.ok(model.provider, `enabled model ${model.id} must declare provider`);
  const unavailable = resolveModelAvailability(model, none);
  assert.equal(unavailable.available, false, `${model.id} must be unavailable when provider is false`);
  assert.equal(unavailable.unavailableCode, "PROVIDER_NOT_CONFIGURED");

  const own = { ...none, [model.provider]: true };
  const available = resolveModelAvailability(model, own);
  assert.equal(available.available, true, `${model.id} must be available when its provider is true`);
}

const undeclared = resolveModelAvailability(
  { ...enabled[0], id: 999001, provider: undefined },
  Object.fromEntries(providers.map((p) => [p, true]))
);
assert.equal(undeclared.available, false);
assert.equal(undeclared.unavailableCode, "PROVIDER_UNDECLARED");

const unknown = resolveModelAvailability(
  { ...enabled[0], id: 999002, provider: "future-provider" },
  Object.fromEntries(providers.map((p) => [p, true]))
);
assert.equal(unknown.available, false, "unknown provider must fail closed");

const circuitModel = enabled.find((m) => m.provider === "elevenlabs") || enabled[0];
const circuitConfigured = { ...none, [circuitModel.provider]: true };
assert.equal(noteProviderFailure(circuitModel.provider, "temporary HTTP 503"), false, "transient errors do not open a permanent provider circuit");
assert.equal(resolveModelAvailability(circuitModel, circuitConfigured).available, true);
assert.equal(noteProviderFailure(circuitModel.provider, "HTTP 401 unauthorized API key"), true, "auth/config failures open the runtime circuit");
assert.equal(resolveModelAvailability(circuitModel, circuitConfigured).unavailableCode, "PROVIDER_UNAVAILABLE");
noteProviderSuccess(circuitModel.provider);
assert.equal(resolveModelAvailability(circuitModel, circuitConfigured).available, true, "a successful provider result closes the circuit");

const oldRevision = process.env.K_REVISION;
process.env.K_REVISION = "assetflow-api-00999-test";
const version = genCatalogVersion(enabled);
assert.match(version, /^assetflow-ap-[a-f0-9]{12}$/, "Cloud Run revision identifies the catalog instead of `local`");
const repriced = enabled.map((m, index) => index === 0 ? { ...m, cost: m.cost + 1 } : m);
assert.notEqual(genCatalogVersion(repriced), version, "catalog fingerprint changes when canonical price changes");
if (oldRevision === undefined) delete process.env.K_REVISION;
else process.env.K_REVISION = oldRevision;

const route = fs.readFileSync("apps/api/src/routes/studio-gen.ts", "utf8");
assert.equal(route.includes("Object.values(providerStatus).some(Boolean)"), false, "unused configured providers cannot make generationReady true");
assert.ok(route.includes("catalogVersion: genCatalogVersion(fullCatalog)"), "models and ops share the full resolved catalog fingerprint");

console.log(`✓ provider-availability-contract — ${enabled.length} enabled model, fail-closed`);
