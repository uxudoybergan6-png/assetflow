#!/usr/bin/env node
// SC_27 — har bir yoqilgan model uchun klient qoidalar bilan qurilgan payload'ni
// LOKAL dev API /gen/cost-quote'ga yuborib PASS/FAIL jadval chiqaradi.
// Klient qoidalari (web + plagin bir xil):
//   image: aspectRatio(imgSettings.aspect.def||aspects[0]) + quality(faqat imgSettings.quality bo'lsa)
//          + count + referenceUrls (faqat referenceMode!=='none' va ref tanlanganda)
//   voice: voice (voices[0].id)
//   sfx:   duration (durations[0])
//   video: aspectRatio (kichik harf 'auto') + resolution + duration ('Auto' yoki raqam-string)
//          + audio (faqat videoSettings.audio && !audioLocked) + bitrateMode (faqat bitrate deklaratsiyasi)
//          + frames: referenceUrl/referenceEndUrl · media-refs: imageUrls/videoUrls/audioUrls
// Ishlatish: node scripts/verify-gen-payloads.mjs [API_URL]  (default http://localhost:4000)
const API = process.argv[2] || process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.VERIFY_EMAIL || "user@assetflow.uz";
const PASS = process.env.VERIFY_PASSWORD || "user123";
const IMG = "https://example.com/ref.png"; // quote URL'ni tekshirmaydi — shakl yetarli
const VID = "https://example.com/ref.mp4";
const AUD = "https://example.com/ref.mp3";

async function jpost(path, body, token) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch { /* bo'sh javob */ }
  return { status: r.status, body: j };
}

// ── Klient payload quruvchi (web/plagin bilan BIR XIL qoidalar) ──
function lcAuto(v) { return String(v || "").toLowerCase() === "auto" ? "auto" : v; }
function buildDefaultParams(m, variant) {
  if (m.mode === "image") {
    const s = m.imgSettings || {};
    const p = {
      aspectRatio: (s.aspect && s.aspect.def) || (m.aspects && m.aspects[0]) || "1:1",
      count: (s.num && s.num[0]) || (m.count && m.count[0]) || 1,
    };
    if (s.quality) p.quality = s.quality.def || s.quality.options[0];
    if (variant === "rich") {
      if (s.quality) p.quality = s.quality.options[s.quality.options.length - 1];
      p.count = (s.num && s.num[s.num.length - 1]) || (m.count && m.count[m.count.length - 1]) || 1;
      const rm = m.referenceMode || "image-edit";
      if (rm !== "none") p.referenceUrls = [IMG, IMG];
    }
    return p;
  }
  if (m.mode === "voice") return { voice: (m.voices && m.voices[0] && m.voices[0].id) || undefined };
  if (m.mode === "sfx") return { duration: (m.durations && m.durations[0]) || 5 };
  if (m.mode === "video") {
    const vs = m.videoSettings || {};
    const p = {
      aspectRatio: lcAuto((vs.aspect && vs.aspect.def) || (m.aspects && m.aspects[0]) || "16:9"),
      resolution: (vs.resolution && vs.resolution.def) || (m.resolutions && m.resolutions[0]) || "720p",
      duration: (vs.duration && vs.duration.def) || String((m.durations && m.durations[0]) || 5),
    };
    if (vs.audio && !vs.audioLocked) p.audio = typeof vs.audioDefault === "boolean" ? vs.audioDefault : true;
    if (vs.bitrate) p.bitrateMode = vs.bitrate.def || vs.bitrate.options[0];
    if (variant === "rich") {
      const ropts = (vs.resolution && vs.resolution.options) || m.resolutions || [];
      p.resolution = ropts[ropts.length - 1] || p.resolution;
      const dopts = (vs.duration && vs.duration.options) || [];
      p.duration = dopts[dopts.length - 1] || p.duration;
      if (m.refKind === "media-refs") {
        const mr = m.mediaRefs || { image: 1, video: 0, audio: 0 };
        if (mr.image > 0) p.imageUrls = [IMG];
        if (mr.video > 0) p.videoUrls = [VID];
        if (mr.audio > 0) p.audioUrls = [AUD];
      } else if (m.refKind === "frames") {
        p.referenceUrl = IMG;
        if (m.endFrame) p.referenceEndUrl = IMG;
      }
    }
    return p;
  }
  return {};
}

function pad(s, n) { return String(s).padEnd(n); }

async function main() {
  const login = await jpost("/api/plugin/login", { email: EMAIL, password: PASS });
  const token = login.body && (login.body.token || login.body.accessToken);
  if (!token) { console.error("LOGIN FAILED", login.status, login.body); process.exit(1); }

  const mr = await fetch(API + "/api/studio/gen/models", { headers: { Authorization: "Bearer " + token } });
  const models = ((await mr.json()).models || []).filter((m) => m.enabled !== false);
  console.log(`API=${API} · yoqilgan modellar: ${models.length}\n`);

  const rows = [];
  let fails = 0;
  for (const m of models) {
    for (const variant of ["default", "rich"]) {
      const params = buildDefaultParams(m, variant);
      const q = await jpost("/api/studio/gen/cost-quote", { modelId: m.id, mode: m.mode, params }, token);
      const ok = q.status === 200 && typeof q.body?.price === "number" && q.body.price > 0 && !!q.body.signature;
      if (!ok) fails++;
      rows.push({
        id: m.id, label: m.label, mode: m.mode, variant,
        status: q.status, price: q.body?.price, ok,
        err: ok ? "" : JSON.stringify(q.body || {}).slice(0, 120),
        sent: JSON.stringify(params),
      });
    }
  }

  // Ataylab-noto'g'ri kombolar — hujjatlangan 4xx kutiladi
  const negatives = [
    // SC_57: 3101 (Seedance Fast) endi YOQILGAN — o'rniga hali disabled 3006 (Seedance 2.0, fal-ulanmagan).
    { name: "disabled model 3006 (Seedance 2.0)", body: { modelId: 3006, mode: "video", params: {} }, expect: 400 },
    { name: "mode mismatch (3001 sifatida image)", body: { modelId: 3001, mode: "image", params: {} }, expect: 400 },
    { name: "unknown model 9999", body: { modelId: 9999, mode: "image", params: {} }, expect: 400 },
  ];
  const negRows = [];
  for (const n of negatives) {
    const q = await jpost("/api/studio/gen/cost-quote", n.body, token);
    const ok = q.status === n.expect;
    if (!ok) fails++;
    negRows.push({ ...n, got: q.status, ok });
  }

  console.log(pad("ID", 6) + pad("MODEL", 30) + pad("MODE", 7) + pad("VARIANT", 9) + pad("HTTP", 6) + pad("PRICE", 7) + "RESULT");
  console.log("-".repeat(78));
  for (const r of rows) {
    console.log(
      pad(r.id, 6) + pad(r.label.slice(0, 28), 30) + pad(r.mode, 7) + pad(r.variant, 9) +
      pad(r.status, 6) + pad(r.price ?? "-", 7) + (r.ok ? "PASS" : "FAIL " + r.err)
    );
    if (process.env.VERBOSE) console.log("       sent: " + r.sent);
  }
  console.log("\nNegative (hujjatlangan 4xx):");
  for (const n of negRows) console.log(`  ${n.ok ? "PASS" : "FAIL"} · ${n.name} → ${n.got} (kutilgan ${n.expect})`);
  console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURE(S)"}`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
