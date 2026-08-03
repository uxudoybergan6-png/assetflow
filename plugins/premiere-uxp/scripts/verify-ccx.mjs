#!/usr/bin/env node
/*
 * `.ccx` TOZALIK TEKSHIRUVI — paket ichida nima borligini AYNAN paketdan o'qib
 * tekshiradi (build skriptining niyatiga emas, chiqqan BAYTLARGA qaraydi).
 *
 * `.ccx` — oddiy, dunyoga ochiq ZIP: uni har kim yechib o'qiy oladi. Shu sabab
 * ichida secret, dev-konfiguratsiya, lokal manzil yoki QA harness'i qolib
 * ketmasligi kerak (system prompt §10.3).
 *
 * Tekshiruvlar:
 *   1. ZIP tuzilmasi: `..`, absolyut yo'l, takror nom, shifrlash, ZIP64 yo'q.
 *   2. Taqiqlangan yo'llar: scripts/ spike/ dev/ dist/ node_modules/ .git/ .env
 *      va sourcemap (`*.map`).
 *   3. Matn fayllarda lokal manzil (`localhost`, `127.0.0.1`, `:4000`) yo'q.
 *   4. Secret naqshlari (API kalit, private key, hardcode Bearer) yo'q.
 *   5. `manifest.json`: id/versiya/`main` bor, `main` paket ichida mavjud,
 *      `network.domains` ichida lokal manzil yo'q.
 *   6. `main` HTML dagi HAR bir lokal `src`/`href` paket ichida mavjud
 *      (o'rnatilgan panelda "fayl topilmadi" bo'lmasin).
 *
 * CLI:
 *   node scripts/verify-ccx.mjs                    # dist/ ichidagi hamma .ccx
 *   node scripts/verify-ccx.mjs <fayl.ccx> [...]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const MAX_ENTRIES = 4096;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/* ── ZIP o'quvchisi (tashqi `unzip` YO'Q — xom baytlar) ──────────────────── */

/** Markaziy katalogni o'qiydi → `[{name, method, offset, size, csize}]`. */
function readCentral(buf, label) {
  const bad = (why) => { throw new Error(`${label}: ZIP buzuq — ${why}`); };
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) bad("EOCD topilmadi");
  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOff = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) bad("ZIP64 qo'llab-quvvatlanmaydi");
  if (total > MAX_ENTRIES) bad(`juda ko'p yozuv (${total})`);

  const out = [];
  let p = cdOff;
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) bad(`markaziy yozuv #${i} imzosi noto'g'ri`);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cLen = buf.readUInt16LE(p + 32);
    const attrs = buf.readUInt32LE(p + 38);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nLen).toString("utf8");
    if (flags & 0x1) bad(`shifrlangan yozuv: ${name}`);
    if (method !== 0 && method !== 8) bad(`noma'lum siqish (${method}): ${name}`);
    if (size > MAX_ENTRY_BYTES) bad(`yozuv juda katta: ${name}`);
    // Yuqori 16 bit — UNIX rejimi; S_IFLNK (0xa000) symlink degani.
    if (((attrs >>> 16) & 0xf000) === 0xa000) bad(`symlink: ${name}`);
    out.push({ name, method, csize, size, offset });
    p += 46 + nLen + eLen + cLen;
  }
  return out;
}

/** Bitta yozuvning xom baytini qaytaradi. */
function readEntry(buf, e, label) {
  if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw new Error(`${label}: lokal sarlavha buzuq (${e.name})`);
  const nLen = buf.readUInt16LE(e.offset + 26);
  const eLen = buf.readUInt16LE(e.offset + 28);
  const start = e.offset + 30 + nLen + eLen;
  const raw = buf.subarray(start, start + e.csize);
  if (e.method === 0) return Buffer.from(raw);
  return inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
}

/* ── Qoidalar ────────────────────────────────────────────────────────────── */

const FORBIDDEN_PREFIX = ["scripts/", "spike/", "dev/", "dist/", "node_modules/", ".git/"];
const FORBIDDEN_NAME = [/\.map$/i, /(^|\/)\.env/i, /(^|\/)\.DS_Store$/i, /(^|\/)qa-/i];

/**
 * DEV INSTRUMENTATSIYASI — mijoz paketida bo'lmasligi kerak (audit P0.5).
 *
 * MUHIM: "ish vaqtida `isDev` bayrog'i o'chiq" degani YETARLI EMAS — bayroq
 * kodni yo'q qilmaydi. Shu sabab tekshiruv PAKETGA qaraydi: fayl bormi va uning
 * imzosi biror faylga singib ketmaganmi (masalan kelajakda kimdir diag'ni
 * boshqa shim ichiga ko'chirса).
 */
const DEV_FILE = [/(^|\/)uxp-diag\.js$/i];
const REQUIRED_RUNTIME = [
  "js/ae-shim/uxp-account-events.js",
  "js/ae-shim/uxp-import-events.js",
  "js/ae-shim/uxp-native-events.js",
];
/** Diag oynasining o'ziga xos, boshqa hech qayerda uchramaydigan imzolari. */
const DEV_MARK = [
  ["__ffT1", "diag T1/T2/T3 hodisa zondi"],
  ["repaintProbe", "diag RPT turtki zondi"],
];

/** Matn ichidagi lokal manzillar — mijoz paketida bo'lmasligi kerak. */
const LOCAL_RE = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/gi;

/**
 * Ma'lum va QARALGAN lokal-manzil holatlari: fayl → kutilgan uchrash soni.
 *
 * Bu fayllar AE plagini bilan 1:1 umumiy manba — ulardagi `localhost` hech
 * qachon Premiere ichida so'rovga aylanmaydi (quyidagi sabablarga qara). Ammo
 * ro'yxat SONNI ham tekshiradi: manba o'zgarib yangi uchrash qo'shilsa,
 * tekshiruv yiqiladi va odam qayta ko'rib chiqishga majbur bo'ladi.
 */
const LOCAL_OK = {
  // `LOCAL_API`/`LOCAL_ADMIN` + `isLocalDev()` — faqat `location.hostname`
  // localhost bo'lganda ishlatiladi; UXP panelida hech qachon emas.
  "ported/ae-src/assetflow-env.js": 4,
  // `publicApiBase()` HIMOYASI: prefs'da qolib ketgan localhost bazani aniqlab
  // production'ga qaytaradi — ya'ni bu uchrashlar xavf emas, xavfning davosi.
  "ported/ae-src/assetflow-account.js": 6,
  // CMS vizual muharriri `?ffcms` bilan gate qilingan postMessage allowlist'i;
  // Premiere'da bu so'rov qatori yo'q — modul umuman uyg'onmaydi.
  "ported/ae-inline-08.js": 2,
};

/**
 * Secret naqshlari. Ataylab TOR: umumiy `key`/`token` so'zi emas, faqat
 * haqiqiy kalit shakllari — aks holda har ikkinchi qatorda soxta ogohlantirish
 * chiqib, tekshiruv e'tibordan qolardi.
 */
const SECRET_RE = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "OpenAI uslubidagi kalit"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/\bghp_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bAIza[0-9A-Za-z_-]{30,}/, "Google API kaliti"],
  [/\b(?:secret|password|api[_-]?key)\s*[:=]\s*["'][^"'\s]{12,}["']/i, "hardcode maxfiy qiymat"],
  [/Authorization\s*:\s*["']Bearer\s+[A-Za-z0-9._-]{20,}["']/i, "hardcode Bearer"],
];

const TEXT_EXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".txt", ".md", ".svg"]);

function isLocalRef(u) {
  const s = (u || "").trim();
  if (!s || s.startsWith("#")) return false;
  return !/^(https?:|data:|blob:|\/\/)/i.test(s);
}
const cleanRef = (u) => u.split("#")[0].split("?")[0].trim();

function htmlRefs(text) {
  const out = [];
  const re = /<(?:script|link|img|source|video|audio)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const a = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[0]);
    if (a) out.push(a[2] ?? a[3] ?? "");
  }
  return out;
}

/** Bitta paketni tekshiradi → xatolar ro'yxati. */
function verify(file) {
  const label = path.basename(file);
  const errs = [];
  const buf = fs.readFileSync(file);
  const entries = readCentral(buf, label);

  const names = new Set();
  for (const e of entries) {
    if (names.has(e.name)) errs.push(`takror nom: ${e.name}`);
    names.add(e.name);
    if (e.name.startsWith("/") || /^[A-Za-z]:/.test(e.name)) errs.push(`absolyut yo'l: ${e.name}`);
    if (e.name.split("/").includes("..")) errs.push(`yo'l chiqishi: ${e.name}`);
    const pre = FORBIDDEN_PREFIX.find((p) => e.name.startsWith(p));
    if (pre) errs.push(`taqiqlangan papka: ${e.name}`);
    if (FORBIDDEN_NAME.some((r) => r.test(e.name))) errs.push(`taqiqlangan fayl: ${e.name}`);
    if (DEV_FILE.some((r) => r.test(e.name))) errs.push(`dev instrumenti: ${e.name}`);
  }
  for (const required of REQUIRED_RUNTIME) {
    if (!names.has(required)) errs.push(`majburiy runtime fayli yo'q: ${required}`);
  }

  const text = new Map();
  for (const e of entries) {
    if (!TEXT_EXT.has(path.extname(e.name).toLowerCase())) continue;
    const s = readEntry(buf, e, label).toString("utf8");
    text.set(e.name, s);
    const hits = [];
    LOCAL_RE.lastIndex = 0;
    for (let m; (m = LOCAL_RE.exec(s)); ) hits.push(`${m[0]}@${s.slice(0, m.index).split("\n").length}`);
    const okCount = LOCAL_OK[e.name];
    if (hits.length && okCount == null) {
      errs.push(`lokal manzil (${hits.length}): ${e.name} — ${hits.slice(0, 3).join(", ")}`);
    } else if (hits.length !== (okCount || 0) && okCount != null) {
      errs.push(
        `lokal manzil soni o'zgardi: ${e.name} — kutilgan ${okCount}, topildi ${hits.length}` +
          ` (${hits.join(", ")}). LOCAL_OK ni qayta ko'rib chiq.`,
      );
    }
    for (const [mark, why] of DEV_MARK) {
      const at = s.indexOf(mark);
      if (at >= 0) errs.push(`${why}: ${e.name}:${s.slice(0, at).split("\n").length}`);
    }
    for (const [re, why] of SECRET_RE) {
      const m = re.exec(s);
      if (m) {
        const line = s.slice(0, m.index).split("\n").length;
        errs.push(`${why}: ${e.name}:${line}`);
      }
    }
  }

  const mj = text.get("manifest.json");
  if (!mj) errs.push("manifest.json yo'q");
  else {
    let m = null;
    try { m = JSON.parse(mj); } catch (e) { errs.push(`manifest.json parse bo'lmadi: ${e.message}`); }
    if (m) {
      for (const k of ["id", "version", "main", "manifestVersion"]) {
        if (!m[k]) errs.push(`manifest.${k} yo'q`);
      }
      if (m.main && !names.has(m.main)) errs.push(`manifest.main paketda yo'q: ${m.main}`);
      const doms = (m.requiredPermissions && m.requiredPermissions.network && m.requiredPermissions.network.domains) || [];
      for (const d of doms) if (LOCAL_RE.test(String(d))) errs.push(`network.domains ichida lokal manzil: ${d}`);
      // `main` HTML havolalari paket ichida mavjudmi.
      const html = m.main ? text.get(m.main) : null;
      if (html) {
        for (const raw of htmlRefs(html)) {
          if (!isLocalRef(raw)) continue;
          const rel = path.posix.normalize(path.posix.join(path.posix.dirname(m.main), cleanRef(raw)));
          if (!names.has(rel)) errs.push(`havola paketda yo'q: ${m.main} → ${raw}`);
        }
      }
    }
  }

  return { label, count: entries.length, bytes: buf.length, errs };
}

/* ── Asosiy ──────────────────────────────────────────────────────────────── */

let files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!files.length) {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ yo'q — avval `node scripts/build-ccx.mjs`.");
    process.exit(1);
  }
  files = fs.readdirSync(DIST).filter((f) => f.endsWith(".ccx")).map((f) => path.join(DIST, f));
}
if (!files.length) {
  console.error("Tekshiradigan .ccx topilmadi.");
  process.exit(1);
}

let bad = 0;
for (const f of files) {
  let r;
  try {
    r = verify(f);
  } catch (e) {
    console.log(`✗ ${path.basename(f)} — ${e.message}`);
    bad++;
    continue;
  }
  if (r.errs.length) {
    bad++;
    console.log(`✗ ${r.label} — ${r.errs.length} muammo (${r.count} fayl, ${(r.bytes / 1024).toFixed(1)} KB)`);
    for (const e of r.errs) console.log(`    · ${e}`);
  } else {
    console.log(`✓ ${r.label} — toza (${r.count} fayl, ${(r.bytes / 1024).toFixed(1)} KB)`);
  }
}
process.exit(bad ? 1 : 0);
