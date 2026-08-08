#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

import {
  GEN_MODELS,
  getRefKind,
  getReferenceMode,
  isModelEnabled,
} from "../apps/api/dist/lib/gen-models.js";
import { normalizeAndValidateGenParams } from "../apps/api/dist/lib/gen-param-validation.js";

const require = createRequire(import.meta.url);
const { createController } = require("../plugins/after-effects-cep/frameflow-create-workspace.js");
const platform = fs.readFileSync(new URL("../packages/assetflow-studio/platform/index.html", import.meta.url), "utf8");

function extractMethod(name, nextMarker) {
  const marker = `  ${name}(`;
  const start = platform.indexOf(marker);
  assert.notEqual(start, -1, `web method ${name} not found`);
  const end = platform.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `web method ${name} end marker not found`);
  const source = platform.slice(start + 2, end).trim();
  return Function(`"use strict"; return ({${source}}).${name};`)();
}

// These are the production web methods, extracted from the shipped platform source rather than
// reimplemented test doubles. The CEP side imports its production controller directly.
const webBuildParams = extractMethod("buildParams", "\n  // BATCH4 #2 — video-upscale");
const webRefCaps = extractMethod("refCaps", "\n  refModelOk(");
const webProjectRefs = extractMethod("projectRefs", "\n  // P13 — promptda");

const IMG1 = "https://example.com/reference-1.png";
const IMG2 = "https://example.com/reference-2.png";
const VID = "https://example.com/reference.mp4";
const AUD = "https://example.com/reference.mp3";

function defaultState(model) {
  const image = model.imgSettings || {};
  const video = model.videoSettings || {};
  return {
    aiSize: image.aspect?.def || video.aspect?.def || model.aspects?.[0] || "1:1",
    aiCount: image.num?.[0] || model.count?.[0] || 1,
    aiQuality: image.quality?.def || image.quality?.options?.[0] || "",
    aiDuration: video.duration?.def ?? video.duration?.options?.[0] ?? model.durations?.[0] ?? 5,
    aiRes: video.resolution?.def || video.resolution?.options?.[0] || model.resolutions?.[0] || "",
    aiAudio: typeof video.audioDefault === "boolean" ? video.audioDefault : false,
    aiBitrate: video.bitrate?.def || video.bitrate?.options?.[0] || "",
    aiVoice: model.voices?.[0]?.id || "",
    refImages: [],
    refVideos: [],
    refAudios: [],
    refStartUrl: null,
    refEndUrl: null,
  };
}

function addRichReferences(model, state) {
  if (model.mode === "image" && (model.refKind === "image" || (model.maxRefs || 0) > 0)) {
    state.refImages = [IMG1, IMG2].slice(0, Math.max(1, Math.min(2, model.maxRefs || 1)));
  }
  if (model.mode !== "video") return;
  if (model.refKind === "frames") {
    state.refStartUrl = IMG1;
    if (model.endFrame) state.refEndUrl = IMG2;
  } else if (model.refKind === "media-refs") {
    const limits = model.mediaRefs || {};
    // Media-frame capable models use the frame slots first; the global projection then applies
    // image and total limits exactly as the real web UI does.
    if (model.endFrame) {
      state.refStartUrl = IMG1;
      state.refEndUrl = IMG2;
    }
    if ((limits.image || 0) > (model.endFrame ? 2 : 0)) state.refImages = [IMG1];
    if ((limits.video || 0) > 0) state.refVideos = [VID];
    if ((limits.audio || 0) > 0) state.refAudios = [AUD];
  }
}

function webParams(model, rich) {
  const state = defaultState(model);
  if (rich) addRichReferences(model, state);
  const ctx = { state, refCaps: webRefCaps, projectRefs: webProjectRefs };
  return webBuildParams.call(ctx, { mode: model.mode }, model);
}

async function cepParams(model, rich) {
  const ctl = createController({ mode: model.mode });
  ctl.setModels(model.mode, [model]);
  if (ctl.snapshot().mode !== model.mode) ctl.setMode(model.mode);
  if (rich) {
    if (model.mode === "image" && (model.refKind === "image" || (model.maxRefs || 0) > 0)) {
      const count = Math.max(1, Math.min(2, model.maxRefs || 1));
      [IMG1, IMG2].slice(0, count).forEach((url, i) => ctl.addReference({ id: `img-${i}`, kind: "image", url }));
    } else if (model.mode === "video" && model.refKind === "frames") {
      ctl.addReference({ id: "start", kind: "image", role: "start", url: IMG1 });
      if (model.endFrame) ctl.addReference({ id: "end", kind: "image", role: "end", url: IMG2 });
    } else if (model.mode === "video" && model.refKind === "media-refs") {
      const limits = model.mediaRefs || {};
      if (model.endFrame) {
        ctl.addReference({ id: "start", kind: "image", role: "start", url: IMG1 });
        ctl.addReference({ id: "end", kind: "image", role: "end", url: IMG2 });
      }
      if ((limits.image || 0) > (model.endFrame ? 2 : 0)) ctl.addReference({ id: "img", kind: "image", url: IMG1 });
      if ((limits.video || 0) > 0) ctl.addReference({ id: "vid", kind: "video", url: VID });
      if ((limits.audio || 0) > 0) ctl.addReference({ id: "aud", kind: "audio", url: AUD });
    }
  }
  let params = null;
  await ctl.requestQuote(async (q) => {
    params = q.params;
    return { price: 1, signature: "contract-test", pricedParams: q.params };
  });
  return params;
}

let checks = 0;
for (const sourceModel of GEN_MODELS.filter((m) => isModelEnabled(m) && !m.opType)) {
  // `/gen/models` adds these canonical capability fields before either client sees the model.
  const model = { ...sourceModel, refKind: getRefKind(sourceModel), refMode: getReferenceMode(sourceModel) };
  for (const rich of [false, true]) {
    const webRaw = webParams(model, rich);
    const cepRaw = await cepParams(model, rich);
    const web = normalizeAndValidateGenParams(model, webRaw);
    const cep = normalizeAndValidateGenParams(model, cepRaw);
    assert.equal(web.ok, true, `web ${model.id}/${rich ? "rich" : "default"}: ${JSON.stringify(web.errors)}`);
    assert.equal(cep.ok, true, `CEP ${model.id}/${rich ? "rich" : "default"}: ${JSON.stringify(cep.errors)}`);
    assert.deepEqual(cep.canonicalParams, web.canonicalParams, `${model.id} ${model.label} ${rich ? "rich" : "default"} parity`);
    checks += 1;
  }
}

console.log(`✓ actual web + CEP payload parity — ${checks} model variants`);
