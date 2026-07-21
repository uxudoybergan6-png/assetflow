// Task 2 — PLAGIN UPDATER XAVFSIZLIK TESTI (haqiqiy JONLI manba, mock YO'Q).
//
// Test AssetFlow_Plugin.html ichidagi AF-UPDATER-BEGIN…AF-UPDATER-END blokini
// AYNAN o'qiydi va uch qatlamda tekshiradi:
//   A) MANBA SKANI — eski o'z-o'zini-yozish primitivlari (unzip / cp / extension
//      papkasi / shell interpolatsiya) YO'Q, majburiy primitivlar BOR;
//   B) XULQ — blok Node'da stub global'lar bilan ishga tushiriladi va uning
//      HAQIQIY funksiyalari (window.__afUpdater) chaqiriladi (musbat + salbiy);
//   C) MUTATSIYA ISBOTI — ataylab buzilgan nusxalarda A va B tekshiruvlari
//      YIQILISHI shart (aks holda testlar bo'sh — hech nimani isbotlamaydi);
//   D) YUKLAB OLUVCHI — updater ishlatadigan HAQIQIY AssetFlowCatalog.downloadUrlToFile
//      (assetflow-catalog.js jonli manbasi) strict rejimda: https→http redirect rad
//      etiladi, hajm chegarasi oqim ustida ushlanadi, opts'siz eski xulq o'zgarmaydi.
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-updater-security.mjs

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import http from "node:http";
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
  ["mandatory blocks dismissal only when the installer really works", /\(blocking\?''\s*:\s*'<button type="button" class="spbtn" id="afUpdLater">Later<\/button>'\)/],
  ["dismissal gate computed by blocksDismissal()", /var blocking=blocksDismissal\(info,osPlatform\(\),IS_CEP,downloadEngineReady\(\)\)/],
  ["platform sent explicitly to the API", /platformQuery\s*\(\s*\)/],
  // Task 2 tuzatish (audit #2) — yuklab olish STRICT rejimda chaqiriladi.
  ["strict https-only + bounded download options at the live call site", /downloadUrlToFile\([\s\S]{0,400}?\},null,\{httpsOnly:true,maxBytes:MAX_INSTALLER_BYTES\}\)/],
  ["download engine must advertise strict support", /AssetFlowCatalog\.downloadStrictSupported===true/],
  // Task 2 tuzatish (audit #4) — muvaffaqiyat faqat 'spawn' dan keyin.
  ["launch settled through settleLaunch()", /settleLaunch\(ch,supportsSpawnEvent\(nodeVersion\(\)\),/],
  ["spawn event is the success signal", /ch\.on\('spawn',function\(\)\{ done\(onOk\); \}\)/],
];
for (const [label, re] of REQUIRED) {
  ok(`updater source HAS ${label}`, re.test(SRC));
}

// launchInstaller — "ochildi" ekrani spawn() dan KEYIN darhol emas, faqat settleLaunch
// muvaffaqiyat callback'i ichida chaqirilishi SHART (aks holda yolg'on + yetim temp fayl).
{
  const body = SRC.slice(SRC.indexOf("function launchInstaller("));
  const settleAt = body.indexOf("settleLaunch(ch,");
  const handedAt = body.indexOf("showHandedOff(");
  const tmpAt = body.indexOf("upd.tmp=null;");
  ok("launchInstaller shows success only after settleLaunch", settleAt > 0 && handedAt > settleAt);
  ok("launchInstaller relinquishes the temp file only after settleLaunch", settleAt > 0 && tmpAt > settleAt);
  ok("launchInstaller has no synchronous success path", !/spawn\([^)]*\);\s*(ch\.unref\(\);\s*)?(upd\.tmp=null;\s*)?showHandedOff/.test(body));
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
  // setTimeout navbatga yig'iladi — kechiktirilgan yo'llarni test ATAYLAB ishga tushiradi.
  const timers = [];
  const fn = new Function(
    "window", "document", "localStorage", "setTimeout", "setInterval", "pubFetch", "console", "require", "process",
    src + "\nreturn window.__afUpdater;"
  );
  const api = fn(
    win, doc,
    { getItem: () => null, setItem() {} },
    (cb) => { timers.push(cb); return timers.length; }, noop,
    () => Promise.reject(new Error("no network in test")),
    { error() {}, log() {} },
    () => { throw new Error("require blocked in test"); },
    { platform: "linux" }
  );
  api.__timers = timers;
  return api;
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

// ── B2) Majburiy yangilanish foydalanuvchini QOPQONGA solmaydi (audit #3) ──
// Bloklash faqat: mandatory + CEP + strict dvigatel + YAROQLI installer. Bittasi yo'q =>
// halol xato + Later/yopish (keyingi tekshiruvda yana eslatiladi).
const mandInfo = { mandatory: true, latest: { version: "9.9.9" }, installer: macInstaller };
check("mandatory + valid installer + CEP → dismissal blocked", U.blocksDismissal(mandInfo, "darwin", true, true), true);
check("mandatory but NO installer → not blocked (no trap)", U.blocksDismissal({ ...mandInfo, installer: null }, "darwin", true, true), false);
check("mandatory but storage unavailable (no url) → not blocked", U.blocksDismissal({ ...mandInfo, installer: { ...macInstaller, url: "" } }, "darwin", true, true), false);
check("mandatory but installer for another OS → not blocked", U.blocksDismissal(mandInfo, "win32", true, true), false);
check("mandatory on an unsupported OS → not blocked", U.blocksDismissal(mandInfo, "linux", true, true), false);
check("mandatory but checksum missing → not blocked", U.blocksDismissal({ ...mandInfo, installer: { ...macInstaller, sha256: "" } }, "darwin", true, true), false);
check("mandatory outside CEP → not blocked", U.blocksDismissal(mandInfo, "darwin", false, true), false);
check("mandatory without a strict download engine → not blocked", U.blocksDismissal(mandInfo, "darwin", true, false), false);
check("non-mandatory release never blocks", U.blocksDismissal({ ...mandInfo, mandatory: false }, "darwin", true, true), false);
check("missing info never blocks", U.blocksDismissal(null, "darwin", true, true), false);

// ── B3) Ishga tushirish HALOLLIGI (audit #4) — muvaffaqiyat faqat 'spawn' dan keyin ──
function fakeChild() {
  const h = {};
  return {
    on(ev, cb) { (h[ev] = h[ev] || []).push(cb); return this; },
    emit(ev, a) { (h[ev] || []).forEach((cb) => cb(a)); },
  };
}
check("node 16 supports the spawn event", U.supportsSpawnEvent("16.14.2"), true);
check("node 15.5 (CEP 11) supports the spawn event", U.supportsSpawnEvent("15.5.0"), true);
check("node 12 does not (deferred settle)", U.supportsSpawnEvent("12.22.0"), false);
check("unknown node version → deferred settle", U.supportsSpawnEvent(""), false);
{
  const seen = [];
  const ch = fakeChild();
  U.settleLaunch(ch, true, () => seen.push("ok"), () => seen.push("err"));
  check("no success before the child actually spawns", seen, []);
  ch.emit("spawn");
  check("success shown once the child spawns", seen, ["ok"]);
  ch.emit("error", new Error("late"));
  check("a late spawn error does not double-settle", seen, ["ok"]);
}
{
  const seen = [];
  const ch = fakeChild();
  U.settleLaunch(ch, true, () => seen.push("ok"), () => seen.push("err"));
  ch.emit("error", new Error("ENOENT"));
  check("async spawn error settles as failure, never success", seen, ["err"]);
  ch.emit("spawn");
  check("spawn after an error cannot claim success", seen, ["err"]);
}
{
  const seen = [];
  const ch = fakeChild();
  const from = U.__timers.length;
  U.settleLaunch(ch, false, () => seen.push("ok"), () => seen.push("err"));
  ch.emit("error", new Error("ENOENT"));
  U.__timers.slice(from).forEach((fn) => fn());
  check("legacy runtime: error wins over the deferred settle", seen, ["err"]);
}
{
  const seen = [];
  const ch = fakeChild();
  const from = U.__timers.length;
  U.settleLaunch(ch, false, () => seen.push("ok"), () => seen.push("err"));
  check("legacy runtime: nothing claimed before the deferred tick", seen, []);
  U.__timers.slice(from).forEach((fn) => fn());
  check("legacy runtime: success after the deferred tick", seen, ["ok"]);
}

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
// C7 — majburiylik yana so'zsiz bloklasa (qopqon), skan TUTADI.
{
  const mutant = SRC.replace(
    "+(blocking?'':'<button type=\"button\" class=\"spbtn\" id=\"afUpdLater\">Later</button>')",
    "+(mand?'':'<button type=\"button\" class=\"spbtn\" id=\"afUpdLater\">Later</button>')"
  );
  ok("mutation: unconditional mandatory block IS caught by the source scan",
    !/\(blocking\?''\s*:\s*'<button type="button" class="spbtn" id="afUpdLater">Later<\/button>'\)/.test(mutant));
}
// C8 — blocksDismissal installer yaroqliligini tekshirmay qo'ysa, XULQ testi TUTADI.
{
  const mutant = SRC.replace(
    "return validateInstaller(plat,info.installer).ok===true;",
    "return true;"
  );
  const M = loadUpdater(mutant);
  ok("mutation: blocking an impossible mandatory update IS caught",
    U.blocksDismissal({ ...mandInfo, installer: null }, "darwin", true, true) === false &&
    M.blocksDismissal({ ...mandInfo, installer: null }, "darwin", true, true) === true);
}
// C9 — strict yuklab olish parametrlari olib tashlansa, skan TUTADI.
{
  const mutant = SRC.replace(",null,{httpsOnly:true,maxBytes:MAX_INSTALLER_BYTES})", ")");
  ok("mutation: dropping the strict download options IS caught",
    !/downloadUrlToFile\([\s\S]{0,400}?\},null,\{httpsOnly:true,maxBytes:MAX_INSTALLER_BYTES\}\)/.test(mutant));
}
// C10 — spawn'ni kutmay "ochildi" deyilsa, tuzilma tekshiruvi TUTADI.
{
  const mutant = SRC.replace(
    /settleLaunch\(ch,supportsSpawnEvent\(nodeVersion\(\)\),function\(\)\{/,
    "upd.tmp=null; showHandedOff(v); settleLaunch(ch,supportsSpawnEvent(nodeVersion()),function(){"
  );
  const body = mutant.slice(mutant.indexOf("function launchInstaller("));
  ok("mutation: claiming success before spawn IS caught",
    body.indexOf("showHandedOff(") < body.indexOf("settleLaunch(ch,"));
}
// C11 — settleLaunch ikki marta hal qilsa, XULQ testi TUTADI.
{
  const mutant = SRC.replace("function done(fn,a){ if(settled)return; settled=true;", "function done(fn,a){ settled=true;");
  const M = loadUpdater(mutant);
  const seen = [];
  const ch = fakeChild();
  M.settleLaunch(ch, true, () => seen.push("ok"), () => seen.push("err"));
  ch.emit("spawn");
  ch.emit("error", new Error("late"));
  ok("mutation: double settlement IS caught by the behaviour test", seen.length === 2);
}

// ── D) YUKLAB OLUVCHI — HAQIQIY AssetFlowCatalog.downloadUrlToFile (audit #2) ──────
// Updater aynan shu umumiy yordamchini chaqiradi. Test uni assetflow-catalog.js JONLI
// manbasidan yuklaydi (soxta nusxa YO'Q): transport sifatida haqiqiy localhost HTTP
// serveri ishlatiladi; https→http downgrade uchun `require` darajasida transport
// almashtiriladi (yordamchi mantiqning O'ZI sinaladi, qayta yozilmaydi).
const CATALOG_SRC = readFileSync(path.join(SCRIPTS_DIR, "..", "assetflow-catalog.js"), "utf8");
const nodeRequire = createRequire(import.meta.url);

function loadCatalog(src, requireImpl) {
  const fn = new Function("window", "require", "console",
    (src || CATALOG_SRC) + "\nreturn AssetFlowCatalog;");
  return fn({}, requireImpl || nodeRequire, { log() {}, error() {}, warn() {} });
}
const CAT = loadCatalog();
ok("shared downloader loaded from the live assetflow-catalog.js", typeof CAT.downloadUrlToFile === "function");
ok("shared downloader advertises strict-mode support", CAT.downloadStrictSupported === true);
ok("updater's engine gate names the flag the shared helper actually exports",
  /AssetFlowCatalog\.downloadStrictSupported===true/.test(SRC) && CAT.downloadStrictSupported === true);

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ff-dl-test-"));
const dest = (n) => path.join(tmpDir, n);
const noLeftovers = (p) => !existsSync(p) && !existsSync(p + ".part");
const settle = (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }));

function listen(handler) {
  const srv = http.createServer(handler);
  return new Promise((res) => srv.listen(0, "127.0.0.1", () => res({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}
const close = (srv) => new Promise((res) => srv.close(res));

// D1 — ORQAGA MOSLIK: opts'siz chaqiruv (pack/mogrt yo'llari) o'zgarmagan — redirect
// kuzatiladi, fayl to'liq yoziladi.
{
  const { srv, base } = await listen((req, res) => {
    if (req.url === "/r") { res.writeHead(302, { location: base + "/f" }); res.end(); return; }
    res.writeHead(200, { "content-length": "5" }); res.end("hello");
  });
  const out = dest("compat.bin");
  const r = await settle(CAT.downloadUrlToFile(base + "/r", out, null));
  ok("legacy call (no opts) still follows redirects and writes the file", r.ok && readFileSync(out, "utf8") === "hello");
  ok("legacy call leaves no .part file", !existsSync(out + ".part"));
  await close(srv);
}

// D2 — STRICT: boshlang'ich URL https bo'lmasa — so'rov UMUMAN yuborilmaydi.
{
  let hits = 0;
  const { srv, base } = await listen((req, res) => { hits++; res.writeHead(200); res.end("x"); });
  const out = dest("insecure-initial.bin");
  const r = await settle(CAT.downloadUrlToFile(base + "/f", out, null, null, { httpsOnly: true, maxBytes: 1024 }));
  ok("strict mode refuses a non-HTTPS initial URL", !r.ok && /non-HTTPS/i.test(String(r.e && r.e.message)));
  check("strict mode never contacts the insecure host", hits, 0);
  ok("strict refusal leaves no file behind", noLeftovers(out));
  await close(srv);
}

// D3 — STRICT: https→http REDIRECT (downgrade) rad etiladi va http transport
// umuman ishlatilmaydi.
function fakeTransports(location) {
  const httpHits = [];
  const req = () => ({ on() { return this; }, destroy() {} });
  const respond = (cb, status, headers, body) => {
    const res = Readable.from(body ? [Buffer.from(body)] : []);
    res.statusCode = status; res.headers = headers;
    setImmediate(() => cb(res));
    return req();
  };
  return {
    httpHits,
    https: { get: (u, a, b) => respond(typeof a === "function" ? a : b, 302, { location }, null) },
    http: { get: (u, a, b) => { httpHits.push(u); return respond(typeof a === "function" ? a : b, 200, { "content-length": "7" }, "payload"); } },
  };
}
{
  const t = fakeTransports("http://evil.invalid/installer.pkg");
  const C = loadCatalog(null, (id) => (id === "https" ? t.https : id === "http" ? t.http : nodeRequire(id)));
  const out = dest("downgrade.bin");
  const r = await settle(C.downloadUrlToFile("https://cdn.example/i.pkg", out, null, null, { httpsOnly: true, maxBytes: 1024 }));
  ok("strict mode refuses an https→http redirect", !r.ok && /non-HTTPS/i.test(String(r.e && r.e.message)));
  check("the http transport is never used after a downgrade", t.httpHits.length, 0);
  ok("downgrade refusal leaves no file behind", noLeftovers(out));
}
// D3-mutatsiya — httpsOnly darvozasi olib tashlansa, downgrade O'TIB KETADI (test bo'sh emas).
{
  const t = fakeTransports("http://evil.invalid/installer.pkg");
  const mutant = CATALOG_SRC.replace(
    'if (httpsOnly && !isHttps(u)) { abortStrict("Insecure (non-HTTPS) download URL"); return; }',
    ""
  );
  ok("mutation fixture actually removed the https gate", mutant !== CATALOG_SRC);
  const C = loadCatalog(mutant, (id) => (id === "https" ? t.https : id === "http" ? t.http : nodeRequire(id)));
  const out = dest("downgrade-mutant.bin");
  const r = await settle(C.downloadUrlToFile("https://cdn.example/i.pkg", out, null, null, { httpsOnly: true, maxBytes: 1024 }));
  ok("mutation: dropping the https gate IS caught (downgrade would succeed)", r.ok && t.httpHits.length === 1);
}

// D4 — STRICT: e'lon qilingan Content-Length chegaradan katta => bitta bayt ham yozilmaydi.
{
  const { srv, base } = await listen((req, res) => { res.writeHead(200, { "content-length": String(4096) }); res.end(Buffer.alloc(4096)); });
  const out = dest("too-big-declared.bin");
  const r = await settle(CAT.downloadUrlToFile(base + "/f", out, null, null, { maxBytes: 1024 }));
  ok("declared Content-Length over the limit is rejected", !r.ok && /size limit/i.test(String(r.e && r.e.message)));
  ok("oversized declaration leaves no file behind", noLeftovers(out));
  await close(srv);
}

// D5 — STRICT: Content-Length YO'Q (yolg'on/chunked) — oqim chegaradan oshgan zahoti
// uziladi, ya'ni server rejalashtirilgan baytlarning HAMMASINI yubora olmaydi.
{
  const CHUNK = 64 * 1024, CHUNKS = 256, PLANNED = CHUNK * CHUNKS; // 16 MiB
  let sent = 0;
  const { srv, base } = await listen((req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    let i = 0;
    const pump = () => {
      if (i >= CHUNKS || res.destroyed || res.writableEnded) { try { res.end(); } catch (e) {} return; }
      i++; sent += CHUNK;
      res.write(Buffer.alloc(CHUNK), () => setImmediate(pump));
    };
    pump();
  });
  const out = dest("too-big-streamed.bin");
  const LIMIT = 256 * 1024;
  const r = await settle(CAT.downloadUrlToFile(base + "/f", out, null, null, { maxBytes: LIMIT }));
  ok("streamed bytes over the limit are rejected", !r.ok && /size limit/i.test(String(r.e && r.e.message)));
  ok("the stream is cut early, not after filling the disk", sent < PLANNED);
  ok("streamed overflow leaves no partial data", noLeftovers(out));
  await close(srv);
}

// D6 — STRICT chegara ostidagi yuklash normal ishlaydi (chegara halol, ortiqcha emas).
{
  const { srv, base } = await listen((req, res) => { res.writeHead(200, { "content-length": "5" }); res.end("okok!"); });
  const out = dest("within-limit.bin");
  const r = await settle(CAT.downloadUrlToFile(base + "/f", out, null, null, { httpsOnly: false, maxBytes: 1024 }));
  ok("a download within the limit still succeeds", r.ok && readFileSync(out, "utf8") === "okok!");
  await close(srv);
}
rmSync(tmpDir, { recursive: true, force: true });

if (fail) {
  console.error(`\n${fail}/${count} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (${count} case).`);
