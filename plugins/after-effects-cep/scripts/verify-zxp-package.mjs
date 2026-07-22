// Paket tarkib tekshiruvchisi — arxivni RUNTIME referenslariga qarshi tekshiradi:
// manifest MainPath/ScriptPath, HTML <link>/<script> (lokal), CSS url() shrift assetlari.
// Yetishmagan fayl = FAIL. data:/http(s):/runtime generatsiya qilingan URL'lar e'tiborga olinmaydi.
//
// Bu modul HAM CLI, HAM kutubxona: xavfsizlik testi (test-package-security.mjs) shu yerdagi
// referens mantiqidan foydalanadi (nusxa ko'chirilmaydi).
// Yangi dependency yo'q — faqat Node builtin + tizim `unzip`.
//
// Ishga tushirish:
//   node plugins/after-effects-cep/scripts/verify-zxp-package.mjs [archive.zip]
//   (argumentsiz → default MIJOZ flavor arxivi)

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { artifactPath, DEFAULT_FLAVOR } from "./package-flavors.mjs";

export function listEntries(archivePath) {
  const out = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" });
  return new Set(out.split("\n").map((l) => l.trim()).filter(Boolean));
}

export function readEntry(archivePath, entry) {
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

export function extractAll(text, regex) {
  const found = [];
  let m;
  while ((m = regex.exec(text))) found.push(m[1]);
  return found;
}

/** Arxivning barcha runtime referenslarini tekshiradi.
 *  `resolved` — HAQIQATAN referens qilingan arxiv yo'llari (marketplace preflight undan
 *  "paketda bor, lekin hech qayerdan chaqirilmaydi" fayllarni aniqlaydi).
 *  @returns {{ checks: {ok:boolean,label:string}[], failed:number, htmlEntries:string[],
 *              resolved:Set<string> }} */
export function verifyArchiveReferences(archivePath) {
  const checks = [];
  const ok = (label) => checks.push({ ok: true, label });
  const bad = (label) => checks.push({ ok: false, label });

  const entries = listEntries(archivePath);
  const htmlEntries = [];
  const resolvedRefs = new Set();

  // 1) manifest MainPath/ScriptPath
  const manifestEntry = "CSXS/manifest.xml";
  if (!entries.has(manifestEntry)) {
    bad(`${manifestEntry} MISSING from archive`);
    return { checks, failed: 1, htmlEntries, resolved: resolvedRefs };
  }
  const xml = readEntry(archivePath, manifestEntry);
  const paths = [
    ...extractAll(xml, /<MainPath>([^<]+)<\/MainPath>/gi),
    ...extractAll(xml, /<ScriptPath>([^<]+)<\/ScriptPath>/gi),
  ];
  for (const raw of paths) {
    const resolved = normalizeRef(".", raw);
    if (entries.has(resolved)) {
      ok(`manifest → ${raw} (${resolved})`);
      resolvedRefs.add(resolved);
      if (resolved.endsWith(".html")) htmlEntries.push(resolved);
    } else {
      bad(`manifest → ${raw} (${resolved}) MISSING from archive`);
    }
  }

  // 2) HTML <link rel=stylesheet> / <script src> → 3) CSS url()
  const seenCss = new Set();
  for (const htmlEntry of htmlEntries) {
    const html = readEntry(archivePath, htmlEntry);
    const baseDir = path.posix.dirname(htmlEntry);
    const refs = [
      ...extractAll(html, /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi),
      ...extractAll(html, /<script[^>]+src=["']([^"']+)["']/gi),
    ];
    for (const raw of refs) {
      if (isIgnorableUrl(raw)) continue;
      const resolved = normalizeRef(baseDir, raw);
      if (!entries.has(resolved)) {
        bad(`${htmlEntry} → ${raw} (${resolved}) MISSING from archive`);
        continue;
      }
      ok(`${htmlEntry} → ${raw} (${resolved})`);
      resolvedRefs.add(resolved);
      if (!resolved.endsWith(".css") || seenCss.has(resolved)) continue;
      seenCss.add(resolved);
      const css = readEntry(archivePath, resolved);
      const cssDir = path.posix.dirname(resolved);
      for (const url of extractAll(css, /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
        if (isIgnorableUrl(url)) continue;
        const target = normalizeRef(cssDir, url);
        if (entries.has(target)) {
          ok(`${resolved} → ${url} (${target})`);
          resolvedRefs.add(target);
        } else bad(`${resolved} → ${url} (${target}) MISSING from archive`);
      }
    }
  }

  return { checks, failed: checks.filter((c) => !c.ok).length, htmlEntries, resolved: resolvedRefs };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archive = process.argv[2] || artifactPath(DEFAULT_FLAVOR, { signed: false });
  console.log(`→ Arxiv tekshirilmoqda: ${archive}`);
  let result;
  try {
    result = verifyArchiveReferences(archive);
  } catch (e) {
    console.error(`✗ Arxivni o'qib bo'lmadi: ${e.message}`);
    process.exit(1);
  }
  console.log(result.checks.map((c) => (c.ok ? `✓  ${c.label}` : `✗ FAIL  ${c.label}`)).join("\n"));
  if (result.failed) {
    console.error(`\n${result.failed} referens(lar) topilmadi — paket to'liq emas.`);
    process.exit(1);
  }
  console.log(
    `\nHammasi tasdiqlandi (${result.checks.length} referens) — paket tarkibi runtime referenslariga mos.`
  );
}
