import assert from "node:assert/strict";
import fs from "node:fs";
import {
  GEN_MODELS,
} from "../dist/lib/gen-models.js";
import {
  resolveModelAvailability,
} from "../dist/lib/gen-provider-availability.js";

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

const studioRoute = fs.readFileSync(new URL('../src/routes/studio-gen.ts', import.meta.url), 'utf8');
assert.doesNotMatch(studioRoute, /catalogVersion:\s*genCatalogVersion\(catalogModels\)/, 'filtered /models catalogVersion drifts from /ops');
assert.match(studioRoute, /catalogVersion:\s*genCatalogVersion\(\)/, 'canonical full-catalog version is required');
assert.match(studioRoute, /cancellable:\s*gen\.status\s*===\s*["']queued["']/, 'POST /gen must expose server-authoritative cancellable state');
assert.match(studioRoute, /cancellable\s*=\s*gen\.status\s*===\s*["']queued["']\s*&&\s*!genParams\.__providerJob/, 'GET /gen/:id must clear cancellable after provider dispatch');
assert.match(studioRoute, /const cursor = Math\.max\(0, Number\(req\.query\.cursor\) \|\| 0\)/, 'generation history must accept a bounded cursor');
assert.match(studioRoute, /res\.json\(\{ items, hasMore, nextCursor:/, 'generation history must return pagination metadata');

console.log(`✓ provider-availability-contract — ${enabled.length} enabled model, fail-closed`);
