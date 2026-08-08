import assert from "node:assert/strict";
import { GEN_MODELS } from "../dist/lib/gen-models.js";
import { normalizeAndValidateGenParams } from "../dist/lib/gen-param-validation.js";
import { genParamsHash, signCostQuote, verifyCostQuote } from "../dist/lib/gen-quote.js";

const enabled = GEN_MODELS.filter((m) => m.enabled !== false);
let checks = 0;

for (const model of enabled) {
  const required = {};
  if (model.refMode === "required") {
    required.referenceUrl = "https://example.invalid/start.png";
    if (model.mode === "image") required.referenceUrls = [required.referenceUrl];
  }
  const base = normalizeAndValidateGenParams(model, required);
  assert.equal(
    base.ok,
    true,
    `${model.id} default canonical params failed: ${base.errors.map((e) => e.code).join(",")}`
  );
  checks++;

  const unknown = normalizeAndValidateGenParams(model, { ...required, definitelyUnknown: true });
  assert.ok(unknown.errors.some((e) => e.code === "PARAM_NOT_SUPPORTED"), `${model.id} unknown key accepted`);
  checks++;

  if (!model.endFrame) {
    const end = normalizeAndValidateGenParams(model, {
      ...required,
      referenceUrl: "https://example.invalid/start.png",
      referenceEndUrl: "https://example.invalid/end.png",
    });
    assert.ok(end.errors.some((e) => e.code === "END_FRAME_NOT_SUPPORTED"), `${model.id} unsupported end accepted`);
    checks++;
  } else {
    const noStart = normalizeAndValidateGenParams(model, {
      referenceEndUrl: "https://example.invalid/end.png",
    });
    assert.ok(noStart.errors.some((e) => e.code === "END_FRAME_REQUIRES_START"), `${model.id} end without start accepted`);
    checks++;
  }

  if (model.mode === "image" && Number.isInteger(model.maxRefs)) {
    const refs = Array.from({ length: model.maxRefs + 1 }, (_, i) => `https://example.invalid/${i}.png`);
    const over = normalizeAndValidateGenParams(model, { referenceUrl: refs[0], referenceUrls: refs });
    assert.ok(over.errors.some((e) => e.code === "REFERENCE_LIMIT_EXCEEDED"), `${model.id} maxRefs+1 accepted`);
    checks++;
  }

  if (model.mediaRefs) {
    const over = normalizeAndValidateGenParams(model, {
      imageUrls: Array.from({ length: model.mediaRefs.image + 1 }, (_, i) => `https://example.invalid/${i}.png`),
    });
    assert.ok(over.errors.some((e) => e.code === "REFERENCE_LIMIT_EXCEEDED"), `${model.id} mediaRefs.image+1 accepted`);
    checks++;
  }
}

const model = enabled.find((m) => m.mode === "image" && m.maxRefs && m.maxRefs > 1);
assert.ok(model, "multi-reference image model missing");
const a = normalizeAndValidateGenParams(model, {
  referenceUrl: "https://example.invalid/a.png",
  referenceUrls: ["https://example.invalid/a.png"],
}).canonicalParams;
const b = normalizeAndValidateGenParams(model, {
  referenceUrl: "https://example.invalid/b.png",
  referenceUrls: ["https://example.invalid/b.png"],
}).canonicalParams;
assert.notEqual(genParamsHash(model.id, model.mode, a), genParamsHash(model.id, model.mode, b));

const videoModel = enabled.find((m) => m.mediaRefs?.video);
assert.ok(videoModel, "multimodal video model missing");
const videoA = normalizeAndValidateGenParams(videoModel, {
  videoUrls: ["https://example.invalid/a.mp4"],
}).canonicalParams;
const videoB = normalizeAndValidateGenParams(videoModel, {
  videoUrls: ["https://example.invalid/b.mp4"],
}).canonicalParams;
assert.notEqual(genParamsHash(videoModel.id, videoModel.mode, videoA), genParamsHash(videoModel.id, videoModel.mode, videoB));

const signedQuote = {
  modelId: videoModel.id,
  mode: videoModel.mode,
  price: 12,
  ph: genParamsHash(videoModel.id, videoModel.mode, videoA),
};
const signature = signCostQuote(signedQuote);
assert.equal(verifyCostQuote(signature, signedQuote).ok, true);
assert.equal(
  verifyCostQuote(signature, { ...signedQuote, ph: genParamsHash(videoModel.id, videoModel.mode, videoB) }).ok,
  false,
  "changing references after quote must produce BAD_QUOTE semantics"
);

console.log(`✓ all-enabled-model-contract + quote-gen reference invariant — ${checks + 4} checks`);
