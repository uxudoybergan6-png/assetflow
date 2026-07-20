#!/usr/bin/env node
// Kling AI direct-API aktivatsiya probasi. Minimal t2v/image task submit qiladi va Kling
// service-code'ni chiqaradi: 1102/1103 → resource pack yo'q / model ruxsatsiz (aktivlashtirilmagan).
// Ishlatish: node scripts/probe-kling.mjs
import "dotenv/config";

const KEY = process.env.KLING_API_KEY || "";
const BASE = (process.env.KLING_API_BASE?.trim() || "https://api-singapore.klingai.com").replace(/\/+$/, "");
if (!KEY) { console.error("KLING_API_KEY yo'q (.env)"); process.exit(2); }
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function post(path, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
  let j = null; try { j = JSON.parse(await r.text()); } catch {}
  return { http: r.status, code: j?.code, message: j?.message, data: j?.data };
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: H });
  let j = null; try { j = JSON.parse(await r.text()); } catch {}
  return { http: r.status, code: j?.code, message: j?.message, data: j?.data };
}
function verdict(code) {
  if (code === 0) return "CALLABLE (submit accepted)";
  if (code === 1102 || code === 1103) return "NOT ACTIVATED (1102 pack exhausted/expired | 1103 model not authorized)";
  if (code === 1101 || code === 1100) return "ACCOUNT ISSUE (arrears / abnormal)";
  if (code >= 1000 && code <= 1004) return "AUTH FAILED (bad/expired key)";
  if (code === 1301) return "CALLABLE but content-policy blocked this prompt (account OK)";
  return `code=${code}`;
}

const probes = [
  ["Kling 3.0 t2v", () => post("/text-to-video/kling-3.0", {
    prompt: "a calm ocean wave at sunset, cinematic",
    settings: { resolution: "720p", aspect_ratio: "16:9", duration: 5, audio: "off", multi_shot: false },
    options: { watermark_info: { enabled: false } },
  })],
  ["Kling 3.0 Turbo i2v", () => post("/image-to-video/kling-3.0-turbo", {
    contents: [{ type: "prompt", text: "gentle zoom" }, { type: "first_frame", url: "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_25.png" }],
    settings: { resolution: "720p", duration: 5 },
    options: { watermark_info: { enabled: false } },
  })],
  ["Kling 3.0 Omni video", () => post("/omni-video/kling-3.0-omni", {
    contents: [{ type: "prompt", text: "a calm ocean wave at sunset" }],
    settings: { resolution: "720p", aspect_ratio: "16:9", duration: 5, audio: "off", multi_shot: false },
    options: { watermark_info: { enabled: false } },
  })],
  ["Kling Image 3.0", () => post("/v1/images/generations", {
    model_name: "kling-v3", prompt: "a red apple on a table, studio light", resolution: "1k", n: 1, aspect_ratio: "1:1",
  })],
  ["Kling Image 3.0 Omni", () => post("/v1/images/omni-image", {
    model_name: "kling-v3-omni", prompt: "a red apple on a table, studio light", resolution: "1k", n: 1, aspect_ratio: "1:1",
  })],
];

for (const [name, fn] of probes) {
  try {
    const r = await fn();
    console.log(`\n== ${name} ==\n  HTTP ${r.http} code=${r.code} msg=${r.message || ""} id=${r.data?.id || r.data?.task_id || "-"}`);
    console.log("  => " + verdict(r.code));
  } catch (e) {
    console.log(`\n== ${name} ==\n  ERROR ${e.message}`);
  }
}
console.log("");
