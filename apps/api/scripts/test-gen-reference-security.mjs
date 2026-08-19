import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GEN_MODELS } from "../dist/lib/gen-models.js";
import { validateSavedReferenceMetadata } from "../dist/lib/gen-param-validation.js";

const model = GEN_MODELS.find((m) => m.id === 3103);
assert.ok(model && model.enabled !== false && model.mediaRefs, "multimodal reference fixture missing");

const mb = 1024 * 1024;
const good = validateSavedReferenceMetadata(model, [
  { id: "img", kind: "image", contentType: "image/png", sizeBytes: 2 * mb },
  { id: "vid", kind: "video", contentType: "video/mp4", sizeBytes: 20 * mb },
  { id: "aud", kind: "audio", contentType: "audio/mpeg", sizeBytes: 3 * mb },
]);
assert.deepEqual(good, []);

const badFormat = validateSavedReferenceMetadata(model, [
  { id: "bad-format", kind: "video", contentType: "video/webm", sizeBytes: mb },
]);
assert.ok(badFormat.some((e) => e.code === "REFERENCE_FORMAT_NOT_SUPPORTED"));

const tooLarge = validateSavedReferenceMetadata(model, [
  { id: "large", kind: "image", contentType: "image/png", sizeBytes: 31 * mb },
]);
assert.ok(tooLarge.some((e) => e.code === "REFERENCE_FILE_TOO_LARGE"));

const tooLargeTotal = validateSavedReferenceMetadata(model, [
  { id: "v1", kind: "video", contentType: "video/mp4", sizeBytes: 27 * mb },
  { id: "v2", kind: "video", contentType: "video/mp4", sizeBytes: 27 * mb },
]);
assert.ok(tooLargeTotal.some((e) => e.code === "REFERENCE_TOTAL_TOO_LARGE"));

const route = readFileSync(new URL("../src/routes/studio-gen.ts", import.meta.url), "utf8");
assert.match(route, /savedReference\.findMany\([\s\S]*?where:\s*\{\s*userId,\s*id:/, "saved refs must be user-scoped");
assert.match(route, /gen-refs\/\$\{userId\}/, "generated reference storage must be user-scoped");
assert.match(route, /gen-ref-src\/\$\{userId\}/, "source reference storage must be user-scoped");
assert.ok(
  (route.match(/validateReferenceOwnershipAndMetadata\(\s*req\.user!\.userId,\s*model,\s*normalized\.referenceManifest\s*\)/g) || []).length >= 3,
  "quote, preflight and gen must all use the same ownership gate"
);

assert.match(
  route,
  /async function hydrateParamsRefUrls[\s\S]*?gcsKeyFromUrl\(u\)[\s\S]*?getSignedDownloadUrl\(key, 7200\)/,
  "persisted generation references must be re-signed when history/session data is read"
);
assert.match(
  route,
  /async function cleanupExpiredSavedReferences[\s\S]*?generationId:\s*null[\s\S]*?userId/,
  "TTL cleanup must not remove references linked to a generation and must support account scoping"
);
assert.match(
  route,
  /async function touchSavedReferences[\s\S]*?where:\s*\{\s*userId,[\s\S]*?generationId,[\s\S]*?expiresAt:\s*savedReferenceExpiry\(now\)/,
  "used references must be account-scoped, linked to the generation and have their TTL renewed"
);
assert.match(
  route,
  /studioGenRouter\.delete\("\/gen\/sessions\/:id"[\s\S]*?tx\.savedReference\.findMany\([\s\S]*?generationId:\s*\{\s*in:\s*genIds\s*\},\s*userId:\s*session\.userId[\s\S]*?tx\.savedReference\.deleteMany/,
  "session deletion must remove only that account's linked references"
);
assert.match(
  route,
  /linkedRefs = await prisma\.savedReference\.findMany\(\{ where: \{ generationId: gen\.id, userId: gen\.userId \} \}\)[\s\S]*?savedReference\.deleteMany/,
  "generation deletion must remove only that account's linked references"
);

console.log("✓ reference-security-lifecycle — ownership, MIME, size, TTL, re-sign and orphan cleanup guards");
