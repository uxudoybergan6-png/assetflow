// Task A — paket tarkib tekshiruvchisi. Avvalgi "arxiv tasdiq" faqat qo'lda fayl sonini
// sanash edi (haqiqiy referens tekshiruvi yo'q). Bu skript unsigned arxivni RUNTIME
// referenslariga qarshi tekshiradi: manifest MainPath/ScriptPath, HTML <link>/<script>
// (lokal), CSS url() shrift assetlari. Yetishmagan fayl = FAIL. data:/http(s):/runtime
// generatsiya qilingan URL'lar e'tiborga olinmaydi.
// Yangi dependency yo'q — faqat Node builtin + tizim `unzip` (build-zxp.sh allaqachon
// `zip`ga tayanadi).
// Ishga tushirish: node plugins/after-effects-cep/scripts/verify-zxp-package.mjs [archive.zip]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPTS_DIR, "../../..");

const archive = process.argv[2] || defaultArchivePath();

function defaultArchivePath() {
  const manifest = readFileSync(
    path.join(ROOT, "plugins/after-effects-cep/CSXS/manifest.xml"),
    "utf8"
  );
  const m = manifest.match(/ExtensionBundleVersion="([^"]+)"/);
  const version = m ? m[1] : "0.0.0";
  return path.join(ROOT, "dist/zxp", `assetflow-v${version}-unsigned.zip`);
}

let fail = 0;
const evidence = [];

function ok(label) {
  evidence.push(`✓  ${label}`);
}
function bad(label) {
  fail++;
  evidence.push(`✗ FAIL  ${label}`);
}

function listEntries(archivePath) {
  const out = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" });
  return new Set(out.split("\n").map((l) => l.trim()).filter(Boolean));
}

function readEntry(archivePath, entry) {
  return execFileSync("unzip", ["-p", archivePath, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function isIgnorableUrl(u) {
  const v = u.trim();
  if (!v) return true;
  if (/^(data|https?|javascript):/i.test(v)) return true; // xorijiy/inline — arxiv tarkibiga aloqasi yo'q
  if (v.startsWith("#")) return true; // in-page anchor
  if (/[{}$]/.test(v)) return true; // runtime-generatsiya (template literal/placeholder)
  return false;
}

function normalizeRef(baseDir, ref) {
  const clean = ref.split("?")[0].split("#")[0];
  const joined = path.posix.normalize(path.posix.join(baseDir, clean));
  return joined.replace(/^\.\//, "").replace(/^\//, "");
}

function extractAttr(html, tagRegex) {
  const found = [];
  let m;
  while ((m = tagRegex.exec(html))) found.push(m[1]);
  return found;
}

function verifyHtmlRefs(archivePath, entries, htmlEntry) {
  const html = readEntry(archivePath, htmlEntry);
  const baseDir = path.posix.dirname(htmlEntry);
  const hrefs = extractAttr(html, /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
  const srcs = extractAttr(html, /<script[^>]+src=["']([^"']+)["']/gi);
  const cssRefs = [];
  for (const raw of [...hrefs, ...srcs]) {
    if (isIgnorableUrl(raw)) continue;
    const resolved = normalizeRef(baseDir, raw);
    if (entries.has(resolved)) {
      ok(`${htmlEntry} → ${raw} (${resolved})`);
      if (resolved.endsWith(".css")) cssRefs.push(resolved);
    } else {
      bad(`${htmlEntry} → ${raw} (${resolved}) MISSING from archive`);
    }
  }
  return cssRefs;
}

function verifyCssRefs(archivePath, entries, cssEntry) {
  const css = readEntry(archivePath, cssEntry);
  const baseDir = path.posix.dirname(cssEntry);
  const urls = extractAttr(css, /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
  for (const raw of urls) {
    if (isIgnorableUrl(raw)) continue;
    const resolved = normalizeRef(baseDir, raw);
    if (entries.has(resolved)) {
      ok(`${cssEntry} → ${raw} (${resolved})`);
    } else {
      bad(`${cssEntry} → ${raw} (${resolved}) MISSING from archive`);
    }
  }
}

function verifyManifestPaths(archivePath, entries) {
  const manifestEntry = "CSXS/manifest.xml";
  if (!entries.has(manifestEntry)) {
    bad(`${manifestEntry} MISSING from archive`);
    return { htmlEntries: [] };
  }
  const xml = readEntry(archivePath, manifestEntry);
  const mainPaths = extractAttr(xml, /<MainPath>([^<]+)<\/MainPath>/gi);
  const scriptPaths = extractAttr(xml, /<ScriptPath>([^<]+)<\/ScriptPath>/gi);
  const htmlEntries = [];
  for (const raw of [...mainPaths, ...scriptPaths]) {
    const resolved = normalizeRef(".", raw);
    if (entries.has(resolved)) {
      ok(`manifest → ${raw} (${resolved})`);
      if (resolved.endsWith(".html")) htmlEntries.push(resolved);
    } else {
      bad(`manifest → ${raw} (${resolved}) MISSING from archive`);
    }
  }
  return { htmlEntries };
}

function main() {
  console.log(`→ Arxiv tekshirilmoqda: ${archive}`);
  let entries;
  try {
    entries = listEntries(archive);
  } catch (e) {
    console.error(`✗ Arxivni o'qib bo'lmadi: ${e.message}`);
    process.exit(1);
  }
  const { htmlEntries } = verifyManifestPaths(archive, entries);
  const seenCss = new Set();
  for (const htmlEntry of htmlEntries) {
    const cssRefs = verifyHtmlRefs(archive, entries, htmlEntry);
    for (const cssEntry of cssRefs) {
      if (seenCss.has(cssEntry)) continue;
      seenCss.add(cssEntry);
      verifyCssRefs(archive, entries, cssEntry);
    }
  }

  console.log(evidence.join("\n"));
  if (fail) {
    console.error(`\n${fail} referens(lar) topilmadi — paket to'liq emas.`);
    process.exit(1);
  }
  console.log(`\nHammasi tasdiqlandi (${evidence.length} referens) — paket tarkibi runtime referenslariga mos.`);
}

main();
