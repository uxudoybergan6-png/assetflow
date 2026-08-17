import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createController } = require("../frameflow-create-workspace.js");
let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const imageA = {
  id: 1010, mode: "image", label: "A very long production image model name that must remain readable", isDefault: true,
  refKind: "image", refMode: "optional", maxRefs: 2,
  imgSettings: { aspect: { options: ["1:1", "16:9"], def: "1:1" }, quality: { options: ["1K", "2K"], def: "1K" }, num: [1, 2] }
};
const imageB = {
  id: 1011, mode: "image", label: "Reference model", refKind: "image", refMode: "required", maxRefs: 1,
  imgSettings: { aspect: { options: ["4:3"], def: "4:3" }, quality: { options: ["2K"], def: "2K" }, num: [1] }
};
const video = {
  id: 3001, mode: "video", label: "Video model", refKind: "media-refs", mediaRefLimits: { image: 2, video: 1, audio: 1, total: 3 },
  videoSettings: { aspect: { options: ["16:9", "9:16"], def: "16:9" }, resolution: { options: ["720p", "1080p"], def: "720p" }, duration: { options: [5, 10], def: 5 }, audio: true, audioDefault: false }
};

await check("mode routes to the selected real model catalog", async () => {
  const c = createController();
  c.setModels("image", [imageA, imageB]);
  c.setModels("video", [video]);
  assert.equal(c.snapshot().modelId, 1010);
  c.setMode("video");
  assert.equal(c.snapshot().modelId, 3001);
});

await check("existing session remains active when switching generation modes", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  c.setModels("video", [video]);
  c.setSession("mixed-session-1");
  c.setMode("video");
  assert.equal(c.snapshot().sessionId, "mixed-session-1");
  c.setMode("image");
  assert.equal(c.snapshot().sessionId, "mixed-session-1");
});

await check("model switch atomically validates output defaults and invalidates quote", async () => {
  const c = createController();
  c.setModels("image", [imageA, imageB]);
  assert.equal(c.setSetting("aspectRatio", "16:9"), true);
  await c.requestQuote(async () => ({ price: 8, signature: "test-signature" }));
  assert.equal(c.snapshot().quote.status, "ready");
  c.selectModel(1011);
  assert.equal(c.snapshot().settings.aspectRatio, "4:3");
  assert.equal(c.snapshot().quote.status, "idle");
});

await check("stale quote cannot become submit-ready", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  let release;
  const pending = c.requestQuote(() => new Promise((resolve) => { release = resolve; }));
  c.setSetting("quality", "2K");
  release({ price: 4, signature: "stale-signature" });
  assert.deepEqual(await pending, { stale: true });
  assert.notEqual(c.snapshot().quote.status, "ready");
});

await check("expired quote is rejected before dispatch", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  c.setPrompt("A current quote only");
  await c.requestQuote(async () => ({ price: 4, signature: "expired-signature", expiresAt: "2000-01-01T00:00:00.000Z" }));
  assert.equal(c.snapshot().validation.reason, "quote_expired");
  await assert.rejects(() => c.submit(async () => {}), /quote_expired/);
});

await check("quote signature stays out of snapshots but reaches the trusted dispatch once", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  c.setPrompt("A clean editorial frame");
  await c.requestQuote(async () => ({ price: 4, signature: "secret-signed-quote", issuedAt: 1 }));
  let payload;
  await c.submit(async (p) => { payload = p; return { accepted: true }; });
  assert.equal(JSON.stringify(c.snapshot()).includes("secret-signed-quote"), false);
  assert.equal(payload.costQuoteSignature, "secret-signed-quote");
  assert.equal(payload.quotedPrice, 4);
});

await check("new-session submit is deduplicated while dispatch is pending", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  c.setPrompt("One job only");
  await c.requestQuote(async () => ({ price: 4, signature: "test-signature" }));
  let calls = 0;
  let finish;
  const dispatch = () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); };
  const a = c.submit(dispatch);
  const b = c.submit(dispatch);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({ accepted: true });
  await Promise.all([a, b]);
});

await check("existing session id is carried into the real generation dispatch", async () => {
  const c = createController();
  c.setModels("image", [imageA]);
  c.setSession("session-existing-42");
  c.setPrompt("Continue this visual conversation");
  await c.requestQuote(async () => ({ price: 4, signature: "test-signature" }));
  let payload;
  await c.submit(async (p) => { payload = p; return { accepted: true }; });
  assert.equal(payload.sessionId, "session-existing-42");
});

await check("required reference blocks submit before any dispatch", async () => {
  const c = createController();
  c.setModels("image", [imageB]);
  c.setPrompt("Edit this image");
  await c.requestQuote(async () => ({ price: 6, signature: "test-signature" }));
  assert.equal(c.snapshot().validation.reason, "reference_required");
  await assert.rejects(() => c.submit(async () => {}), /reference_required/);
});

await check("reference limits are capability-driven and incompatible refs are retained visibly", async () => {
  const c = createController();
  c.setModels("video", [video]);
  c.setMode("video");
  assert.equal(c.addReference({ id: "i1", kind: "image", title: "Frame" }).ok, true);
  assert.equal(c.addReference({ id: "a1", kind: "audio", title: "Beat" }).ok, true);
  assert.equal(c.addReference({ id: "x1", kind: "document", title: "Notes" }).reason, "unsupported_reference");
  c.setModels("image", [imageA]);
  c.setMode("image");
  assert.equal(c.snapshot().references.some((r) => r.id === "a1" && r.active === false), true);
});

await check("quote and submit carry canonical multimodal reference fields, never referenceCount", async () => {
  const c = createController();
  c.setModels("video", [video]);
  c.setMode("video");
  c.setPrompt("Animate the frame to this beat");
  assert.equal(c.addReference({ id: "i1", kind: "image", url: "https://example.com/frame.png", savedRefId: "saved-i1" }).ok, true);
  assert.equal(c.addReference({ id: "a1", kind: "audio", url: "https://example.com/beat.mp3", savedRefId: "saved-a1" }).ok, true);
  let quoted;
  await c.requestQuote(async (q) => {
    quoted = q;
    return { price: 12, signature: "signed", pricedParams: q.params };
  });
  assert.deepEqual(quoted.params.imageUrls, ["https://example.com/frame.png"]);
  assert.deepEqual(quoted.params.audioUrls, ["https://example.com/beat.mp3"]);
  assert.deepEqual(quoted.params.savedReferenceIds, ["saved-i1", "saved-a1"]);
  assert.equal("referenceCount" in quoted.params, false);
  let payload;
  await c.submit(async (p) => { payload = p; return { accepted: true }; });
  assert.deepEqual(payload.params, quoted.params);
});

await check("audio-only multimodal draft is blocked before quote-backed submit", async () => {
  const c = createController();
  c.setModels("video", [video]);
  c.setMode("video");
  c.setPrompt("Use this sound");
  assert.equal(c.addReference({ id: "a1", kind: "audio", url: "https://example.com/beat.mp3" }).ok, true);
  await c.requestQuote(async () => ({ price: 12, signature: "signed" }));
  assert.equal(c.snapshot().validation.reason, "audio_reference_requires_visual");
});

await check("unsupported output setting cannot leak into the payload", async () => {
  const c = createController();
  c.setModels("video", [video]);
  c.setMode("video");
  assert.equal(c.setSetting("duration", 10), true);
  assert.equal(c.setSetting("duration", 30), false);
  assert.equal(c.snapshot().settings.duration, 10);
});

console.log(`create-workspace behavior: ${passed} passed, 0 failed`);
