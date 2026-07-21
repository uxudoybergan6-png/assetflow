// Security Task 1 — bog'liqlik xavfsizlik "poli" (floor) regressiya testi.
//
// Maqsad: 2026-07-21 auditda tuzatilgan zaifliklar JIMGINA qaytib kelmasin. Test HECH QANDAY
// ko'chirilgan konstantani tekshirmaydi — u HAQIQIY fayllarni o'qiydi:
//   1) manifestlar (package.json) — e'lon qilingan semver diapazoni,
//   2) package-lock.json — daraxtda AMALDA hal qilingan (resolved) versiyalar,
//   3) node_modules/<pkg>/package.json — o'rnatilgan versiya (bo'lsa).
// Diapazon, lock yoki o'rnatilgan nusxadan BIRORTASI poldan past bo'lsa — test yiqiladi.
//
// Ishga tushirish: node scripts/test-dependency-security-floors.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
function check(ok, label, detail) {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok && detail) console.log(`         ${detail}`);
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// --- minimal semver (yangi dependency qo'shmaslik uchun) --------------------------------
/** "1.2.3-beta.1" → [1,2,3] (prerelease e'tiborga olinmaydi; bu yerda faqat stabil versiyalar). */
function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
/**
 * Diapazon QONIQTIRA OLADIGAN ENG PAST versiya. `^2.2.0`/`~3.0.7`/`>=7.0.3`/`2.2.0` shakllarini
 * qo'llaydi. Tanilmagan/kengroq shakl (`*`, `x`, `||`, `<`) — ATAYLAB xato: bunday diapazon
 * zaif versiyaga tusha oladi, shuning uchun testdan o'tmasligi kerak.
 */
function minSatisfying(range) {
  const r = String(range).trim();
  if (/[|*x<]/i.test(r) || r === "") return null;
  const m = /^(\^|~|>=|>)?\s*(\d+\.\d+\.\d+.*)$/.exec(r);
  if (!m) return null;
  const base = parseVersion(m[2]);
  if (!base) return null;
  // `>` uchun ham `base`ni ishlatamiz — bu KONSERVATIV (haqiqiy min undan yuqori bo'ladi).
  return base;
}

// --- HAQIQIY fayllar --------------------------------------------------------------------
const lock = readJson("package-lock.json");
const lockPackages = lock.packages || {};

/** Lock ichidagi shu paket nomiga tegishli BARCHA hal qilingan versiyalar. */
function lockedVersions(name) {
  const out = [];
  for (const [key, meta] of Object.entries(lockPackages)) {
    if (!key || !meta || typeof meta.version !== "string") continue;
    // "node_modules/foo", "apps/api/node_modules/foo", "node_modules/a/node_modules/foo"
    if (key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)) {
      out.push({ path: key, version: meta.version });
    }
  }
  return out;
}

function installedVersion(name) {
  const p = path.join(ROOT, "node_modules", name, "package.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")).version;
  } catch {
    return null;
  }
}

/**
 * TO'G'RIDAN-TO'G'RI (manifestda e'lon qilingan) paketlar — uchalasi ham 2026-07-21 auditda
 * aynan shu manifestlar sababli zaif edi.
 */
const DIRECT = [
  {
    name: "multer",
    manifest: "apps/api/package.json",
    section: "dependencies",
    floor: "2.2.0",
    why: "GHSA-72gw-mp4g-v24j (nested field DoS) + GHSA-3p4h-7m6x-2hcm (aborted-upload cleanup)",
  },
  {
    name: "http-proxy-middleware",
    manifest: "packages/assetflow-studio/package.json",
    section: "dependencies",
    floor: "3.0.7",
    why: "GHSA-gcq2-9pq2-cxqm (multipart CRLF injection) + GHSA-64mm-vxmg-q3vj (Host-header router bypass)",
  },
  {
    name: "pm2",
    manifest: "package.json",
    section: "devDependencies",
    floor: "7.0.3",
    why: "js-yaml GHSA-h67p-54hq-rp68 / GHSA-52cp-r559-cp3m — pm2 <7 js-yaml <4.3.0 ga pinlangan",
  },
];

console.log("\n  Bog'liqlik xavfsizlik poli — to'g'ridan-to'g'ri paketlar\n");

for (const dep of DIRECT) {
  const floor = parseVersion(dep.floor);
  const pkg = readJson(dep.manifest);
  const range = pkg[dep.section]?.[dep.name];

  check(
    typeof range === "string" && range.length > 0,
    `${dep.name}: ${dep.manifest} → ${dep.section} da mavjud`,
    `topilmadi (${dep.why})`
  );
  if (typeof range !== "string") continue;

  const min = minSatisfying(range);
  check(
    min !== null && cmp(min, floor) >= 0,
    `${dep.name}: manifest diapazoni "${range}" ${dep.floor} dan past versiyaga TUSHA OLMAYDI`,
    min === null
      ? `"${range}" — juda keng/tanilmagan diapazon, zaif versiyaga tushishi mumkin`
      : `min ${min.join(".")} < ${dep.floor} — ${dep.why}`
  );

  const locked = lockedVersions(dep.name);
  check(locked.length > 0, `${dep.name}: package-lock.json da hal qilingan`, "lock'da yo'q");
  for (const l of locked) {
    const v = parseVersion(l.version);
    check(
      v !== null && cmp(v, floor) >= 0,
      `${dep.name}: lock "${l.path}" → ${l.version} ≥ ${dep.floor}`,
      `${dep.why}`
    );
  }

  const inst = installedVersion(dep.name);
  if (inst !== null) {
    const v = parseVersion(inst);
    check(
      v !== null && cmp(v, floor) >= 0,
      `${dep.name}: o'rnatilgan ${inst} ≥ ${dep.floor}`,
      `${dep.why}`
    );
  } else {
    console.log(`  ·  ${dep.name}: node_modules'да yo'q (npm install qilinmagan) — lock tekshiruvi kuchda`);
  }
}

/**
 * TRANZITIV paketlar — manifestda yo'q, lekin shu vazifada tuzatilgan. Bu yerda faqat LOCK
 * tekshiriladi (aynan shu joyda regressiya bo'ladi: parent yangilansa/qaytarilsa).
 */
const TRANSITIVE = [
  { name: "body-parser", floor: "2.3.0", why: "GHSA-v422-hmwv-36x6 (invalid limit → size enforcement o'chadi)" },
  { name: "esbuild", floor: "0.28.1", why: "GHSA-g7r4-m6w7-qqqr (dev-server arbitrary file read, Windows)" },
  { name: "protobufjs", floor: "7.6.5", why: "GHSA-j3f2-48v5-ccww (.proto option parsing infinite loop)" },
  { name: "js-yaml", floor: "4.3.0", why: "GHSA-h67p-54hq-rp68 / GHSA-52cp-r559-cp3m (merge-key quadratic DoS)" },
  { name: "uuid", floor: "11.1.1", why: "GHSA-w5hq-g745-h8pq (v3/v5/v6 buffer bounds check)" },
];

console.log("\n  Bog'liqlik xavfsizlik poli — tranzitiv paketlar (package-lock.json)\n");

for (const dep of TRANSITIVE) {
  const floor = parseVersion(dep.floor);
  const locked = lockedVersions(dep.name);
  if (!locked.length) {
    // Daraxtda umuman yo'q = zaiflik yuzasi ham yo'q (masalan uuid gaxios 7 bilan chiqib ketdi).
    console.log(`✓  ${dep.name}: daraxtda yo'q (zaiflik yuzasi yo'q)`);
    continue;
  }
  for (const l of locked) {
    const v = parseVersion(l.version);
    check(
      v !== null && cmp(v, floor) >= 0,
      `${dep.name}: lock "${l.path}" → ${l.version} ≥ ${dep.floor}`,
      `${dep.why}`
    );
  }
}

// ---------------------------------------------------------------------------------------
// PM2 7 moslik — `pm2 jlist` chiqishini bardoshli o'qish.
// pm2 6 → 7 major yangilanishidan keyin, foydalanuvchi hali `pm2 kill` qilmagan bo'lsa,
// PM2 CLI JSON oldiga "In-memory PM2 is out-of-date" bannerini qo'shadi (izolyatsiyalangan
// PM2_HOME'да tasdiqlangan). Oddiy JSON.parse throw qilardi → skriptlar sog' ro'yxatni
// "buzilgan" deb ko'rsatardi.
// ---------------------------------------------------------------------------------------
console.log("\n  PM2 7 moslik — pm2 jlist chiqishini o'qish\n");

const { parsePm2Jlist } = await import("./pm2-jlist.mjs");
const REAL_BANNER =
  ">>>> In-memory PM2 is out-of-date, do:\n>>>> $ pm2 update\n" +
  "In memory PM2 version: 6.0.14\nLocal PM2 version: 7.0.3\n\n";
const SAMPLE = '[{"name":"assetflow-api","pm2_env":{"status":"online","restart_time":0}}]';

check(parsePm2Jlist(SAMPLE)?.[0]?.name === "assetflow-api", "parsePm2Jlist: toza JSON o'qiladi");
check(
  parsePm2Jlist(REAL_BANNER + SAMPLE)?.[0]?.pm2_env?.status === "online",
  "parsePm2Jlist: 'In-memory PM2 is out-of-date' banneri bilan ham o'qiladi (pm2 6→7 oralig'i)"
);
// Sovuq PM2_HOME (`pm2 kill` / `npm run pm2:reset` dan keyin) — pm2 7.0.3 chiqishidan AYNAN
// olingan shakl: ASCII banner + KVADRAT QAVSLI `[PM2] …` qatorlar, so'ng JSON. "Birinchi `[`"
// qoidasi bu yerda `[PM2]` ga tushib null qaytarardi.
const COLD_BANNER =
  "\n      -------------\n\n   PM2 ASCII art …\n\n" +
  "[PM2] Spawning PM2 daemon with pm2_home=/tmp/ff-pm2home\n" +
  "[PM2] PM2 Successfully daemonized\n";
check(
  Array.isArray(parsePm2Jlist(COLD_BANNER + "[]")) && parsePm2Jlist(COLD_BANNER + "[]").length === 0,
  "parsePm2Jlist: sovuq daemon '[PM2] Spawning…' banneri + bo'sh ro'yxat o'qiladi"
);
check(
  parsePm2Jlist(COLD_BANNER + SAMPLE + "\n")?.[0]?.name === "assetflow-api",
  "parsePm2Jlist: sovuq daemon banneri + haqiqiy ro'yxat o'qiladi (npm run pm2:reset yo'li)"
);
check(parsePm2Jlist("") === null, "parsePm2Jlist: bo'sh chiqish → null");
check(parsePm2Jlist("[PM2] Spawning PM2 daemon\n") === null, "parsePm2Jlist: faqat banner, JSON yo'q → null");
check(parsePm2Jlist("boom") === null, "parsePm2Jlist: JSON bo'lmagan chiqish → null");
check(parsePm2Jlist('{"not":"array"}') === null, "parsePm2Jlist: massiv bo'lmagan JSON → null");

// Sanity: testning o'zi haqiqiy fayllarni o'qiganini tasdiqlaymiz (bo'sh/soxta o'tishning oldini oladi).
check(
  Object.keys(lockPackages).length > 50,
  `package-lock.json haqiqatan o'qildi (${Object.keys(lockPackages).length} yozuv)`,
  "lock bo'sh yoki formati kutilmagan — tekshiruv ishonchsiz"
);

console.log(
  fail === 0
    ? "\n  ✓ Barcha xavfsizlik pollari saqlangan\n"
    : `\n  ✗ ${fail} ta tekshiruv YIQILDI — zaif bog'liqlik qaytib kelgan\n`
);
process.exit(fail === 0 ? 0 : 1);
