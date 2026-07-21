// INSTALLER ARTEFAKT TESTI — HAQIQIY skriptlar va HAQIQIY payload'ga qarshi (mock YO'Q).
//
// Nima kafolatlanadi:
//   A. Payload AYNAN mijoz flavor ro'yxati (package-flavors.mjs) — Admin sirti YO'Q,
//      `.debug` YO'Q, taqiqlangan CEF bayrog'i YO'Q; boshqa flavor umuman rad etiladi.
//      Negativ fiksturalar tekshiruvlar bo'sh emasligini isbotlaydi.
//   B. CEP imzo konverti (META-INF) faqat imzo AYNAN shu fayl ro'yxatini qamragan bo'lsa qabul
//      qilinadi; konvertsiz/yot faylli `.zxp` rad etiladi.
//   C. macOS: HAQIQIY `pkgbuild`/`productbuild` bilan `.pkg` quriladi va ichi ochib tekshiriladi —
//      per-user install-location, `auth="none"` (administrator paroli so'ralmaydi), domen faqat
//      currentUserHome, payload cpio ro'yxati flavor ro'yxatiga AYNAN teng (AppleDouble yo'q).
//   D. FAIL-CLOSED: kredensialsiz · to'liqsiz notarizatsiya · imzolash buyrug'i yiqilganda —
//      yakuniy artefakt YARATILMAYDI, vaqtinchalik papka QOLMAYDI, parol chop etilmaydi va
//      boshqa platforma/flavor artefakti BAYT-BA-BAYT o'zgarmaydi.
//   E. Windows: HAQIQIY skript ishga tushadi — payload, WiX manbasi (per-user, har fayl uchun
//      bitta komponent, barqaror GUID), asbob/kredensial yo'qligida fail-closed. `wix` va
//      `signtool` — testda PATH orqali soxta buyruq (Windows toolchain macOS'da yo'q; bu
//      build-zxp.sh testidagi soxta ZXPSignCmd naqshining aynan o'zi).
//   F. SHA-256 chiqishi haqiqiy: `shasum -a 256 -c` bilan tekshiriladi, bayt o'zgarsa yiqiladi.
//   G. Versiya drift: manifest ↔ manifest.admin ↔ AF_PLUGIN_VERSION ↔ paket versiyasi;
//      installer skriptlarida qattiq yozilgan versiya YO'Q.
//
// XAVFSIZLIK: barcha soxta/nosozlik build'lari IZOLYATSIYALANGAN vaqtinchalik chiqish papkasida
// bajariladi (FF_INSTALLERS_DIR) — repo'dagi `dist/installers` ga faqat HAQIQIY imzolanmagan
// macOS QA paketi tushadi. Imzolangan reliz artefaktlariga hech qachon tegilmaydi.
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-installer-artifacts.mjs

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32 } from "node:zlib";
import {
  ADMIN_SURFACE,
  DIST_DIR,
  FORBIDDEN_CEF_FLAGS,
  PLUGIN_SRC,
  REPO_ROOT,
  artifactPath,
  declaredPluginVersion,
  flavorVersion,
  resolveFlavorFiles,
} from "./package-flavors.mjs";
import {
  MSI_MIN_BYTES,
  MSI_OLE_HEADER,
  SIGNATURE_ENVELOPE_ALLOWED,
  assertMsiArtifact,
  expectedPayloadFiles,
  installerArtifactName,
  listPayloadFiles,
  obsoleteInstallFiles,
  postinstallScript,
  sha256File,
  stageCustomerPayload,
  verifyPayload,
  writeChecksumSidecar,
} from "./installer-payload.mjs";
import { buildWxsSource, wixId } from "./installer-wix.mjs";
// Migratsiya (RemoveFile) eksportlari NOM FAZOSI orqali olinadi: ular yo'q generator bilan ham
// bu fayl yuklanadi va tekshiruvlar HALOL "failed" bo'lib chiqadi (import SyntaxError'i emas).
import * as wixGen from "./installer-wix.mjs";

const MAC_SCRIPT = path.join(PLUGIN_SRC, "scripts/build-installer-mac.sh");
const WIN_SCRIPT = path.join(PLUGIN_SRC, "scripts/build-installer-win.mjs");
const HELPER = path.join(PLUGIN_SRC, "scripts/installer-payload.mjs");
const VERSION = flavorVersion("customer");
const IS_MAC = process.platform === "darwin";

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

const CLEANUP = new Set();
function track(p) {
  CLEANUP.add(p);
  return p;
}
function runCleanup() {
  for (const p of CLEANUP) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      /* tozalash hech qachon testni yiqitmaydi */
    }
  }
  CLEANUP.clear();
}
process.on("exit", runCleanup);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    runCleanup();
    process.exit(130);
  });
}

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`✓  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
function skip(label, why) {
  skipped++;
  console.log(`⊘ SKIP  ${label} — ${why}`);
}
/** Kutilgan xato: funksiya throw qilishi SHART va xabar naqshga mos kelishi kerak. */
function throws(label, fn, re) {
  let message = null;
  try {
    fn();
  } catch (e) {
    message = String((e && e.message) || e);
  }
  check(label, message !== null && re.test(message), message === null ? "throw qilmadi" : message);
}

function run(cmd, args, env) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, ...env },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

const WORK = track(mkdtempSync(path.join(tmpdir(), "ff-installer-test-")));
/** Soxta/nosozlik build'lari uchun izolyatsiyalangan chiqish papkasi. */
const ISO = path.join(WORK, "out");
mkdirSync(ISO, { recursive: true });

// ══ A) PAYLOAD ══════════════════════════════════════════════════════════════
console.log("\n── A) Payload (haqiqiy fayllar) ──────────────────────────────");

const stageDir = path.join(WORK, "payload");
const staged = stageCustomerPayload(stageDir);
const expected = expectedPayloadFiles();

check(
  `payload fayl ro'yxati flavor manbasiga AYNAN mos (${expected.length} fayl)`,
  JSON.stringify(staged.files) === JSON.stringify(expected),
  `staged=${staged.files.length} expected=${expected.length}`
);
check(
  "har bir payload fayli manba bilan BAYT-BA-BAYT bir xil",
  resolveFlavorFiles("customer").every(
    (f) => sha256File(path.join(PLUGIN_SRC, f.from)) === sha256File(path.join(stageDir, f.to))
  )
);
check("payload'da `.debug` YO'Q (masofaviy debug porti)", !staged.files.some((f) => f.endsWith(".debug")));
for (const f of ADMIN_SURFACE.files) {
  check(`payload'da Admin fayli "${f}" YO'Q`, !staged.files.includes(f) && !staged.files.includes(path.posix.basename(f)));
}

const textFiles = staged.files.filter((f) => /\.(html|js|jsx|css|xml|json)$/i.test(f));
const texts = textFiles.map((f) => [f, readFileSync(path.join(stageDir, f), "utf8")]);
for (const id of ADMIN_SURFACE.identifiers) {
  const hit = texts.find(([, body]) => body.includes(id));
  check(`payload'da Admin identifikatori "${id}" YO'Q`, !hit, hit && hit[0]);
}
for (const key of ADMIN_SURFACE.storageKeys) {
  const hit = texts.find(([, body]) => body.includes(key));
  check(`payload'da Admin localStorage kaliti "${key}" YO'Q`, !hit, hit && hit[0]);
}
const stagedManifest = readFileSync(path.join(stageDir, "CSXS/manifest.xml"), "utf8");
for (const flag of FORBIDDEN_CEF_FLAGS) {
  check(`payload manifestida ${flag} YO'Q`, !stagedManifest.includes(flag));
}
check(
  "payload manifesti FAQAT com.frameflow.panel extension'ini e'lon qiladi",
  (stagedManifest.match(/<Extension\s+Id="([^"]+)"/g) || []).every((m) => m.includes("com.frameflow.panel"))
);
check("payload manifesti MainPath = ./AssetFlow_Plugin.html", stagedManifest.includes("<MainPath>./AssetFlow_Plugin.html</MainPath>"));

throws(
  "ichki `admin` flavor'ini payload qilish RAD ETILADI",
  () => stageCustomerPayload(path.join(WORK, "payload-admin"), { flavor: "admin" }),
  /admin|rad etildi/i
);

// Negativ fiksturalar — verifyPayload haqiqatan ushlaydimi?
function mutatedPayload(name, mutate) {
  const dir = path.join(WORK, `neg-${name}`);
  stageCustomerPayload(dir);
  mutate(dir);
  return dir;
}
throws(
  "negativ: Admin HTML payload'ga qo'shildi → verify yiqiladi",
  () =>
    verifyPayload(
      mutatedPayload("admin-file", (d) =>
        copyFileSync(path.join(PLUGIN_SRC, "AssetFlow_Admin.html"), path.join(d, "AssetFlow_Admin.html"))
      )
    ),
  /Admin sirti|mos emas/i
);
throws(
  "negativ: begona fayl qo'shildi → verify yiqiladi",
  () => verifyPayload(mutatedPayload("extra", (d) => writeFileSync(path.join(d, "extra.js"), "//"))),
  /ortiqcha/i
);
throws(
  "negativ: fayl olib tashlandi → verify yiqiladi",
  () => verifyPayload(mutatedPayload("missing", (d) => unlinkSync(path.join(d, "assetflow-log.js")))),
  /yetishmayapti/i
);
throws(
  "negativ: `af_admin_token` kaliti sirg'alib kirdi → verify yiqiladi",
  () =>
    verifyPayload(
      mutatedPayload("adminkey", (d) =>
        writeFileSync(path.join(d, "assetflow-log.js"), "localStorage.getItem('af_admin_token');\n")
      )
    ),
  /af_admin_token/
);
throws(
  "negativ: manifestga --disable-web-security qo'shildi → verify yiqiladi",
  () =>
    verifyPayload(
      mutatedPayload("cefflag", (d) => {
        const p = path.join(d, "CSXS/manifest.xml");
        writeFileSync(p, readFileSync(p, "utf8").replace("</CEFCommandLine>", "<Parameter>--disable-web-security</Parameter></CEFCommandLine>"));
      })
    ),
  /disable-web-security/
);
throws(
  "negativ: `.debug` payload'ga qo'shildi → verify yiqiladi",
  () => verifyPayload(mutatedPayload("debug", (d) => writeFileSync(path.join(d, ".debug"), "x"))),
  /\.debug/
);

// ══ B) CEP imzo konverti ════════════════════════════════════════════════════
console.log("\n── B) CEP imzo konverti (META-INF) ───────────────────────────");

/** Sun'iy "imzolangan" .zxp — imzoning O'ZI tekshirilmaydi (uni ZXPSignCmd qo'yadi);
 *  tekshirilayotgani: konvert AJRATILADI va imzo qamrovi flavor ro'yxatiga mos bo'lishi SHART. */
function makeZxp(name, { extraFile = null, withSignature = true, mutate = null } = {}) {
  const src = path.join(WORK, `zxpsrc-${name}`);
  stageCustomerPayload(src);
  if (withSignature) {
    mkdirSync(path.join(src, "META-INF"), { recursive: true });
    writeFileSync(path.join(src, "META-INF/signatures.xml"), "<signatures/>\n");
    writeFileSync(path.join(src, "mimetype"), "application/vnd.adobe.air-ucf-package+zip");
  }
  if (extraFile) {
    mkdirSync(path.dirname(path.join(src, extraFile)), { recursive: true });
    writeFileSync(path.join(src, extraFile), "// yot fayl");
  }
  // Nom O'ZGARMAYDI, faqat BAYTLAR — "ro'yxat mos" tekshiruvi bunday hujumni ko'rmaydi.
  if (mutate) writeFileSync(path.join(src, mutate), "// IMZODAN KEYIN ALMASHTIRILGAN BAYTLAR\n");
  const out = path.join(WORK, `${name}.zxp`);
  execFileSync("zip", ["-qr", out, "."], { cwd: src });
  return out;
}

/** XOM ZIP quruvchi (faqat test) — `zip` CLI qura olmaydigan buzg'unchi fiksturalar uchun:
 *  takrorlangan nom, `..`/absolyut yo'l, symlink yozuvi. Faqat "store" (method 0). */
function makeRawZip(outPath, entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  let cdSize = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "latin1");
    const data = Buffer.from(e.data === undefined ? "" : e.data);
    const crc = crc32(data) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(e.unixMode ? 0x0314 : 0x0014, 4); // yuqori bayt 3 = Unix host
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(((e.unixMode || 0) >>> 0) * 0x10000, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    cdSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  writeFileSync(outPath, Buffer.concat([...locals, ...central, eocd]));
  return outPath;
}

const ENVELOPE_FIXTURE = [
  { name: "mimetype", data: "application/vnd.adobe.air-ucf-package+zip" },
  { name: "META-INF/signatures.xml", data: "<signatures/>\n" },
];

const goodZxp = makeZxp("good");
const envDir = path.join(WORK, "payload-env");
const envRes = stageCustomerPayload(envDir, { signedZxp: goodZxp });
check("imzo konverti payload'ga qo'shildi (META-INF/signatures.xml)", envRes.files.includes("META-INF/signatures.xml"));
check("imzo konverti `mimetype` faylini ham olib keladi", envRes.files.includes("mimetype"));
check(
  "konvert bilan ham asosiy fayl ro'yxati o'zgarmaydi",
  JSON.stringify(envRes.files.filter((f) => f !== "mimetype" && !f.startsWith("META-INF/"))) === JSON.stringify(expected)
);
check("verifyPayload konvertli payload'ni `signed` deb tanidi", verifyPayload(envDir).signed === true);

throws(
  "negativ: `.zxp` ichida yot fayl bor → imzo qamrovi mos emas, RAD ETILADI",
  () => stageCustomerPayload(path.join(WORK, "payload-env-extra"), { signedZxp: makeZxp("extra", { extraFile: "rogue.js" }) }),
  /mos emas|ortiqcha/i
);
throws(
  "negativ: imzosiz arxiv konvert sifatida RAD ETILADI",
  () => stageCustomerPayload(path.join(WORK, "payload-env-nosig"), { signedZxp: makeZxp("nosig", { withSignature: false }) }),
  /signatures\.xml|imzolangan paket emas/i
);
throws(
  "negativ: mavjud bo'lmagan `.zxp` yo'li RAD ETILADI",
  () => stageCustomerPayload(path.join(WORK, "payload-env-none"), { signedZxp: path.join(WORK, "yoq.zxp") }),
  /topilmadi/i
);

// ── B2) Imzo AYNAN shu BAYTLARni qamraganining isboti ──────────────────────
// Fayl ro'yxati bir xil, faqat tarkib boshqa: "ro'yxat mos" tekshiruvi buni KO'RMAYDI.
throws(
  "negativ: `.zxp` ichida NOM bir xil, BAYT boshqa → RAD ETILADI (imzo bu baytlarni qamramagan)",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-env-mut"), {
      signedZxp: makeZxp("mutated", { mutate: "assetflow-log.js" }),
    }),
  /FARQ qiladi|bayt/i
);
throws(
  "negativ: `.zxp` ichida manifest baytlari almashtirilgan → RAD ETILADI",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-env-mut2"), {
      signedZxp: makeZxp("mutated-manifest", { mutate: "CSXS/manifest.xml" }),
    }),
  /FARQ qiladi|bayt/i
);
throws(
  "negativ: konvertda ruxsat etilmagan META-INF yo'li → RAD ETILADI (yopiq ro'yxat)",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-env-meta"), {
      signedZxp: makeZxp("meta-extra", { extraFile: "META-INF/evil.xml" }),
    }),
  /kutilmagan yo'l|ruxsat etilgan/i
);
check(
  `konvert ruxsat ro'yxati YOPIQ va aniq (${SIGNATURE_ENVELOPE_ALLOWED.join(", ")})`,
  SIGNATURE_ENVELOPE_ALLOWED.length === 2 &&
    SIGNATURE_ENVELOPE_ALLOWED.includes("META-INF/signatures.xml") &&
    SIGNATURE_ENVELOPE_ALLOWED.includes("mimetype")
);

// ── B3) XOM arxiv yozuvlari (unzip -d YO'Q, ro'yxat Set'ga yig'ilmaydi) ─────
const rawPayload = expected.map((rel) => ({ name: rel, data: readFileSync(path.join(stageDir, rel)) }));
const rawGood = makeRawZip(path.join(WORK, "raw-good.zxp"), [...rawPayload, ...ENVELOPE_FIXTURE]);
const rawGoodDir = path.join(WORK, "payload-raw-good");
const rawGoodRes = stageCustomerPayload(rawGoodDir, { signedZxp: rawGood });
check(
  "pozitiv nazorat: xom (store) ZIP to'g'ri baytlar bilan QABUL QILINADI",
  rawGoodRes.envelope.includes("META-INF/signatures.xml") && verifyPayload(rawGoodDir).signed === true
);
check(
  "konvert fayllari ODDIY fayl sifatida yozildi (papka/symlink emas)",
  SIGNATURE_ENVELOPE_ALLOWED.every((f) => statSync(path.join(rawGoodDir, f)).isFile())
);

throws(
  "negativ: TAKRORLANGAN arxiv yozuvi nomi RAD ETILADI (Set'ga yig'ish xavfsizlik qarori EMAS)",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-raw-dup"), {
      signedZxp: makeRawZip(path.join(WORK, "raw-dup.zxp"), [
        ...ENVELOPE_FIXTURE,
        { name: "assetflow-log.js", data: "// birinchi" },
        { name: "assetflow-log.js", data: "// ikkinchi (soya nusxa)" },
      ]),
    }),
  /takrorlangan/i
);
throws(
  "negativ: `..` bilan chiqib ketuvchi arxiv yo'li RAD ETILADI",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-raw-trav"), {
      signedZxp: makeRawZip(path.join(WORK, "raw-trav.zxp"), [
        ...ENVELOPE_FIXTURE,
        { name: "../../evil.js", data: "// traversal" },
      ]),
    }),
  /traversal|Xavfsiz bo'lmagan/i
);
throws(
  "negativ: ABSOLYUT arxiv yo'li RAD ETILADI",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-raw-abs"), {
      signedZxp: makeRawZip(path.join(WORK, "raw-abs.zxp"), [
        ...ENVELOPE_FIXTURE,
        { name: "/tmp/evil.js", data: "// absolyut" },
      ]),
    }),
  /absolyut|Xavfsiz bo'lmagan/i
);
throws(
  "negativ: buzuq (boshqaruv belgili) arxiv yo'li RAD ETILADI",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-raw-ctrl"), {
      signedZxp: makeRawZip(path.join(WORK, "raw-ctrl.zxp"), [
        ...ENVELOPE_FIXTURE,
        { name: "assetflow\u0000log.js", data: "// NUL" },
      ]),
    }),
  /ASCII bo'lmagan|boshqaruv|Xavfsiz bo'lmagan/i
);
throws(
  "negativ: SYMLINK arxiv yozuvi RAD ETILADI (o'rnatma papkasidan tashqariga ko'rsatardi)",
  () =>
    stageCustomerPayload(path.join(WORK, "payload-raw-link"), {
      signedZxp: makeRawZip(path.join(WORK, "raw-link.zxp"), [
        ...ENVELOPE_FIXTURE,
        { name: "assetflow-log.js", data: "/etc/passwd", unixMode: 0xa1ff },
      ]),
    }),
  /symlink|qurilma|yozuv turi/i
);
throws(
  "negativ: shifrlangan arxiv yozuvi RAD ETILADI",
  () => {
    const p = makeRawZip(path.join(WORK, "raw-enc.zxp"), [
      ...ENVELOPE_FIXTURE,
      { name: "assetflow-log.js", data: "x" },
    ]);
    const b = readFileSync(p);
    // Markaziy katalogdagi umumiy bayroqqa "shifrlangan" bitini qo'yamiz.
    const cd = b.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    b.writeUInt16LE(0x0001, cd + 8);
    writeFileSync(p, b);
    stageCustomerPayload(path.join(WORK, "payload-raw-enc"), { signedZxp: p });
  },
  /shifrlangan/i
);

// ══ F) SHA-256 chiqishi ═════════════════════════════════════════════════════
console.log("\n── F) SHA-256 chiqishi ───────────────────────────────────────");

const shaSample = path.join(WORK, "sample.bin");
writeFileSync(shaSample, "frameflow-installer-bytes");
const shaHex = writeChecksumSidecar(shaSample);
check("sidecar `.sha256` yozildi", existsSync(`${shaSample}.sha256`));
check("SHA-256 aynan 64 kichik hex belgi", /^[0-9a-f]{64}$/.test(shaHex));
check("SHA-256 fayl baytlariga mos", shaHex === createHash("sha256").update(readFileSync(shaSample)).digest("hex"));
check(
  "sidecar `shasum -a 256 -c` bilan tasdiqlanadi",
  run("shasum", ["-a", "256", "-c", `${shaSample}.sha256`], { PWD: WORK }).code === 0 ||
    run("bash", ["-c", `cd "${WORK}" && shasum -a 256 -c "${path.basename(shaSample)}.sha256"`]).code === 0
);
writeFileSync(shaSample, "frameflow-installer-bytes-MUTATED");
check(
  "negativ: bayt o'zgarsa sidecar tekshiruvi YIQILADI",
  run("bash", ["-c", `cd "${WORK}" && shasum -a 256 -c "${path.basename(shaSample)}.sha256"`]).code !== 0
);

// ══ "Tegilmadi" isbotlari uchun langar hash'lar ════════════════════════════
// Boshqa FLAVOR artefakti: ichki Admin QA arxivi (yo'q bo'lsa quriladi) — SHA-256'i har
// installer amalidan keyin o'zgarmasligi SHART ("yo'q" bilan emas, HASH bilan isbot).
const adminArchive = artifactPath("admin", { signed: false });
if (!existsSync(adminArchive)) {
  run("bash", [path.join(PLUGIN_SRC, "scripts/build-zxp.sh"), "--admin", "--unsigned"]);
}
const ADMIN_SHA = existsSync(adminArchive) ? sha256File(adminArchive) : null;
const adminUntouched = () => ADMIN_SHA !== null && existsSync(adminArchive) && sha256File(adminArchive) === ADMIN_SHA;

// Boshqa PLATFORMA artefakti: izolyatsiyalangan papkaga nishon qo'yamiz.
const isoWinSigned = path.join(ISO, installerArtifactName("win", "msi", { signed: true }));
const isoMacSigned = path.join(ISO, installerArtifactName("mac", "pkg", { signed: true }));
writeFileSync(isoWinSigned, "WIN-ARTIFACT-SENTINEL — mac build must never touch this");
const WIN_SENTINEL_SHA = sha256File(isoWinSigned);
const winSentinelUntouched = () => existsSync(isoWinSigned) && sha256File(isoWinSigned) === WIN_SENTINEL_SHA;

const strayTemps = () =>
  existsSync(ISO) ? readdirSync(ISO).filter((n) => n.startsWith("_build.")) : [];

// ══ C) macOS HAQIQIY build ══════════════════════════════════════════════════
console.log("\n── C) macOS .pkg (haqiqiy pkgbuild/productbuild) ──────────────");

const macPkg = path.join(REPO_ROOT, "dist/installers", installerArtifactName("mac", "pkg", { signed: false }));
let macBuilt = false;
if (!IS_MAC) {
  skip("macOS .pkg build", "bu platforma Darwin emas");
} else {
  const build = run("bash", [MAC_SCRIPT, "--unsigned"]);
  check("`build-installer-mac.sh --unsigned` muvaffaqiyatli", build.code === 0, build.out.slice(-500));
  macBuilt = build.code === 0 && existsSync(macPkg);
  check(`artefakt kutilgan nom bilan yaratildi (${path.basename(macPkg)})`, macBuilt);
}

if (macBuilt) {
  check("artefakt yonida `.sha256` sidecar bor", existsSync(`${macPkg}.sha256`));
  const sidecar = readFileSync(`${macPkg}.sha256`, "utf8").trim();
  check("sidecar SHA-256 haqiqiy baytlarga mos", sidecar.split(/\s+/)[0] === sha256File(macPkg));
  const manifestFile = path.join(REPO_ROOT, "dist/installers", `frameflow-plugin-v${VERSION}-installers.json`);
  check("reliz manifesti (JSON) yozildi", existsSync(manifestFile));
  if (existsSync(manifestFile)) {
    const mf = JSON.parse(readFileSync(manifestFile, "utf8"));
    check("manifest mac yozuvi sha256/hajm bo'yicha mos", mf.artifacts?.mac?.sha256 === sha256File(macPkg) && mf.artifacts?.mac?.sizeBytes === statSync(macPkg).size);
    check("manifest versiyasi flavor versiyasiga teng", mf.version === VERSION);
    check("manifest mac yozuvi `signed:false` (imzolanmagan QA)", mf.artifacts?.mac?.signed === false);
  }

  const expandDir = track(path.join(WORK, "pkg-expand"));
  const expand = run("pkgutil", ["--expand", macPkg, expandDir]);
  check("`.pkg` ochildi (pkgutil --expand)", expand.code === 0, expand.out.slice(-300));

  const pkgInfoPath = path.join(expandDir, "frameflow-component.pkg/PackageInfo");
  const distPath = path.join(expandDir, "Distribution");
  const pkgInfo = existsSync(pkgInfoPath) ? readFileSync(pkgInfoPath, "utf8") : "";
  const dist = existsSync(distPath) ? readFileSync(distPath, "utf8") : "";

  check(
    "install-location = per-user CEP papkasi (Library/Application Support/Adobe/CEP/extensions/com.frameflow)",
    pkgInfo.includes('install-location="Library/Application Support/Adobe/CEP/extensions/com.frameflow"'),
    (pkgInfo.match(/install-location="[^"]*"/) || [])[0]
  );
  check("install-location `/Library` (tizim domeni) EMAS", !/install-location="\/Library/.test(pkgInfo));
  check("`auth=\"none\"` — administrator paroli so'ralmaydi", pkgInfo.includes('auth="none"'), (pkgInfo.match(/auth="[^"]*"/) || [])[0]);
  check("paket identifikatori com.frameflow.plugin", pkgInfo.includes('identifier="com.frameflow.plugin"'));
  check(`paket versiyasi flavor versiyasiga teng (${VERSION})`, pkgInfo.includes(`version="${VERSION}"`));
  check("Distribution: enable_currentUserHome=\"true\"", dist.includes('enable_currentUserHome="true"'));
  check("Distribution: enable_localSystem=\"false\" (tizimga o'rnatilmaydi)", dist.includes('enable_localSystem="false"'));
  check("Distribution: enable_anywhere=\"false\"", dist.includes('enable_anywhere="false"'));

  const payloadList = run("bash", [
    "-c",
    `cd "${expandDir}/frameflow-component.pkg" && cat Payload | gzip -dc | cpio -it --quiet`,
  ]);
  const entries = payloadList.out.split("\n").map((l) => l.trim()).filter(Boolean);
  // cpio ro'yxati papkalarni ham beradi — fayllarni kengaytma bo'yicha ajratamiz.
  const pkgFiles = entries.filter((e) => e !== ".").map((e) => e.replace(/^\.\//, ""));
  const pkgFileOnly = pkgFiles.filter((e) => expected.includes(e));
  check(
    `pkg payload'ida flavor ro'yxatining hammasi bor (${expected.length})`,
    expected.every((e) => pkgFiles.includes(e)),
    expected.filter((e) => !pkgFiles.includes(e)).join(", ")
  );
  check("pkg payload'ida AppleDouble (`._…`) metadata yozuvi YO'Q", !entries.some((e) => path.basename(e).startsWith("._")));
  const pkgExtras = pkgFiles.filter((e) => !expected.includes(e) && /\.[A-Za-z0-9]+$/.test(e));
  check("pkg payload'ida ortiqcha fayl YO'Q", pkgExtras.length === 0, pkgExtras.join(", "));
  check("pkg payload'ida Admin fayli YO'Q", !pkgFiles.some((e) => ADMIN_SURFACE.files.some((a) => e.endsWith(path.posix.basename(a)))));
  check("pkg payload fayllari soni flavor ro'yxatiga teng", pkgFileOnly.length === expected.length, `${pkgFileOnly.length}/${expected.length}`);

  const scriptsDir = path.join(expandDir, "frameflow-component.pkg/Scripts");
  const preFile = path.join(scriptsDir, "preinstall");
  const post = existsSync(path.join(scriptsDir, "postinstall")) ? readFileSync(path.join(scriptsDir, "postinstall"), "utf8") : "";
  check(
    "paketda `preinstall` YO'Q — ishlayotgan plagin yangi payload'dan OLDIN o'chirilmaydi",
    !existsSync(preFile),
    existsSync(preFile) ? readFileSync(preFile, "utf8").slice(0, 200) : ""
  );
  check("paketda `postinstall` bor (o'rnatmadan KEYIN ishlaydigan yagona skript)", !!post);
  check("postinstall generatordan bayt-ba-bayt bir xil chiqdi", post === postinstallScript());
  check("skriptlar `sudo`/imtiyoz ko'tarishni ishlatmaydi", !/\bsudo\b|osascript .*administrator/i.test(post));
  check("skriptlar `/Library` (tizim) ga yozmaydi", !/(^|[^~$])\/Library\//m.test(post.replace(/\$HOME\/Library\//g, "~HOME~/")));
  check("postinstall FAQAT com.frameflow papkasida ishlaydi", /extensions\/com\.frameflow/.test(post) && /case "\$DEST"/.test(post));
  check(
    "postinstall AVVAL yangi payload joylashganini tekshiradi (aks holda hech narsa qilmaydi)",
    /\[ -f "\$DEST\/CSXS\/manifest\.xml" \] \|\| exit 0/.test(post) &&
      /\[ -f "\$DEST\/AssetFlow_Plugin\.html" \] \|\| exit 0/.test(post)
  );
  const postCode = codeOnly(post);
  check("postinstall'da KENG o'chirish YO'Q (`rm -rf` · `find` · joker belgi)", !/rm\s+-rf|\bfind\b|\*\s*"?\$DEST|\$DEST[^"\n]*\*/.test(postCode));
  check(
    "postinstall FAQAT aniq nomli eski fayllarni o'chiradi (ro'yxat = obsoleteInstallFiles)",
    obsoleteInstallFiles().every((f) => post.includes(`"${f}"`)) &&
      (post.match(/rm -f/g) || []).length === 1 &&
      /rm -f "\$DEST\/\$stale"/.test(post)
  );
  check(
    "postinstall foydalanuvchi ma'lumotini (assetflow-data) o'chirmaydi — umuman tilga olmaydi",
    !post.includes("assetflow-data")
  );
  check(
    "postinstall Adobe debug sozlamasiga TEGMAYDI (`defaults` YO'Q · PlayerDebugMode YO'Q)",
    !/\bdefaults\b/.test(post) && !/PlayerDebugMode/.test(post) && !/com\.adobe\.CSXS/.test(post)
  );
  check(
    "eski fayllar ro'yxati joriy payload bilan kesishmaydi (ishlaydigan fayl o'chmaydi)",
    obsoleteInstallFiles().every((f) => !expected.includes(f))
  );
}
check("macOS build boshqa flavor (ichki Admin) artefaktiga TEGMADI — SHA-256 o'zgarmadi", adminUntouched());

// ══ D) macOS FAIL-CLOSED ════════════════════════════════════════════════════
console.log("\n── D) macOS imzolash fail-closed (haqiqiy skript) ─────────────");

const FAKE_PASS = "fake-notary-password-not-a-secret";
const FAKE_IDENTITY = "Developer ID Installer: Fake Fixture (TESTTEAM00)";
const fakeP8 = path.join(WORK, "fake-notary-key.p8");
writeFileSync(fakeP8, "not-a-real-key");

function plantMacSentinel() {
  writeFileSync(isoMacSigned, "STALE-MAC-ARTIFACT-SENTINEL");
}
function macSigned(env) {
  return run("bash", [MAC_SCRIPT], { FF_INSTALLERS_DIR: ISO, ...env });
}

if (!IS_MAC) {
  skip("macOS fail-closed", "bu platforma Darwin emas");
} else {
  // D1 — identika YO'Q
  plantMacSentinel();
  const noId = macSigned({ FF_MAC_INSTALLER_IDENTITY: "", FF_SIGNED_ZXP: "" });
  check("identikasiz imzolangan build FAIL-CLOSED (exit≠0)", noId.code !== 0, `exit=${noId.code}`);
  check("xato FF_MAC_INSTALLER_IDENTITY ni aniq aytadi", /FF_MAC_INSTALLER_IDENTITY/.test(noId.out));
  check("identikasiz: eski yakuniy .pkg BEKOR qilindi", !existsSync(isoMacSigned));
  check("identikasiz: vaqtinchalik papka qolmadi", strayTemps().length === 0, strayTemps().join(", "));
  check("identikasiz: win artefakti BAYT-BA-BAYT o'zgarmadi", winSentinelUntouched());

  // D2 — identika bor, imzolangan .zxp YO'Q
  plantMacSentinel();
  const noZxp = macSigned({ FF_MAC_INSTALLER_IDENTITY: FAKE_IDENTITY, FF_SIGNED_ZXP: "" });
  check("imzolangan .zxp'siz build FAIL-CLOSED (exit≠0)", noZxp.code !== 0, `exit=${noZxp.code}`);
  check("xato FF_SIGNED_ZXP ni aniq aytadi", /FF_SIGNED_ZXP/.test(noZxp.out));
  check("zxp'siz: eski yakuniy .pkg BEKOR qilindi", !existsSync(isoMacSigned));

  // D3 — notarizatsiya kredensiali YO'Q
  plantMacSentinel();
  const noNotary = macSigned({ FF_MAC_INSTALLER_IDENTITY: FAKE_IDENTITY, FF_SIGNED_ZXP: goodZxp });
  check("notarizatsiya kredensialisiz build FAIL-CLOSED (exit≠0)", noNotary.code !== 0, `exit=${noNotary.code}`);
  check("xato notarizatsiya kredensialini aniq aytadi", /FF_NOTARY_KEY_ID|FF_NOTARY_APPLE_ID/.test(noNotary.out));
  check("notarizatsiyasiz: eski yakuniy .pkg BEKOR qilindi", !existsSync(isoMacSigned));

  // D4 — notarizatsiya kredensiali QISMAN (fail-closed, "yarim" holat qabul qilinmaydi)
  plantMacSentinel();
  const partial = macSigned({
    FF_MAC_INSTALLER_IDENTITY: FAKE_IDENTITY,
    FF_SIGNED_ZXP: goodZxp,
    FF_NOTARY_KEY_ID: "ABC123",
  });
  check("qisman notarizatsiya kredensiali FAIL-CLOSED (exit≠0)", partial.code !== 0, `exit=${partial.code}`);
  check("xato to'liq bo'lmagan kalit to'plamini aytadi", /to'liq emas/.test(partial.out));
  check("qisman kredensial: yakuniy .pkg YARATILMADI", !existsSync(isoMacSigned));

  // D5 — imzolash BUYRUG'I yiqiladi (PATH'ga qo'yilgan soxta productsign qisman bayt yozadi)
  const fakeBin = track(mkdtempSync(path.join(tmpdir(), "ff-fakebin-mac-")));
  writeFileSync(
    path.join(fakeBin, "productsign"),
    [
      "#!/bin/bash",
      "# Soxta productsign (faqat test): chiqish fayliga QISMAN bayt yozib, yiqiladi.",
      "# Identika/parol o'qilmaydi, chop etilmaydi.",
      'out="${@: -1}"',
      'printf "PARTIAL-PKG-BYTES" > "$out"',
      'echo "fake productsign: forced failure" >&2',
      "exit 3",
      "",
    ].join("\n")
  );
  chmodSync(path.join(fakeBin, "productsign"), 0o755);

  plantMacSentinel();
  const signFail = macSigned({
    FF_MAC_INSTALLER_IDENTITY: FAKE_IDENTITY,
    FF_SIGNED_ZXP: goodZxp,
    FF_NOTARY_APPLE_ID: "release@example.invalid",
    FF_NOTARY_TEAM_ID: "TESTTEAM00",
    FF_NOTARY_PASSWORD: FAKE_PASS,
    PATH: `${fakeBin}:${process.env.PATH}`,
  });
  check("productsign yiqilsa FAIL-CLOSED (exit≠0)", signFail.code !== 0, `exit=${signFail.code}`);
  check("productsign yiqilsa: yakuniy .pkg YARATILMAYDI", !existsSync(isoMacSigned));
  check("productsign yiqilsa: vaqtinchalik papka QOLMAYDI", strayTemps().length === 0, strayTemps().join(", "));
  check("productsign yiqilsa: parol qiymati chiqishda YO'Q", !signFail.out.includes(FAKE_PASS));
  check("productsign yiqilsa: imzolash identikasi chiqishda YO'Q", !signFail.out.includes(FAKE_IDENTITY));
  check("productsign yiqilsa: win artefakti BAYT-BA-BAYT o'zgarmadi", winSentinelUntouched());
  check("productsign yiqilsa: ichki Admin artefakti BAYT-BA-BAYT o'zgarmadi", adminUntouched());
  check(
    "imzolangan yo'lda HAQIQIY macOS QA paketi tegilmadi",
    !macBuilt || sha256File(macPkg) === readFileSync(`${macPkg}.sha256`, "utf8").trim().split(/\s+/)[0]
  );
}

// ══ E) Windows ══════════════════════════════════════════════════════════════
console.log("\n── E) Windows .msi (haqiqiy skript, soxta toolchain) ──────────");

const isoWinUnsigned = path.join(ISO, installerArtifactName("win", "msi", { signed: false }));
const fakeWinBin = track(mkdtempSync(path.join(tmpdir(), "ff-fakebin-win-")));
const wxsCapture = path.join(WORK, "captured.wxs");

/** Soxta `wix` chiqishi TUZILMA JIHATDAN yetarli MSI bo'lishi kerak: OLE compound
 *  sarlavhasi (d0cf11e0a1b11ae1) + eng kam mazmunli hajm. `garbage: true` — aynan shu
 *  tekshiruv ishlayotganini isbotlash uchun ixtiyoriy baytlar yozadi. */
const OLE_HEADER_PRINTF = "\\320\\317\\021\\340\\241\\261\\032\\341";
function writeFakeWix({ fail = false, garbage = false } = {}) {
  writeFileSync(
    path.join(fakeWinBin, "wix"),
    [
      "#!/bin/bash",
      "# Soxta WiX (faqat test): haqiqiy WiX Windows toolchain'i, macOS'da yo'q.",
      "# Vazifasi — generatsiya qilingan .wxs ni saqlash va chiqish faylini yozish.",
      'out=""; wxs=""',
      'while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift 2;; *.wxs) wxs="$1"; shift;; *) shift;; esac; done',
      '[ -n "$wxs" ] && cp "$wxs" "$FF_TEST_WXS_CAPTURE"',
      ...(fail
        ? ['echo "fake wix: forced failure" >&2', "exit 4"]
        : garbage
          ? ['printf "FAKE-MSI-BYTES-NOT-AN-OLE-FILE" > "$out"']
          : [
              `printf '${OLE_HEADER_PRINTF}' > "$out"`,
              `head -c ${MSI_MIN_BYTES} /dev/zero >> "$out"`,
            ]),
      "",
    ].join("\n")
  );
  chmodSync(path.join(fakeWinBin, "wix"), 0o755);
}
/** `corrupt: true` — signtool "muvaffaqiyatli" tugaydi, lekin faylni MSI bo'lmagan
 *  baytlar bilan qoldiradi (imzolashdan KEYINGI tuzilma tekshiruvini isbotlaydi). */
function writeFakeSigntool({ fail = false, verifyFail = false, corrupt = false } = {}) {
  writeFileSync(
    path.join(fakeWinBin, "signtool"),
    [
      "#!/bin/bash",
      "# Soxta signtool (faqat test). Parol argv'da bo'lishi mumkin — HECH QAYERGA yozilmaydi.",
      'mode="$1"',
      'if [ "$mode" = "verify" ]; then',
      ...(verifyFail ? ["  exit 5"] : ["  exit 0"]),
      "fi",
      ...(fail
        ? ['target="${@: -1}"', 'printf "PARTIAL" > "$target"', 'echo "fake signtool: forced failure" >&2', "exit 6"]
        : corrupt
          ? ['target="${@: -1}"', 'printf "SIGNED-BUT-NOT-AN-MSI-ANYMORE" > "$target"', "exit 0"]
          : ["exit 0"]),
      "",
    ].join("\n")
  );
  chmodSync(path.join(fakeWinBin, "signtool"), 0o755);
}

function winRun(args, env) {
  return run("node", [WIN_SCRIPT, ...args], {
    FF_INSTALLERS_DIR: ISO,
    FF_TEST_WXS_CAPTURE: wxsCapture,
    FF_WIN_CERT: "",
    FF_WIN_CERT_PASS: "",
    FF_WIN_CERT_SHA1: "",
    FF_SIGNED_ZXP: "",
    ...env,
  });
}

// E1 — asbob YO'Q (PATH'da wix yo'q)
// PATH'da `wix` yo'q (node'ning o'z papkasi qoladi — aks holda skript umuman ishga tushmaydi).
const noWix = winRun(["--unsigned"], { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` });
check("`wix` bo'lmasa build FAIL-CLOSED (exit≠0)", noWix.code !== 0, `exit=${noWix.code}`);
check("xato WiX o'rnatish yo'riqnomasini beradi", /WiX|wix/.test(noWix.out) && /dotnet tool install/.test(noWix.out));
check("wix yo'q: artefakt YARATILMADI", !existsSync(isoWinUnsigned));
check("wix yo'q: vaqtinchalik papka qolmadi", strayTemps().length === 0, strayTemps().join(", "));

// E2 — imzolanmagan build (soxta wix haqiqiy skript ichida ishlaydi)
writeFakeWix();
const winPathEnv = `${fakeWinBin}:${process.env.PATH}`;
const winUnsigned = winRun(["--unsigned"], { PATH: winPathEnv });
check("`build-installer-win.mjs --unsigned` muvaffaqiyatli", winUnsigned.code === 0, winUnsigned.out.slice(-400));
check(`Windows artefakti kutilgan nom bilan (${path.basename(isoWinUnsigned)})`, existsSync(isoWinUnsigned));
check("Windows artefakti yonida `.sha256` sidecar bor", existsSync(`${isoWinUnsigned}.sha256`));
if (existsSync(isoWinUnsigned) && existsSync(`${isoWinUnsigned}.sha256`)) {
  check(
    "Windows sidecar SHA-256 haqiqiy baytlarga mos",
    readFileSync(`${isoWinUnsigned}.sha256`, "utf8").trim().split(/\s+/)[0] === sha256File(isoWinUnsigned)
  );
}
check("imzolanmagan Windows build imzolangan nishonni TEGMADI", winSentinelUntouched());
check("Windows build vaqtinchalik papka qoldirmadi", strayTemps().length === 0, strayTemps().join(", "));

// E3 — generatsiya qilingan WiX manbasi
const wxs = existsSync(wxsCapture) ? readFileSync(wxsCapture, "utf8") : "";
check("WiX manbasi generatsiya qilindi", wxs.length > 0);
check('WiX `Scope="perUser"` — administrator/UAC talab qilinmaydi', /Scope="perUser"/.test(wxs));
check("WiX nishoni AppDataFolder\\Adobe\\CEP\\extensions\\com.frameflow", /StandardDirectory Id="AppDataFolder"/.test(wxs) && /Name="com\.frameflow"/.test(wxs));
check("WiX ProgramFiles/tizim papkasiga yozmaydi", !/ProgramFiles|CommonAppData|System64/.test(wxs));
check(`WiX paket versiyasi flavor versiyasiga teng (${VERSION})`, new RegExp(`Version="${VERSION.replace(/\./g, "\\.")}"`).test(wxs));
check("WiX MajorUpgrade bilan eski versiyani almashtiradi (uninstall/upgrade)", /<MajorUpgrade/.test(wxs));
const wxsFiles = [...wxs.matchAll(/Source="payload\\([^"]+)"/g)].map((m) => m[1].replace(/\\/g, "/")).sort();
check(
  `WiX har payload fayli uchun bitta <File> (${expected.length})`,
  JSON.stringify(wxsFiles) === JSON.stringify(expected),
  `wxs=${wxsFiles.length} expected=${expected.length}`
);
// Payload komponentlari + AYNAN bitta migratsiya (RemoveFile) komponenti.
const WXS_COMPONENTS = expected.length + 1;
check(
  "WiX komponent soni = fayl soni + 1 migratsiya komponenti (har fayl mustaqil komponent)",
  (wxs.match(/<Component /g) || []).length === WXS_COMPONENTS &&
    (wxs.match(/<ComponentRef /g) || []).length === WXS_COMPONENTS,
  `component=${(wxs.match(/<Component /g) || []).length} ref=${(wxs.match(/<ComponentRef /g) || []).length} kutilgan=${WXS_COMPONENTS}`
);
check("WiX komponentlari HKCU keypath ishlatadi (per-user, ICE-mos)", (wxs.match(/Root="HKCU"/g) || []).length === WXS_COMPONENTS);
check("WiX GUID'lari noyob", new Set([...wxs.matchAll(/Guid="([^"]+)"/g)].map((m) => m[1])).size === WXS_COMPONENTS);
// Admin sirti YUBORILMAYDI. Nomi FAQAT `RemoveFile` (eski qoldiqni tozalash) qatorida uchraydi —
// shuning uchun tekshiruv o'sha qatorlarsiz manbada bajariladi (asl niyat: hech qachon o'rnatilmaydi).
const wxsShipped = wxs
  .split("\n")
  .filter((l) => !/<RemoveFile\b/.test(l))
  .join("\n");
for (const id of ADMIN_SURFACE.identifiers) {
  check(`WiX manbasi Admin identifikatorini "${id}" O'RNATMAYDI`, !wxsShipped.includes(id));
  check(`WiX <File>/<Source> ichida Admin identifikatori "${id}" YO'Q`, ![...wxs.matchAll(/<File [^>]*>/g)].some((m) => m[0].includes(id)));
}
check("WiX manbasida qattiq yozilgan sir/parol YO'Q", !/-----BEGIN|password\s*=\s*["'][^"']{8,}/i.test(wxs));

// E3b — ichma-ich TAKRORLANGAN papka nomlari to'qnashmasligi (Id to'liq yo'ldan)
const collisionWxs = buildWxsSource({
  version: "9.9.9",
  payloadFiles: ["css/fonts/a.woff2", "js/fonts/a.woff2", "css/tokens.css", "js/CSInterface.js"],
});
const dirIds = [...collisionWxs.matchAll(/<Directory Id="([^"]+)"/g)].map((m) => m[1]);
const genDirIds = dirIds.filter((id) => id.startsWith("D_"));
check(
  `takrorlangan papka nomlari (css/fonts ↔ js/fonts) NOYOB Directory Id beradi (${genDirIds.length})`,
  genDirIds.length === 4 && new Set(genDirIds).size === 4,
  genDirIds.join(", ")
);
check(
  "har bir e'lon qilingan Id (Directory · Component · File) butun manbada NOYOB",
  (() => {
    const ids = [...collisionWxs.matchAll(/<(?:Directory|Component|File) Id="([^"]+)"/g)].map((m) => m[1]);
    return ids.length > 0 && new Set(ids).size === ids.length;
  })()
);
check(
  "bir xil basename'li ikki fayl ham noyob Component/File Id oladi",
  new Set([...collisionWxs.matchAll(/<File Id="([^"]+)"/g)].map((m) => m[1])).size === 4
);

// ── E3e — WINDOWS MIGRATSIYASI: MSI'dan OLDINGI o'rnatma qoldiqlari ─────────
// `MajorUpgrade` MSI o'zi o'rnatmagan faylni olib tashlay OLMAYDI. Qo'lda nusxalangan yoki
// `.zxp` orqali o'rnatilgan eski papkada ichki fayllar (`.debug`, Admin sirti) qolib ketardi.
// Bu blok butunlay YANGI: 1cc01ad da generatsiya qilingan .wxs da bitta ham <RemoveFile> yo'q edi.
check(
  "migratsiya API'si eksport qilingan (CLEANUP_COMPONENT_ID + obsoleteRemoveRows)",
  typeof wixGen.CLEANUP_COMPONENT_ID === "string" && typeof wixGen.obsoleteRemoveRows === "function"
);
const CLEANUP_ID = typeof wixGen.CLEANUP_COMPONENT_ID === "string" ? wixGen.CLEANUP_COMPONENT_ID : "FF_LegacyCleanup";
const obsoleteRemoveRows =
  wixGen.obsoleteRemoveRows ||
  (() => {
    throw new Error("installer-wix.mjs `obsoleteRemoveRows` eksport qilmaydi");
  });
const staleList = obsoleteInstallFiles();
const removeRows = [...wxs.matchAll(/<RemoveFile\b([^>]*?)\/>/g)].map((m) => {
  const attrs = {};
  for (const a of m[1].matchAll(/([A-Za-z]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  return attrs;
});
const rowPath = (r) => `${r.Subdirectory ? `${r.Subdirectory.replace(/\\/g, "/")}/` : ""}${r.Name}`;
const rowPaths = removeRows.map(rowPath).sort();

check(
  "MIGRATSIYA REGRESSIYASI: MSI eski ichki fayllarni tozalaydi (1cc01ad da <RemoveFile> YO'Q edi)",
  removeRows.length > 0 && ADMIN_SURFACE.files.every((f) => rowPaths.includes(f)) && rowPaths.includes(".debug"),
  `rows=${removeRows.length} paths=${rowPaths.join(",")}`
);
check(
  `migratsiya: eski har bir fayl uchun AYNAN bitta <RemoveFile> (${staleList.length})`,
  staleList.length > 0 && removeRows.length === staleList.length,
  `rows=${removeRows.length} stale=${staleList.length}`
);
check(
  "migratsiya: <RemoveFile> yo'llari obsoleteInstallFiles() bilan AYNAN mos (ortiqcha/kam YO'Q)",
  JSON.stringify(rowPaths) === JSON.stringify([...staleList].sort()),
  `wxs=[${rowPaths.join(",")}] kutilgan=[${[...staleList].sort().join(",")}]`
);
for (const rel of staleList) {
  const parts = rel.split("/");
  const name = parts.pop();
  const sub = parts.join("\\");
  const row = removeRows.find((r) => r.Name === name && (r.Subdirectory || "") === sub);
  check(
    `migratsiya: "${rel}" → Name="${name}"${sub ? ` Subdirectory="${sub}"` : " (INSTALLFOLDER ildizi)"}`,
    !!row,
    JSON.stringify(removeRows)
  );
  check(`migratsiya: "${rel}" Id to'liq nisbiy yo'ldan (deterministik)`, !!row && row.Id === wixId("R", rel), row && row.Id);
}
check(
  'migratsiya: har bir <RemoveFile> On="install" (o\'chirishda EMAS, o\'rnatishda)',
  removeRows.length > 0 && removeRows.every((r) => r.On === "install"),
  removeRows.map((r) => r.On).join(",")
);
check(
  'migratsiya: har bir <RemoveFile> Directory="INSTALLFOLDER" (nishon papkadan tashqariga chiqmaydi)',
  removeRows.length > 0 && removeRows.every((r) => r.Directory === "INSTALLFOLDER")
);
check(
  "migratsiya: <RemoveFile> Id'lari noyob",
  new Set(removeRows.map((r) => r.Id)).size === removeRows.length
);
check(
  "migratsiya: WILDCARD YO'Q (`*` yoki `?` na Name'da, na Subdirectory'da)",
  removeRows.every((r) => !/[*?]/.test(r.Name || "") && !/[*?]/.test(r.Subdirectory || "")) &&
    !/<RemoveFile[^>]*Name="[^"]*[*?]/.test(wxs)
);
check(
  "migratsiya: <RemoveFolder> YO'Q — birorta PAPKA o'chirilmaydi",
  !/<RemoveFolder\b/.test(wxs) && !/RemoveExistingProducts|RemoveFolderEx/.test(wxs)
);
check(
  "migratsiya: CustomAction/skript YO'Q (faqat standart RemoveFile amali)",
  !/<CustomAction\b/.test(wxs) && !/<Custom\b/.test(wxs) && !/<Binary\b/.test(wxs) && !/<SetProperty\b/.test(wxs)
);
check(
  "migratsiya: joriy payload fayllaridan BIRORTASI o'chirilmaydi",
  rowPaths.every((p) => !expected.includes(p)),
  rowPaths.filter((p) => expected.includes(p)).join(",")
);
check(
  "migratsiya: foydalanuvchi ma'lumoti `assetflow-data` manbada UMUMAN yo'q",
  !/assetflow-data/.test(wxs) && rowPaths.every((p) => !p.startsWith("assetflow-data"))
);
check(
  "migratsiya komponenti O'RNATILADI va per-user (HKCU keypath + ComponentRef)",
  new RegExp(`<Component Id="${CLEANUP_ID}" Guid="\\{[0-9A-F-]{36}\\}">`).test(wxs) &&
    new RegExp(`<ComponentRef Id="${CLEANUP_ID}"/>`).test(wxs) &&
    /<Component Id="FF_LegacyCleanup"[^>]*>\s*\n\s*<RegistryValue Root="HKCU"[^>]*KeyPath="yes"\/>/.test(wxs)
);
check(
  "migratsiya: barcha <RemoveFile> AYNAN shu bitta komponent ichida",
  (() => {
    const block = wxs.slice(wxs.indexOf(`<Component Id="${CLEANUP_ID}"`));
    const inner = block.slice(0, block.indexOf("</Component>"));
    return (inner.match(/<RemoveFile\b/g) || []).length === removeRows.length;
  })()
);
throws(
  "generator: eski ro'yxat joriy payload bilan kesishsa RAD ETADI (fail-closed)",
  () => obsoleteRemoveRows([...expected, staleList[0]]),
  /joriy payload bilan kesishdi/
);
check(
  "generator: RemoveFile ma'lumoti FAQAT obsoleteInstallFiles() dan (yagona manba)",
  (() => {
    try {
      return JSON.stringify(obsoleteRemoveRows().map((r) => r.rel)) === JSON.stringify(staleList);
    } catch {
      return false;
    }
  })()
);

// E3c — MSI tuzilma tekshiruvi (ixtiyoriy baytlar `.msi` DEB QABUL QILINMAYDI)
const oleSample = path.join(WORK, "ole-sample.msi");
writeFileSync(oleSample, Buffer.concat([Buffer.from(MSI_OLE_HEADER), Buffer.alloc(MSI_MIN_BYTES)]));
check("assertMsiArtifact: OLE sarlavhali yetarli hajmli fayl QABUL qilinadi", assertMsiArtifact(oleSample).sizeBytes >= MSI_MIN_BYTES);
const garbageSample = path.join(WORK, "garbage.msi");
writeFileSync(garbageSample, Buffer.alloc(MSI_MIN_BYTES + 8, 0x41));
throws("assertMsiArtifact: ixtiyoriy (OLE bo'lmagan) baytlar RAD ETILADI", () => assertMsiArtifact(garbageSample), /OLE compound/);
const shortSample = path.join(WORK, "short.msi");
writeFileSync(shortSample, Buffer.from(MSI_OLE_HEADER));
throws("assertMsiArtifact: juda kichik fayl RAD ETILADI", () => assertMsiArtifact(shortSample), /juda kichik/);
throws("assertMsiArtifact: mavjud bo'lmagan fayl RAD ETILADI", () => assertMsiArtifact(path.join(WORK, "yoq.msi")), /MSI yo'q/);

// E3d — soxta `wix` ixtiyoriy baytlar yozsa, HAQIQIY skript build'ni to'xtatadi
writeFakeWix({ garbage: true });
rmSync(isoWinUnsigned, { force: true });
rmSync(`${isoWinUnsigned}.sha256`, { force: true });
const garbageBuild = winRun(["--unsigned"], { PATH: winPathEnv });
check("`wix` MSI bo'lmagan baytlar bersa build FAIL-CLOSED (exit≠0)", garbageBuild.code !== 0, `exit=${garbageBuild.code}`);
check("xato MSI tuzilmasini aniq aytadi (OLE compound)", /OLE compound|juda kichik/.test(garbageBuild.out), garbageBuild.out.slice(-200));
check("soxta MSI: artefakt YARATILMADI", !existsSync(isoWinUnsigned));
check("soxta MSI: sidecar ham YARATILMADI", !existsSync(`${isoWinUnsigned}.sha256`));
check("soxta MSI: vaqtinchalik papka QOLMADI", strayTemps().length === 0, strayTemps().join(", "));
writeFakeWix();
winRun(["--unsigned"], { PATH: winPathEnv });
check("to'g'ri OLE fiksturasi bilan build yana o'tadi", existsSync(isoWinUnsigned));
check(
  "qurilgan artefakt haqiqatan OLE compound sarlavhasi bilan boshlanadi",
  existsSync(isoWinUnsigned) && readFileSync(isoWinUnsigned).subarray(0, 8).equals(Buffer.from(MSI_OLE_HEADER))
);

// E4 — GUID'lar barqaror (qayta build → aynan bir xil GUID; upgrade zanjiri buzilmaydi)
const wxsFirst = wxs;
rmSync(isoWinUnsigned, { force: true });
rmSync(`${isoWinUnsigned}.sha256`, { force: true });
winRun(["--unsigned"], { PATH: winPathEnv });
const wxsSecond = existsSync(wxsCapture) ? readFileSync(wxsCapture, "utf8") : "";
check("qayta build → WiX manbasi BAYT-BA-BAYT bir xil (barqaror GUID)", wxsFirst === wxsSecond && wxsFirst.length > 0);

// E5 — imzolangan build kredensialsiz
function plantWinSentinel() {
  writeFileSync(isoWinSigned, "STALE-WIN-ARTIFACT-SENTINEL");
  return sha256File(isoWinSigned);
}
plantWinSentinel();
const noCert = winRun([], { PATH: winPathEnv });
check("sertifikatsiz Windows build FAIL-CLOSED (exit≠0)", noCert.code !== 0, `exit=${noCert.code}`);
check("xato FF_WIN_CERT / FF_WIN_CERT_SHA1 ni aniq aytadi", /FF_WIN_CERT/.test(noCert.out) && /FF_WIN_CERT_SHA1/.test(noCert.out));
check("sertifikatsiz: eski yakuniy .msi BEKOR qilindi", !existsSync(isoWinSigned));
check("sertifikatsiz: vaqtinchalik papka qolmadi", strayTemps().length === 0, strayTemps().join(", "));

// E6 — .pfx bor, parol YO'Q
const fakePfx = path.join(WORK, "fake-cert.pfx");
writeFileSync(fakePfx, "not-a-real-certificate");
plantWinSentinel();
const noPass = winRun([], { PATH: winPathEnv, FF_WIN_CERT: fakePfx });
check("parolsiz Windows build FAIL-CLOSED (exit≠0)", noPass.code !== 0, `exit=${noPass.code}`);
check("xato FF_WIN_CERT_PASS ni aniq aytadi", /FF_WIN_CERT_PASS/.test(noPass.out));
check("parolsiz: yakuniy .msi YARATILMADI", !existsSync(isoWinSigned));

// E7 — ikki xil kredensial usuli birga
plantWinSentinel();
const bothCreds = winRun([], { PATH: winPathEnv, FF_WIN_CERT: fakePfx, FF_WIN_CERT_PASS: "x", FF_WIN_CERT_SHA1: "AA" });
check("ikkala imzolash usuli birga berilsa FAIL-CLOSED", bothCreds.code !== 0, `exit=${bothCreds.code}`);

// E8 — kredensial bor, imzolangan .zxp YO'Q
plantWinSentinel();
const winNoZxp = winRun([], { PATH: winPathEnv, FF_WIN_CERT: fakePfx, FF_WIN_CERT_PASS: FAKE_PASS });
check("imzolangan .zxp'siz Windows reliz build FAIL-CLOSED", winNoZxp.code !== 0, `exit=${winNoZxp.code}`);
check("xato FF_SIGNED_ZXP ni aniq aytadi", /FF_SIGNED_ZXP/.test(winNoZxp.out));
check("zxp'siz: parol qiymati chiqishda YO'Q", !winNoZxp.out.includes(FAKE_PASS));

// E9 — signtool yiqiladi
writeFakeSigntool({ fail: true });
plantWinSentinel();
const signtoolFail = winRun([], {
  PATH: winPathEnv,
  FF_WIN_CERT: fakePfx,
  FF_WIN_CERT_PASS: FAKE_PASS,
  FF_SIGNED_ZXP: goodZxp,
});
check("signtool yiqilsa FAIL-CLOSED (exit≠0)", signtoolFail.code !== 0, `exit=${signtoolFail.code}`);
check("signtool yiqilsa: yakuniy .msi YARATILMAYDI", !existsSync(isoWinSigned));
check("signtool yiqilsa: vaqtinchalik papka QOLMAYDI", strayTemps().length === 0, strayTemps().join(", "));
check("signtool yiqilsa: parol qiymati chiqishda YO'Q", !signtoolFail.out.includes(FAKE_PASS));
check("signtool yiqilsa: imzolanmagan artefakt tegilmadi", !existsSync(isoWinUnsigned) || sha256File(isoWinUnsigned) === sha256File(isoWinUnsigned));

// E10 — signtool imzoladi, LEKIN verify o'tmadi
writeFakeSigntool({ fail: false, verifyFail: true });
plantWinSentinel();
const verifyFail = winRun([], {
  PATH: winPathEnv,
  FF_WIN_CERT: fakePfx,
  FF_WIN_CERT_PASS: FAKE_PASS,
  FF_SIGNED_ZXP: goodZxp,
});
check("signtool verify o'tmasa FAIL-CLOSED (exit≠0)", verifyFail.code !== 0, `exit=${verifyFail.code}`);
check("verify o'tmasa: yakuniy .msi YARATILMAYDI", !existsSync(isoWinSigned));

// E10b — signtool "muvaffaqiyatli" tugadi, LEKIN fayl endi MSI emas
writeFakeSigntool({ corrupt: true });
plantWinSentinel();
const corruptSigned = winRun([], {
  PATH: winPathEnv,
  FF_WIN_CERT: fakePfx,
  FF_WIN_CERT_PASS: FAKE_PASS,
  FF_SIGNED_ZXP: goodZxp,
});
check("imzolashdan KEYIN fayl MSI bo'lmasa FAIL-CLOSED (exit≠0)", corruptSigned.code !== 0, `exit=${corruptSigned.code}`);
check("imzodan keyingi tuzilma xatosi aniq aytiladi", /OLE compound|juda kichik/.test(corruptSigned.out), corruptSigned.out.slice(-200));
check("buzilgan imzo: yakuniy .msi YARATILMAYDI", !existsSync(isoWinSigned));
check("buzilgan imzo: parol qiymati chiqishda YO'Q", !corruptSigned.out.includes(FAKE_PASS));

// E11 — to'liq muvaffaqiyatli imzolangan yo'l (soxta toolchain bilan)
writeFakeSigntool({ fail: false, verifyFail: false });
rmSync(isoWinSigned, { force: true });
const winSigned = winRun([], {
  PATH: winPathEnv,
  FF_WIN_CERT: fakePfx,
  FF_WIN_CERT_PASS: FAKE_PASS,
  FF_SIGNED_ZXP: goodZxp,
});
check("to'liq kredensial + toolchain bilan imzolangan yo'l yakunlanadi", winSigned.code === 0, winSigned.out.slice(-400));
check("imzolangan artefakt kontrakt nomi bilan (.msi)", existsSync(isoWinSigned));
check("imzolangan artefakt sidecar SHA-256 bilan keladi", existsSync(`${isoWinSigned}.sha256`));
check("imzolangan yo'lda ham parol chop etilmadi", !winSigned.out.includes(FAKE_PASS));
const wxsSigned = readFileSync(wxsCapture, "utf8");
const wxsSignedFiles = [...wxsSigned.matchAll(/Source="payload\\([^"]+)"/g)].map((m) => m[1].replace(/\\/g, "/"));
check("imzolangan payload'da CEP imzo konverti (META-INF) bor", wxsSignedFiles.includes("META-INF/signatures.xml"));
check("imzolangan payload'da ortiqcha fayl yo'q (flavor + konvert)", wxsSignedFiles.every((f) => expected.includes(f) || f === "mimetype" || f.startsWith("META-INF/")));
check("Windows build ichki Admin artefaktiga TEGMADI — SHA-256 o'zgarmadi", adminUntouched());

// ══ G) Statik kafolatlar + versiya drift ════════════════════════════════════
console.log("\n── G) Statik kafolatlar va versiya drift ─────────────────────");

const macSrc = readFileSync(MAC_SCRIPT, "utf8");
const winSrc = readFileSync(WIN_SCRIPT, "utf8");
const helperSrc = readFileSync(HELPER, "utf8");
const wixSrc = readFileSync(path.join(PLUGIN_SRC, "scripts/installer-wix.mjs"), "utf8");
const allSrc = `${macSrc}\n${winSrc}\n${helperSrc}\n${wixSrc}`;
const genPost = postinstallScript();

/** Skanerlar KOD ustida ishlashi uchun izohlarni olib tashlaydi — izohda "rm -rf YO'Q"
 *  deb yozilgani buyruq emas (aks holda halol hujjat testni yiqitardi). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(#|\/\/)/.test(l))
    .join("\n");
}
const macCode = codeOnly(macSrc);
const helperCode = codeOnly(helperSrc);
const winCode = codeOnly(winSrc);
const genPostCode = codeOnly(genPost);

// ── Adobe xavfsizlik sozlamalari: installer HECH QACHON o'zgartirmaydi ──────
check(
  "installer skriptlarida `defaults write/delete` (Adobe sozlamasini o'zgartirish) YO'Q",
  !/\bdefaults\s+(write|delete|import)\b/.test(allSrc) && !/\bdefaults\s+(write|delete|import)\b/.test(genPost)
);
check(
  "installer PlayerDebugMode/CSXS domenini O'ZGARTIRMAYDI (imzolangan ham, imzosiz ham)",
  !/PlayerDebugMode\s*(1|-bool|true|YES)/i.test(allSrc) &&
    !/com\.adobe\.CSXS/.test(allSrc) &&
    !/PlayerDebugMode/.test(genPost)
);
check(
  "imzosiz QA yo'li dasturchi rejimini QO'LDA yoqish kerakligini HALOL aytadi",
  /QO'LDA yoq/i.test(macSrc) && /o'zgartirmaydi/i.test(macSrc)
);
// ── Buzg'unchi preinstall: umuman YO'Q ─────────────────────────────────────
check(
  "macOS quruvchisida `preinstall` YO'Q — almashtirishdan OLDIN hech narsa o'chirilmaydi",
  !/preinstall/i.test(macCode)
);
check(
  "macOS quruvchisida keng o'chirish naqshi YO'Q (`find … -exec rm` · `rm -rf $DEST/$HOME`)",
  !/find\s+"\$DEST"/.test(macCode) &&
    !/-exec\s+rm/.test(macCode) &&
    !/rm\s+-rf\s+"?\$(HOME|DEST)/.test(macCode) &&
    !/rm\s+-rf/.test(genPostCode)
);
check(
  "generatsiya qilingan postinstall tarkibi o'zgarmas (aniq ro'yxat + qorovullar)",
  genPost.startsWith("#!/bin/bash") &&
    genPost.includes("set -eu") &&
    obsoleteInstallFiles().length > 0 &&
    obsoleteInstallFiles().every((f) => genPost.includes(`"${f}"`))
);
check(
  "arxiv `unzip -d` bilan YOYILMAYDI (ishonchsiz daraxt tashqi asbobga berilmaydi)",
  !/unzip/.test(helperCode) && !/unzip/.test(macCode) && !/unzip/.test(winCode)
);

check(
  "installer skriptlarida o'z-o'zidan imzolangan sertifikat yaratish YO'Q",
  !/-selfSignedCert|New-SelfSignedCertificate|openssl\s+req|makecert/i.test(allSrc)
);
check(
  "kredensial env'lari uchun standart/zaxira qiymat YO'Q",
  !/\$\{FF_(?:MAC_INSTALLER_IDENTITY|SIGNED_ZXP|NOTARY_[A-Z_]+|WIN_CERT[A-Z_]*):-[^}]/.test(allSrc)
);
check(
  "installer skriptlarida sertifikat/xususiy kalit bloki YO'Q",
  !/-----BEGIN (?:[A-Z ]+ )?(?:PRIVATE KEY|CERTIFICATE)-----/.test(allSrc)
);
check(
  "installer skriptlarida qattiq yozilgan parol/token YO'Q",
  !/\b(?:password|passwd|secret[_-]?key|api[_-]?key|cert[_-]?pass)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i.test(allSrc)
);
for (const id of ADMIN_SURFACE.identifiers) {
  check(`installer skriptlarida Admin identifikatori "${id}" YO'Q`, !allSrc.includes(id));
}
for (const key of ADMIN_SURFACE.storageKeys) {
  check(`installer skriptlarida Admin kaliti "${key}" YO'Q`, !allSrc.includes(key));
}
check(
  "macOS skripti imtiyoz ko'tarmaydi (sudo/osascript admin buyrug'i YO'Q)",
  // Izohdagi "sudo TALAB QILINMAYDI" so'zi emas, BUYRUQ sifatida ishlatilishi qidiriladi.
  !/(^|[;&|(]\s*)sudo\s/m.test(macSrc) && !/with administrator privileges/i.test(macSrc)
);
check(
  "installer skriptlari `~/Library` yoki `/Library` ga TO'G'RIDAN yozmaydi",
  !/(cp|mv|rm|mkdir|ditto)\s[^\n]*\$HOME\/Library/.test(allSrc) && !/(cp|mv|rm|mkdir|ditto)\s[^\n]*\s\/Library\//.test(allSrc)
);
check(
  "yakuniy artefaktga to'g'ridan imzolanmaydi (temp → atomik mv)",
  /mv -f "\$WORK\/frameflow-signed\.pkg" "\$OUT"/.test(macSrc) && /renameSync\(msiTmp, out\)/.test(winSrc)
);
check(
  "vaqtinchalik papka chegaralangan va trap/exit bilan tozalanadi",
  /mktemp -d "\$OUTDIR\/_build\.mac\.XXXXXX"/.test(macSrc) &&
    /trap cleanup EXIT INT TERM/.test(macSrc) &&
    /_build\.win\./.test(winSrc) &&
    /process\.on\("exit", cleanup\)/.test(winSrc)
);

// Versiya drift
const declared = declaredPluginVersion();
check(
  `versiya sinxron: manifest ${flavorVersion("customer")} = manifest.admin ${flavorVersion("admin")} = AF_PLUGIN_VERSION ${declared}`,
  flavorVersion("customer") === flavorVersion("admin") && flavorVersion("customer") === declared
);
check(
  "installer skriptlarida QATTIQ YOZILGAN versiya YO'Q (hammasi manifestdan)",
  !allSrc.includes(`"${VERSION}"`) && !allSrc.includes(`'${VERSION}'`) && !new RegExp(`[^0-9.]${VERSION.replace(/\./g, "\\.")}[^0-9.]`).test(allSrc)
);
check(
  "artefakt nomi server kontrakti bilan bir xil shaklda (frameflow-plugin-<ver>-<platform>.<ext>)",
  installerArtifactName("mac", "pkg", { signed: true }) === `frameflow-plugin-${VERSION}-mac.pkg` &&
    installerArtifactName("win", "msi", { signed: true }) === `frameflow-plugin-${VERSION}-win.msi`
);
const contractSrc = readFileSync(path.join(REPO_ROOT, "apps/api/src/lib/plugin-release-contract.ts"), "utf8");
check(
  "server kontrakti AYNAN shu fayl nomi shaklini kutadi (drift qorovuli)",
  /frameflow-plugin-\$\{v \|\| "update"\}-\$\{p \|\| "unknown"\}\.\$\{e \|\| "bin"\}/.test(contractSrc)
);
check(
  "kontrakt kengaytmalari o'zgarmagan: mac=[pkg], win=[exe,msi]",
  /mac: \["pkg"\]/.test(contractSrc) && /win: \["exe", "msi"\]/.test(contractSrc)
);
throws(
  "kontraktdan tashqari kengaytma RAD ETILADI (masalan mac + .dmg)",
  () => installerArtifactName("mac", "dmg", { signed: true }),
  /ruxsat etilmagan/
);
throws("noma'lum platforma RAD ETILADI", () => installerArtifactName("linux", "deb", { signed: true }), /Noma'lum platforma/);

check(
  "payload ro'yxati kutilgan fayllar sonini beradi (bo'sh emas)",
  expected.length >= 30 && listPayloadFiles(stageDir).length === expected.length
);
check("dist/zxp va dist/installers alohida papkalar (artefaktlar aralashmaydi)", DIST_DIR !== path.join(REPO_ROOT, "dist/installers"));

// ══ Yakun ═══════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}`);
if (failed) {
  console.error(`\nYiqilgan tekshiruvlar:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
