import assert from "node:assert/strict";
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

console.log(`✓ provider-availability-contract — ${enabled.length} enabled model, fail-closed`);
