import assert from "node:assert/strict";
import fs from "node:fs";

const { parseVertexModerationResponse } = await import("../dist/lib/ai/vertex-enhance.js");

assert.deepEqual(
  parseVertexModerationResponse({
    text: "SAFE",
    candidates: [{ finishReason: "STOP", safetyRatings: [] }],
  }),
  { ok: true, blocked: false, categories: [], reason: null },
  "an explicit SAFE sentinel should pass"
);

const promptBlocked = parseVertexModerationResponse({
  promptFeedback: {
    blockReason: "SAFETY",
    safetyRatings: [
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", blocked: true },
    ],
  },
  candidates: [],
});
assert.equal(promptBlocked.ok, true);
assert.equal(promptBlocked.blocked, true);
assert.ok(promptBlocked.categories.includes("harm_category_sexually_explicit"));

const outputBlocked = parseVertexModerationResponse({
  text: "",
  candidates: [{ finishReason: "PROHIBITED_CONTENT", safetyRatings: [] }],
});
assert.equal(outputBlocked.ok, true);
assert.equal(outputBlocked.blocked, true);
assert.ok(outputBlocked.categories.includes("prohibited_content"));

const policyBlocked = parseVertexModerationResponse({
  text: "BLOCK",
  candidates: [{ finishReason: "STOP", safetyRatings: [] }],
});
assert.equal(policyBlocked.ok, true);
assert.equal(policyBlocked.blocked, true);
assert.deepEqual(policyBlocked.categories, ["vertex-policy"]);

for (const malformed of [null, {}, { text: "" }, { text: "SAFE enough" }]) {
  const verdict = parseVertexModerationResponse(malformed);
  assert.equal(verdict.ok, false, "missing/ambiguous safety response must be unavailable");
  assert.equal(verdict.blocked, true, "missing/ambiguous safety response must fail closed");
  assert.deepEqual(verdict.categories, ["unverified-content"]);
}

const route = fs.readFileSync("apps/api/src/routes/studio-gen.ts", "utf8");
const processor = fs.readFileSync("apps/api/src/lib/gen-processor.ts", "utf8");
const explore = fs.readFileSync("apps/api/src/lib/explore-submit.ts", "utf8");
assert.ok(route.includes("moderationReady"), "health/models expose moderation readiness");
assert.ok(route.includes("generationReady"), "health/models expose end-to-end generation readiness");
assert.ok(route.includes('"MODERATION_UNAVAILABLE" : "MODERATION_NOT_CONFIGURED"'), "models distinguish transient safety outage from missing configuration");
assert.ok(route.includes("safetyVerificationReadiness"), "health/models use an active moderation readiness probe");
assert.ok(route.includes('kind: "video" as const'), "input video references reach moderation");
assert.ok(route.includes('kind: "audio" as const'), "input audio references reach moderation");
assert.ok(processor.includes("a.type === ASSET_TYPE.video"), "generated video is moderated");
assert.ok(processor.includes("a.type === ASSET_TYPE.audio"), "generated audio is moderated");
assert.ok(explore.includes("moderateGenerationContent"), "Explore publishing uses the multimodal moderation gate");
assert.ok(explore.includes("media: [{ kind: mediaClass, url: mediaUrl }]"), "Explore verifies the real image/video/audio result");

console.log("Vertex moderation fail-closed parser checks passed.");
