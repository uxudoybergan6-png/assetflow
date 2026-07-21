// Task A — Plugin sahifasi CTA/versiya-matn holat mashinasi regressiya testi (test infra yo'q — standalone).
// Bu funksiya platform/index.html'dagi render() ichidagi pgCtaLabel/pgVersionNote hisobining
// AYNAN nusxasi (dc-runtime raw <script> ichida — import qilib bo'lmaydi, shu bois qo'lda sinxronlanadi).
// index.html'da bu hisob o'zgarsa — shu faylni ham yangilang.
// Ishga tushirish: node packages/assetflow-studio/scripts/test-plugin-download-state.mjs

const DEFAULT_CTA = "Download the plugin (.zxp)";
const DEFAULT_VERSION_NOTE = "ZXP Installer or Creative Cloud · requires After Effects 2022 (22.0) or newer";

function computePluginPageCopy(pluginDl, pluginRelease, pluginDlErr) {
  const pgCtaLabel =
    pluginDl === "loading" ? "Checking latest version…"
    : pluginDl === "unavailable" ? "Beta download not published yet"
    : pluginDl === "error" ? "Retry check"
    : DEFAULT_CTA;
  const pgVersionNote =
    pluginDl === "ready" && pluginRelease ? ("v" + pluginRelease.version + " · ZXP Installer or Creative Cloud · After Effects 2022+")
    : pluginDl === "unavailable" ? "The beta download isn’t published yet — check back soon"
    : pluginDl === "error" ? (pluginDlErr || "Couldn't check for updates — click the button to retry")
    : pluginDl === "loading" ? "Checking the latest release…"
    : DEFAULT_VERSION_NOTE;
  return { pgCtaLabel, pgVersionNote };
}

// downloadPlugin() klik holati — nima qilishi kerakligini simulyatsiya qiladi ("navigate" | "toast" | "retry" | "noop").
function simulateDownloadClick(state) {
  if (state.pluginDl === "loading") return { action: "noop" };
  if (state.pluginDl === "ready" && state.pluginDownloadUrl) return { action: "navigate", url: state.pluginDownloadUrl };
  if (state.pluginDl === "error") return { action: "toast+retry" };
  if (state.pluginDl === "idle") return { action: "retry" };
  return { action: "toast" }; // 'unavailable' — halol xabar, HECH QACHON jim qolmaydi
}

let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok) {
    console.log("  got:     ", JSON.stringify(actual));
    console.log("  expected:", JSON.stringify(expected));
  }
}

check("idle → default CMS copy", computePluginPageCopy("idle", null, ""), { pgCtaLabel: DEFAULT_CTA, pgVersionNote: DEFAULT_VERSION_NOTE });
check("loading → checking copy", computePluginPageCopy("loading", null, ""), { pgCtaLabel: "Checking latest version…", pgVersionNote: "Checking the latest release…" });
check("ready → real version shown", computePluginPageCopy("ready", { version: "1.1.1" }, ""), { pgCtaLabel: DEFAULT_CTA, pgVersionNote: "v1.1.1 · ZXP Installer or Creative Cloud · After Effects 2022+" });
check("unavailable → honest not-published copy", computePluginPageCopy("unavailable", null, ""), { pgCtaLabel: "Beta download not published yet", pgVersionNote: "The beta download isn’t published yet — check back soon" });
check("error → retry copy with message", computePluginPageCopy("error", null, "Can't reach the server"), { pgCtaLabel: "Retry check", pgVersionNote: "Can't reach the server" });

// Klik davomida hech qachon jim qolmaydi (har holat uchun aniq harakat bor):
check("click while loading → noop (ignored, not double-fetch)", simulateDownloadClick({ pluginDl: "loading" }), { action: "noop" });
check("click while ready → navigates to real artifact URL", simulateDownloadClick({ pluginDl: "ready", pluginDownloadUrl: "https://cdn/pack.zip" }), { action: "navigate", url: "https://cdn/pack.zip" });
check("click while error → toast + retry fetch", simulateDownloadClick({ pluginDl: "error" }), { action: "toast+retry" });
check("click while idle (race) → kicks off fetch instead of no-op", simulateDownloadClick({ pluginDl: "idle" }), { action: "retry" });
check("click while unavailable → honest toast, never silent", simulateDownloadClick({ pluginDl: "unavailable" }), { action: "toast" });

if (fail) {
  console.error(`\n${fail} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (10 case).`);
