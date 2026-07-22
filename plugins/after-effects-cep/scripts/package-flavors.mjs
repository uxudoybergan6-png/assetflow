// PAKET FLAVOR'LARI — YAGONA HAQIQAT MANBAI (build + install + testlar shundan o'qiydi).
//
//   customer → ommaviy (default). FAQAT com.frameflow.panel. Mijozga shu ketadi.
//   admin    → ICHKI. FAQAT com.frameflow.admin. Hech qachon mijoz artefaktiga qo'shilmaydi.
//
// Ikkala extension ID bitta artefaktda BO'LMASLIGI shart — shuning uchun manifest ham,
// fayl ro'yxati ham, chiqish nomi ham flavor'ga bog'langan. Batafsil: docs/RELEASE-ARCHITECTURE.md
//
// CLI (bash build-zxp.sh / install-cep.sh shu orqali o'qiydi — JSON parse qilish shart emas):
//   node package-flavors.mjs list
//   node package-flavors.mjs field <flavor> <key>
//   node package-flavors.mjs files <flavor>        # "<src>\t<dest>" qatorlari (glob ochilgan)
//   node package-flavors.mjs version

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_SRC = path.resolve(SCRIPTS_DIR, "..");
export const REPO_ROOT = path.resolve(PLUGIN_SRC, "../..");
export const DIST_DIR = path.join(REPO_ROOT, "dist/zxp");

/** Mijoz panelining RUNTIME'da o'qiydigan fayllari (AssetFlow_Plugin.html <script>/<link>
 *  + css/tokens.css url() shriftlari). Glob YO'Q — nima ketayotgani ko'rinib tursin. */
const CUSTOMER_FILES = [
  "AssetFlow_Plugin.html",
  "assetflow-account.js",
  "assetflow-catalog.js",
  "assetflow-client.js",
  "assetflow-env.js",
  "assetflow-init.js",
  "assetflow-local-store.js",
  "assetflow-log.js",
  "js/CSInterface.js",
  "jsx/host.jsx",
  "css/tokens.css",
  "css/styles.css",
  "css/ff-components.css",
  "css/fonts/*.woff2",
];

/** Ichki Admin paneli MINIMAL: HTML + env + CSInterface + host.jsx + tokens.css (+shriftlar). */
const ADMIN_FILES = [
  "AssetFlow_Admin.html",
  "assetflow-env.js",
  "js/CSInterface.js",
  "jsx/host.jsx",
  "css/tokens.css",
  "css/fonts/*.woff2",
];

/** Ikkala manifest e'lon qiladigan CEF bayroqlari — YOPIQ ro'yxat.
 *  Yangi bayroq ONGLI ravishda shu yerga qo'shilishi kerak (marketplace-preflight
 *  manifest bilan AYNAN tenglikni talab qiladi) — jimgina imkoniyat kengaymasin. */
const CEF_PARAMS = [
  "--allow-file-access-from-files",
  "--allow-file-access",
  "--persist-session-cookies",
  "--mixed-context",
  "--enable-nodejs",
];

/** Qo'llab-quvvatlanadigan host — manifest AYNAN shuni e'lon qiladi. Marketing/listing
 *  matni bundan TASHQARI hech qanday ilovani va'da qila olmaydi. */
const HOSTS = [{ name: "AEFT", version: "[22.0,99.9]" }];
const REQUIRED_RUNTIME = { name: "CSXS", version: "11.0" };

export const FLAVORS = {
  customer: {
    key: "customer",
    label: "FrameFlow customer plugin (public)",
    internal: false,
    manifestSource: "CSXS/manifest.xml",
    debugSource: ".debug",
    bundleId: "com.frameflow",
    bundleName: "FrameFlow",
    extensionId: "com.frameflow.panel",
    mainPath: "./AssetFlow_Plugin.html",
    mainHtml: "AssetFlow_Plugin.html",
    scriptPath: "./jsx/host.jsx",
    menuLabel: "FrameFlow",
    hosts: HOSTS,
    requiredRuntime: REQUIRED_RUNTIME,
    cefParams: CEF_PARAMS,
    installDirName: "com.frameflow",
    artifactBase: "frameflow-plugin",
    files: CUSTOMER_FILES,
  },
  admin: {
    key: "admin",
    label: "FrameFlow INTERNAL admin panel (never ship to customers)",
    internal: true,
    manifestSource: "CSXS/manifest.admin.xml",
    debugSource: ".debug.admin",
    bundleId: "com.frameflow.internal.admin",
    bundleName: "FrameFlow Admin (Internal)",
    extensionId: "com.frameflow.admin",
    mainPath: "./AssetFlow_Admin.html",
    mainHtml: "AssetFlow_Admin.html",
    scriptPath: "./jsx/host.jsx",
    menuLabel: "FrameFlow Admin",
    hosts: HOSTS,
    requiredRuntime: REQUIRED_RUNTIME,
    cefParams: CEF_PARAMS,
    installDirName: "com.frameflow.internal.admin",
    artifactBase: "frameflow-internal-admin",
    files: ADMIN_FILES,
  },
};

export const DEFAULT_FLAVOR = "customer";

/** Mijoz arxividа BO'LMASLIGI shart bo'lgan Admin sirt belgilari. */
export const ADMIN_SURFACE = {
  files: ["AssetFlow_Admin.html", "CSXS/manifest.admin.xml"],
  identifiers: ["com.frameflow.admin", "AssetFlow_Admin.html", "FrameFlow Admin"],
  // Admin panelining o'z localStorage kalitlari (AssetFlow_Admin.html:641-643, 2739)
  storageKeys: ["af_admin_api", "af_admin_token", "af_admin_user", "af_admin_downloaded"],
};

/** HECH BIR manifest (mijoz ham, ichki ham) ishlatmasligi shart bo'lgan CEF bayroqlari. */
export const FORBIDDEN_CEF_FLAGS = ["--disable-web-security"];

/** Tarqatiladigan paketda HECH QACHON bo'lmasligi shart bo'lgan DEBUG sirti.
 *  `files` — masofaviy debug portini ochadigan CEP profil fayllari (`.debug*`).
 *  `markers` — paketlangan matnda uchramasligi kerak bo'lgan debug/xavfsizlik-pasaytiruvchi
 *  satrlar: Adobe dasturchi rejimi kaliti va uni yoquvchi CSXS sozlama domeni. */
export const DEBUG_SURFACE = {
  files: [FLAVORS.customer.debugSource, FLAVORS.admin.debugSource],
  markers: ["PlayerDebugMode", "com.adobe.CSXS.", ...FORBIDDEN_CEF_FLAGS],
};

/** Maxfiy ma'lumot naqshlari — paketlangan matn fayllarida skanerlanadi.
 *  MUHIM: mos kelgan QIYMAT hech qachon chop etilmaydi, faqat fayl nomi + naqsh nomi.
 *  Paket xavfsizlik testi ham, marketplace preflight ham AYNAN shu ro'yxatdan o'qiydi. */
export const SECRET_PATTERNS = [
  { name: "private key block", re: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/ },
  { name: "certificate block", re: /-----BEGIN CERTIFICATE-----/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "OpenAI-style secret key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Stripe live key", re: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{12,}\b/ },
  { name: "JWT literal", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    // Generik "kalit = qiymat". Qiymat kamida 16 belgi VA raqam saqlashi shart — aks holda
    // bu shunchaki identifikator/localStorage kalit nomi (masalan API_KEY = 'af_admin_api'),
    // sir emas. Yolg'on ijobiy natija tekshiruvni foydasiz qilib qo'yadi.
    name: "hardcoded credential assignment",
    re: /\b(?:password|passwd|client_secret|secret[_-]?key|api[_-]?key|private[_-]?key|cert[_-]?pass)["']?\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
    accept: (value) => /\d/.test(value),
  },
];

/** Bitta naqsh matnda uchraydimi. `accept` bo'lsa — mos kelgan QIYMAT ham shartni
 *  qanoatlantirishi kerak. Qiymat qaytarilmaydi (chop etilib ketmasin). */
export function matchesSecretPattern(body, p) {
  if (!p.accept) return p.re.test(body);
  const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
  let m;
  while ((m = re.exec(body))) if (p.accept(m[1])) return true;
  return false;
}

export function getFlavor(name) {
  const f = FLAVORS[name];
  if (!f) {
    throw new Error(
      `Noma'lum flavor: "${name}". Mavjud: ${Object.keys(FLAVORS).join(", ")}`
    );
  }
  return f;
}

/** Versiya — flavor manifestidan (ExtensionBundleVersion). Drift testda ushlanadi. */
export function flavorVersion(name) {
  const f = getFlavor(name);
  const xml = readFileSync(path.join(PLUGIN_SRC, f.manifestSource), "utf8");
  const m = xml.match(/ExtensionBundleVersion="([^"]+)"/);
  if (!m) throw new Error(`${f.manifestSource}: ExtensionBundleVersion topilmadi`);
  return m[1];
}

/** window.AF_PLUGIN_VERSION — mijoz HTML'idagi kontrakt qiymati. */
export function declaredPluginVersion() {
  const html = readFileSync(path.join(PLUGIN_SRC, "AssetFlow_Plugin.html"), "utf8");
  const m = html.match(/window\.AF_PLUGIN_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

/** files[] ni {from, to} juftliklariga ochadi. `from` — PLUGIN_SRC'ga nisbatan,
 *  `to` — arxiv/o'rnatma ichidagi yo'l. Manifest DOIM CSXS/manifest.xml bo'lib tushadi. */
export function resolveFlavorFiles(name) {
  const f = getFlavor(name);
  const out = [{ from: f.manifestSource, to: "CSXS/manifest.xml" }];
  for (const pattern of f.files) {
    if (!pattern.includes("*")) {
      out.push({ from: pattern, to: pattern });
      continue;
    }
    const dir = path.posix.dirname(pattern);
    const suffix = path.posix.basename(pattern).replace("*", "");
    const abs = path.join(PLUGIN_SRC, dir);
    if (!existsSync(abs)) throw new Error(`Glob papkasi yo'q: ${dir}`);
    const matched = readdirSync(abs)
      .filter((n) => n.endsWith(suffix))
      .sort();
    if (!matched.length) throw new Error(`Glob hech narsa topmadi: ${pattern}`);
    for (const n of matched) out.push({ from: `${dir}/${n}`, to: `${dir}/${n}` });
  }
  return out;
}

export function artifactName(name, { signed }) {
  const f = getFlavor(name);
  const v = flavorVersion(name);
  return signed
    ? `${f.artifactBase}-v${v}.zxp`
    : `${f.artifactBase}-v${v}-unsigned.zip`;
}

export function artifactPath(name, opts) {
  return path.join(DIST_DIR, artifactName(name, opts));
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (cmd === "list") {
      console.log(Object.keys(FLAVORS).join("\n"));
    } else if (cmd === "version") {
      console.log(flavorVersion(a || DEFAULT_FLAVOR));
    } else if (cmd === "field") {
      const f = getFlavor(a);
      if (!(b in f)) throw new Error(`Noma'lum maydon: ${b}`);
      console.log(String(f[b]));
    } else if (cmd === "files") {
      for (const { from, to } of resolveFlavorFiles(a)) console.log(`${from}\t${to}`);
    } else if (cmd === "artifact") {
      console.log(artifactPath(a, { signed: b === "signed" }));
    } else {
      console.error("Foydalanish: package-flavors.mjs list|version|field|files|artifact");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
