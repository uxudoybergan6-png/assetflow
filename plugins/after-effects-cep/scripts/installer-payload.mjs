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
// shu `.zxp` ichidagi imzo konverti (`META-INF/signatures.xml` + `mimetype`) payload'ga
// qo'shiladi; AE o'rnatilgan papkadagi Adobe imzosini shundan tekshiradi. Konvert QABUL
// QILINISHIDAN OLDIN `.zxp` ichidagi qolgan HAR BIR fayl allaqachon yig'ilgan lokal mijoz
// payload'i bilan BAYT-BA-BAYT (SHA-256) bir xil bo'lishi shart — aks holda imzo boshqa
// baytlarni qamragan bo'lardi va build to'xtaydi. Installer Adobe'ning hech qanday debug
// sozlamasini (CSXS bayroqlari) O'ZGARTIRMAYDI — na imzolangan, na imzosiz yo'lda.
//
// ARXIV O'QISH: tashqi `unzip -d` bilan ishonchsiz daraxt YOYILMAYDI. ZIP markaziy katalogi
// shu yerda o'qiladi (tartiblangan XOM ro'yxat), har yozuv tekshiriladi (takror nom, `..`,
// absolyut/buzuq yo'l, symlink/qurilma, shifrlash, noma'lum siqish) va FAQAT tasdiqlangan
// oddiy fayllar xom baytdan yoziladi.
//
// CLI (bash quruvchi JSON parse qilmasin):
//   node installer-payload.mjs version
//   node installer-payload.mjs payload-files
//   node installer-payload.mjs stage <dir> [--signed-zxp=<path>]
//   node installer-payload.mjs verify <dir>
//   node installer-payload.mjs artifact <mac|win> <pkg|msi|exe> <signed|unsigned>
//   node installer-payload.mjs checksum <file>          # sidecar .sha256 yozadi, hex chiqaradi
//   node installer-payload.mjs record <platform> <ext> <file> <signed|unsigned>
//   node installer-payload.mjs postinstall-script       # macOS pkg postinstall (generatsiya)
//   node installer-payload.mjs stale-files              # eski o'rnatmadan olib tashlanadigan fayllar

import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { crc32, inflateRawSync } from "node:zlib";
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

/** CEP imzo konverti — payload'da ruxsat etilgan YAGONA qo'shimcha yo'llar.
 *  Ro'yxat ATAYLAB yopiq: `META-INF/` ostidagi boshqa har qanday yo'l (yoki yangi konvert
 *  fayli) rad etiladi va bu yerga ONGLI ravishda qo'shilishi kerak. */
const SIGNATURE_ENVELOPE_PREFIX = "META-INF/";
const SIGNATURE_ENVELOPE_FILE = "mimetype";
const SIGNATURE_MARKER = "META-INF/signatures.xml";
export const SIGNATURE_ENVELOPE_ALLOWED = Object.freeze([SIGNATURE_ENVELOPE_FILE, SIGNATURE_MARKER]);

const isEnvelopePath = (name) => name === SIGNATURE_ENVELOPE_FILE || name.startsWith(SIGNATURE_ENVELOPE_PREFIX);

/** MSI — OLE2 (compound file) sarlavhasi. Ixtiyoriy baytlar `.msi` DEB QABUL QILINMAYDI. */
export const MSI_OLE_HEADER = Object.freeze([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Eng kichik mazmunli MSI — OLE sektor tuzilmasi shundan kichik bo'lolmaydi. */
export const MSI_MIN_BYTES = 4096;

/** `.zxp` uchun chegaralar (zip-bomb / xotira himoyasi). */
const ZXP_MAX_BYTES = 256 * 1024 * 1024;
const ZIP_MAX_ENTRIES = 4096;
const ZIP_MAX_ENTRY_BYTES = 64 * 1024 * 1024;

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

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** MSI artefakti HAQIQATAN OLE2 compound fayli ekanini tasdiqlaydi (nom/hajm yetarli emas —
 *  ixtiyoriy bo'sh bo'lmagan baytlar `.msi` deb qabul QILINMAYDI). Xato = throw. */
export function assertMsiArtifact(file, { stage = "build" } = {}) {
  if (!existsSync(file)) throw new Error(`MSI yo'q (${stage}): ${file}`);
  const st = statSync(file);
  if (!st.isFile()) throw new Error(`MSI oddiy fayl emas (${stage}): ${file}`);
  if (st.size < MSI_MIN_BYTES) {
    throw new Error(`MSI juda kichik (${stage}): ${st.size} bayt < ${MSI_MIN_BYTES}`);
  }
  const head = Buffer.alloc(MSI_OLE_HEADER.length);
  const fd = openSync(file, "r");
  try {
    readSync(fd, head, 0, head.length, 0);
  } finally {
    closeSync(fd);
  }
  if (!head.equals(Buffer.from(MSI_OLE_HEADER))) {
    throw new Error(
      `MSI OLE compound sarlavhasi noto'g'ri (${stage}): ${head.toString("hex")} ` +
        `≠ ${Buffer.from(MSI_OLE_HEADER).toString("hex")}`
    );
  }
  return { sizeBytes: st.size };
}

// ── Payload staging ──────────────────────────────────────────────────────────

/** Nisbiy yo'l tekshiruvi (payload VA arxiv yozuvlari uchun bir xil qoida).
 *  `allowDirSuffix` — arxivdagi papka yozuvi (`css/`) uchun oxirgi `/` ga ruxsat beradi. */
function assertSafeRelative(rel, { allowDirSuffix = false, what = "payload" } = {}) {
  const clean = String(rel == null ? "" : rel);
  const bad = (why) => {
    throw new Error(`Xavfsiz bo'lmagan ${what} yo'li (${why}): ${JSON.stringify(clean)}`);
  };
  if (!clean) bad("bo'sh");
  if (clean.length > 255) bad("juda uzun");
  // Faqat bosiladigan ASCII: NUL/boshqaruv belgilari va aldamchi Unicode nomlarni rad etamiz.
  if (!/^[\x20-\x7e]+$/.test(clean)) bad("ASCII bo'lmagan yoki boshqaruv belgisi");
  if (clean.startsWith("/")) bad("absolyut");
  if (/^[A-Za-z]:/.test(clean)) bad("disk harfi");
  if (clean.includes("\\")) bad("teskari slash");
  const segs = clean.split("/");
  const last = segs.length - 1;
  for (let i = 0; i <= last; i++) {
    const s = segs[i];
    if (s === "." || s === "..") bad("traversal");
    if (s === "") {
      if (!(allowDirSuffix && i === last && last > 0)) bad("bo'sh segment");
    }
  }
  return clean;
}

/** `destDir` ichidan chiqmaydigan absolyut yo'l (symlink/traversal qorovuli). */
function safeJoin(destDir, rel) {
  const base = path.resolve(destDir);
  const abs = path.resolve(base, rel);
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(`Yo'l payload papkasidan chiqib ketdi: ${rel}`);
  }
  return abs;
}

// ── ZIP o'quvchisi (tashqi `unzip` YO'Q — xom baytlar, qat'iy tekshiruv) ─────

const u16 = (buf, off) => buf.readUInt16LE(off);
const u32 = (buf, off) => buf.readUInt32LE(off);

/** ZIP markaziy katalogini XOM va TARTIBLANGAN ro'yxat sifatida o'qiydi (Set YO'Q —
 *  takrorlangan nomlar xavfsizlik qarori uchun ko'rinib turishi SHART). */
function readCentralDirectory(buf, label) {
  const bad = (why) => {
    throw new Error(`${label}: ZIP tuzilmasi buzuq — ${why}`);
  };
  if (buf.length < 22) bad("juda kichik");
  let eocd = -1;
  const floor = Math.max(0, buf.length - (22 + 0xffff));
  for (let i = buf.length - 22; i >= floor; i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) bad("EOCD yozuvi topilmadi");
  const total = u16(buf, eocd + 10);
  const cdSize = u32(buf, eocd + 12);
  const cdOffset = u32(buf, eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    bad("ZIP64 qo'llab-quvvatlanmaydi");
  }
  if (total > ZIP_MAX_ENTRIES) bad(`juda ko'p yozuv (${total} > ${ZIP_MAX_ENTRIES})`);
  if (cdOffset + cdSize > buf.length) bad("markaziy katalog chegaradan tashqarida");

  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > cdOffset + cdSize) bad("markaziy katalog yozuvi kesilgan");
    if (u32(buf, p) !== 0x02014b50) bad(`markaziy katalog imzosi noto'g'ri (#${i})`);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const nameBytes = buf.subarray(p + 46, p + 46 + nameLen);
    if (nameBytes.length !== nameLen) bad("yozuv nomi kesilgan");
    entries.push({
      index: i,
      name: nameBytes.toString("latin1"),
      versionMadeBy: u16(buf, p + 4),
      flags: u16(buf, p + 8),
      method: u16(buf, p + 10),
      crc: u32(buf, p + 16),
      compressedSize: u32(buf, p + 20),
      uncompressedSize: u32(buf, p + 24),
      externalAttrs: u32(buf, p + 38),
      localOffset: u32(buf, p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Har yozuvni ALOHIDA tekshiradi + XOM ro'yxat bo'yicha takror nomlarni ushlaydi.
 *  Set'ga yig'ib "noyob" deb hisoblash TAQIQLANADI — takror nom o'zi buzg'unchi belgi. */
function assertArchiveEntries(entries, label) {
  const bad = (why) => {
    throw new Error(`${label}: ${why}`);
  };
  if (!entries.length) bad("arxiv bo'sh");
  const counts = new Map();
  for (const e of entries) {
    const isDirEntry = e.name.endsWith("/");
    assertSafeRelative(e.name, { allowDirSuffix: true, what: "arxiv" });
    counts.set(e.name, (counts.get(e.name) || 0) + 1);
    if (counts.get(e.name) > 1) bad(`takrorlangan arxiv yozuvi: ${e.name}`);
    if (e.flags & 0x1) bad(`shifrlangan yozuv: ${e.name}`);
    if (e.method !== 0 && e.method !== 8) bad(`qo'llab-quvvatlanmaydigan siqish (${e.method}): ${e.name}`);
    // Unix rejimi (host=3) — FAQAT oddiy fayl yoki papka. Symlink/FIFO/qurilma = rad.
    const hostSystem = e.versionMadeBy >>> 8;
    const unixMode = hostSystem === 3 ? (e.externalAttrs >>> 16) & 0xffff : 0;
    const fmt = unixMode & 0xf000;
    if (unixMode && fmt !== 0x8000 && fmt !== 0x4000) {
      bad(`qo'llab-quvvatlanmaydigan yozuv turi (symlink/qurilma, mode 0${unixMode.toString(8)}): ${e.name}`);
    }
    if (isDirEntry) {
      if (unixMode && fmt !== 0x4000) bad(`papka yozuvi fayl rejimi bilan: ${e.name}`);
      if (e.uncompressedSize !== 0) bad(`papka yozuvida ma'lumot bor: ${e.name}`);
    } else {
      if (unixMode && fmt !== 0x8000) bad(`fayl yozuvi oddiy fayl emas: ${e.name}`);
      if (e.externalAttrs & 0x10) bad(`fayl yozuvi papka atributi bilan: ${e.name}`);
      if (e.uncompressedSize > ZIP_MAX_ENTRY_BYTES) bad(`yozuv juda katta: ${e.name}`);
    }
  }
  return entries;
}

/** Bitta yozuvning XOM baytlari (CRC-32 va o'lcham bilan tasdiqlangan). */
function readEntryBytes(buf, e, label) {
  const bad = (why) => {
    throw new Error(`${label}: ${e.name} — ${why}`);
  };
  const lo = e.localOffset;
  if (lo + 30 > buf.length) bad("lokal sarlavha chegaradan tashqarida");
  if (u32(buf, lo) !== 0x04034b50) bad("lokal sarlavha imzosi noto'g'ri");
  const nameLen = u16(buf, lo + 26);
  const extraLen = u16(buf, lo + 28);
  const localName = buf.subarray(lo + 30, lo + 30 + nameLen).toString("latin1");
  if (localName !== e.name) bad(`lokal nom markaziy katalogga mos emas (${JSON.stringify(localName)})`);
  const start = lo + 30 + nameLen + extraLen;
  const end = start + e.compressedSize;
  if (end > buf.length) bad("ma'lumot bloki chegaradan tashqarida");
  const raw = buf.subarray(start, end);
  let data;
  if (e.method === 0) {
    data = Buffer.from(raw);
  } else {
    try {
      data = inflateRawSync(raw, { maxOutputLength: ZIP_MAX_ENTRY_BYTES });
    } catch (err) {
      bad(`ochib bo'lmadi (${(err && err.message) || err})`);
    }
  }
  if (data.length !== e.uncompressedSize) bad("ochilgan o'lcham markaziy katalogga mos emas");
  if ((crc32(data) >>> 0) !== (e.crc >>> 0)) bad("CRC-32 mos emas");
  return data;
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

/** `.zxp` dan FAQAT imzo konvertini payload'ga ko'chiradi — LEKIN oldin imzo AYNAN shu
 *  lokal payload baytlarini qamraganini isbotlaydi:
 *    1) arxiv yozuvlari xom, tartiblangan ro'yxat sifatida tekshiriladi (takror/traversal/
 *       symlink/shifr/noma'lum siqish = rad);
 *    2) konvertdan tashqari yozuvlar ro'yxati flavor ro'yxatiga AYNAN teng bo'lishi shart;
 *    3) HAR BIR shunday yozuvning XOM baytlari allaqachon yig'ilgan lokal fayl bilan
 *       bayt-ba-bayt va SHA-256 bo'yicha bir xil bo'lishi shart (matn sifatida O'QILMAYDI);
 *    4) faqat shundan keyin konvert fayllari oddiy fayl sifatida yoziladi.
 *  Har qanday nomuvofiqlik = build to'xtaydi (fail-closed). */
function applySignatureEnvelope(destDir, zxpPath) {
  if (!existsSync(zxpPath)) throw new Error(`Imzolangan .zxp topilmadi: ${zxpPath}`);
  const st = statSync(zxpPath);
  if (!st.isFile()) throw new Error(`Imzolangan .zxp oddiy fayl emas: ${zxpPath}`);
  if (st.size > ZXP_MAX_BYTES) throw new Error(`.zxp juda katta (${st.size} bayt): ${zxpPath}`);
  const label = `.zxp (${path.basename(zxpPath)})`;
  const buf = readFileSync(zxpPath);
  const entries = assertArchiveEntries(readCentralDirectory(buf, label), label);

  const envelope = [];
  const payload = [];
  for (const e of entries) {
    if (e.name.endsWith("/")) continue; // papka yozuvi — hech narsa yozilmaydi
    if (isEnvelopePath(e.name)) {
      if (!SIGNATURE_ENVELOPE_ALLOWED.includes(e.name)) {
        throw new Error(
          `${label}: imzo konvertida kutilmagan yo'l "${e.name}" — ruxsat etilgan yagona ro'yxat: ` +
            `[${SIGNATURE_ENVELOPE_ALLOWED.join(", ")}]`
        );
      }
      envelope.push(e);
    } else {
      payload.push(e);
    }
  }
  if (!envelope.some((e) => e.name === SIGNATURE_MARKER)) {
    throw new Error(`${label}: ${SIGNATURE_MARKER} yo'q — bu imzolangan paket emas`);
  }

  const expected = expectedPayloadFiles();
  const actual = payload.map((e) => e.name).sort();
  const extra = actual.filter((e) => !expected.includes(e));
  const missing = expected.filter((e) => !actual.includes(e));
  if (extra.length || missing.length || actual.length !== expected.length) {
    throw new Error(
      `${label}: tarkibi flavor ro'yxatiga mos emas — imzo boshqa fayllarni qamragan. ` +
        `ortiqcha=[${extra.join(", ")}] yetishmayapti=[${missing.join(", ")}]`
    );
  }

  // Bayt bog'lash: imzolangan arxiv ↔ lokal payload (binar-xavfsiz, UTF-8 dekodlanmaydi).
  for (const e of payload) {
    const localPath = safeJoin(destDir, assertSafeRelative(e.name, { what: "arxiv" }));
    if (!existsSync(localPath)) throw new Error(`${label}: lokal payload'da yo'q: ${e.name}`);
    const local = readFileSync(localPath);
    const signed = readEntryBytes(buf, e, label);
    if (local.length !== signed.length || !local.equals(signed) || sha256Buffer(local) !== sha256Buffer(signed)) {
      throw new Error(
        `${label}: "${e.name}" imzolangan arxivda lokal payload'dan FARQ qiladi ` +
          `(lokal ${local.length}b/${sha256Buffer(local).slice(0, 12)} ↔ arxiv ${signed.length}b/${sha256Buffer(signed).slice(0, 12)}) — ` +
          `imzo bu baytlarni qamramagan, build to'xtadi`
      );
    }
  }

  // Faqat tasdiqlangan konvert fayllari — oddiy fayl sifatida, xom baytdan.
  for (const e of envelope) {
    const dst = safeJoin(destDir, assertSafeRelative(e.name, { what: "arxiv" }));
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, readEntryBytes(buf, e, label), { mode: 0o644 });
  }
  return envelope.map((e) => e.name).sort();
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
  const envelope = actual.filter((f) => isEnvelopePath(f));
  const body = actual.filter((f) => !envelope.includes(f));

  const rogueEnvelope = envelope.filter((f) => !SIGNATURE_ENVELOPE_ALLOWED.includes(f));
  if (rogueEnvelope.length) {
    throw new Error(
      `Imzo konvertida ruxsat etilmagan yo'l: [${rogueEnvelope.join(", ")}] — ` +
        `ruxsat etilgan yagona ro'yxat: [${SIGNATURE_ENVELOPE_ALLOWED.join(", ")}]`
    );
  }

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

// ── Eski o'rnatmadan qoladigan fayllar (post-success, ANIQ ro'yxat) ─────────

/** Eski versiyalardan qolishi mumkin bo'lgan, endi HECH QACHON yuborilmaydigan fayllar:
 *  ichki Admin sirti + debug bayroq fayllari. Ro'yxat `package-flavors.mjs` dan olinadi
 *  (qattiq yozilgan nom YO'Q) va joriy payload bilan kesishmasligi TEKSHIRILADI —
 *  ya'ni ishlayotgan panelning birorta fayli hech qachon bu ro'yxatga tushmaydi. */
export function obsoleteInstallFiles() {
  const shipped = new Set(expectedPayloadFiles());
  const list = [
    ...ADMIN_SURFACE.files,
    getFlavor("admin").debugSource,
    getFlavor(INSTALLER_FLAVOR).debugSource,
  ]
    .map((f) => assertSafeRelative(f, { what: "eski" }))
    .filter((f, i, a) => a.indexOf(f) === i)
    .sort();
  for (const f of list) {
    if (shipped.has(f)) throw new Error(`Eski fayllar ro'yxati joriy payload bilan kesishdi: ${f}`);
    if (!/^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(f)) throw new Error(`Eski fayl nomi shakli noto'g'ri: ${f}`);
  }
  return list;
}

/** macOS `.pkg` postinstall skripti (GENERATSIYA — bash quruvchida qattiq yozilgan nom yo'q).
 *  MUHIM: bu FAQAT payload muvaffaqiyatli joylashgandan KEYIN ishlaydi va FAQAT yuqoridagi
 *  aniq nomlarni o'chiradi. `preinstall` YO'Q: ishlayotgan panel almashtirilishidan OLDIN
 *  hech qachon o'chirilmaydi. Adobe sozlamalari (CSXS debug bayroqlari) TEGILMAYDI. */
export function postinstallScript() {
  const dirName = INSTALL_DIR_NAME;
  const mainHtml = getFlavor(INSTALLER_FLAVOR).mainHtml;
  const stale = obsoleteInstallFiles();
  return [
    "#!/bin/bash",
    "# GENERATSIYA: scripts/installer-payload.mjs (postinstall-script) — qo'lda tahrirlanmaydi.",
    "#",
    "# Bu skript payload MUVAFFAQIYATLI joylashtirilgandan KEYIN ishlaydi. Yagona vazifasi —",
    "# eski o'rnatmadan qolishi mumkin bo'lgan ANIQ NOMLI fayllarni olib tashlash.",
    "# Wildcard YO'Q, `find` YO'Q, `rm -rf` YO'Q. Boshqa hamma narsa (jumladan foydalanuvchi",
    "# ma'lumoti) TEGILMAYDI. Adobe/CEP sozlamalari HECH QACHON o'zgartirilmaydi.",
    "set -eu",
    `DEST="$HOME/${MAC_INSTALL_LOCATION}"`,
    'case "$DEST" in',
    `  */Adobe/CEP/extensions/${dirName}) : ;;`,
    "  *) exit 0 ;;",
    "esac",
    "# Yangi payload haqiqatan joyida bo'lmasa — HECH NARSA qilinmaydi.",
    '[ -f "$DEST/CSXS/manifest.xml" ] || exit 0',
    `[ -f "$DEST/${mainHtml}" ] || exit 0`,
    "for stale in \\",
    ...stale.map((f, i) => `  "${f}"${i === stale.length - 1 ? "" : " \\"}`),
    "do",
    '  if [ -f "$DEST/$stale" ]; then rm -f "$DEST/$stale" || true; fi',
    "done",
    "exit 0",
    "",
  ].join("\n");
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
    } else if (cmd === "postinstall-script") {
      process.stdout.write(postinstallScript());
    } else if (cmd === "stale-files") {
      console.log(obsoleteInstallFiles().join("\n"));
    } else if (cmd === "record") {
      if (!c) throw new Error("record <platform> <ext> <file> <signed|unsigned> talab qilinadi");
      const res = recordArtifact(a, b, path.resolve(c), { signed: d === "signed" });
      console.log(res.sha256);
    } else {
      console.error(
        "Foydalanish: installer-payload.mjs version|payload-files|stage|verify|artifact|checksum|record|" +
          "postinstall-script|stale-files"
      );
      process.exit(2);
    }
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}
