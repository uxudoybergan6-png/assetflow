#!/usr/bin/env node
// Topaz Labs live probe (R4_03 PHASE 0). Auth + IMAGE round-trip (submit→poll→download) + VIDEO
// handshake (create returns cost estimate, no credit reserve) + system supportedModels. Standalone —
// adapter'ni chetlab o'tib to'g'ridan-to'g'ri REST (probe-kling.mjs naqshi). Kalit yo'q → skip.
import "dotenv/config";
import { writeFileSync } from "node:fs";

const KEY = process.env.TOPAZ_API_KEY || "";
const IMAGE_BASE = (process.env.TOPAZ_IMAGE_BASE?.trim() || "https://api.topazlabs.com/image/v1").replace(/\/+$/, "");
const VIDEO_BASE = (process.env.TOPAZ_VIDEO_BASE?.trim() || "https://api.topazlabs.com").replace(/\/+$/, "");
const H = { "X-API-Key": KEY };
const results = { auth: "?", supportedModels: "?", imageRoundTrip: "?", videoHandshake: "?" };

if (!KEY) {
  console.log("TOPAZ_API_KEY yo'q (.env) — live probe SKIPPED.");
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(res) { try { return JSON.parse(await res.text()); } catch { return null; } }

// ── 1. AUTH + system status (GET /video/status) ──
try {
  const r = await fetch(`${VIDEO_BASE}/video/status`, { headers: H });
  const b = await j(r);
  if (r.status === 401 || r.status === 403) { results.auth = "FAIL (auth rejected)"; }
  else if (r.ok) {
    results.auth = "PASS";
    results.supportedModels = Array.isArray(b?.supportedModels) ? `PASS (${b.supportedModels.length}): ${b.supportedModels.join(", ")}` : "PASS (no list)";
    console.log(`system: isAvailable=${b?.isAvailable} msg=${b?.availabilityMessage || ""}`);
  } else { results.auth = `HTTP ${r.status}`; }
} catch (e) { results.auth = "ERROR " + e.message; }

// ── 2. IMAGE round-trip (submit source_url → poll → download → fetch buffer) ──
try {
  const form = new FormData();
  form.append("model", "Standard V2");
  form.append("output_format", "png");
  form.append("output_width", "512");
  form.append("source_url", "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_25.png");
  const sub = await fetch(`${IMAGE_BASE}/enhance/async`, { method: "POST", headers: H, body: form });
  const sb = await j(sub);
  if (!sub.ok || !sb?.process_id) {
    results.imageRoundTrip = `FAIL submit HTTP ${sub.status} ${JSON.stringify(sb).slice(0, 160)}`;
  } else {
    const pid = sb.process_id;
    console.log(`image submitted process_id=${pid} eta=${sb.eta}`);
    let status = "";
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      const st = await j(await fetch(`${IMAGE_BASE}/status/${pid}`, { headers: H }));
      status = st?.status || "";
      if (i % 3 === 0) console.log(`  image status=${status} progress=${st?.progress ?? "?"} credits=${st?.credits ?? "?"}`);
      if (status === "Completed" || status === "Failed" || status === "Cancelled") break;
    }
    if (status !== "Completed") { results.imageRoundTrip = `FAIL ended status=${status}`; }
    else {
      const dl = await j(await fetch(`${IMAGE_BASE}/download/${pid}`, { headers: H }));
      const url = dl?.download_url;
      if (!url) { results.imageRoundTrip = "FAIL no download_url"; }
      else {
        const img = await fetch(url);
        const buf = Buffer.from(await img.arrayBuffer());
        if (buf.length > 0) {
          const out = "/private/tmp/claude-501/-Users-usmonov-Projects-creative-tools-saas/77ccb438-433a-4298-ad9d-73ef3eb6555b/scratchpad/topaz-probe-out.png";
          try { writeFileSync(out, buf); } catch {}
          results.imageRoundTrip = `PASS (downloaded ${buf.length} bytes → temp, copy-to-storage proven)`;
        } else { results.imageRoundTrip = "FAIL empty download"; }
      }
    }
  }
} catch (e) { results.imageRoundTrip = "ERROR " + e.message; }

// ── 3. VIDEO handshake — POST /video/ (FREE, returns cost estimate; no accept → no credit reserve) ──
try {
  const body = {
    source: { container: "mp4", size: 16125151, duration: 10, frameCount: 300, frameRate: 30, resolution: { width: 1280, height: 720 } },
    filters: [{ model: "prob-4", auto: "Auto" }],
    output: { resolution: { width: 1920, height: 1080 }, frameRate: 30, audioCodec: "AAC", audioTransfer: "Copy", videoEncoder: "H265", videoProfile: "Main", dynamicCompressionLevel: "High", container: "mp4" },
  };
  const r = await fetch(`${VIDEO_BASE}/video/`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const b = await j(r);
  if (r.ok && b?.requestId && b?.estimates?.cost) {
    results.videoHandshake = `PASS (requestId=${b.requestId.slice(0, 12)}… cost=${JSON.stringify(b.estimates.cost)} credits, no reserve)`;
  } else if (r.status === 401 || r.status === 403) {
    results.videoHandshake = "FAIL (auth/permission)";
  } else {
    results.videoHandshake = `HTTP ${r.status} ${JSON.stringify(b).slice(0, 200)}`;
  }
} catch (e) { results.videoHandshake = "ERROR " + e.message; }

console.log("\n===== TOPAZ PROBE RESULTS =====");
for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
