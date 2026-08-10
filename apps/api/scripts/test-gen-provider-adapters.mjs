import assert from "node:assert/strict";
import {
  GEN_MODELS,
  resolveVideoParams,
} from "../dist/lib/gen-models.js";
import { normalizeAndValidateGenParams } from "../dist/lib/gen-param-validation.js";
import {
  buildByteplusImageBody,
  buildByteplusVideoBody,
} from "../dist/lib/ai/byteplus.js";
import {
  buildKlingImageRequest,
  buildKlingVideoRequest,
} from "../dist/lib/ai/kling.js";
import {
  buildVertexImageEditRequest,
  buildVertexImageTextRequest,
  extractVertexImageResponse,
  isRetryableVertexImageError,
} from "../dist/lib/ai/vertex-image.js";
import { buildVertexVideoRequest } from "../dist/lib/ai/vertex.js";
import { buildVertexOmniBody } from "../dist/lib/ai/vertex-omni.js";
import { buildGoogleTtsRequest } from "../dist/lib/ai/google-tts.js";
import { buildElevenLabsSfxRequest } from "../dist/lib/ai/elevenlabs.js";
import { classifyGenRejection } from "../dist/lib/gen-rejection.js";

const enabled = GEN_MODELS.filter((m) => m.enabled !== false);
const covered = new Set();
let checks = 0;
const ref = "https://assets.example.invalid/start.png";
const end = "https://assets.example.invalid/end.png";

const vertexOk = extractVertexImageResponse({
  candidates: [{ content: { parts: [{ inlineData: { data: "aW1hZ2U=" } }] } }],
});
assert.equal(vertexOk.ok, true, "Vertex inline image is extracted");
assert.equal(vertexOk.ok && vertexOk.data.toString(), "image", "Vertex inline bytes are preserved");
const imagenOk = extractVertexImageResponse({ generatedImages: [{ image: { imageBytes: "aW1hZ2U=" } }] });
assert.equal(imagenOk.ok, true, "Imagen generated image is extracted");
assert.equal(imagenOk.ok && imagenOk.data.toString(), "image", "Imagen bytes are preserved");
const vertexEmpty = extractVertexImageResponse({ candidates: [{ finishReason: "STOP" }] });
assert.equal(vertexEmpty.ok, false, "Vertex empty response fails");
assert.equal(!vertexEmpty.ok && vertexEmpty.retryable, true, "Vertex unexplained empty response is retryable");
const vertexSafety = extractVertexImageResponse({ candidates: [{ finishReason: "IMAGE_SAFETY" }] });
assert.equal(vertexSafety.ok, false, "Vertex safety response fails");
assert.equal(!vertexSafety.ok && vertexSafety.retryable, false, "Vertex safety response is not retried");
assert.equal(isRetryableVertexImageError(new Error("429 RESOURCE_EXHAUSTED")), true, "Vertex quota errors retry");
assert.equal(isRetryableVertexImageError(new Error("400 invalid argument")), false, "Vertex bad requests do not retry");
assert.equal(
  classifyGenRejection("Nano Banana: empty image response (STOP)", { provider: "vertex-image" }).isContent,
  false,
  "unexplained empty image is not mislabeled as content rejection"
);
assert.equal(
  classifyGenRejection("Nano Banana: content policy blocked the image (IMAGE_SAFETY)", { provider: "vertex-image" }).isContent,
  true,
  "explicit Vertex safety response remains a content rejection"
);

function canonical(model, extra = {}) {
  const required = model.feature === "video-upscale"
    ? { sourceKey: `gen/${model.id}/source.mp4`, sourceUrl: "https://assets.example.invalid/source.mp4" }
    : model.refMode === "required"
    ? model.mode === "image"
      ? { referenceUrl: ref, referenceUrls: [ref] }
      : { referenceUrl: ref }
    : {};
  const out = normalizeAndValidateGenParams(model, { ...required, ...extra });
  assert.equal(out.ok, true, `${model.id} canonical failed: ${out.errors.map((e) => e.code).join(",")}`);
  return out.canonicalParams;
}

for (const model of enabled) {
  const params = canonical(model);
  if (model.mode === "image" && model.provider === "vertex-image") {
    const text = buildVertexImageTextRequest(model.key, "prompt", {
      aspectRatio: params.aspectRatio,
      imageSize: params.quality,
    });
    assert.equal(text.request.model, model.key);
    assert.ok(text.request.config);
    if (model.referenceMode !== "none") {
      const edit = buildVertexImageEditRequest(
        model.key,
        "prompt",
        [{ data: "aW1hZ2U=", mimeType: "image/png" }],
        { aspectRatio: params.aspectRatio, imageSize: params.quality }
      );
      assert.equal(edit.contents[0].parts.at(-1).text, "prompt");
      assert.equal(edit.contents[0].parts[0].inlineData.mimeType, "image/png");
    }
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "image" && model.provider === "byteplus") {
    const body = buildByteplusImageBody(model.byteplusModel || model.key, {
      prompt: "use @img1",
      imageUrls: model.referenceMode === "none" ? [] : [ref],
      size: params.quality,
      aspect: params.aspectRatio,
    });
    assert.equal(body.watermark, false);
    assert.equal(body.model, model.byteplusModel || model.key);
    if (model.referenceMode !== "none") assert.ok(body.image);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "image" && model.provider === "kling") {
    const req = buildKlingImageRequest(model, {
      prompt: "prompt",
      imageUrls: model.referenceMode === "none" ? [] : [ref],
      resolution: params.quality,
      aspect: params.aspectRatio,
    });
    assert.match(req.submitPath, /^\/v1\/images\//);
    assert.equal(req.body.watermark_info.enabled, false);
    assert.equal(req.body.n, 1);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "voice" && model.provider === "google-tts") {
    const voice = model.voices?.[0]?.id;
    assert.ok(voice);
    const body = buildGoogleTtsRequest(voice, "Hello");
    assert.equal(body.input.text, "Hello");
    assert.equal(body.voice.name, voice);
    assert.equal(body.audioConfig.audioEncoding, "MP3");
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "sfx" && model.provider === "elevenlabs") {
    const body = buildElevenLabsSfxRequest("cinematic impact", params.duration);
    assert.equal(body.text, "cinematic impact");
    assert.equal(body.prompt_influence, 0.4);
    assert.ok(body.duration_seconds >= 0.5 && body.duration_seconds <= 22);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "video" && model.provider === "vertex") {
    const v = resolveVideoParams(model, params);
    const opts = {
      imageBase64: model.refMode === "required" ? "c3RhcnQ=" : undefined,
      imageMimeType: "image/png",
      endImageBase64: model.endFrame ? "ZW5k" : undefined,
      endImageMimeType: "image/png",
      aspectRatio: v.aspectRatio,
      durationSeconds: v.duration,
      generateAudio: v.generateAudio,
      resolution: v.resolution,
    };
    const body = buildVertexVideoRequest(model.key, "prompt", opts);
    assert.equal(body.model, model.key);
    assert.match(body.config.outputGcsUri, /^gs:\/\//);
    if (model.endFrame) assert.ok(body.config.lastFrame);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "video" && model.provider === "vertex-omni") {
    const body = buildVertexOmniBody(model.key, "prompt", {
      images: [{ data: "aW1hZ2U=", mimeType: "image/png" }],
      videos: [{ gsUri: "gs://bucket/ref.mp4", mimeType: "video/mp4" }],
      aspectRatio: params.aspectRatio,
    });
    assert.equal(body.model, model.key);
    assert.ok(Array.isArray(body.input));
    assert.equal("response_format" in body, false, "Omni video input must omit response_format");
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "video" && model.provider === "byteplus") {
    const v = resolveVideoParams(model, params);
    const refs = model.mediaRefs
      ? { startUrl: ref, imageUrls: ["https://assets.example.invalid/i.png"], videoUrls: ["https://assets.example.invalid/v.mp4"], audioUrls: ["https://assets.example.invalid/a.mp3"] }
      : { startUrl: ref, endUrl: model.endFrame ? end : undefined };
    const body = buildByteplusVideoBody(model, "@img1 @vid1 @aud1", v, refs);
    assert.equal(body.watermark, false);
    assert.ok(Array.isArray(body.content));
    assert.equal(body.content[0].type, "text");
    assert.equal(body.content.filter((x) => x.role === "first_frame").length, 1);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.mode === "video" && model.provider === "kling") {
    const v = resolveVideoParams(model, params);
    const refs = model.mediaRefs
      ? { startUrl: ref, imageUrls: ["https://assets.example.invalid/i.png"], videoUrls: ["https://assets.example.invalid/v.mp4"] }
      : { startUrl: model.refMode === "required" || model.endFrame ? ref : undefined, endUrl: model.endFrame ? end : undefined };
    const req = buildKlingVideoRequest(model, "prompt", v, refs);
    assert.match(req.path, /^\/(text-to-video|image-to-video|omni-video)\//);
    assert.equal(req.body.options.watermark_info.enabled, false);
    covered.add(model.id); checks++;
    continue;
  }
  if (model.provider === "topaz") {
    assert.ok(model.topazModel, `${model.id} Topaz model mapping missing`);
    if (model.mode === "image") {
      assert.equal(model.refMode, "required");
      assert.ok(model.topazEndpoint);
    } else {
      assert.equal(model.feature, "video-upscale");
      assert.ok(params.sourceKey);
      assert.ok(params.sourceUrl);
    }
    covered.add(model.id); checks++;
    continue;
  }
  throw new Error(`Enabled model ${model.id} has no adapter contract (${model.provider}/${model.mode})`);
}

assert.equal(covered.size, enabled.length, "every enabled catalog entry must have adapter coverage");
console.log(`✓ provider-adapter-contract — ${checks}/${enabled.length} enabled entries covered`);
