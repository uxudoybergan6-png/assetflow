// PAKET XAVFSIZLIK REGRESSIYA TESTI — HAQIQIY qurilgan arxivlarga qarshi ishlaydi
// (xotiradagi mock obyekt EMAS): ikkala flavor `build-zxp.sh --unsigned` bilan quriladi,
// so'ng zip ichidagi bayt-tarkib tekshiriladi.
//
// Nima kafolatlanadi:
//   1. Har arxivda AYNAN BITTA kutilgan extension ID (ExtensionList + DispatchInfo mos).
//   2. Manifest MainPath/ScriptPath + HTML/CSS lokal referenslari hammasi arxivda bor
//      (verify-zxp-package.mjs mantiqidan foydalanadi — nusxa ko'chirilmagan).
//   3. MIJOZ arxivida Admin sirti YO'Q: fayl, ID, Admin UI matni, Admin localStorage kalitlari.
//   4. HECH BIR manifestда --disable-web-security YO'Q.
//   5. Paketlangan matn fayllarida ochiq maxfiy kalit naqshlari YO'Q (faqat FAYL NOMI
//      chop etiladi — topilgan qiymat HECH QACHON log qilinmaydi).
//   6. Versiya sinxron: manifest ↔ manifest.admin ↔ window.AF_PLUGIN_VERSION.
//   7. Imzolash FAIL-CLOSED — HAQIQIY build ishga tushiriladi: sertifikatsiz · parolsiz ·
//      imzolash buyrug'i yiqilganda (PATH'ga qo'yilgan soxta ZXPSignCmd qisman bayt yozib,
//      nolga teng bo'lmagan kod bilan tugaydi). Har safar yakuniy .zxp o'rniga "nishon" fayl
//      qo'yiladi va u O'CHIRILGANI tasdiqlanadi; temp qolmaydi; parol chiqishda uchramaydi.
//   8. NEGATIV fikstura: mutatsiya qilingan arxivlar (Admin fayli / Admin ID / taqiqlangan
//      bayroq / soxta kalit bloki qo'shilgan) tekshiruvlar HAQIQATAN yiqilishini isbotlaydi.
//
// XAVFSIZLIK: test imzolangan artefakt yo'llariga vaqtinchalik nishon yozadi. Agar u yerda
// HAQIQIY reliz tursa — test hech narsaga tegmasdan TO'XTAYDI (pastdagi "XAVFSIZLIK DARVOZASI").
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-package-security.mjs

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  rmSync,
  copyFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FLAVORS,
  ADMIN_SURFACE,
  FORBIDDEN_CEF_FLAGS,
  PLUGIN_SRC,
  DIST_DIR,
  artifactPath,
  flavorVersion,
  declaredPluginVersion,
  resolveFlavorFiles,
} from "./package-flavors.mjs";
import {
  listEntries,
  readEntry,
  extractAll,
  verifyArchiveReferences,
} from "./verify-zxp-package.mjs";

let passed = 0;
let failed = 0;
const failures = [];

// ── Ishonchli tozalash — test qanday tugashidan qat'i nazar (assert, throw, Ctrl+C) ──
// Ro'yxatdagi har bir yo'l process EXIT'da o'chiriladi, shu jumladan test yaratgan
// soxta "yakuniy" .zxp nishonlari ham (ular real reliz deb chalg'itmasin).
const CLEANUP_PATHS = new Set();
function trackForCleanup(p) {
  CLEANUP_PATHS.add(p);
  return p;
}
function runCleanup() {
  for (const p of CLEANUP_PATHS) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      /* tozalash hech qachon testni yiqitmaydi */
    }
  }
  CLEANUP_PATHS.clear();
}
process.on("exit", runCleanup);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    runCleanup();
    process.exit(130);
  });
}

// ── XAVFSIZLIK DARVOZASI (birinchi bo'lib bajariladi) ────────────────────────
// Bu test imzolash nosozliklarini isbotlash uchun IMZOLANGAN artefakt yo'llariga soxta
// "nishon" fayl yozadi va keyin o'chiradi. Agar u yerda HAQIQIY reliz tursa — test uni
// yo'q qilardi. Shuning uchun: HAR QANDAY yozuv/tozalash ro'yxatiga qo'shishdan OLDIN
// ikkala yo'l tekshiriladi va mavjud fayl bo'lsa test UMUMAN ishga tushmaydi.
// Mavjud artefakt o'chirilmaydi, nomi o'zgartirilmaydi, huquqi/hajmi o'zgartirilmaydi,
// tarkibi o'qilmaydi va log qilinmaydi — faqat mavjudligi tekshiriladi.
const SIGNED_PATHS = {
  customer: artifactPath("customer", { signed: true }),
  admin: artifactPath("admin", { signed: true }),
};
for (const [flavorKey, signedPath] of Object.entries(SIGNED_PATHS)) {
  if (!existsSync(signedPath)) continue;
  console.error(
    [
      `✗ TO'XTATILDI — test mavjud IMZOLANGAN reliz artefaktiga TEGISHDAN BOSH TORTDI (${flavorKey}):`,
      `    ${signedPath}`,
      "",
      "  Bu test imzolash fail-closed xatti-harakatini isbotlash uchun shu yo'lga vaqtinchalik",
      "  soxta fayl yozib, keyin uni o'chiradi — haqiqiy relizni yo'q qilib yubormasligi uchun",
      "  hech narsa qilmasdan to'xtadi (fayl O'CHIRILMADI, nomi/huquqi O'ZGARMADI, o'qilmadi).",
      "",
      "  Operator: bu artefaktni xavfsiz joyga KO'CHIRING yoki arxivlang, so'ng testni qayta",
      "  ishga tushiring.",
    ].join("\n")
  );
  process.exit(1);
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

// ── Maxfiy ma'lumot naqshlari — mos kelgan QIYMAT hech qachon chop etilmaydi ──
const SECRET_PATTERNS = [
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
    // sir emas. Yolg'on ijobiy natija testni foydasiz qilib qo'yadi.
    name: "hardcoded credential assignment",
    re: /\b(?:password|passwd|client_secret|secret[_-]?key|api[_-]?key|private[_-]?key|cert[_-]?pass)["']?\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
    accept: (value) => /\d/.test(value),
  },
];

const TEXT_EXT = new Set([".html", ".js", ".jsx", ".css", ".xml", ".json", ".txt", ".md", ".debug"]);

function textEntries(entries) {
  return [...entries].filter((e) => !e.endsWith("/") && TEXT_EXT.has(path.extname(e).toLowerCase()));
}

function matchesSecret(body, p) {
  if (!p.accept) return p.re.test(body);
  const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
  let m;
  while ((m = re.exec(body))) if (p.accept(m[1])) return true;
  return false;
}

function scanSecrets(archivePath, entries) {
  const hits = [];
  for (const entry of textEntries(entries)) {
    const body = readEntry(archivePath, entry);
    for (const p of SECRET_PATTERNS) {
      // FAQAT fayl nomi + naqsh nomi qaytadi — mos kelgan QIYMAT hech qayerga chiqmaydi.
      if (matchesSecret(body, p)) hits.push(`${entry} [${p.name}]`);
    }
  }
  return hits;
}

function parseManifest(xml) {
  return {
    bundleId: (xml.match(/ExtensionBundleId="([^"]+)"/) || [])[1],
    bundleVersion: (xml.match(/ExtensionBundleVersion="([^"]+)"/) || [])[1],
    listIds: extractAll(
      (xml.match(/<ExtensionList>[\s\S]*?<\/ExtensionList>/i) || [""])[0],
      /<Extension\s+Id="([^"]+)"/gi
    ),
    dispatchIds: extractAll(
      (xml.match(/<DispatchInfoList>[\s\S]*?<\/DispatchInfoList>/i) || [""])[0],
      /<Extension\s+Id="([^"]+)"/gi
    ),
    mainPaths: extractAll(xml, /<MainPath>([^<]+)<\/MainPath>/gi),
    cefParams: extractAll(xml, /<Parameter>([^<]+)<\/Parameter>/gi),
  };
}

/** Bitta arxiv uchun to'liq audit. `report` — false bo'lsa natija jim qaytariladi
 *  (negativ fiksturalarda tekshiruvlar YIQILISHINI isbotlash uchun ishlatiladi). */
function auditArchive(archivePath, flavorKey, { report = true } = {}) {
  const flavor = FLAVORS[flavorKey];
  const entries = listEntries(archivePath);
  const results = [];
  const add = (label, ok, detail) => results.push({ label, ok, detail });

  // 1) Manifest: aynan bitta kutilgan ID + mos dispatch
  const xml = readEntry(archivePath, "CSXS/manifest.xml");
  const m = parseManifest(xml);
  add(
    `${flavorKey}: manifest ExtensionList = [${flavor.extensionId}] (aynan bitta)`,
    m.listIds.length === 1 && m.listIds[0] === flavor.extensionId,
    `got [${m.listIds.join(", ")}]`
  );
  add(
    `${flavorKey}: manifest DispatchInfo = [${flavor.extensionId}] (aynan bitta, mos)`,
    m.dispatchIds.length === 1 && m.dispatchIds[0] === flavor.extensionId,
    `got [${m.dispatchIds.join(", ")}]`
  );
  add(
    `${flavorKey}: MainPath = ${flavor.mainPath}`,
    m.mainPaths.length === 1 && m.mainPaths[0] === flavor.mainPath,
    `got [${m.mainPaths.join(", ")}]`
  );
  add(`${flavorKey}: ExtensionBundleId = ${flavor.bundleId}`, m.bundleId === flavor.bundleId, m.bundleId);

  // 2) Taqiqlangan CEF bayroqlari (ikkala flavor uchun ham)
  for (const flag of FORBIDDEN_CEF_FLAGS) {
    add(
      `${flavorKey}: manifest ${flag} ishlatmaydi`,
      !m.cefParams.some((p) => p.trim() === flag) && !xml.includes(flag),
      "manifestda topildi"
    );
  }

  // 3) Runtime referenslari (verify-zxp-package.mjs mantiqi)
  const refs = verifyArchiveReferences(archivePath);
  add(
    `${flavorKey}: barcha runtime referenslari yechildi (${refs.checks.length} ta)`,
    refs.failed === 0,
    refs.checks.filter((c) => !c.ok).map((c) => c.label).join("; ")
  );

  // 4) Arxiv tarkibi flavor ro'yxatiga AYNAN mos (ortiqcha fayl yo'q)
  const expected = new Set(resolveFlavorFiles(flavorKey).map((f) => f.to));
  const actual = new Set([...entries].filter((e) => !e.endsWith("/")));
  const extra = [...actual].filter((e) => !expected.has(e));
  const missing = [...expected].filter((e) => !actual.has(e));
  add(`${flavorKey}: arxiv fayl ro'yxati flavor manbasiga mos`, extra.length === 0 && missing.length === 0,
    `extra=[${extra.join(", ")}] missing=[${missing.join(", ")}]`);

  // 5) MIJOZ arxivida Admin sirti YO'Q
  if (!flavor.internal) {
    for (const f of ADMIN_SURFACE.files) {
      add(`customer: "${f}" arxivda yo'q`, !actual.has(f), "arxivda topildi");
    }
    const texts = textEntries(actual).map((e) => [e, readEntry(archivePath, e)]);
    for (const id of ADMIN_SURFACE.identifiers) {
      const hit = texts.find(([, body]) => body.includes(id));
      add(`customer: "${id}" identifikatori hech bir faylda yo'q`, !hit, hit && hit[0]);
    }
    for (const key of ADMIN_SURFACE.storageKeys) {
      const hit = texts.find(([, body]) => body.includes(key));
      add(`customer: Admin localStorage kaliti "${key}" yo'q`, !hit, hit && hit[0]);
    }
  }

  // 6) Maxfiy kalit skani (qiymat chop etilmaydi)
  const secrets = scanSecrets(archivePath, actual);
  add(`${flavorKey}: paketda maxfiy kalit naqshi yo'q`, secrets.length === 0, secrets.join(", "));

  if (report) for (const r of results) check(r.label, r.ok, r.detail);
  return results;
}

// ── Build ────────────────────────────────────────────────────────────────────
function build(flavorKey) {
  execFileSync("bash", [path.join(PLUGIN_SRC, "scripts/build-zxp.sh"), `--${flavorKey}`, "--unsigned"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return artifactPath(flavorKey, { signed: false });
}

console.log("→ Ikkala flavor imzolanmagan holda quriladi (haqiqiy arxivlar)…\n");
const archives = {};
for (const key of Object.keys(FLAVORS)) {
  archives[key] = build(key);
  console.log(`   ${key} → ${path.relative(process.cwd(), archives[key])}`);
}
console.log("");

// ── A) Ijobiy auditlar ───────────────────────────────────────────────────────
for (const key of Object.keys(FLAVORS)) auditArchive(archives[key], key);

// ── B) Versiya sinxronligi ───────────────────────────────────────────────────
const declared = declaredPluginVersion();
check(
  `versiya sinxron: manifest ${flavorVersion("customer")} = manifest.admin ${flavorVersion("admin")} = AF_PLUGIN_VERSION ${declared}`,
  flavorVersion("customer") === flavorVersion("admin") && flavorVersion("customer") === declared
);

// ── C) Imzolash FAIL-CLOSED (haqiqiy build ishga tushiriladi) ────────────────
// Nishon (sentinel): har urinishdan OLDIN MIJOZ yakuniy .zxp o'rniga soxta fayl qo'yiladi —
// build to'xtaganda u O'CHIRILGAN bo'lishi SHART, aks holda eski/qisman artefakt
// "yangi reliz" deb chalg'itardi. ADMIN yo'liga bir marta alohida nishon qo'yiladi va
// har urinishdan keyin BAYT-BA-BAYT o'zgarmaganligi tekshiriladi — "boshqa flavor
// tegilmadi" ni "u umuman yo'q" deb emas, HAQIQIY isbot bilan ko'rsatadi.
// (Yuqoridagi darvoza allaqachon kafolatladi: bu ikkala yo'lda oldin fayl YO'Q edi.)
const SIGNED_OUT = SIGNED_PATHS.customer;
const SENTINEL = "STALE-ARTIFACT-SENTINEL";
// Test uchun soxta parol — HAQIQIY sir EMAS. Build chiqishida uchramasligi tekshiriladi.
const FAKE_PASS = "fake-password-not-a-secret";

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function plantSentinel() {
  trackForCleanup(SIGNED_OUT);
  writeFileSync(SIGNED_OUT, SENTINEL);
}

// Admin nishoni — BIR MARTA qo'yiladi, hech qachon qayta yozilmaydi.
mkdirSync(DIST_DIR, { recursive: true });
trackForCleanup(SIGNED_PATHS.admin);
writeFileSync(SIGNED_PATHS.admin, "ADMIN-FLAVOR-SENTINEL — customer build must never touch this");
const ADMIN_SHA = sha256(SIGNED_PATHS.admin);
const adminUntouched = () =>
  existsSync(SIGNED_PATHS.admin) && sha256(SIGNED_PATHS.admin) === ADMIN_SHA;

// Imzolanmagan arxivlar ham tegilmasligi kerak — oldindan hash olib qo'yamiz.
const UNSIGNED_SHA = {
  customer: sha256(archives.customer),
  admin: sha256(archives.admin),
};
const unsignedUntouched = () =>
  sha256(archives.customer) === UNSIGNED_SHA.customer &&
  sha256(archives.admin) === UNSIGNED_SHA.admin;

function signAttempt(env) {
  try {
    execFileSync("bash", [path.join(PLUGIN_SRC, "scripts/build-zxp.sh"), "--customer"], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, ZXP_CERT: "", ZXP_CERT_PASS: "", ...env },
    });
    return { code: 0, out: "" };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

/** dist/zxp'da qolib ketgan staging/imzolash vaqtinchalik yo'llari. */
function strayTemps() {
  return readdirSync(DIST_DIR).filter((n) => n.startsWith("_stage.") || n.startsWith("_signing."));
}

// C1 — sertifikat YO'Q
plantSentinel();
const noCert = signAttempt({});
check("signed build sertifikatsiz FAIL-CLOSED (exit≠0)", noCert.code !== 0, `exit=${noCert.code}`);
check("signed build xatosi ZXP_CERT ni aniq aytadi", /ZXP_CERT/.test(noCert.out));
check("sertifikatsiz: eski yakuniy .zxp BEKOR qilindi", !existsSync(SIGNED_OUT));
check("sertifikatsiz: admin flavor artefakti BAYT-BA-BAYT o'zgarmadi", adminUntouched());

// C2 — sertifikat bor, parol YO'Q
const certDir = trackForCleanup(mkdtempSync(path.join(tmpdir(), "ff-cert-")));
const fakeCert = path.join(certDir, "fake.p12");
writeFileSync(fakeCert, "not-a-real-certificate");
plantSentinel();
const noPass = signAttempt({ ZXP_CERT: fakeCert });
check("signed build parolsiz FAIL-CLOSED (exit≠0)", noPass.code !== 0, `exit=${noPass.code}`);
check("signed build xatosi ZXP_CERT_PASS ni aniq aytadi", /ZXP_CERT_PASS/.test(noPass.out));
check("parolsiz: eski yakuniy .zxp BEKOR qilindi", !existsSync(SIGNED_OUT));
check("parolsiz: admin flavor artefakti BAYT-BA-BAYT o'zgarmadi", adminUntouched());

// C3 — imzolash BUYRUG'I yiqiladi: soxta ZXPSignCmd chiqish fayliga QISMAN bayt yozib,
//      nolga teng bo'lmagan kod bilan tugaydi. Yakuniy .zxp paydo BO'LMASLIGI va
//      hech qanday vaqtinchalik fayl QOLMASLIGI shart.
const fakeBin = trackForCleanup(mkdtempSync(path.join(tmpdir(), "ff-fakebin-")));
const fakeSigner = path.join(fakeBin, "ZXPSignCmd");
writeFileSync(
  fakeSigner,
  [
    "#!/bin/bash",
    "# Soxta imzolovchi (faqat test): $3 = chiqish yo'li. QISMAN bayt yozadi, so'ng yiqiladi.",
    "# Parol ($5) o'qilmaydi, chop etilmaydi, hech qayerga yozilmaydi.",
    'printf "PARTIAL-ZXP-BYTES" > "$3"',
    'echo "fake signer: forced failure"',
    "exit 7",
    "",
  ].join("\n")
);
chmodSync(fakeSigner, 0o755);

plantSentinel();
const signFail = signAttempt({
  ZXP_CERT: fakeCert,
  ZXP_CERT_PASS: FAKE_PASS,
  PATH: `${fakeBin}:${process.env.PATH}`,
});
check("imzolash buyrug'i yiqilsa FAIL-CLOSED (exit≠0)", signFail.code !== 0, `exit=${signFail.code}`);
check("imzolash yiqilsa: yakuniy .zxp YARATILMAYDI", !existsSync(SIGNED_OUT));
check("imzolash yiqilsa: qisman imzolangan temp QOLMAYDI", strayTemps().length === 0, strayTemps().join(", "));
check("build chiqishida parol qiymati chop etilmadi", !signFail.out.includes(FAKE_PASS));
check("imzolash yiqilsa: admin flavor artefakti BAYT-BA-BAYT o'zgarmadi", adminUntouched());

// C4 — imzolanmagan arxivlar ham TEGILMAGAN (hash bilan isbot)
check("imzolanmagan arxivlar BAYT-BA-BAYT o'zgarmadi", unsignedUntouched());
check(
  "build skriptida self-signed sertifikat yaratish / standart parol yo'q",
  // `${ZXP_CERT_PASS:-}` (bo'sh = tekshiruv) RUXSAT; `${ZXP_CERT_PASS:-qiymat}` (standart parol) TAQIQ.
  !/-selfSignedCert/.test(buildScriptText()) &&
    !/\$\{ZXP_CERT(?:_PASS)?:-[^}]/.test(buildScriptText())
);
check(
  "build skripti yakuniy .zxp'ga to'g'ridan imzolamaydi (temp → atomik mv)",
  /-sign "\$STAGE" "\$SIGN_TMP"/.test(buildScriptText()) && /mv -f "\$SIGN_TMP" "\$OUT"/.test(buildScriptText())
);

// ── D) NEGATIV fiksturalar — mutatsiya qilingan arxivlar ────────────────────
// Tekshiruvlar haqiqatan ushlaydimi? Har mutatsiya kamida bitta assert'ni yiqitishi SHART.
const work = trackForCleanup(mkdtempSync(path.join(tmpdir(), "ff-pkg-neg-")));

function mutatedCopy(name, mutate) {
  const dst = path.join(work, name);
  copyFileSync(archives.customer, dst);
  const stage = path.join(work, `${name}.stage`);
  mkdirSync(stage, { recursive: true });
  mutate(stage, dst);
  return dst;
}

function zipAdd(archive, stageDir, relPath) {
  execFileSync("zip", ["-q", archive, relPath], { cwd: stageDir });
}

function negative(label, archivePath, expectLabelMatch) {
  const results = auditArchive(archivePath, "customer", { report: false });
  const broken = results.filter((r) => !r.ok);
  const matched = broken.some((r) => expectLabelMatch.test(r.label));
  check(
    `negativ fikstura: ${label} → audit yiqiladi (${broken.length} assert)`,
    broken.length > 0 && matched,
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
}

// D1 — Admin HTML fayli qo'shilgan
negative(
  "AssetFlow_Admin.html qo'shildi",
  mutatedCopy("neg-admin-file.zip", (stage, archive) => {
    copyFileSync(path.join(PLUGIN_SRC, "AssetFlow_Admin.html"), path.join(stage, "AssetFlow_Admin.html"));
    zipAdd(archive, stage, "AssetFlow_Admin.html");
  }),
  /AssetFlow_Admin\.html/
);

// D2 — manifestga ikkinchi (Admin) extension ID qo'shilgan
negative(
  "manifestga com.frameflow.admin ID qo'shildi",
  mutatedCopy("neg-admin-id.zip", (stage, archive) => {
    const xml = readEntry(archive, "CSXS/manifest.xml").replace(
      "</ExtensionList>",
      '  <Extension Id="com.frameflow.admin" Version="1.1.1"/>\n  </ExtensionList>'
    );
    mkdirSync(path.join(stage, "CSXS"), { recursive: true });
    writeFileSync(path.join(stage, "CSXS/manifest.xml"), xml);
    zipAdd(archive, stage, "CSXS/manifest.xml");
  }),
  /ExtensionList|identifikatori/
);

// D3 — taqiqlangan CEF bayrog'i qo'shilgan
negative(
  "manifestga --disable-web-security qo'shildi",
  mutatedCopy("neg-flag.zip", (stage, archive) => {
    const xml = readEntry(archive, "CSXS/manifest.xml").replace(
      "</CEFCommandLine>",
      "  <Parameter>--disable-web-security</Parameter>\n          </CEFCommandLine>"
    );
    mkdirSync(path.join(stage, "CSXS"), { recursive: true });
    writeFileSync(path.join(stage, "CSXS/manifest.xml"), xml);
    zipAdd(archive, stage, "CSXS/manifest.xml");
  }),
  /disable-web-security/
);

// D4 — Admin localStorage kaliti sirg'alib kirdi
negative(
  "Admin localStorage kaliti (af_admin_token) sirg'alib kirdi",
  mutatedCopy("neg-storage-key.zip", (stage, archive) => {
    writeFileSync(path.join(stage, "assetflow-log.js"), "localStorage.getItem('af_admin_token');\n");
    zipAdd(archive, stage, "assetflow-log.js");
  }),
  /af_admin_token/
);

// D5 — soxta maxfiy kalit bloki (haqiqiy kalit EMAS — sarlavha runtime'da yig'iladi)
negative(
  "paketga maxfiy kalit bloki qo'shildi",
  mutatedCopy("neg-secret.zip", (stage, archive) => {
    const header = "-----BEGIN RSA PRIVATE" + " KEY-----"; // bo'lib yozilgan: repo skanini chalg'itmasin
    writeFileSync(path.join(stage, "assetflow-init.js"), `/*\n${header}\nRkFLRSBGSVhUVVJF\n*/\n`);
    zipAdd(archive, stage, "assetflow-init.js");
  }),
  /maxfiy kalit/
);

rmSync(work, { recursive: true, force: true });

function buildScriptText() {
  return readFileSync(path.join(PLUGIN_SRC, "scripts/build-zxp.sh"), "utf8");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`\nYiqilgan tekshiruvlar:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
