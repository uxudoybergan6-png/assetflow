#!/usr/bin/env node
/*
 * `.ccx` QURUVCHI — FrameFlow Premiere Pro UXP paneli.
 *
 * `.ccx` = oddiy ZIP (Adobe UnifiedPluginInstaller shu kengaytmani ochadi).
 * Paket ZIP MARKAZIY KATALOGI bilan shu yerda YOZILADI — tashqi `zip` CLI ga
 * tayanmaymiz (CI konteynerida bo'lmasligi mumkin, `child_process` esa qo'shimcha
 * yuza). `zlib` FAQAT build vaqtida ishlatiladi — UXP runtime'da emas.
 *
 * IKKI FLAVOR (system prompt §5 / §10.2 — bitta ID bilan ikki kanalga chiqma):
 *   • `standalone`  — o'zimiz tarqatadigan `.ccx` (sayt/landing yuklab olish).
 *                     ID: manifest'dagi `com.frameflow.premiere`.
 *   • `marketplace` — Adobe Exchange kanali. ID Adobe tomonidan beriladi, shu
 *                     sabab `FF_PR_MARKETPLACE_ID` env'dan olinadi (kodda
 *                     hardcode YO'Q — hali berilmagan bo'lsa flavor o'tkazib
 *                     yuboriladi, jim SOXTA paket chiqmaydi).
 *
 * FAYL RO'YXATI QO'LDA EMAS — `manifest.json.main` dan boshlab BOG'LIQLIK
 * YOPILMASI hisoblanadi (`<script src>`, `<link href>`, CSS `url(...)`) + manifest
 * ikonkalari. Sabab: `js/` ichida FAZA 1 skeletonidan qolgan, endi hech kim
 * chaqirmaydigan modullar bor — allowlist bo'lsa ular jimgina paketga tushardi.
 * Yopilmadan tashqaridagi hech narsa (dev harness, QA drayveri, spike) kirmaydi.
 *
 * CLI:
 *   node scripts/build-ccx.mjs                 # ikkala flavor (imkoni bo'lgani)
 *   node scripts/build-ccx.mjs --flavor=standalone
 *   node scripts/build-ccx.mjs --list          # faqat fayl ro'yxatini chiqaradi
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/* ══════════════════════════════════════════════════════════════════════════
   Bog'liqlik yopilmasi
   ══════════════════════════════════════════════════════════════════════════ */

/** Paketga HECH QACHON kirmaydigan yo'l boshlanishlari (yopilma tashqarisi ham). */
const NEVER = ["scripts/", "spike/", "dev/", "dist/", "node_modules/", ".git/"];

/** Yopilma qidiruvida e'tiborsiz qoldiriladigan manbalar (tashqi/inline). */
function isLocalRef(u) {
  if (!u) return false;
  const s = u.trim();
  if (!s || s.startsWith("#")) return false;
  return !/^(https?:|data:|blob:|\/\/)/i.test(s);
}

/** `?v=…#frag` ni kesadi. */
const cleanRef = (u) => u.split("#")[0].split("?")[0].trim();

function refsOfHtml(text) {
  const out = [];
  const re = /<(?:script|link|img|source|video|audio)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const tag = m[0];
    const a = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (a) out.push(a[2] ?? a[3] ?? "");
  }
  return out;
}

function refsOfCss(text) {
  const out = [];
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]+))\s*\)/gi;
  let m;
  while ((m = re.exec(text))) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  const imp = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)')/gi;
  while ((m = imp.exec(text))) out.push(m[1] ?? m[2] ?? "");
  return out;
}

/**
 * `entry` dan boshlab bog'liq fayllarni to'playdi (repo-nisbiy, `/` bilan).
 * Yo'q fayl — QATTIQ XATO: paket ichida sinuvchi havola qolib ketmasin.
 */
function closureFrom(entryRel) {
  const seen = new Set();
  const queue = [entryRel];
  const missing = [];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { missing.push(rel); continue; }
    const ext = path.extname(rel).toLowerCase();
    if (ext !== ".html" && ext !== ".css") continue;
    const text = fs.readFileSync(abs, "utf8");
    const refs = ext === ".html" ? refsOfHtml(text) : refsOfCss(text);
    for (const raw of refs) {
      if (!isLocalRef(raw)) continue;
      const ref = cleanRef(raw);
      if (!ref) continue;
      const next = path
        .normalize(path.join(path.dirname(rel), ref))
        .split(path.sep)
        .join("/");
      if (next.startsWith("..")) {
        missing.push(`${rel} → ${ref} (plagin ildizidan tashqarida)`);
        continue;
      }
      queue.push(next);
    }
  }
  if (missing.length) {
    throw new Error(`Bog'liqlik topilmadi:\n  ${missing.join("\n  ")}`);
  }
  return [...seen].sort();
}

/* ══════════════════════════════════════════════════════════════════════════
   ZIP yozuvchi (tashqi vositasiz)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * DOS sana/vaqt. `SOURCE_DATE_EPOCH` berilsa o'sha ishlatiladi — bir xil
 * manbadan bir xil bayt chiqishi (reproducible build) uchun.
 */
function dosStamp() {
  const epoch = Number(process.env.SOURCE_DATE_EPOCH || 0);
  const d = epoch > 0 ? new Date(epoch * 1000) : new Date();
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** `[{name, data}]` → ZIP baytlari (deflate; ZIP64 YO'Q — panel kichik). */
function zipBytes(entries) {
  const { time, date } = dosStamp();
  const locals = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data) >>> 0;
    const deflated = deflateRawSync(e.data, { level: 9 });
    // Siqilgan hajm kattaroq bo'lsa — siqmasdan saqlaymiz (kichik JSON/PNG).
    const store = deflated.length >= e.data.length;
    const body = store ? e.data : deflated;
    const method = store ? 0 : 8;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);            // versiya (2.0 — deflate)
    lh.writeUInt16LE(0x0800, 6);        // bayroq: nom UTF-8
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(0x031e, 4);        // yaratuvchi: UNIX + 3.0
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    // Tashqi atributlar: oddiy fayl 644. `>>> 0` SHART — `<< 16` JS'da 32-bitli
    // ISHORALI natija beradi va `writeUInt32LE` manfiy sonni rad etadi.
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + body.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Flavor'lar
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Flavor manifesti. Faqat `id` (va marketplace uchun nom qo'shimchasi)
 * o'zgaradi — kod, tarmoq ruxsatlari, versiya AYNAN bir xil qoladi, aks holda
 * ikki kanal ikki xil xatti-harakat qilardi.
 */
function flavors(baseManifest) {
  const list = [
    { key: "standalone", id: baseManifest.id, name: baseManifest.name },
  ];
  const mkId = (process.env.FF_PR_MARKETPLACE_ID || "").trim();
  if (mkId) list.push({ key: "marketplace", id: mkId, name: baseManifest.name });
  return list;
}

/* ══════════════════════════════════════════════════════════════════════════
   Asosiy
   ══════════════════════════════════════════════════════════════════════════ */

const argv = process.argv.slice(2);
const only = (argv.find((a) => a.startsWith("--flavor=")) || "").split("=")[1] || "";
const listOnly = argv.includes("--list");

const manifestPath = path.join(ROOT, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.main) throw new Error("manifest.json ichida `main` yo'q");

const files = new Set(["manifest.json", ...closureFrom(manifest.main)]);

/**
 * Manifest ikonkasi. `scale: [1,2]` bo'lsa Adobe faylni `@1x`/`@2x` qo'shimchasi
 * bilan qidiradi va BAZA yo'lning o'zi diskda bo'lmasligi mumkin (bizda shunday:
 * `icons/ff23@1x.png` bor, `icons/ff23.png` yo'q). Shu sabab baza yo'l faqat
 * MAVJUD bo'lsa qo'shiladi, lekin hech qanday variant topilmasa — qattiq xato
 * (ikonkasiz panel ro'yxatda bo'sh kvadrat bo'lib chiqardi).
 */
function addIcon(ic) {
  if (!ic || !ic.path) return;
  const scales = Array.isArray(ic.scale) && ic.scale.length ? ic.scale : [1];
  let found = 0;
  if (fs.existsSync(path.join(ROOT, ic.path))) { files.add(ic.path); found++; }
  for (const s of scales) {
    const v = ic.path.replace(/\.png$/i, `@${s}x.png`);
    if (fs.existsSync(path.join(ROOT, v))) { files.add(v); found++; }
  }
  if (!found) throw new Error(`Ikonka topilmadi: ${ic.path} (scale ${scales.join(",")})`);
}
for (const ic of manifest.icons || []) addIcon(ic);
for (const ep of manifest.entrypoints || []) for (const ic of ep.icons || []) addIcon(ic);

const sorted = [...files].sort();
for (const rel of sorted) {
  const bad = NEVER.find((p) => rel.startsWith(p));
  if (bad) throw new Error(`Paketga kirmasligi kerak edi: ${rel} (${bad})`);
}

if (listOnly) {
  for (const f of sorted) console.log(f);
  console.log(`\n${sorted.length} fayl`);
  process.exit(0);
}

fs.mkdirSync(DIST, { recursive: true });
const built = [];
for (const fl of flavors(manifest)) {
  if (only && fl.key !== only) continue;
  const entries = sorted.map((rel) => {
    if (rel === "manifest.json") {
      const m = { ...manifest, id: fl.id, name: fl.name };
      return { name: rel, data: Buffer.from(`${JSON.stringify(m, null, 2)}\n`, "utf8") };
    }
    return { name: rel, data: fs.readFileSync(path.join(ROOT, rel)) };
  });
  const buf = zipBytes(entries);
  const out = path.join(DIST, `frameflow-premiere-${manifest.version}-${fl.key}.ccx`);
  fs.writeFileSync(out, buf);
  const sha = createHash("sha256").update(buf).digest("hex");
  fs.writeFileSync(`${out}.sha256`, `${sha}  ${path.basename(out)}\n`);
  built.push({ out, sha, bytes: buf.length, id: fl.id });
}

if (!built.length) {
  console.error(
    only
      ? `Flavor topilmadi: ${only}`
      : "Hech qanday flavor qurilmadi (marketplace uchun FF_PR_MARKETPLACE_ID kerak)"
  );
  process.exit(1);
}

console.log(`FrameFlow Premiere .ccx — v${manifest.version}, ${sorted.length} fayl`);
for (const b of built) {
  console.log(`  ${path.relative(ROOT, b.out)}`);
  console.log(`    id: ${b.id}  ·  ${(b.bytes / 1024).toFixed(1)} KB`);
  console.log(`    sha256: ${b.sha}`);
}
if (!process.env.FF_PR_MARKETPLACE_ID && !only) {
  console.log("  (marketplace flavor o'tkazib yuborildi — FF_PR_MARKETPLACE_ID berilmagan)");
}
