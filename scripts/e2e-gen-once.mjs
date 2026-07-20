#!/usr/bin/env node
// R4 — bitta modelni TO'LIQ pipeline orqali generatsiya qiladi (login → session → cost-quote →
// POST /gen → poll → done). Kredit YECHILADI (real e2e). Ishlatish:
//   VIDEO: node scripts/e2e-gen-once.mjs <modelId> [resolution] [durationSec]
//   IMAGE: MODE=image node scripts/e2e-gen-once.mjs <modelId> [quality]
const API = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.VERIFY_EMAIL || "user@assetflow.uz";
const PASS = process.env.VERIFY_PASSWORD || "user123";
const MODE = process.env.MODE === "image" ? "image" : "video";
const modelId = Number(process.argv[2] || 3103);
const resolution = process.argv[3] || (MODE === "image" ? "1K" : "480p");
const duration = String(process.argv[4] || "4");

async function jpost(path, body, token) {
  const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
async function jget(path, token) {
  const r = await fetch(API + path, { headers: token ? { Authorization: "Bearer " + token } : {} });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

const login = await jpost("/api/plugin/login", { email: EMAIL, password: PASS });
const token = login.body?.token || login.body?.accessToken;
if (!token) { console.error("LOGIN FAILED", login.status, login.body); process.exit(1); }

const sess = await jpost("/api/studio/gen/sessions", { mode: MODE, title: "R4 e2e" }, token);
const sessionId = sess.body?.id;
console.log("session", sessionId);

const REF = process.env.REF || ""; // ixtiyoriy referenceUrl (i2v boshlang'ich kadr)
const params = MODE === "image"
  ? { aspectRatio: "1:1", quality: resolution, count: 1 }
  : { aspectRatio: "auto", resolution, duration, audio: false, ...(REF ? { referenceUrl: REF } : {}) };
const quote = await jpost("/api/studio/gen/cost-quote", { modelId, mode: MODE, params }, token);
if (quote.status !== 200) { console.error("QUOTE FAILED", quote.status, quote.body); process.exit(1); }
console.log("quote price", quote.body.price, "sig", String(quote.body.signature).slice(0, 12) + "...");

const idem = "r4e2e-" + MODE + "-" + modelId + "-" + resolution + "-" + duration + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const gen = await jpost("/api/studio/gen", {
  sessionId, mode: MODE, prompt: "a calm ocean wave at sunset, cinematic slow motion",
  modelId, params, price: quote.body.price, costQuoteSignature: quote.body.signature, idempotencyKey: idem,
}, token);
console.log("POST /gen ->", gen.status, JSON.stringify(gen.body).slice(0, 200));
const jobId = gen.body?.jobId;
if (!jobId) process.exit(1);

for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await jget("/api/studio/gen/" + jobId, token);
  const status = st.body?.status;
  const asset = st.body?.assets?.[0] || st.body?.asset;
  process.stdout.write(`[${i}] ${status}\n`);
  if (status === "done" || status === "completed") {
    console.log("\n=> DONE. assetUrl:", (asset?.url || asset?.previewUrl || "?").slice(0, 90));
    console.log("creditsLeft:", st.body?.creditsLeft ?? "?");
    process.exit(0);
  }
  if (status === "failed" || status === "error") { console.error("\n=> FAILED:", st.body?.error || st.body); process.exit(1); }
}
console.log("\n=> timed out polling");
process.exit(1);
