#!/usr/bin/env node
// Ad-hoc BytePlus ModelArk aktivatsiya probasi (SC_57 naqshi). Berilgan model ID uchun
// minimal t2v task submit qiladi va javobni chiqaradi: ModelNotOpen → aktivlashtirilmagan.
// Ishlatish: node scripts/probe-byteplus-model.mjs <modelArkId> [resolution] [duration]
import "dotenv/config";

const KEY = process.env.BYTEPLUS_API_KEY || "";
const BASE = (process.env.BYTEPLUS_ARK_BASE?.trim() || "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/+$/, "");
const model = process.argv[2] || "dreamina-seedance-2-0-mini-260615";
const resolution = process.argv[3] || "480p";
const duration = Number(process.argv[4] || 4);

if (!KEY) { console.error("BYTEPLUS_API_KEY yo'q (.env)"); process.exit(2); }

const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const body = {
  model,
  content: [{ type: "text", text: "a calm ocean wave at sunset, cinematic" }],
  resolution,
  ratio: "16:9",
  duration,
  generate_audio: false,
  watermark: false,
};

console.log(`PROBE model=${model} res=${resolution} dur=${duration}s\nPOST ${BASE}/contents/generations/tasks`);
const res = await fetch(`${BASE}/contents/generations/tasks`, { method: "POST", headers, body: JSON.stringify(body) });
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 800));

let taskId = null;
try { taskId = JSON.parse(text)?.id; } catch { /* ignore */ }
if (!taskId) {
  const notOpen = /ModelNotOpen|not\s*open|not\s*activ|access.?denied|no\s*permission|unauthor/i.test(text);
  console.log(notOpen ? "\n=> VERDICT: NOT ACTIVATED (ModelNotOpen / no access)" : "\n=> VERDICT: SUBMIT FAILED (see body)");
  process.exit(1);
}
console.log(`\nsubmit OK, taskId=${taskId} — polling...`);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const pr = await fetch(`${BASE}/contents/generations/tasks/${encodeURIComponent(taskId)}`, { headers });
  const pj = await pr.json().catch(() => ({}));
  const st = String(pj?.status || "").toLowerCase();
  console.log(`  [${i}] status=${st}`);
  if (st === "succeeded") { console.log("\n=> VERDICT: ACTIVATED + CALLABLE. video_url=", pj?.content?.video_url?.slice(0, 80)); process.exit(0); }
  if (st === "failed" || st === "expired" || st === "cancelled") {
    console.log("\ntask error:", JSON.stringify(pj?.error || {}));
    console.log("=> VERDICT: SUBMIT OK but generation FAILED (still means model is activated)");
    process.exit(0);
  }
}
console.log("\n=> VERDICT: submit OK, timed out polling (model activated; slow)");
process.exit(0);
