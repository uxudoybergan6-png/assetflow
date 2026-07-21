// Task 2 — PLAGIN UPDATER XAVFSIZLIK TESTI (haqiqiy JONLI manba, mock YO'Q).
//
// Test AssetFlow_Plugin.html ichidagi AF-UPDATER-BEGIN…AF-UPDATER-END blokini
// AYNAN o'qiydi va uch qatlamda tekshiradi:
//   A) MANBA SKANI — eski o'z-o'zini-yozish primitivlari (unzip / cp / extension
//      papkasi / shell interpolatsiya) YO'Q, majburiy primitivlar BOR;
//   B) XULQ — blok Node'da stub global'lar bilan ishga tushiriladi va uning
//      HAQIQIY funksiyalari (window.__afUpdater) chaqiriladi (musbat + salbiy);
//   C) MUTATSIYA ISBOTI — ataylab buzilgan nusxalarda A va B tekshiruvlari
//      YIQILISHI shart (aks holda testlar bo'sh — hech nimani isbotlamaydi).
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-updater-security.mjs

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_HTML = path.join(SCRIPTS_DIR, "..", "AssetFlow_Plugin.html");
const BEGIN = "/* AF-UPDATER-BEGIN";
const END = "/* AF-UPDATER-END */";

let fail = 0;
let count = 0;
function check(label, actual, expected) {
  count++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok) {
    console.log("  got:     ", JSON.stringify(actual));
    console.log("  expected:", JSON.stringify(expected));
  }
}
function ok(label, cond) { check(label, !!cond, true); }

// ── Blokni jonli fayldan ajratib olish ─────────────────────────────────────
function extractUpdater(html) {
  const a = html.indexOf(BEGIN);
  const b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error("AF-UPDATER-BEGIN/END markerlari topilmadi");
  return html.slice(a, b + END.length);
}

const html = readFileSync(PLUGIN_HTML, "utf8");
const SRC = extractUpdater(html);
ok("updater block extracted from the live AssetFlow_Plugin.html", SRC.length > 1000);
check("exactly one updater block in the file", html.split(BEGIN).length - 1, 1);

// ── A) MANBA SKANI ─────────────────────────────────────────────────────────
// Eski self-overwrite oqimining har bir primitivi — YO'Q bo'lishi SHART.
const FORBIDDEN = [
  ["unzip invocation", /\bunzip\b/],
  ["cp / copy of the extension folder", /execFileSync\s*\(\s*['"]cp['"]|['"]cp['"]\s*,\s*\[|\bcpSync\b|\bcopyFileSync\b/],
  ["extension directory lookup", /extensionDir\s*\(|SystemPath\.EXTENSION|getSystemPath\s*\(/],
  ["writing files outside the temp download", /\bwriteFileSync\b|\bmkdirSync\b|\brenameSync\b/],
  ["recursive delete", /\brmSync\b|\brm\s+-rf\b|\brmdirSync\s*\([^)]*recursive/],
  ["shell execution / interpolation", /execSync\s*\(|\bshell\s*:\s*true\b|child\.exec\s*\(/],
  ["manual extension-replacement advice", /replace the extension folder|extension folder, then restart|Unzip it/i],
  ["auto-installing the legacy zxp", /\.zxp/i],
];
for (const [label, re] of FORBIDDEN) {
  check(`updater source has NO ${label}`, re.test(SRC), false);
}

// Majburiy primitivlar — BOR bo'lishi SHART.
const REQUIRED = [
  ["mandatory SHA-256 verification", /createHash\s*\(\s*['"]sha256['"]\s*\)/],
  ["64-hex checksum gate", /\[0-9a-fA-F\]\{64\}/],
  ["HTTPS-only artifact gate", /\^\\?https:/],
  ["bounded unique temp dir", /mkdtempSync\s*\(\s*path\.join\s*\(\s*os\.tmpdir\s*\(\s*\)/],
  ["argument-array launch (spawn)", /child\.spawn\s*\(\s*plan\.cmd\s*,\s*plan\.args/],
  ["macOS pkg handed to the OS installer", /\/usr\/bin\/open/],
  ["Windows msi handed to msiexec", /msiexec\.exe['"]\s*,\s*args\s*:\s*\[\s*['"]\/i['"]/],
  ["failed-download cleanup", /function cleanupTmp\s*\(/],
  ["OS-approval + restart messaging", /may ask you to approve[\s\S]*restart|approve it[\s\S]*quit After Effects/i],
  ["update polling preserved", /setInterval\s*\(function\s*\(\s*\)\s*\{\s*checkForUpdate\(true\);\s*\}\s*,\s*6\*60\*60\*1000\)/],
  ["Later / dismiss preserved", /afUpdLater[\s\S]*setDismissed/],
  ["mandatory releases cannot be dismissed", /\(mand\?''\s*:\s*'<button type="button" class="spbtn" id="afUpdLater">Later<\/button>'\)/],
  ["platform sent explicitly to the API", /platformQuery\s*\(\s*\)/],
];
for (const [label, re] of REQUIRED) {
  ok(`updater source HAS ${label}`, re.test(SRC));
}

// Blok sintaktik sog'mi (CEP ES5 uslubi — node --check ES5'ni ham qabul qiladi).
{
  const dir = mkdtempSync(path.join(os.tmpdir(), "ff-updater-check-"));
  const f = path.join(dir, "updater.js");
  try {
    writeFileSync(f, SRC);
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    ok("updater block passes node --check", true);
  } catch (e) {
    ok("updater block passes node --check", false);
    console.log("  ", String(e.stderr || e.message).slice(0, 400));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── B) XULQ — haqiqiy funksiyalarni stub muhitda ishga tushiramiz ──────────
function loadUpdater(src) {
  const win = { AF_PLUGIN_VERSION: "0.0.0" };
  const doc = {
    getElementById: () => null,
    createElement: () => ({ className: "", classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} }),
    body: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const noop = () => 0;
  const fn = new Function(
    "window", "document", "localStorage", "setTimeout", "setInterval", "pubFetch", "console", "require", "process",
    src + "\nreturn window.__afUpdater;"
  );
  return fn(
    win, doc,
    { getItem: () => null, setItem() {} },
    noop, noop,
    () => Promise.reject(new Error("no network in test")),
    { error() {}, log() {} },
    () => { throw new Error("require blocked in test"); },
    { platform: "linux" }
  );
}
const U = loadUpdater(SRC);
ok("updater exposes its real internals for testing", !!(U && U.validateInstaller && U.launchPlan));

const SHA = "a".repeat(64);
const macInstaller = { platform: "mac", ext: "pkg", url: "https://cdn.example/frameflow.pkg", sha256: SHA, sizeBytes: 1024 };
const winInstaller = { platform: "win", ext: "exe", url: "https://cdn.example/frameflow.exe", sha256: SHA, sizeBytes: 1024 };

// Musbat yo'l — allowlist platformalari + to'g'ri kengaytma
check("mac + .pkg accepted", U.validateInstaller("darwin", macInstaller).ok, true);
check("win + .exe accepted", U.validateInstaller("win32", winInstaller).ok, true);
check("win + .msi accepted", U.validateInstaller("win32", { ...winInstaller, ext: "msi" }).ok, true);

// Salbiy yo'llar — har biri ANIQ sabab bilan bloklanadi
check("unsupported OS (linux) blocked", U.validateInstaller("linux", macInstaller), { ok: false, reason: "unsupported_platform" });
check("unknown OS string blocked", U.validateInstaller("", macInstaller), { ok: false, reason: "unsupported_platform" });
check("missing installer blocked", U.validateInstaller("darwin", null), { ok: false, reason: "no_installer" });
check("mac + .exe blocked", U.validateInstaller("darwin", { ...macInstaller, ext: "exe" }), { ok: false, reason: "bad_extension" });
check("mac + .zxp blocked (legacy package never auto-installed)", U.validateInstaller("darwin", { ...macInstaller, ext: "zxp" }), { ok: false, reason: "bad_extension" });
check("mac + .zip blocked", U.validateInstaller("darwin", { ...macInstaller, ext: "zip" }), { ok: false, reason: "bad_extension" });
check("win + .pkg blocked", U.validateInstaller("win32", { ...winInstaller, ext: "pkg" }), { ok: false, reason: "bad_extension" });
check("win + .bat blocked", U.validateInstaller("win32", { ...winInstaller, ext: "bat" }), { ok: false, reason: "bad_extension" });
check("installer for another platform blocked", U.validateInstaller("darwin", { ...macInstaller, platform: "win" }), { ok: false, reason: "platform_mismatch" });
check("http:// url blocked", U.validateInstaller("darwin", { ...macInstaller, url: "http://cdn.example/f.pkg" }), { ok: false, reason: "insecure_url" });
check("file:// url blocked", U.validateInstaller("darwin", { ...macInstaller, url: "file:///tmp/evil.pkg" }), { ok: false, reason: "insecure_url" });
check("missing checksum blocked", U.validateInstaller("darwin", { ...macInstaller, sha256: "" }), { ok: false, reason: "missing_checksum" });
check("63-hex checksum blocked", U.validateInstaller("darwin", { ...macInstaller, sha256: "a".repeat(63) }), { ok: false, reason: "missing_checksum" });
check("65-hex checksum blocked", U.validateInstaller("darwin", { ...macInstaller, sha256: "a".repeat(65) }), { ok: false, reason: "missing_checksum" });
check("non-hex checksum blocked", U.validateInstaller("darwin", { ...macInstaller, sha256: "z".repeat(64) }), { ok: false, reason: "missing_checksum" });
check("uppercase 64-hex checksum accepted (normalised)", U.validateInstaller("darwin", { ...macInstaller, sha256: "A".repeat(64) }).sha256, "a".repeat(64));
check("zero size blocked", U.validateInstaller("darwin", { ...macInstaller, sizeBytes: 0 }), { ok: false, reason: "bad_size" });
check("oversized installer blocked", U.validateInstaller("darwin", { ...macInstaller, sizeBytes: U.maxBytes + 1 }), { ok: false, reason: "bad_size" });

// Fayl nomi — server matnidan EMAS, traversal imkonsiz
check("safe file name built from version", U.safeInstallerName("1.2.3", "pkg"), "frameflow-plugin-1.2.3.pkg");
check("path traversal in version stripped", U.safeInstallerName("../../etc/passwd", "pkg"), "frameflow-plugin-....etcpasswd.pkg");
check("separators in extension stripped", U.safeInstallerName("1.2.3", "pkg/../sh"), "frameflow-plugin-1.2.3.pkgsh");
check("empty version falls back", U.safeInstallerName("", "pkg"), "frameflow-plugin-update.pkg");

// Ishga tushirish rejasi — argument massivi, shell YO'Q
check("mac pkg → open with arg array", U.launchPlan("darwin", "/tmp/a b/frameflow.pkg", "pkg"), { cmd: "/usr/bin/open", args: ["/tmp/a b/frameflow.pkg"] });
check("win msi → msiexec /i with arg array", U.launchPlan("win32", "C:\\t\\f.msi", "msi"), { cmd: "msiexec.exe", args: ["/i", "C:\\t\\f.msi"] });
check("win exe → launched directly", U.launchPlan("win32", "C:\\t\\f.exe", "exe"), { cmd: "C:\\t\\f.exe", args: [] });
check("mac exe → no launch plan", U.launchPlan("darwin", "/tmp/f.exe", "exe"), null);
check("linux pkg → no launch plan", U.launchPlan("linux", "/tmp/f.pkg", "pkg"), null);
check("empty path → no launch plan", U.launchPlan("darwin", "", "pkg"), null);
check("download page is https", U.isHttpsUrl(U.downloadPage), true);

// ── C) MUTATSIYA ISBOTI — buzilgan nusxalarda tekshiruvlar YIQILISHI shart ──
function scanFails(mutant, re) { return re.test(mutant); }

// C1 — self-overwrite primitivini qaytarsak, taqiq skani buni TUTADI.
{
  const mutant = SRC.replace("setUpdStatus('Verifying SHA-256…');", "child.execFileSync('unzip',['-o',file,'-d',dir]);");
  ok("mutation: reintroduced unzip IS caught by the forbidden scan", scanFails(mutant, /\bunzip\b/));
}
// C2 — extension papkasiga cp qaytsa, skan TUTADI.
{
  const mutant = SRC.replace("cleanupTmp();", "child.execFileSync('cp',['-R',file,extensionDir()]);");
  ok("mutation: reintroduced cp -R IS caught by the forbidden scan", scanFails(mutant, /['"]cp['"]\s*,\s*\[/));
  ok("mutation: reintroduced extensionDir() IS caught by the forbidden scan", scanFails(mutant, /extensionDir\s*\(/));
}
// C3 — SHA-256 tekshiruvi olib tashlansa, XULQ testi buni TUTADI.
{
  const mutant = SRC.replace(
    "if(!isSha256Hex(installer.sha256))return {ok:false,reason:'missing_checksum'};",
    ""
  );
  const M = loadUpdater(mutant);
  const before = U.validateInstaller("darwin", { ...macInstaller, sha256: "" }).ok;
  const after = M.validateInstaller("darwin", { ...macInstaller, sha256: "" }).ok;
  ok("mutation: dropping the checksum gate IS caught by the behaviour test", before === false && after === true);
}
// C4 — kengaytma allowlist'i kengaytirilsa, XULQ testi buni TUTADI.
{
  const mutant = SRC.replace("darwin:{id:'mac',label:'macOS',exts:['pkg']}", "darwin:{id:'mac',label:'macOS',exts:['pkg','zxp']}");
  const M = loadUpdater(mutant);
  ok("mutation: widening the mac extension allowlist IS caught", M.validateInstaller("darwin", { ...macInstaller, ext: "zxp" }).ok === true);
}
// C5 — HTTPS to'sig'i olib tashlansa, XULQ testi TUTADI.
{
  const mutant = SRC.replace("function isHttpsUrl(u){ return /^https:\\/\\/[^\\s]+$/i.test(String(u==null?'':u)); }", "function isHttpsUrl(u){ return !!u; }");
  const M = loadUpdater(mutant);
  ok("mutation: dropping the HTTPS gate IS caught", M.validateInstaller("darwin", { ...macInstaller, url: "http://x/f.pkg" }).ok === true);
}
// C6 — shell bilan ishga tushirishga o'tilsa, skan TUTADI.
{
  const mutant = SRC.replace("{detached:true,stdio:'ignore'}", "{detached:true,stdio:'ignore',shell:true}");
  ok("mutation: shell:true launch IS caught by the forbidden scan", scanFails(mutant, /\bshell\s*:\s*true\b/));
}

if (fail) {
  console.error(`\n${fail}/${count} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (${count} case).`);
