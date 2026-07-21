// INSTALLER PAYLOAD — macOS `.pkg` va Windows `.msi` quruvchilari uchun YAGONA manba.
//
// Payload HAR DOIM MIJOZ (customer) flavor'i: fayl ro'yxati `package-flavors.mjs`dan olinadi
// (nusxa ro'yxat YO'Q — drift bo'lmasin). Ichki Admin flavor'i installerga HECH QACHON
// kirmaydi — `stageCustomerPayload` boshqa flavor'ni umuman qabul qilmaydi.
//
// O'rnatish nishoni — FAQAT foydalanuvchi (per-user) CEP papkasi:
//   macOS   ~/Library/Application Support/Adobe/CEP/extensions/com.frameflow
//   Windows %APPDATA%\Adobe\CEP\extensions\com.frameflow
//
// CEP IMZO KONVERTI (ixtiyoriy, reliz uchun MAJBURIY): agar `FF_SIGNED_ZXP` berilsa —
// shu `.zxp` ichidagi `META-INF/**` + `mimetype` payload'ga qo'shiladi. AE o'rnatilgan
// papkadagi Adobe imzosini shundan tekshiradi, ya'ni mijoz mashinasida CEP PlayerDebugMode
// yoqish SHART EMAS. `.zxp`ning qolgan tarkibi flavor ro'yxatiga AYNAN mos bo'lishi shart
// (aks holda imzo boshqa fayllarni qamrab olgan bo'lardi) — mos kelmasa build to'xtaydi.
//
// CLI (bash quruvchi JSON parse qilmasin):
//   node installer-payload.mjs version
//   node installer-payload.mjs payload-files
//   node installer-payload.mjs stage <dir> [--signed-zxp=<path>]
//   node installer-payload.mjs verify <dir>
//   node installer-payload.mjs artifact <mac|win> <pkg|msi|exe> <signed|unsigned>
//   node installer-payload.mjs checksum <file>          # sidecar .sha256 yozadi, hex chiqaradi
//   node installer-payload.mjs record <platform> <ext> <file> <signed|unsigned>

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ADMIN_SURFACE,
  FORBIDDEN_CEF_FLAGS,
  PLUGIN_SRC,
  REPO_ROOT,
  flavorVersion,
  getFlavor,
  resolveFlavorFiles,
} from "./package-flavors.mjs";
import { listEntries } from "./verify-zxp-package.mjs";

/** Installer artefaktlari (git'da kuzatilmaydi — dist/ .gitignore ostida).
 *  `FF_INSTALLERS_DIR` — FAQAT chiqish papkasini ko'chiradi (test/CI izolyatsiyasi uchun);
 *  payload, tekshiruv va imzolash siyosatiga hech qanday ta'siri yo'q. */
export const INSTALLERS_DIR = process.env.FF_INSTALLERS_DIR
  ? path.resolve(process.env.FF_INSTALLERS_DIR)
  : path.join(REPO_ROOT, "dist/installers");

/** Installer FAQAT mijoz paneli uchun quriladi. */
export const INSTALLER_FLAVOR = "customer";

/** Extension papkasi nomi (ikkala platformada bir xil). */
export const INSTALL_DIR_NAME = getFlavor(INSTALLER_FLAVOR).installDirName;

/** macOS home-domain ichidagi nisbiy o'rnatish yo'li (pkgbuild --install-location). */
export const MAC_INSTALL_LOCATION = `Library/Application Support/Adobe/CEP/extensions/${INSTALL_DIR_NAME}`;

/** Platforma → ruxsat etilgan kengaytmalar (server kontrakti bilan bir xil:
 *  apps/api/src/lib/plugin-release-contract.ts INSTALLER_EXTENSIONS). */
export const INSTALLER_EXTENSIONS = { mac: ["pkg"], win: ["msi", "exe"] };

/** CEP imzo konverti — payload'da ruxsat etilgan YAGONA qo'shimcha yo'llar. */
const SIGNATURE_ENVELOPE_PREFIX = "META-INF/";
const SIGNATURE_ENVELOPE_FILE = "mimetype";
const SIGNATURE_MARKER = "META-INF/signatures.xml";

export function installerVersion() {
  return flavorVersion(INSTALLER_FLAVOR);
}

/** Artefakt nomi. Imzolangan nom AYNAN server kontraktining `installerFileName()` shakli:
 *  `frameflow-plugin-<ver>-<platform>.<ext>` — panel yuklab olgan fayl nomi bilan mos. */
export function installerArtifactName(platform, ext, { signed }) {
  const allowed = INSTALLER_EXTENSIONS[platform];
  if (!allowed) throw new Error(`Noma'lum platforma: ${platform} (mac|win)`);
  if (!allowed.includes(ext)) {
    throw new Error(`${platform} uchun kengaytma "${ext}" ruxsat etilmagan (${allowed.join("|")})`);
  }
  const v = installerVersion();
  return signed
    ? `frameflow-plugin-${v}-${platform}.${ext}`
    : `frameflow-plugin-${v}-${platform}-unsigned.${ext}`;
}

export function installerArtifactPath(platform, ext, opts) {
  return path.join(INSTALLERS_DIR, installerArtifactName(platform, ext, opts));
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

// ── Payload staging ──────────────────────────────────────────────────────────

function assertSafeRelative(rel) {
  const clean = String(rel || "");
  if (!clean || clean.startsWith("/") || clean.includes("\\") || clean.split("/").includes("..")) {
    throw new Error(`Xavfsiz bo'lmagan payload yo'li: ${rel}`);
  }
  return clean;
}

/** Papkadagi barcha fayllar (papkaga nisbatan POSIX yo'l bilan), tartiblangan. */
export function listPayloadFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      const child = path.join(abs, name);
      const childRel = rel ? `${rel}/${name}` : name;
      if (statSync(child).isDirectory()) walk(child, childRel);
      else out.push(childRel);
    }
  };
  if (existsSync(dir)) walk(dir, "");
  return out.sort();
}

/** Installer payload'iga kutilayotgan fayllar — flavor manbasidan (yagona haqiqat). */
export function expectedPayloadFiles() {
  return resolveFlavorFiles(INSTALLER_FLAVOR)
    .map((f) => assertSafeRelative(f.to))
    .sort();
}

/** `.zxp` dan FAQAT imzo konvertini (META-INF/** + mimetype) payload'ga ko'chiradi.
 *  Arxivning qolgan tarkibi flavor ro'yxatiga AYNAN mos bo'lishi SHART. */
function applySignatureEnvelope(destDir, zxpPath) {
  if (!existsSync(zxpPath)) throw new Error(`Imzolangan .zxp topilmadi: ${zxpPath}`);
  // Arxiv ro'yxatini mavjud tekshiruvchi yordamchisidan olamiz (nusxa mantiq YO'Q).
  const entries = [...listEntries(zxpPath)].filter((e) => e && !e.endsWith("/"));

  const envelope = [];
  const payload = [];
  for (const e of entries) {
    if (e.startsWith(SIGNATURE_ENVELOPE_PREFIX) || e === SIGNATURE_ENVELOPE_FILE) {
      envelope.push(assertSafeRelative(e));
    } else {
      payload.push(e);
    }
  }
  if (!envelope.includes(SIGNATURE_MARKER)) {
    throw new Error(`.zxp da ${SIGNATURE_MARKER} yo'q — bu imzolangan paket emas: ${path.basename(zxpPath)}`);
  }
  const expected = expectedPayloadFiles();
  const extra = payload.filter((e) => !expected.includes(e)).sort();
  const missing = expected.filter((e) => !payload.includes(e)).sort();
  if (extra.length || missing.length) {
    throw new Error(
      `.zxp tarkibi flavor ro'yxatiga mos emas — imzo boshqa fayllarni qamragan. ` +
        `ortiqcha=[${extra.join(", ")}] yetishmayapti=[${missing.join(", ")}]`
    );
  }
  execFileSync("unzip", ["-oq", zxpPath, ...envelope, "-d", destDir], { stdio: "pipe" });
  return envelope.sort();
}

/** MIJOZ payload'ini `destDir` ga yig'adi. Boshqa flavor QABUL QILINMAYDI. */
export function stageCustomerPayload(destDir, { signedZxp = null, flavor = INSTALLER_FLAVOR } = {}) {
  if (flavor !== INSTALLER_FLAVOR) {
    throw new Error(
      `Installer payload'i FAQAT "${INSTALLER_FLAVOR}" flavor'idan quriladi — "${flavor}" rad etildi ` +
        `(ichki Admin paneli mijoz installeriga hech qachon kirmaydi).`
    );
  }
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  for (const { from, to } of resolveFlavorFiles(INSTALLER_FLAVOR)) {
    const rel = assertSafeRelative(to);
    const src = path.join(PLUGIN_SRC, from);
    if (!existsSync(src)) throw new Error(`Manba fayl yo'q: ${from}`);
    const dst = path.join(destDir, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }
  const envelope = signedZxp ? applySignatureEnvelope(destDir, signedZxp) : [];
  return { files: listPayloadFiles(destDir), envelope };
}

// ── Payload tekshiruvi (fail-closed) ─────────────────────────────────────────

const TEXT_EXT = new Set([".html", ".js", ".jsx", ".css", ".xml", ".json", ".txt", ".md"]);

/** Payload qat'iy tekshiruvi: fayl ro'yxati AYNAN mos · Admin sirti YO'Q ·
 *  taqiqlangan CEF bayrog'i YO'Q · `.debug` yo'q. Xato = throw (build to'xtaydi). */
export function verifyPayload(destDir) {
  const actual = listPayloadFiles(destDir);
  const expected = expectedPayloadFiles();
  const envelope = actual.filter(
    (f) => f.startsWith(SIGNATURE_ENVELOPE_PREFIX) || f === SIGNATURE_ENVELOPE_FILE
  );
  const body = actual.filter((f) => !envelope.includes(f));

  const extra = body.filter((f) => !expected.includes(f));
  const missing = expected.filter((f) => !body.includes(f));
  if (extra.length || missing.length) {
    throw new Error(
      `Payload flavor ro'yxatiga mos emas — ortiqcha=[${extra.join(", ")}] yetishmayapti=[${missing.join(", ")}]`
    );
  }
  if (envelope.length && !envelope.includes(SIGNATURE_MARKER)) {
    throw new Error(`Imzo konverti to'liq emas: ${SIGNATURE_MARKER} yo'q`);
  }
  if (actual.some((f) => f === ".debug" || f.endsWith("/.debug"))) {
    throw new Error("`.debug` fayli installer payload'ida bo'lishi mumkin emas (masofaviy debug porti)");
  }

  // Admin sirti — fayl nomi
  for (const f of ADMIN_SURFACE.files) {
    if (actual.includes(f) || actual.includes(path.posix.basename(f))) {
      throw new Error(`Admin sirti payload'da: ${f}`);
    }
  }
  // Admin sirti — matn ichidagi identifikator / localStorage kaliti
  const needles = [...ADMIN_SURFACE.identifiers, ...ADMIN_SURFACE.storageKeys];
  for (const rel of actual) {
    if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) continue;
    const text = readFileSync(path.join(destDir, rel), "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) throw new Error(`Admin sirti payload'da: "${needle}" → ${rel}`);
    }
    if (rel === "CSXS/manifest.xml") {
      for (const flag of FORBIDDEN_CEF_FLAGS) {
        if (text.includes(flag)) throw new Error(`Taqiqlangan CEF bayrog'i manifestda: ${flag}`);
      }
      const listBlock = (text.match(/<ExtensionList>[\s\S]*?<\/ExtensionList>/i) || [""])[0];
      const ids = [...listBlock.matchAll(/<Extension\s+Id="([^"]+)"/gi)].map((m) => m[1]);
      const want = getFlavor(INSTALLER_FLAVOR).extensionId;
      if (ids.length !== 1 || ids[0] !== want) {
        throw new Error(`Manifest ExtensionList [${ids.join(", ")}] — kutilgan aynan [${want}]`);
      }
    }
  }
  return { files: actual, envelope, signed: envelope.includes(SIGNATURE_MARKER) };
}

// ── SHA-256 chiqishi (admin publish bayt-ba-bayt mos bo'lishi uchun) ─────────

/** `<artefakt>.sha256` yozadi (`shasum -a 256 -c` formatida) va hex qaytaradi. */
export function writeChecksumSidecar(artifactFile) {
  const hex = sha256File(artifactFile);
  const sidecar = `${artifactFile}.sha256`;
  writeAtomic(sidecar, `${hex}  ${path.basename(artifactFile)}\n`);
  return hex;
}

function writeAtomic(target, contents) {
  const tmp = `${target}.tmp.${process.pid}`;
  writeFileSync(tmp, contents);
  renameSync(tmp, target);
}

/** Versiya bo'yicha reliz manifesti — admin Releases formasiga tayyor qiymatlar. */
export function recordArtifact(platform, ext, artifactFile, { signed }) {
  const version = installerVersion();
  const manifestPath = path.join(INSTALLERS_DIR, `frameflow-plugin-v${version}-installers.json`);
  let manifest = { version, artifacts: {} };
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (parsed && parsed.version === version && parsed.artifacts) manifest = parsed;
    } catch {
      /* buzilgan manifest — qaytadan yoziladi */
    }
  }
  const hex = sha256File(artifactFile);
  manifest.artifacts[platform] = {
    platform,
    ext,
    fileName: path.basename(artifactFile),
    sizeBytes: statSync(artifactFile).size,
    sha256: hex,
    signed: !!signed,
    builtAt: new Date().toISOString(),
  };
  writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, sha256: hex };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const [cmd, a, b, c, d] = argv;
  const flagValue = (name) => {
    const hit = argv.find((x) => x.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  try {
    if (cmd === "version") {
      console.log(installerVersion());
    } else if (cmd === "payload-files") {
      console.log(expectedPayloadFiles().join("\n"));
    } else if (cmd === "stage") {
      if (!a) throw new Error("stage <dir> talab qilinadi");
      const zxp = flagValue("signed-zxp");
      const res = stageCustomerPayload(path.resolve(a), { signedZxp: zxp || null });
      console.log(String(res.files.length));
    } else if (cmd === "verify") {
      if (!a) throw new Error("verify <dir> talab qilinadi");
      const res = verifyPayload(path.resolve(a));
      console.log(res.signed ? "signed-envelope" : "plain");
    } else if (cmd === "artifact") {
      console.log(installerArtifactPath(a, b, { signed: c === "signed" }));
    } else if (cmd === "checksum") {
      if (!a) throw new Error("checksum <file> talab qilinadi");
      console.log(writeChecksumSidecar(path.resolve(a)));
    } else if (cmd === "record") {
      if (!c) throw new Error("record <platform> <ext> <file> <signed|unsigned> talab qilinadi");
      const res = recordArtifact(a, b, path.resolve(c), { signed: d === "signed" });
      console.log(res.sha256);
    } else {
      console.error(
        "Foydalanish: installer-payload.mjs version|payload-files|stage|verify|artifact|checksum|record"
      );
      process.exit(2);
    }
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}
