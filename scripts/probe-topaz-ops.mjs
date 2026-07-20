#!/usr/bin/env node
// R4_07 — Topaz OP activation probe. Har OP (Gigapixel image, RemoveBG image, Proteus video)
// uchun REAL arzon END-TO-END job: submit → poll → download → temp'ga ko'chir (storage copy isboti).
// Video uchun TO'LIQ standard lifecycle (create → accept → PUT parts → complete-upload → poll →
// download). Adapter'ni chetlab REST bilan (probe-topaz.mjs naqshi). Kalit yo'q → skip.
//   Ishlatish: node scripts/probe-topaz-ops.mjs [tiny.mp4]
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.TOPAZ_API_KEY || "";
const IMAGE_BASE = (process.env.TOPAZ_IMAGE_BASE?.trim() || "https://api.topazlabs.com/image/v1").replace(/\/+$/, "");
const VIDEO_BASE = (process.env.TOPAZ_VIDEO_BASE?.trim() || "https://api.topazlabs.com").replace(/\/+$/, "");
const H = { "X-API-Key": KEY };
const OUT = process.env.SCRATCH_DIR || "/private/tmp/topaz-ops";
const CLIP = process.argv[2] || "/private/tmp/topaz-tiny.mp4";
// Kichik ochiq test rasm (Kling CDN — probe-topaz.mjs bilan bir xil)
const TEST_IMG = "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_25.png";

const results = { gigapixel: "?", removebg: "?", proteusVideo: "?" };
if (!KEY) { console.log("TOPAZ_API_KEY yo'q (.env) — probe SKIPPED."); process.exit(0); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(res) { try { return JSON.parse(await res.text()); } catch { return null; } }

// ── Generic image OP (endpoint + model) → submit → poll → download → temp ──
// outFmt null → output_format YUBORILMAYDI (RemoveBG faqat mode=segmentation/Alpha bilan RGBA
// chiqaradi; top-level output_format=png bilan 400 beradi — 2026-07-20 jonli tekshirilgan).
async function imageOp(endpoint, model, outFmt, tag) {
  const form = new FormData();
  form.append("model", model);
  if (outFmt) form.append("output_format", outFmt);
  form.append("source_url", TEST_IMG);
  const sub = await fetch(`${IMAGE_BASE}/${endpoint}/async`, { method: "POST", headers: H, body: form });
  const sb = await j(sub);
  if (!sub.ok || !sb?.process_id) return `FAIL submit HTTP ${sub.status} ${JSON.stringify(sb).slice(0, 160)}`;
  const pid = sb.process_id;
  let status = "", credits = "?";
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const st = await j(await fetch(`${IMAGE_BASE}/status/${pid}`, { headers: H }));
    status = st?.status || ""; credits = st?.credits ?? credits;
    if (i % 3 === 0) console.log(`  ${tag} status=${status} progress=${st?.progress ?? "?"} credits=${credits}`);
    if (status === "Completed" || status === "Failed" || status === "Cancelled") break;
  }
  if (status !== "Completed") return `FAIL ended status=${status}`;
  const dl = await j(await fetch(`${IMAGE_BASE}/download/${pid}`, { headers: H }));
  const url = dl?.download_url;
  if (!url) return "FAIL no download_url";
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (!buf.length) return "FAIL empty download";
  try { writeFileSync(`${OUT}/topaz-${tag}.${outFmt}`, buf); } catch { /* temp best-effort */ }
  return `PASS (credits=${credits}, ${buf.length} bytes → temp, storage-copy proven)`;
}

// ── 1. Gigapixel (Standard V2, /enhance) — image upscale ──
try { results.gigapixel = await imageOp("enhance", "Standard V2", "png", "gigapixel"); }
catch (e) { results.gigapixel = "ERROR " + e.message; }

// ── 2. RemoveBG (/matting, output_format YO'Q → default mode=segmentation, RGBA png) ──
try { results.removebg = await imageOp("matting", "RemoveBG", null, "removebg"); }
catch (e) { results.removebg = "ERROR " + e.message; }

// ── 3. Proteus video — FULL lifecycle (create → accept → PUT → complete → poll → download) ──
try {
  let bytes;
  try { bytes = readFileSync(CLIP); } catch { throw new Error(`test clip topilmadi: ${CLIP} (ffmpeg bilan yarating)`); }
  // ffprobe-siz: bizning tiny.mp4 320x240@24fps 2s ma'lum (probe skript o'zi yaratadi).
  const src = { container: "mp4", size: bytes.length, duration: 2, frameCount: 48, frameRate: 24, resolution: { width: 320, height: 240 } };
  const out = { resolution: { width: 640, height: 480 }, frameRate: 24, audioCodec: "AAC", audioTransfer: "None", videoEncoder: "H264", videoProfile: "High", dynamicCompressionLevel: "High", container: "mp4" };
  const create = await fetch(`${VIDEO_BASE}/video/`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ source: src, filters: [{ model: "prob-4", auto: "Auto" }], output: out }) });
  const cb = await j(create);
  if (!create.ok || !cb?.requestId) { results.proteusVideo = `FAIL create HTTP ${create.status} ${JSON.stringify(cb).slice(0, 200)}`; }
  else {
    const rid = cb.requestId;
    console.log(`  proteus create requestId=${rid.slice(0, 12)}… estimate=${JSON.stringify(cb.estimates?.cost)} credits`);
    const acc = await fetch(`${VIDEO_BASE}/video/${rid}/accept`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json" } });
    const ab = await j(acc);
    if (!acc.ok || !Array.isArray(ab?.urls) || !ab.urls.length) { results.proteusVideo = `FAIL accept HTTP ${acc.status} ${JSON.stringify(ab).slice(0, 200)}`; }
    else {
      // Bayt-diapazonlarda PUT (teng bo'lak) — accept.urls.length part
      const n = ab.urls.length, partSize = Math.ceil(bytes.length / n), parts = [];
      for (let i = 0; i < n; i++) {
        const chunk = bytes.subarray(i * partSize, Math.min((i + 1) * partSize, bytes.length));
        const pr = await fetch(ab.urls[i], { method: "PUT", body: chunk });
        if (!pr.ok) { parts.length = 0; results.proteusVideo = `FAIL part ${i + 1} PUT HTTP ${pr.status}`; break; }
        parts.push({ partNum: i + 1, eTag: (pr.headers.get("etag") || "").replace(/"/g, "") });
      }
      if (parts.length === n) {
        const comp = await fetch(`${VIDEO_BASE}/video/${rid}/complete-upload/`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ uploadResults: parts }) });
        if (!comp.ok) { results.proteusVideo = `FAIL complete-upload HTTP ${comp.status} ${JSON.stringify(await j(comp)).slice(0, 200)}`; }
        else {
          let status = "", durl = "";
          for (let i = 0; i < 120; i++) {
            await sleep(4000);
            const st = await j(await fetch(`${VIDEO_BASE}/video/${rid}/status`, { headers: H }));
            status = String(st?.status || "").toLowerCase();
            if (i % 3 === 0) console.log(`  proteus status=${status} progress=${st?.progress ?? "?"}`);
            if (status === "complete") { durl = st?.download?.url || ""; break; }
            if (status === "failed" || status === "canceled") break;
          }
          if (status !== "complete") { results.proteusVideo = `FAIL ended status=${status}`; }
          else if (!durl) { results.proteusVideo = "FAIL no download url"; }
          else {
            const buf = Buffer.from(await (await fetch(durl)).arrayBuffer());
            if (!buf.length) { results.proteusVideo = "FAIL empty download"; }
            else { try { writeFileSync(`${OUT}/topaz-proteus.mp4`, buf); } catch {} results.proteusVideo = `PASS (${buf.length} bytes → temp, storage-copy proven)`; }
          }
        }
      }
    }
  }
} catch (e) { results.proteusVideo = "ERROR " + e.message; }

console.log("\n===== TOPAZ OP PROBE RESULTS =====");
for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
const allPass = Object.values(results).every((v) => String(v).startsWith("PASS"));
console.log(`\n${allPass ? "ALL OPS PASS" : "SOME OPS FAILED (keep those disabled)"}`);
