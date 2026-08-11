import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { optimizeVideoReferenceForUpload, probeMediaSpec } from "../dist/lib/optimize-preview.js";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "apps/api/src/routes/studio-gen.ts"), "utf8");
const plugin = fs.readFileSync(path.join(root, "plugins/after-effects-cep/AssetFlow_Plugin.html"), "utf8");
const web = fs.readFileSync(path.join(root, "packages/assetflow-studio/platform/index.html"), "utf8");

assert.ok(route.includes('code: "VIDEO_CLIP_REQUIRED"'), "API rejects video uploads without a valid clip range");
assert.ok(route.includes("duration < VIDEO_REF_CLIP_MIN_SEC"), "API enforces the 2 second minimum");
assert.ok(route.includes("duration > VIDEO_REF_CLIP_MAX_SEC"), "API enforces the 15 second maximum");
assert.ok(route.includes("`gen-refs/${req.user!.userId}/clips/"), "trimmed videos use a dedicated storage prefix");
assert.ok(route.includes('field: "videoUrls"'), "generation validation has a video-reference gate");
assert.ok(route.includes("!key.startsWith(`gen-refs/${userId}/clips/`)"), "raw video URLs cannot reach providers");
assert.ok(route.includes("invalidEnhanceVideo"), "raw video URLs cannot reach multimodal Enhance");
assert.ok(route.includes("clip: videoClip ?"), "upload response proves which segment was produced");

assert.ok(plugin.includes("clipParamsJson(src)),300000"), "CEP fallback preserves clip parameters");
assert.ok(plugin.includes("the full video was not uploaded"), "CEP metadata failure is fail-closed");
assert.ok(plugin.includes("type==='video'&&!r.clip"), "CEP accepts only server-confirmed trimmed videos");

assert.ok(web.includes("chooseVideoRefClip(source)"), "web has the shared video clip editor");
assert.ok(web.includes("uploadTrimmedVideoUrl(srcUrl, name)"), "web trims My Library and generated URLs");
assert.ok(web.includes("if (this.isVideoRefFile(f))"), "web file uploads enter the clip editor");
assert.ok(web.includes("url = await this.uploadTrimmedVideoUrl(url, title)"), "web My Library path is trimmed");
assert.ok(web.includes("url = await this.uploadTrimmedVideoUrl(url, 'Generated video')"), "web drag/drop path is trimmed");
assert.ok(web.includes("if (clip && (!r || !r.clip))"), "web accepts only server-confirmed trimmed files");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-video-trim-test-"));
try {
  const input = path.join(tempDir, "source.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=blue:s=1280x720:r=24",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
    "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", input,
  ], { stdio: "pipe" });

  assert.equal(await optimizeVideoReferenceForUpload(input), false, "optimizer rejects a missing range");
  assert.equal(
    await optimizeVideoReferenceForUpload(input, { startSec: 0, endSec: 16 }),
    false,
    "optimizer rejects ranges over 15 seconds"
  );
  assert.equal(
    await optimizeVideoReferenceForUpload(input, { startSec: 1.25, endSec: 4.25 }),
    true,
    "optimizer creates the selected segment"
  );
  const spec = await probeMediaSpec(input);
  assert.ok(spec.durationSec != null && Math.abs(spec.durationSec - 3) <= 0.25, `trimmed duration is ${spec.durationSec}s, expected 3s`);
  assert.equal(spec.audioCodec, null, "trimmed video reference does not carry the original audio track");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("Video reference trim contract and ffmpeg integration passed.");
