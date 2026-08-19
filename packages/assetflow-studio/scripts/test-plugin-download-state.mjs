import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("packages/assetflow-studio/platform/index.html", "utf8");

function premiereCopy(state) {
  const label = state.pluginDl === "loading" ? "Checking Premiere release…"
    : state.pluginDl === "unavailable" ? "Premiere Pro (.ccx) — not published yet"
    : state.pluginDl === "error" ? "Retry check"
    : state.pluginDl === "idle" ? "Checking Premiere release…"
    : "Premiere Pro (.ccx)";
  const disabled = ["idle", "loading", "unavailable"].includes(state.pluginDl);
  return { label, disabled };
}

function afterEffectsCopy(state) {
  const label = state.pluginAeDl === "ready" ? "After Effects (.zxp)"
    : state.pluginAeDl === "error" ? "Retry After Effects check"
    : state.pluginAeDl === "loading" || state.pluginAeDl === "idle" ? "Checking After Effects release…"
    : "After Effects — not published";
  const disabled = ["idle", "loading", "unavailable"].includes(state.pluginAeDl);
  return { label, disabled };
}

assert.deepEqual(premiereCopy({ pluginDl: "idle" }), { label: "Checking Premiere release…", disabled: true });
assert.deepEqual(premiereCopy({ pluginDl: "ready" }), { label: "Premiere Pro (.ccx)", disabled: false });
assert.deepEqual(premiereCopy({ pluginDl: "unavailable" }), { label: "Premiere Pro (.ccx) — not published yet", disabled: true });
assert.deepEqual(premiereCopy({ pluginDl: "error" }), { label: "Retry check", disabled: false });
assert.deepEqual(afterEffectsCopy({ pluginAeDl: "unavailable" }), { label: "After Effects — not published", disabled: true });
assert.deepEqual(afterEffectsCopy({ pluginAeDl: "error" }), { label: "Retry After Effects check", disabled: false });

// Bir kanal yiqilsa ikkinchisining release holati yashirilmaydi.
assert.match(html, /Promise\.allSettled\(\[/);
assert.match(html, /const prTask = FFAPI\.pluginVersion[\s\S]{0,260}this\.setState\(\{ pluginDl: 'ready'/);
assert.match(html, /const aeTask = FFAPI\.pluginVersion[\s\S]{0,260}pluginAeDl: 'ready'/);
assert.match(html, /await Promise\.allSettled\(\[prTask, aeTask\]\)/);

// Presigned URL bir soatda tugaydi: CTA state'dagi eski URL'ga to'g'ridan o'tmay,
// bosish vaqtida serverdan yangi Premiere/AE havolasini oladi.
assert.match(html, /async downloadPlugin\(\)[\s\S]{0,1800}FFAPI\.pluginVersion\(null, platform[\s\S]{0,900}window\.location\.href = freshUrl/);
assert.match(html, /async downloadAePlugin\(\)[\s\S]{0,1400}FFAPI\.pluginVersion\(null, \{ app: 'ae', manual: true \}\)[\s\S]{0,800}window\.location\.href = freshUrl/);
assert.doesNotMatch(html, /window\.location\.href = (?:st\.)?plugin(?:Ae)?DownloadUrl/);

// Server tekshiruvidan oldin yoki unpublished holatda download bosilmaydi; error esa Retry bo'lib qoladi.
assert.match(html, /disabled="\{\{ prUnavailable \}\}" aria-disabled="\{\{ prUnavailable \}\}"/);
assert.match(html, /disabled="\{\{ aeUnavailable \}\}" aria-disabled="\{\{ aeUnavailable \}\}"/);
assert.match(html, /prUnavailable: this\.state\.pluginDl === 'idle' \|\| this\.state\.pluginDl === 'loading' \|\| this\.state\.pluginDl === 'unavailable'/);
assert.match(html, /aeUnavailable: this\.state\.pluginAeDl === 'idle' \|\| this\.state\.pluginAeDl === 'loading' \|\| this\.state\.pluginAeDl === 'unavailable'/);

// CMS'dagi stale AE/.zxp yoki PR/.ccx da'vosi faqat tegishli live release bo'lsa ko'rinadi.
assert.match(html, /const staleAe = !aeReleased/);
assert.match(html, /const stalePr = !prReleased/);
assert.match(html, /feats: safeReleaseList\(lc\.plans\[i\]\.feats\)/);
assert.match(html, /label: releaseSafeText\(st\.label, 'Web \+ verified Adobe plugin releases'\)/);
assert.match(html, /Export from the browser; verified Adobe plugin releases are listed on the Plugin page\./);

// JS ishlashidan oldingi SEO copy ham unpublished AE'ni mavjud deb e'lon qilmaydi.
const head = html.slice(0, html.indexOf("</head>"));
assert.doesNotMatch(head, /right inside After Effects/i);

console.log("Plugin release-aware copy and CTA state contract passed.");
