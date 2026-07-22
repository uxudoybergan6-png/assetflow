// MARKETPLACE PREFLIGHT REGRESSIYA TESTI — HAQIQIY jonli manba va HAQIQIY qurilgan arxivga
// qarshi (mock YO'Q). Har mutatsiya JONLI manbadan olingan nusxani buzadi va tegishli
// tekshiruv HAQIQATAN yiqilishini isbotlaydi — ya'ni preflight "hamma narsa ✓" deb
// yolg'on aytolmaydi.
//
// Bloklar:
//   A. Joriy repo QA rejimida TOZA (0 fail) — preflight'ning o'zi ishlaydi.
//   B. Manifest mutatsiyalari: versiya drifti (bundle · <Extension Version=> · AF_PLUGIN_VERSION),
//      ID/MainPath/ScriptPath/Menu/HostList/RequiredRuntime drifti, CEF bayroq allowlist'i.
//   C. Arxiv mutatsiyalari: `.debug` · PlayerDebugMode · disable-web-security · Admin fayli/ID/
//      localStorage kaliti · maxfiy kalit bloki · masofaviy <script> · yetishmagan/ortiqcha fayl ·
//      QA arxivida imzo konverti · arxiv↔manba manifest drifti · HTTPS bo'lmagan endpoint.
//   D. Artefakt nomi/publishability: imzolanmagan zip imzolangan nom ostida · noto'g'ri nom ·
//      release rejimida artefakt yo'q.
//   E. Imzolangan konteyner TANASI: konvert bor va baytlar joriy payload'ga teng → o'tadi;
//      bayt o'zgargan yoki yot fayl qo'shilgan → yiqiladi. (CHEGARA: bu FAQAT konteyner
//      tanasining baytlarini taqqoslaydi — kriptografik imzo tekshiruvi EMAS; u G blokida.)
//   F. Ega metadata: joy egallovchi (QA ruxsat / release rad) · soxta da'volar · manifestda yo'q
//      mahsulot mosligi · HTTPS bo'lmagan URL · email shakli · noto'g'ri enum · yetishmagan kalit ·
//      yo'q asset · buzuq JSON.
//   G. KRIPTOGRAFIK tekshiruv ORKESTRATSIYASI (ZXPSignCmd): soxta konvert + vositasiz → o'tmaydi ·
//      vosita yo'q → fail-closed · vosita ≠ 0 → fail-closed · argv AYNAN `-verify <artefakt>` ·
//      vosita chiqishi hisobotga sizmaydi · QA rejimi vositani CHAQIRMAYDI.
//   H. Skriptning o'zi: sertifikat/parol o'qimaydi, sertifikat yaratmaydi, shell ishlatmaydi.
//
// XAVFSIZLIK: test HECH QACHON `dist/zxp` ichidagi IMZOLANGAN artefakt yo'liga yozmaydi —
// barcha soxta "imzolangan" fiksturalar izolyatsiyalangan vaqtinchalik papkada yashaydi.
// Test sertifikat YARATMAYDI, sertifikat/parol O'QIMAYDI va hech narsani Adobe'ga yubormaydi.
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-marketplace-preflight.mjs

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLUGIN_SRC, artifactName, getFlavor } from "./package-flavors.mjs";
import {
  SUBMISSION_FILE,
  auditArchive,
  auditArtifactNaming,
  auditManifestSource,
  auditPackagedEnvDefaults,
  auditSignedArtifact,
  auditSubmissionMetadata,
  buildCustomerQaArchive,
  createReport,
  parseLiveManifest,
  resolveZxpSignCmd,
  runPreflight,
} from "./marketplace-preflight.mjs";

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log(`✓  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const WORK = mkdtempSync(path.join(tmpdir(), "ff-mkt-test-"));
process.on("exit", () => rmSync(WORK, { recursive: true, force: true }));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    rmSync(WORK, { recursive: true, force: true });
    process.exit(130);
  });
}

const FLAVOR = getFlavor("customer");
const LIVE_XML = readFileSync(path.join(PLUGIN_SRC, FLAVOR.manifestSource), "utf8");
const LIVE_META = readFileSync(SUBMISSION_FILE, "utf8");

// ── A) Joriy repo QA rejimida TOZA ───────────────────────────────────────────
console.log("→ QA preflight jonli repo ustida (haqiqiy build)…\n");
const live = runPreflight({ mode: "qa" });
check(
  `A: jonli repo QA preflight'dan o'tadi (${live.report.checks.length} tekshiruv)`,
  live.report.failed.length === 0,
  live.report.failed.map((f) => f.label).join("; ")
);
check(
  "A: QA rejimida 'imzolangan artefakt mavjud' TALABI yo'q (kredensialsiz ishlaydi)",
  !live.report.checks.some((c) => /imzolangan artefakt mavjud/.test(c.label))
);
check(
  "A: QA rejimi imzolangan .zxp yo'qligini ANIQ eslatadi (jim o'tmaydi)",
  live.signedPresent ||
    live.report.notes.some((n) => /imzolangan \.zxp YO'Q/.test(n.label))
);
check(
  "A: QA rejimi yechilmagan ega maydonlarini ANIQ sanaydi",
  live.report.notes.some((n) => /EGA kiritishini kutmoqda/.test(n.label))
);

const QA_ARCHIVE = live.qaArchive;

// ── B) Manifest mutatsiyalari ────────────────────────────────────────────────
function manifestMutation(label, mutate, expectLabel) {
  const report = createReport();
  const xml = mutate(LIVE_XML);
  check(`B: mutatsiya matnni haqiqatan o'zgartirdi — ${label}`, xml !== LIVE_XML);
  auditManifestSource(report, { xml });
  const broken = report.failed;
  check(
    `B: ${label} → preflight yiqiladi`,
    broken.length > 0 && broken.some((f) => expectLabel.test(f.label)),
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
}

manifestMutation(
  "ExtensionBundleVersion drifti (1.1.1 → 9.9.9)",
  (x) => x.replace('ExtensionBundleVersion="1.1.1"', 'ExtensionBundleVersion="9.9.9"'),
  /versiya sinxron/
);
manifestMutation(
  "<Extension Version=> bundle versiyasidan ajradi",
  (x) => x.replace('<Extension Id="com.frameflow.panel" Version="1.1.1"/>', '<Extension Id="com.frameflow.panel" Version="1.0.0"/>'),
  /Extension Version/
);
manifestMutation(
  "ExtensionBundleId almashtirildi",
  (x) => x.replace('ExtensionBundleId="com.frameflow"', 'ExtensionBundleId="com.example.other"'),
  /ExtensionBundleId/
);
manifestMutation(
  "ExtensionBundleName almashtirildi",
  (x) => x.replace('ExtensionBundleName="FrameFlow"', 'ExtensionBundleName="Something Else"'),
  /ExtensionBundleName/
);
manifestMutation(
  "ichki Admin ID qo'shildi",
  (x) => x.replace("</ExtensionList>", '  <Extension Id="com.frameflow.admin" Version="1.1.1"/>\n  </ExtensionList>'),
  /ExtensionList/
);
manifestMutation(
  "MainPath boshqa faylga ko'chdi",
  (x) => x.replace("<MainPath>./AssetFlow_Plugin.html</MainPath>", "<MainPath>./index.html</MainPath>"),
  /MainPath/
);
manifestMutation(
  "ScriptPath olib tashlandi",
  (x) => x.replace("<ScriptPath>./jsx/host.jsx</ScriptPath>", ""),
  /ScriptPath/
);
manifestMutation(
  "Menu yorlig'i o'zgardi",
  (x) => x.replace("<Menu>FrameFlow</Menu>", "<Menu>FrameFlow BETA</Menu>"),
  /Menu/
);
manifestMutation(
  "HostList e'lon qilinmagan ilovaga kengaytirildi (PPRO)",
  (x) => x.replace('<Host Name="AEFT" Version="[22.0,99.9]"/>', '<Host Name="AEFT" Version="[22.0,99.9]"/>\n      <Host Name="PPRO" Version="[22.0,99.9]"/>'),
  /HostList/
);
manifestMutation(
  "Host versiya diapazoni jimgina kengaydi",
  (x) => x.replace('Version="[22.0,99.9]"/>\n    </HostList>', 'Version="[1.0,99.9]"/>\n    </HostList>'),
  /HostList/
);
manifestMutation(
  "RequiredRuntime versiyasi o'zgardi",
  (x) => x.replace('<RequiredRuntime Name="CSXS" Version="11.0"/>', '<RequiredRuntime Name="CSXS" Version="6.0"/>'),
  /RequiredRuntime/
);
manifestMutation(
  "--disable-web-security qaytdi",
  (x) => x.replace("</CEFCommandLine>", "  <Parameter>--disable-web-security</Parameter>\n          </CEFCommandLine>"),
  /disable-web-security|CEF bayroqlari/
);
manifestMutation(
  "yangi CEF bayrog'i allowlist'siz qo'shildi",
  (x) => x.replace("</CEFCommandLine>", "  <Parameter>--remote-debugging-port=8088</Parameter>\n          </CEFCommandLine>"),
  /CEF bayroqlari/
);

// ── C) Arxiv mutatsiyalari ───────────────────────────────────────────────────
function mutatedArchive(name, mutate) {
  const dst = path.join(WORK, name);
  copyFileSync(QA_ARCHIVE, dst);
  const stage = path.join(WORK, `${name}.stage`);
  mkdirSync(stage, { recursive: true });
  mutate(stage, dst);
  return dst;
}

function zipAdd(archive, stageDir, relPath) {
  execFileSync("zip", ["-q", archive, relPath], { cwd: stageDir });
}
function zipDrop(archive, relPath) {
  execFileSync("zip", ["-qd", archive, relPath]);
}
function writeStage(stage, rel, body) {
  const abs = path.join(stage, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

function archiveMutation(label, archivePath, expectLabel, opts = {}) {
  const report = createReport();
  auditArchive(report, archivePath, { tag: "fixture", signed: false, liveManifestXml: LIVE_XML });
  if (opts.env) auditPackagedEnvDefaults(report, archivePath, "fixture");
  const broken = report.failed;
  check(
    `C: ${label} → preflight yiqiladi`,
    broken.length > 0 && broken.some((f) => expectLabel.test(f.label)),
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
}

archiveMutation(
  "`.debug` profili paketga sirg'alib kirdi",
  mutatedArchive("neg-debug.zip", (stage, archive) => {
    copyFileSync(path.join(PLUGIN_SRC, ".debug"), path.join(stage, ".debug"));
    zipAdd(archive, stage, ".debug");
  }),
  /debug profili/
);
archiveMutation(
  "PlayerDebugMode ko'rsatmasi paketda",
  mutatedArchive("neg-playerdebug.zip", (stage, archive) => {
    writeStage(stage, "assetflow-init.js", "// enable PlayerDebugMode before install\n");
    zipAdd(archive, stage, "assetflow-init.js");
  }),
  /PlayerDebugMode/
);
archiveMutation(
  "--disable-web-security paketlangan matnda",
  mutatedArchive("neg-dws.zip", (stage, archive) => {
    writeStage(stage, "assetflow-log.js", "// launch with --disable-web-security\n");
    zipAdd(archive, stage, "assetflow-log.js");
  }),
  /disable-web-security/
);
archiveMutation(
  "Admin HTML fayli qo'shildi",
  mutatedArchive("neg-adminfile.zip", (stage, archive) => {
    copyFileSync(path.join(PLUGIN_SRC, "AssetFlow_Admin.html"), path.join(stage, "AssetFlow_Admin.html"));
    zipAdd(archive, stage, "AssetFlow_Admin.html");
  }),
  /Admin fayli|fayl ro'yxati/
);
archiveMutation(
  "Admin localStorage kaliti sirg'alib kirdi",
  mutatedArchive("neg-adminkey.zip", (stage, archive) => {
    writeStage(stage, "assetflow-log.js", "localStorage.getItem('af_admin_token');\n");
    zipAdd(archive, stage, "assetflow-log.js");
  }),
  /af_admin_token/
);
archiveMutation(
  "maxfiy kalit bloki paketda",
  mutatedArchive("neg-secret.zip", (stage, archive) => {
    const header = "-----BEGIN RSA PRIVATE" + " KEY-----"; // bo'lib yozilgan: repo skanini chalg'itmasin
    writeStage(stage, "assetflow-init.js", `/*\n${header}\nRkFLRSBGSVhUVVJF\n*/\n`);
    zipAdd(archive, stage, "assetflow-init.js");
  }),
  /maxfiy kalit/
);
archiveMutation(
  "sertifikat bloki paketda",
  mutatedArchive("neg-cert.zip", (stage, archive) => {
    const header = "-----BEGIN CERTI" + "FICATE-----";
    writeStage(stage, "assetflow-init.js", `/*\n${header}\nRkFLRQ==\n*/\n`);
    zipAdd(archive, stage, "assetflow-init.js");
  }),
  /maxfiy kalit/
);
archiveMutation(
  "masofadan yuklanadigan <script> qo'shildi",
  mutatedArchive("neg-remote.zip", (stage, archive) => {
    const html = readFileSync(path.join(PLUGIN_SRC, "AssetFlow_Plugin.html"), "utf8").replace(
      "</head>",
      '<script src="https://cdn.example.com/analytics.js"></script></head>'
    );
    writeStage(stage, "AssetFlow_Plugin.html", html);
    zipAdd(archive, stage, "AssetFlow_Plugin.html");
  }),
  /masofadan yuklanadigan/
);
archiveMutation(
  "runtime fayli paketdan tushib qoldi (css/styles.css)",
  mutatedArchive("neg-missing.zip", (stage, archive) => zipDrop(archive, "css/styles.css")),
  /fayl ro'yxati|runtime referenslari/
);
archiveMutation(
  "paketga yot fayl qo'shildi",
  mutatedArchive("neg-extra.zip", (stage, archive) => {
    writeStage(stage, "notes.txt", "internal build notes\n");
    zipAdd(archive, stage, "notes.txt");
  }),
  /fayl ro'yxati/
);
archiveMutation(
  "IMZOLANMAGAN QA arxivi imzo konverti bilan bezatildi",
  mutatedArchive("neg-fakeenvelope.zip", (stage, archive) => {
    writeStage(stage, "META-INF/signatures.xml", "<signatures/>\n");
    zipAdd(archive, stage, "META-INF/signatures.xml");
  }),
  /imzo konverti YO'Q/
);
archiveMutation(
  "arxivdagi manifest jonli manbadan ajradi",
  mutatedArchive("neg-manifestdrift.zip", (stage, archive) => {
    writeStage(stage, "CSXS/manifest.xml", LIVE_XML.replace("<Menu>FrameFlow</Menu>", "<Menu>Drifted</Menu>"));
    zipAdd(archive, stage, "CSXS/manifest.xml");
  }),
  /jonli manba bilan bir xil/
);
archiveMutation(
  "panel standart endpoint'i HTTPS'dan HTTP'ga tushdi",
  mutatedArchive("neg-http.zip", (stage, archive) => {
    const src = readFileSync(path.join(PLUGIN_SRC, "assetflow-env.js"), "utf8").replace(
      'const PROD_API = "https://api.getframeflow.app";',
      'const PROD_API = "http://api.getframeflow.app";'
    );
    writeStage(stage, "assetflow-env.js", src);
    zipAdd(archive, stage, "assetflow-env.js");
  }),
  /standart API endpoint'i HTTPS/,
  { env: true }
);

// ── D) Artefakt nomi / publishability ────────────────────────────────────────
const SIGNED_NAME = artifactName("customer", { signed: true });

function namingCase(label, signedPath, mode, expect) {
  const report = createReport();
  const res = auditArtifactNaming(report, { signedPath, mode });
  const broken = report.failed;
  check(
    `D: ${label}`,
    expect.fails
      ? broken.length > 0 && broken.some((f) => expect.fails.test(f.label))
      : broken.length === 0,
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
  return res;
}

// D1 — imzolanmagan zip imzolangan nom ostida = eng xavfli yolg'on
const fakeSignedDir = path.join(WORK, "fake-signed");
mkdirSync(fakeSignedDir, { recursive: true });
const unsignedAsSigned = path.join(fakeSignedDir, SIGNED_NAME);
copyFileSync(QA_ARCHIVE, unsignedAsSigned);
namingCase("imzolanmagan zip imzolangan nom ostida → yiqiladi", unsignedAsSigned, "qa", {
  fails: /imzo konverti bor/,
});

// D2 — noto'g'ri nom
const wrongName = path.join(fakeSignedDir, "frameflow-plugin-latest.zxp");
copyFileSync(QA_ARCHIVE, wrongName);
namingCase("kutilgan nomdan farq qiluvchi artefakt → yiqiladi", wrongName, "qa", {
  fails: /kutilgan nomga teng/,
});

// D3 — release rejimi, artefakt YO'Q
namingCase("release rejimi imzolangan artefakt yo'qligida FAIL-CLOSED", path.join(fakeSignedDir, "missing", SIGNED_NAME), "release", {
  fails: /imzolangan artefakt mavjud/,
});

// D4 — QA rejimi, artefakt YO'Q → yiqilmaydi (faqat eslatma)
namingCase("QA rejimi artefakt yo'qligida yiqilmaydi", path.join(fakeSignedDir, "missing", SIGNED_NAME), "qa", {});

// ── E) Imzolangan konteyner tanasi (bayt taqqoslash) ─────────────────────────
/** QA arxividan "imzo konvertli" .zxp yasaydi (soxta konvert + o'sha baytlar).
 *  CHEGARA: bu KRIPTOGRAFIK imzo EMAS va shunday deb ATALMAYDI — bu shunchaki konvertli
 *  konteyner. U faqat "konteyner tanasi joriy payload baytlariga tengmi" mantiqini sinaydi.
 *  Kriptografik tekshiruv — G bloki (ZXPSignCmd orkestratsiyasi) va oxir-oqibat Adobe. */
function makeEnvelopeZxp(name, mutate) {
  const dir = path.join(WORK, `zxp-${name}`);
  mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, SIGNED_NAME);
  copyFileSync(QA_ARCHIVE, dst);
  const stage = path.join(WORK, `${name}.stage`);
  mkdirSync(stage, { recursive: true });
  writeStage(stage, "META-INF/signatures.xml", "<signatures/>\n");
  writeStage(stage, "mimetype", "application/vnd.adobe.air-ucf-package+zip");
  zipAdd(dst, stage, "META-INF/signatures.xml");
  zipAdd(dst, stage, "mimetype");
  if (mutate) mutate(stage, dst);
  return dst;
}

function signedCase(label, zxpPath, expectFail) {
  const report = createReport();
  auditSignedArtifact(report, zxpPath, LIVE_XML);
  const broken = report.failed;
  check(
    `E: ${label}`,
    expectFail
      ? broken.length > 0 && broken.some((f) => expectFail.test(f.label))
      : broken.length === 0,
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
}

const OK_ZXP = makeEnvelopeZxp("ok");
signedCase("konvert + aynan mos baytlar → konteyner tanasi tekshiruvi o'tadi", OK_ZXP, null);
signedCase(
  "konteynerda fayl bayti o'zgargan → yiqiladi",
  makeEnvelopeZxp("tampered", (stage, archive) => {
    writeStage(stage, "assetflow-init.js", "// tampered after signing\n");
    zipAdd(archive, stage, "assetflow-init.js");
  }),
  /konteyner tanasi|fayl ro'yxati/
);
signedCase(
  "konteynerda yot fayl → yiqiladi",
  makeEnvelopeZxp("extra", (stage, archive) => {
    writeStage(stage, "extra.js", "console.log('smuggled');\n");
    zipAdd(archive, stage, "extra.js");
  }),
  /fayl ro'yxati|konteyner tanasi/
);
signedCase(
  "konteynerda ruxsatsiz META-INF yo'li → yiqiladi",
  makeEnvelopeZxp("rogue-envelope", (stage, archive) => {
    writeStage(stage, "META-INF/extra.xml", "<x/>\n");
    zipAdd(archive, stage, "META-INF/extra.xml");
  }),
  /yot yo'l|konteyner tanasi/
);

// ── F) Ega metadata ──────────────────────────────────────────────────────────
const LIVE_MANIFEST = parseLiveManifest(LIVE_XML);

function metaCase(label, mutate, { mode = "release", expectFail = null, raw = null } = {}) {
  const file = path.join(WORK, `meta-${Buffer.from(label).toString("hex").slice(0, 24)}.json`);
  if (raw != null) writeFileSync(file, raw);
  else {
    const doc = JSON.parse(LIVE_META);
    mutate(doc);
    writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const report = createReport();
  auditSubmissionMetadata(report, { mode, manifest: LIVE_MANIFEST, file });
  const broken = report.failed;
  check(
    `F: ${label}`,
    expectFail
      ? broken.length > 0 && broken.some((f) => expectFail.test(f.label))
      : broken.length === 0,
    `broken=[${broken.map((b) => b.label).join(" | ")}]`
  );
}

/** To'liq, HALOL to'ldirilgan metadata (soxta da'vosiz) — release rejimida o'tishi SHART. */
function filledDoc(doc) {
  doc.owner.publisherDisplayName = "FrameFlow";
  doc.owner.publisherAccountEmail = "owner@example.com";
  doc.owner.supportUrl = "https://getframeflow.app/support";
  doc.owner.privacyPolicyUrl = "https://getframeflow.app/privacy";
  doc.owner.termsUrl = "https://getframeflow.app/terms";
  doc.owner.signingCertificateSource = "self-signed";
  doc.listing.shortDescription = "Browse approved After Effects templates and generate assets inside the panel.";
  doc.listing.longDescription = "FrameFlow is an After Effects panel for browsing an approved template catalog and generating images, video, voice and SFX with credits.";
  doc.listing.category = "Video";
  doc.listing.keywords = ["templates", "motion graphics", "generative"];
  doc.listing.pricingModel = "free-with-in-app-purchase";
  doc.visualAssets.icon = "plugins/after-effects-cep/marketplace-submission.json";
  doc.visualAssets.screenshot1 = "plugins/after-effects-cep/marketplace-submission.json";
  doc.visualAssets.screenshot2 = "plugins/after-effects-cep/marketplace-submission.json";
  doc.acknowledgements.updateChannel = "marketplace-plus-in-panel";
  doc.acknowledgements.inPanelUpdaterCoexistence = "accepted-both-may-notify";
  return doc;
}

metaCase("jonli metadata QA rejimida yiqilmaydi (joy egallovchi ruxsat)", () => {}, { mode: "qa" });
metaCase("jonli metadata release rejimida joy egallovchi uchun yiqiladi", () => {}, {
  expectFail: /yechilmagan ega joy egallovchisi/,
});
metaCase("to'liq halol metadata release rejimida o'tadi", filledDoc, {});
metaCase(
  "mijoz soni da'vosi",
  (d) => {
    filledDoc(d);
    d.listing.shortDescription = "Trusted by 12,000+ creators worldwide.";
  },
  { expectFail: /mijoz\/yuklab olish soni/ }
);
metaCase(
  "reyting da'vosi",
  (d) => {
    filledDoc(d);
    d.listing.longDescription = "Rated 4.9/5 by our community.";
  },
  { expectFail: /reyting/ }
);
metaCase(
  "katalog hajmi da'vosi",
  (d) => {
    filledDoc(d);
    d.listing.longDescription = "Instant access to 5,000+ templates.";
  },
  { expectFail: /katalog hajmi/ }
);
metaCase(
  "qo'llab-quvvatlash kafolati da'vosi",
  (d) => {
    filledDoc(d);
    d.listing.shortDescription = "24/7 support with a money-back guarantee.";
  },
  { expectFail: /qo'llab-quvvatlash kafolati/ }
);
metaCase(
  "narx da'vosi listing matnida",
  (d) => {
    filledDoc(d);
    d.listing.shortDescription = "Only $9 per month for everything.";
  },
  { expectFail: /narx da'vosi/ }
);
metaCase(
  "manifestda yo'q mahsulot mosligi (Premiere Pro)",
  (d) => {
    filledDoc(d);
    d.listing.longDescription = "Works in After Effects and Premiere Pro.";
  },
  { expectFail: /Premiere Pro/ }
);
metaCase(
  "kalit so'zda soxta da'vo",
  (d) => {
    filledDoc(d);
    d.listing.keywords = ["templates", "10,000+ assets"];
  },
  { expectFail: /katalog hajmi/ }
);
metaCase(
  "HTTPS bo'lmagan qo'llab-quvvatlash URL'i",
  (d) => {
    filledDoc(d);
    d.owner.supportUrl = "http://getframeflow.app/support";
  },
  { expectFail: /HTTPS URL/ }
);
metaCase(
  "publisherAccountEmail email SHAKLIDA emas (bo'sh emasligi yetarli emas)",
  (d) => {
    filledDoc(d);
    d.owner.publisherAccountEmail = "n/a";
  },
  { expectFail: /publisherAccountEmail" email shaklida/ }
);
metaCase(
  "publisherAccountEmail domensiz/@ siz to'ldirilgan",
  (d) => {
    filledDoc(d);
    d.owner.publisherAccountEmail = "owner-at-example.com";
  },
  { expectFail: /publisherAccountEmail" email shaklida/ }
);
metaCase(
  "publisherAccountEmail TLD'siz domen",
  (d) => {
    filledDoc(d);
    d.owner.publisherAccountEmail = "owner@localhost";
  },
  { expectFail: /publisherAccountEmail" email shaklida/ }
);
{
  // Ega email'i yiqilgan taqdirda ham hisobotga CHIQMASLIGI shart (chop etish/uzatish YO'Q).
  const SENTINEL = "SENTINEL-OWNER-EMAIL-LEAK";
  const file = path.join(WORK, "meta-email-leak.json");
  const doc = filledDoc(JSON.parse(LIVE_META));
  doc.owner.publisherAccountEmail = `${SENTINEL}@@example.com`;
  writeFileSync(file, JSON.stringify(doc, null, 2));
  const report = createReport();
  auditSubmissionMetadata(report, { mode: "release", manifest: LIVE_MANIFEST, file });
  check(
    "F: buzuq email yiqiladi, LEKIN qiymat hisobotga sizmaydi",
    report.failed.some((f) => /publisherAccountEmail" email shaklida/.test(f.label)) &&
      !JSON.stringify(report.checks.concat(report.notes)).includes(SENTINEL)
  );
}
metaCase(
  "ruxsat etilmagan sertifikat manbai",
  (d) => {
    filledDoc(d);
    d.owner.signingCertificateSource = "borrowed";
  },
  { expectFail: /signingCertificateSource/ }
);
metaCase(
  "to'g'ridan installer kanali birlamchi qilib qo'yildi",
  (d) => {
    filledDoc(d);
    d.acknowledgements.directInstallerChannel = "primary";
  },
  { expectFail: /directInstallerChannel/ }
);
metaCase(
  "updater birga yashashi tan olinmagan",
  (d) => {
    filledDoc(d);
    d.acknowledgements.inPanelUpdaterCoexistence = "not-considered";
  },
  { expectFail: /inPanelUpdaterCoexistence/ }
);
metaCase(
  "listing nomi manifest ExtensionBundleName'dan farq qiladi",
  (d) => {
    filledDoc(d);
    d.listing.name = "FrameFlow Pro";
  },
  { expectFail: /ExtensionBundleName bilan bir xil/ }
);
metaCase(
  "vizual asset yo'li mavjud emas",
  (d) => {
    filledDoc(d);
    d.visualAssets.icon = "assets/does-not-exist.png";
  },
  { expectFail: /vizual asset mavjud/ }
);
metaCase(
  "majburiy kalit olib tashlandi",
  (d) => {
    filledDoc(d);
    delete d.owner.privacyPolicyUrl;
  },
  { expectFail: /privacyPolicyUrl" mavjud/ }
);
metaCase("buzuq JSON", null, { raw: "{ not json", expectFail: /JSON sifatida o'qildi/ });

{
  const report = createReport();
  auditSubmissionMetadata(report, {
    mode: "release",
    manifest: LIVE_MANIFEST,
    file: path.join(WORK, "no-such-metadata.json"),
  });
  check(
    "F: metadata fayli umuman yo'q → yiqiladi",
    report.failed.some((f) => /submission metadata bor/.test(f.label))
  );
}

// ── G) KRIPTOGRAFIK tekshiruv ORKESTRATSIYASI (Adobe ZXPSignCmd) ─────────────
//
// ⚠ CHEGARA — HALOL O'QI: quyidagi SOXTA tekshiruvchi fikstura imzoning KRIPTOGRAFIK
// haqiqiyligini ISBOTLAMAYDI va shunday da'vo QILMAYDI. U FAQAT ORKESTRATSIYANI isbotlaydi:
// vosita AYNAN `-verify <artefakt>` argumentlari bilan chaqiriladi, chiqish kodi 0 bo'lmasa
// yoki vosita topilmasa RELIZ rejimi YIQILADI, vositaning chiqishi hech qayerga sizmaydi.
// Haqiqiy kriptografik javobni FAQAT Adobe'ning haqiqiy ZXPSignCmd'i beradi (bu mashinada
// u YO'Q — shuning uchun haqiqiy `--release` bu yerda ataylab yiqiladi).

const VERIFIER_SENTINEL = "SENTINEL-VERIFIER-OUTPUT-MUST-NOT-LEAK";

/** Deterministik soxta tekshiruvchi: argv'ni faylga yozadi, sentinel chiqarib, `exitCode` bilan
 *  tugaydi. Sertifikat/parol umuman ishlatilmaydi — bu shunchaki argv yozuvchi. */
function fakeVerifier(name, exitCode) {
  const dir = path.join(WORK, `verifier-${name}`);
  mkdirSync(dir, { recursive: true });
  const log = path.join(dir, "argv.json");
  const bin = path.join(dir, "ZXPSignCmd");
  writeFileSync(
    bin,
    "#!/usr/bin/env node\n" +
      `require("node:fs").writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));\n` +
      `process.stdout.write(${JSON.stringify(`${VERIFIER_SENTINEL} stdout\n`)});\n` +
      `process.stderr.write(${JSON.stringify(`${VERIFIER_SENTINEL} stderr\n`)});\n` +
      `process.exit(${exitCode});\n`
  );
  chmodSync(bin, 0o755);
  return { bin, log };
}

const reportText = (r) =>
  JSON.stringify({ checks: r.checks, notes: r.notes, failed: r.failed.map((f) => f.label) });

// G1 — SOXTA META-INF/signatures.xml + tekshiruvchi YO'Q → RELIZ rejimi O'TMAYDI.
{
  const res = runPreflight({
    mode: "release",
    zxpPath: OK_ZXP,
    verifierPath: path.join(WORK, "nowhere", "ZXPSignCmd"),
  });
  const labels = res.report.failed.map((f) => f.label);
  check(
    "G: soxta imzo konverti + ZXPSignCmd yo'q → RELIZ rejimi O'TMAYDI (fail-closed)",
    res.nativeVerified === false && res.report.failed.length > 0,
    labels.join(" | ")
  );
  check(
    "G: yo'q ZXPSignCmd aynan 'vosita topilmadi' + 'tekshiruv bajarilmadi' deb yiqiladi",
    labels.some((l) => /ZXPSignCmd topildi/.test(l)) &&
      labels.some((l) => /kriptografik imzo tekshiruvi/.test(l)),
    labels.join(" | ")
  );
}

// G2 — berilgan yo'l bor, lekin bajariladigan emas → zaxiraga TUSHMAYDI, fail-closed.
{
  const dir = path.join(WORK, "verifier-noexec");
  mkdirSync(dir, { recursive: true });
  const bin = path.join(dir, "ZXPSignCmd");
  writeFileSync(bin, "#!/usr/bin/env node\nprocess.exit(0);\n");
  chmodSync(bin, 0o644);
  check(
    "G: bajarib bo'lmaydigan vosita yo'li → resolveZxpSignCmd null (jimgina boshqa binarga o'tmaydi)",
    resolveZxpSignCmd({ verifierPath: bin }).path === null
  );
  const res = runPreflight({ mode: "release", zxpPath: OK_ZXP, verifierPath: bin });
  check("G: bajarib bo'lmaydigan vosita → RELIZ yiqiladi", res.nativeVerified === false);
}

// G3 — tekshiruvchi 0 dan farqli kod qaytardi → fail-closed, chiqish sizmaydi.
{
  const v = fakeVerifier("nonzero", 3);
  const res = runPreflight({ mode: "release", zxpPath: OK_ZXP, verifierPath: v.bin });
  check(
    "G: tekshiruvchi chiqish kodi ≠ 0 → RELIZ fail-closed",
    res.nativeVerified === false &&
      res.report.failed.some((f) => /kriptografik imzo tekshiruvi/.test(f.label)),
    res.report.failed.map((f) => f.label).join(" | ")
  );
  check(
    "G: YIQILGAN tekshiruvchining stdout/stderr'i hisobotga sizmaydi",
    !reportText(res.report).includes(VERIFIER_SENTINEL)
  );
  check(
    "G: kod ≠ 0 bo'lsa ham vosita AYNAN ['-verify', <artefakt>] bilan chaqirilgan",
    JSON.stringify(JSON.parse(readFileSync(v.log, "utf8"))) === JSON.stringify(["-verify", OK_ZXP])
  );
}

// G4 — argv yozuvchi, 0 qaytaruvchi tekshiruvchi: qolgan JONLI-manba fiksturasi tekshiriladi.
//      (Bu FAQAT orkestratsiya isboti — kriptografik haqiqiylik isboti EMAS.)
{
  const v = fakeVerifier("ok", 0);
  const res = runPreflight({ mode: "release", zxpPath: OK_ZXP, verifierPath: v.bin });
  const labels = res.report.failed.map((f) => f.label);
  check(
    "G: soxta OK tekshiruvchi bilan release oqimi uchidan-uchiga (faqat ega metadata qoladi)",
    labels.length === 1 && /yechilmagan ega joy egallovchisi/.test(labels[0]),
    labels.join(" | ")
  );
  check("G: nativeVerified = true FAQAT chiqish kodi 0 bo'lganda", res.nativeVerified === true);
  const argv = JSON.parse(readFileSync(v.log, "utf8"));
  check(
    "G: ZXPSignCmd AYNAN ['-verify', <aynan topshiriladigan artefakt>] bilan chaqirildi",
    argv.length === 2 && argv[0] === "-verify" && argv[1] === OK_ZXP,
    JSON.stringify(argv)
  );
  check(
    "G: MUVAFFAQIYATLI tekshiruvchining chiqishi ham hisobotga sizmaydi",
    !reportText(res.report).includes(VERIFIER_SENTINEL)
  );
}

// G5 — QA rejimi vositani TALAB HAM QILMAYDI, CHAQIRMAYDI HAM.
{
  const v = fakeVerifier("qa-must-not-run", 0);
  const res = runPreflight({ mode: "qa", zxpPath: OK_ZXP, verifierPath: v.bin });
  check("G: QA rejimi ZXPSignCmd'ni CHAQIRMAYDI (argv jurnali yaratilmadi)", !existsSync(v.log));
  check(
    "G: QA rejimi hisobotida ZXPSignCmd talabi umuman yo'q",
    !/ZXPSignCmd/.test(reportText(res.report)) && res.nativeVerified === false
  );
  check("G: QA rejimi ZXPSignCmd'siz ham 0 fail bilan o'tadi", res.report.failed.length === 0,
    res.report.failed.map((f) => f.label).join(" | "));
}

// ── H) Skriptning o'zi ───────────────────────────────────────────────────────
const PREFLIGHT_SRC = readFileSync(path.join(PLUGIN_SRC, "scripts/marketplace-preflight.mjs"), "utf8");
const CODE_ONLY = PREFLIGHT_SRC.split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
const EXEC_TARGETS = [...CODE_ONLY.matchAll(/execFileSync\(\s*"([^"]+)"/g)].map((m) => m[1]);
const ENV_READS = [
  ...new Set(
    [...CODE_ONLY.matchAll(/process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([^"']+)["']\s*\])/g)].map(
      (m) => m[1] || m[2]
    )
  ),
];
check("H: preflight ZXP_CERT / ZXP_CERT_PASS o'qimaydi", !/ZXP_CERT/.test(CODE_ONLY));
check("H: preflight sertifikat yaratmaydi (-selfSignedCert yo'q)", !/selfSignedCert/.test(CODE_ONLY));
check("H: preflight -sign chaqirmaydi (faqat -verify)", !/"-sign"/.test(CODE_ONLY) && /"-verify"/.test(CODE_ONLY));
check(
  "H: preflight yagona LITERAL tashqi buyruq chaqiradi — bash build-zxp.sh (imzolash YO'Q)",
  EXEC_TARGETS.length === 1 && EXEC_TARGETS[0] === "bash",
  EXEC_TARGETS.join(", ")
);
check(
  "H: ZXPSignCmd argument MASSIVI bilan chaqiriladi (satr interpolatsiyasi yo'q)",
  /spawnSync\(\s*[A-Za-z_.$]+\s*,\s*\["-verify",\s*[A-Za-z_.$]+\s*\]/.test(CODE_ONLY)
);
check(
  "H: hech qayerda shell ishlatilmaydi (shell:true yo'q, exec/execSync/spawn yo'q)",
  !/shell\s*:\s*true/.test(CODE_ONLY) &&
    /shell\s*:\s*false/.test(CODE_ONLY) &&
    !/\bexecSync\(/.test(CODE_ONLY) &&
    !/(?<![A-Za-z.])exec\(/.test(CODE_ONLY) &&
    !/(?<![A-Za-z.])spawn\(/.test(CODE_ONLY)
);
check(
  "H: preflight faqat MAXFIY BO'LMAGAN env o'qiydi (PATH · ZXPSIGNCMD_PATH)",
  ENV_READS.length > 0 && ENV_READS.every((n) => ["PATH", "ZXPSIGNCMD_PATH"].includes(n)),
  ENV_READS.join(", ")
);
check(
  "H: ZXPSignCmd qidiruv joylari build-zxp.sh bilan bir xil",
  ["/Applications/Adobe Extension Manager CC/ZXPSignCmd", '"bin", ZXPSIGNCMD_BIN', '"tools", ZXPSIGNCMD_BIN'].every(
    (needle) => CODE_ONLY.includes(needle)
  )
);
check(
  "H: preflight faqat imzolanmagan QA build'ini quradi",
  /"--unsigned"/.test(CODE_ONLY) && !/--signed\b/.test(CODE_ONLY)
);
check(
  "H: QA arxivi jonli build orqali quriladi (nusxa ro'yxat emas)",
  /build-zxp\.sh/.test(CODE_ONLY) && /resolveFlavorFiles/.test(CODE_ONLY)
);
check(
  "H: jonli imzolangan artefakt yo'liga test yozmadi",
  !existsSync(path.join(path.dirname(QA_ARCHIVE), SIGNED_NAME))
);
check("H: buildCustomerQaArchive kutilgan QA nomini qaytaradi", path.basename(buildCustomerQaArchive()).endsWith("-unsigned.zip"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`\nYiqilgan tekshiruvlar:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
