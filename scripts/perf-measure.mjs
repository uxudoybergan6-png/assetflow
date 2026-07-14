/**
 * Step 22 (MUAMMOLAR-1) — KATALOG PERF O'LCHOVI.
 * Ishlaydigan API (localhost:4000) ustidan katalog TTFB, javob hajmi, filtr/qidiruv
 * vaqti, "plagin sync" (birinchi sahifa), detail va PARALLEL yuk testini o'lchaydi.
 *
 *   node scripts/perf-measure.mjs [apiBase] [label]
 *   API_BASE=... node scripts/perf-measure.mjs
 *
 * RAQAM chiqaradi (JSON + inson-o'qiydigan). docs/PERF-BASELINE.md'ga QO'LDA yoziladi
 * (yoki --md bilan avtomatik qo'shiladi). Cloud Run CPU/xotira PRODUCTIONда GCP
 * konsolidan o'qiladi — bu yerda lokal API process RSS proxy sifatida beriladi.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const API = process.env.API_BASE || process.argv[2] || "http://localhost:4000";
const LABEL = process.argv[3] || "local";
const CATALOG = `${API}/api/plugin/catalog`;

async function timedFetch(url, opts = {}) {
  const t0 = process.hrtime.bigint();
  const r = await fetch(url, opts);
  const buf = Buffer.from(await r.arrayBuffer());
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, status: r.status, bytes: buf.length, body: buf };
}

function stats(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { p50: +at(50).toFixed(1), p95: +at(95).toFixed(1), max: +s[s.length - 1].toFixed(1), mean: +mean.toFixed(1) };
}

async function measureEndpoint(url, runs = 8) {
  const times = [];
  let bytes = 0, status = 0, count = null;
  // warmup emas — HAR chaqiruv "sovuq" (app kesh yo'q; ETag yubormaymiz → to'liq 200).
  for (let i = 0; i < runs; i++) {
    const r = await timedFetch(url + (url.includes("?") ? "&" : "?") + `_cb=${i}`); // cache-bust
    times.push(r.ms); bytes = r.bytes; status = r.status;
    try { const j = JSON.parse(r.body.toString()); count = Array.isArray(j.items) ? j.items.length : (Array.isArray(j.results) ? j.results.length : null); } catch {}
  }
  return { ...stats(times), bytes, kb: +(bytes / 1024).toFixed(1), status, count };
}

async function loadTest(url, concurrency = 20) {
  const t0 = process.hrtime.bigint();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) => timedFetch(url + (url.includes("?") ? "&" : "?") + `_u=${i}`))
  );
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const times = results.map((r) => r.ms);
  const ok = results.filter((r) => r.status === 200).length;
  return { concurrency, wallMs: +wallMs.toFixed(1), ok, ...stats(times) };
}

function apiRss() {
  // Lokal API node process RSS (MB) — Cloud Run proxy. Productionда GCP metrics.
  try {
    const { execSync } = require("child_process");
    const out = execSync("ps -A -o rss=,command= | grep 'dist/index.js' | grep -v grep | head -1", { encoding: "utf8" });
    const kb = Number((out.trim().split(/\s+/)[0]) || 0);
    return kb ? +(kb / 1024).toFixed(1) : null;
  } catch { return null; }
}

async function main() {
  // Katalogdagi jami (birinchi sahifadan nextCursor bilan taxminan — yoki count uchun health).
  const list = await measureEndpoint(`${CATALOG}?take=48`, 10);
  const filter = await measureEndpoint(`${CATALOG}?take=48&templateType=graphics`, 10);
  const filter2 = await measureEndpoint(`${CATALOG}?take=48&templateType=video-templates&pro=1&orient=16:9`, 8);
  const search = await measureEndpoint(`${CATALOG}?take=48&q=cinematic`, 10);

  // Detail — birinchi katalog elementining id'si.
  let detail = null, firstId = null;
  try {
    const r = await fetch(`${CATALOG}?take=1`);
    const j = await r.json();
    firstId = j.items?.[0]?.id;
    if (firstId) detail = await measureEndpoint(`${CATALOG}/${firstId}`, 8);
  } catch {}

  // "Plagin sync" = birinchi sahifa (server-side pagination'dan keyin sync = 1 sahifa).
  const pluginSync = { note: "server-side pagination: initial sync = first page (take=48)", ...list };

  // Yuk testi — N parallel foydalanuvchi sovuq katalog ochsa.
  const load20 = await loadTest(`${CATALOG}?take=48`, 20);
  const load50 = await loadTest(`${CATALOG}?take=48`, 50);

  const rss = apiRss();

  const out = {
    label: LABEL,
    api: API,
    at: new Date().toISOString(),
    catalogList: list,
    filter,
    filterCombo: filter2,
    search,
    detail,
    pluginSync,
    load: { c20: load20, c50: load50 },
    apiProcessRssMb: rss,
  };
  console.log(JSON.stringify(out, null, 2));

  // Inson-o'qiydigan xulosa.
  console.log("\n──────── SUMMARY (" + LABEL + ") ────────");
  console.log(`catalog list  : TTFB p50 ${list.p50}ms · p95 ${list.p95}ms · ${list.kb}KB · ${list.count} items`);
  console.log(`filter (graphics): p50 ${filter.p50}ms · ${filter.count} items`);
  console.log(`filter (combo): p50 ${filter2.p50}ms · ${filter2.count} items`);
  console.log(`search (q)    : p50 ${search.p50}ms · ${search.count} items`);
  if (detail) console.log(`detail (:id)  : p50 ${detail.p50}ms · ${detail.kb}KB`);
  console.log(`load c=20     : wall ${load20.wallMs}ms · p50 ${load20.p50}ms · p95 ${load20.p95}ms · ${load20.ok}/20 ok`);
  console.log(`load c=50     : wall ${load50.wallMs}ms · p50 ${load50.p50}ms · p95 ${load50.p95}ms · ${load50.ok}/50 ok`);
  console.log(`API RSS       : ${rss != null ? rss + " MB" : "n/a"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
