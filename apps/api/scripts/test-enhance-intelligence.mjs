import assert from "node:assert/strict";
import fs from "node:fs";
import { validateMentionIntegrity } from "../dist/lib/enhance-mentions.js";

const route = fs.readFileSync("apps/api/src/routes/studio-gen.ts", "utf8");
const vertex = fs.readFileSync("apps/api/src/lib/ai/vertex-enhance.ts", "utf8");
const apiClient = fs.readFileSync("packages/assetflow-studio/platform/ff-api.js", "utf8");
const web = fs.readFileSync("packages/assetflow-studio/platform/index.html", "utf8");

assert.deepEqual(validateMentionIntegrity("Use @img1 and @video2", "Use @img1 and @video2 carefully"), { ok: true });
assert.equal(validateMentionIntegrity("Use @img1", "Use @img2").ok, false, "renumbered references are rejected");
assert.equal(validateMentionIntegrity("Use @start and @end", "Use @start").ok, false, "dropped references are rejected");
assert.equal(validateMentionIntegrity("No reference", "Use @img1").ok, false, "invented references are rejected");

for (const mode of ["image", "video", "voice", "sfx", "music"]) {
  assert.ok(vertex.includes(`${mode}: \"You are an expert`), `${mode} has a dedicated Enhance role`);
  assert.ok(vertex.includes(`${mode}: \"`), `${mode} has mode-specific prompt guidance`);
}
assert.ok(vertex.includes("preserve the language of the spoken script"), "voice Enhance preserves spoken language");
assert.ok(vertex.includes('refRole === "start-frame" ? "@start"'), "start frame has an explicit semantic role");
assert.ok(vertex.includes('refRole === "end-frame" ? "@end"'), "end frame has an explicit semantic role");
assert.ok(vertex.includes("silently verify that the rewrite preserves"), "Enhance performs a self-check before output");

assert.ok(route.includes('enhance_style: z.enum(["faithful", "cinematic", "creative"])'), "API validates Enhance styles");
assert.ok(route.includes("enhanceModelContext(model, mode, p.data.settings)"), "selected model capabilities and settings inform Enhance");
assert.ok(route.includes("model?.maxChars"), "voice output observes the selected model character cap");
assert.ok(route.includes("imageRoles: p.data.image_roles"), "reference roles reach multimodal Enhance");
assert.ok(apiClient.includes("body.enhance_style = opts.style"), "web API client sends Enhance style");
assert.ok(apiClient.includes("body.image_roles = opts.imageRoles"), "web API client sends image roles");
assert.ok(apiClient.includes("body.settings = opts.settings"), "selected generation settings reach Enhance");

assert.ok(web.includes("Enhance style"), "web settings expose Enhance style selection");
assert.ok(web.includes("1 + (enhanceHasImage ? 1 : 0) + (enhanceHasVideo ? 2 : 0) + (enhanceHasAudio ? 1 : 0)"), "web shows modality-aware Enhance cost");
assert.ok(web.includes("imageRoles.push(x.k === 'start' ? 'start-frame'"), "web labels start/end/image roles explicitly");
assert.ok(web.includes("enhanceNotEnough"), "web gates Enhance against its real price");

console.log("Enhance intelligence checks passed.");
