// MARKETPLACE PREFLIGHT — Adobe Developer Distribution (Creative Cloud Marketplace) uchun
// MIJOZ CEP paketining topshirishga tayyorligini FAIL-CLOSED tekshiradi.
//
// Bu skript KUTILGAN HOLATNI NUSXA QILMAYDI: har tekshiruv JONLI manbadan (CSXS/manifest.xml,
// AssetFlow_Plugin.html, assetflow-env.js) va YANGI QURILGAN mijoz arxividan o'qiydi. Fayl
// ro'yxati, versiya, ID va artefakt nomlari — `package-flavors.mjs` (yagona manba); referens
// mantiqi — `verify-zxp-package.mjs`; imzo/bayt bog'lash — `installer-payload.mjs`. Bu yerda
// raqib ro'yxat YO'Q.
//
// Rasmiy asos (faqat quyidagilar; boshqa Adobe siyosati TAXMIN QILINMAYDI):
//   1. Developer Distribution CEP/ZXP listingini qabul qiladi; CEP paketi (CSXS manifest +
//      extension HTML) va ZXPSignCmd bilan imzolash oqimi talab qilinadi.
//      https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/submission/overview
//   2. Marketplace/Creative Cloud Desktop bir bosishda o'rnatish va avtomatik yangilanish
//      bildirishnomasi/o'rnatishini beradi.
//      https://developer.adobe.com/developer-distribution/creative-cloud/docs/guides/best-practices
//   3. Adobe CEP namunasi ZXPSignCmd'ni hujjatlaydi; o'z-o'zidan imzolangan yoki tijorat
//      sertifikati mumkin.  https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/ReadMe.md
//      Vositaning o'zi (imzolash VA `-verify` tekshiruvi):
//      https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD
//
// REJIMLAR:
//   node marketplace-preflight.mjs                 # QA STRUKTURA — kredensialsiz, lokal.
//                                                  #   imzolangan artefakt ham, ZXPSignCmd ham
//                                                  #   TALAB QILINMAYDI va CHAQIRILMAYDI;
//                                                  #   natija HECH QACHON "topshirishga tayyor" demaydi.
//   node marketplace-preflight.mjs --release       # RELIZ — imzolangan .zxp + Adobe ZXPSignCmd
//                                                  #   bilan KRIPTOGRAFIK tekshiruv + to'liq ega
//                                                  #   metadata SHART.
//   ... --zxp=<path>                               # imzolangan artefakt yo'li (BASENAME manbadan
//                                                  #   olingan kutilgan nomga TENG bo'lishi shart).
//   ... --zxpsigncmd=<path>                        # ZXPSignCmd bajariladigan faylining ANIQ yo'li
//                                                  #   (env: ZXPSIGNCMD_PATH). MAXFIY EMAS — faqat
//                                                  #   vosita yo'li; test/CI uchun.
//
// XAVFSIZLIK: bu skript sertifikat YARATMAYDI, saqlamaydi va O'QIMAYDI. `ZXP_CERT`/
// `ZXP_CERT_PASS` bu faylda umuman ishlatilmaydi (test buni majburlaydi). Maxfiy naqsh
// topilsa — FAQAT fayl nomi + naqsh nomi chop etiladi, QIYMAT hech qachon. ZXPSignCmd'ning
// stdout/stderr'i HECH QACHON chop etilmaydi (sertifikat metadatasi bo'lishi mumkin) — faqat
// o'tdi/yiqildi/vosita-yo'q holati. Ega email'i hech qayerga chop etilmaydi va uzatilmaydi.

import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_SURFACE,
  DEBUG_SURFACE,
  FORBIDDEN_CEF_FLAGS,
  PLUGIN_SRC,
  REPO_ROOT,
  SECRET_PATTERNS,
  artifactName,
  artifactPath,
  declaredPluginVersion,
  flavorVersion,
  getFlavor,
  matchesSecretPattern,
  resolveFlavorFiles,
} from "./package-flavors.mjs";
import { extractAll, listEntries, readEntry, verifyArchiveReferences } from "./verify-zxp-package.mjs";
import {
  SIGNATURE_ENVELOPE_ALLOWED,
  expectedPayloadFiles,
  stageCustomerPayload,
  verifyPayload,
} from "./installer-payload.mjs";

export const FLAVOR_KEY = "customer";
export const SUBMISSION_FILE = path.join(PLUGIN_SRC, "marketplace-submission.json");

/** Ega to'ldirishi shart bo'lgan joy egallovchilar (release rejimida HAR BIRI yiqiladi). */
export const OWNER_PLACEHOLDERS = ["OWNER-INPUT-REQUIRED", "OWNER-VISUAL-INPUT"];

/** Metadata sxemasi — release rejimida MAJBURIY yo'llar va (bo'lsa) ruxsat etilgan qiymatlar.
 *  `assetPath: true` → qiymat repo'ga nisbatan MAVJUD fayl bo'lishi shart. */
const SUBMISSION_SCHEMA = [
  { key: "channel", oneOf: ["adobe-developer-distribution"] },
  { key: "owner.publisherDisplayName" },
  // Faqat "bo'sh emas" YETARLI EMAS edi: "n/a" ham o'tib ketardi. Shakl tekshiriladi,
  // QIYMAT esa hech qayerga chop etilmaydi va uzatilmaydi.
  { key: "owner.publisherAccountEmail", email: true },
  { key: "owner.supportUrl", url: true },
  { key: "owner.privacyPolicyUrl", url: true },
  { key: "owner.termsUrl", url: true },
  { key: "owner.signingCertificateSource", oneOf: ["self-signed", "commercial-code-signing"] },
  { key: "listing.name", matchesBundleName: true },
  { key: "listing.shortDescription", copy: true },
  { key: "listing.longDescription", copy: true },
  { key: "listing.category" },
  { key: "listing.keywords", list: true, copy: true },
  { key: "listing.pricingModel", oneOf: ["free", "paid", "free-with-in-app-purchase"] },
  { key: "visualAssets.icon", assetPath: true },
  { key: "visualAssets.screenshot1", assetPath: true },
  { key: "visualAssets.screenshot2", assetPath: true },
  {
    key: "acknowledgements.updateChannel",
    oneOf: ["marketplace-only", "marketplace-plus-in-panel"],
  },
  {
    // Marketplace/CC Desktop avtomatik yangilaydi (rasmiy fakt #2), panelda esa o'z
    // yangilanish bildirishnomasi bor. Ega bu birga yashashni ANIQ tan olishi shart.
    key: "acknowledgements.inPanelUpdaterCoexistence",
    oneOf: ["accepted-both-may-notify", "in-panel-updater-disabled-in-separate-task"],
  },
  {
    // Xavfsizlik chegarasi: to'g'ridan `.pkg`/`.msi` — KEYINGI zaxira kanal.
    key: "acknowledgements.directInstallerChannel",
    oneOf: ["backup-later"],
  },
];

/** Listing matnida TAQIQLANGAN da'volar — hech biri koddan tasdiqlanmaydi.
 *  (Veb marketing nusxasi ALOHIDA qo'riqlanadi: `scripts/verify-public-copy.mjs`.) */
const FABRICATED_CLAIM_PATTERNS = [
  ["mijoz/yuklab olish soni", /\b\d[\d.,]*\s*(?:k|m|\+)?\s*(?:users?|customers?|creators?|installs?|downloads?|subscribers?)\b/i],
  ["reyting/sharh", /\b\d(?:\.\d)?\s*(?:\/\s*5|stars?)\b|average rating|top[- ]rated/i],
  ["katalog hajmi", /\b\d[\d.,]*\s*\+?\s*(?:templates?|assets?|presets?|packs?)\b/i],
  ["qo'llab-quvvatlash kafolati", /24\/7|guarantee|guaranteed|\bSLA\b|instant support|money[- ]?back/i],
  ["narx da'vosi", /\$\s?\d|\b\d+\s?(?:USD|EUR)\b|per month|\/mo\b|\bfree forever\b/i],
  ["reyting-siz ustunlik da'vosi", /\b(?:#\s?1|no\.?\s?1|the best|world'?s|industry[- ]leading)\b/i],
];

/** Manifest HostList'da E'LON QILINMAGAN mahsulotlar listing matnida va'da qilinmaydi. */
const HOST_PRODUCT_NAMES = { AEFT: ["After Effects"] };
const OTHER_PRODUCT_NAMES = [
  "Premiere Pro",
  "DaVinci Resolve",
  "Final Cut",
  "Photoshop",
  "Illustrator",
  "InDesign",
  "Audition",
  "Media Encoder",
  "Blender",
  "Figma",
];

const TEXT_EXT = new Set([".html", ".js", ".jsx", ".css", ".xml", ".json", ".txt", ".md", ".debug"]);

// ── Natija yig'gich ──────────────────────────────────────────────────────────

export function createReport() {
  const checks = [];
  const notes = [];
  return {
    checks,
    notes,
    check(label, ok, detail) {
      checks.push({ label, ok: !!ok, detail: ok ? "" : String(detail == null ? "" : detail) });
      return !!ok;
    },
    note(label, detail) {
      notes.push({ label, detail: String(detail == null ? "" : detail) });
    },
    get failed() {
      return checks.filter((c) => !c.ok);
    },
  };
}

// ── 1) JONLI manifest ↔ flavor manbasi (drift) ───────────────────────────────

export function parseLiveManifest(xml) {
  const listBlock = (xml.match(/<ExtensionList>[\s\S]*?<\/ExtensionList>/i) || [""])[0];
  const dispatchBlock = (xml.match(/<DispatchInfoList>[\s\S]*?<\/DispatchInfoList>/i) || [""])[0];
  const hostBlock = (xml.match(/<HostList>[\s\S]*?<\/HostList>/i) || [""])[0];
  return {
    bundleId: (xml.match(/ExtensionBundleId="([^"]+)"/) || [])[1] || null,
    bundleName: (xml.match(/ExtensionBundleName="([^"]+)"/) || [])[1] || null,
    bundleVersion: (xml.match(/ExtensionBundleVersion="([^"]+)"/) || [])[1] || null,
    listExtensions: [...listBlock.matchAll(/<Extension\s+Id="([^"]+)"(?:\s+Version="([^"]+)")?/gi)].map(
      (m) => ({ id: m[1], version: m[2] || null })
    ),
    dispatchIds: extractAll(dispatchBlock, /<Extension\s+Id="([^"]+)"/gi),
    mainPaths: extractAll(xml, /<MainPath>([^<]+)<\/MainPath>/gi),
    scriptPaths: extractAll(xml, /<ScriptPath>([^<]+)<\/ScriptPath>/gi),
    menus: extractAll(xml, /<Menu>([^<]+)<\/Menu>/gi),
    hosts: [...hostBlock.matchAll(/<Host\s+Name="([^"]+)"\s+Version="([^"]+)"/gi)].map((m) => ({
      name: m[1],
      version: m[2],
    })),
    requiredRuntimes: [...xml.matchAll(/<RequiredRuntime\s+Name="([^"]+)"\s+Version="([^"]+)"/gi)].map(
      (m) => ({ name: m[1], version: m[2] })
    ),
    cefParams: extractAll(xml, /<Parameter>([^<]+)<\/Parameter>/gi).map((p) => p.trim()),
  };
}

const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** `xml` berilmasa — JONLI manbadan o'qiladi. Berilishi FAQAT mutatsiya testlari uchun
 *  (jonli manbadan olingan matnni buzib, tekshiruv haqiqatan yiqilishini isbotlash). */
export function auditManifestSource(report, { xml: overrideXml = null } = {}) {
  const flavor = getFlavor(FLAVOR_KEY);
  const xml =
    overrideXml == null ? readFileSync(path.join(PLUGIN_SRC, flavor.manifestSource), "utf8") : overrideXml;
  const m = parseLiveManifest(xml);
  // Versiya AYNAN tekshirilayotgan manifestdan olinadi — so'ng BOSHQA fayllar bilan
  // solishtiriladi (manifest.admin, AF_PLUGIN_VERSION). Shu tartibda drift ko'rinadi.
  const version = m.bundleVersion;
  const declared = declaredPluginVersion();

  report.check(`manifest ExtensionBundleId = ${flavor.bundleId}`, m.bundleId === flavor.bundleId, m.bundleId);
  report.check(
    `manifest ExtensionBundleName = ${flavor.bundleName}`,
    m.bundleName === flavor.bundleName,
    m.bundleName
  );
  report.check(
    `manifest ExtensionList = aynan [${flavor.extensionId}]`,
    m.listExtensions.length === 1 && m.listExtensions[0].id === flavor.extensionId,
    `got [${m.listExtensions.map((e) => e.id).join(", ")}]`
  );
  // Bu atribut ilgari HECH QAYERDA tekshirilmasdi — bundle versiyasidan jimgina ajrab ketardi.
  report.check(
    `manifest <Extension Version="${version}"> bundle versiyasiga teng`,
    m.listExtensions.length === 1 && m.listExtensions[0].version === version,
    `got ${m.listExtensions.map((e) => e.version).join(", ")}`
  );
  report.check(
    `manifest DispatchInfo = aynan [${flavor.extensionId}]`,
    m.dispatchIds.length === 1 && m.dispatchIds[0] === flavor.extensionId,
    `got [${m.dispatchIds.join(", ")}]`
  );
  report.check(
    `manifest MainPath = ${flavor.mainPath} (CEP paketining extension HTML'i)`,
    sameList(m.mainPaths, [flavor.mainPath]),
    `got [${m.mainPaths.join(", ")}]`
  );
  report.check(
    `manifest ScriptPath = ${flavor.scriptPath}`,
    sameList(m.scriptPaths, [flavor.scriptPath]),
    `got [${m.scriptPaths.join(", ")}]`
  );
  report.check(
    `manifest Menu = ${flavor.menuLabel}`,
    sameList(m.menus, [flavor.menuLabel]),
    `got [${m.menus.join(", ")}]`
  );
  report.check(
    `manifest HostList = ${flavor.hosts.map((h) => `${h.name} ${h.version}`).join(", ")}`,
    sameList(m.hosts, flavor.hosts),
    `got [${m.hosts.map((h) => `${h.name} ${h.version}`).join(", ")}]`
  );
  report.check(
    `manifest RequiredRuntime = ${flavor.requiredRuntime.name} ${flavor.requiredRuntime.version}`,
    sameList(m.requiredRuntimes, [flavor.requiredRuntime]),
    `got [${m.requiredRuntimes.map((r) => `${r.name} ${r.version}`).join(", ")}]`
  );
  report.check(
    `manifest CEF bayroqlari flavor allowlist'iga AYNAN teng (${flavor.cefParams.length} ta)`,
    sameList([...m.cefParams].sort(), [...flavor.cefParams].sort()),
    `got [${m.cefParams.join(", ")}]`
  );
  for (const flag of FORBIDDEN_CEF_FLAGS) {
    report.check(`manifest ${flag} ishlatmaydi`, !xml.includes(flag), "manifestda topildi");
  }
  report.check(
    `versiya sinxron: manifest ${version} = manifest.admin ${flavorVersion("admin")} = AF_PLUGIN_VERSION ${declared}`,
    version === flavorVersion("admin") && version === declared
  );
  report.check(
    `manifest ExtensionBundleVersion semver shaklida (${version})`,
    /^\d+\.\d+\.\d+$/.test(String(version)),
    version
  );
  report.check(
    `manifest versiyasi flavor manbasi bilan bir xil (${flavorVersion(FLAVOR_KEY)})`,
    version === flavorVersion(FLAVOR_KEY),
    `${version} ≠ ${flavorVersion(FLAVOR_KEY)}`
  );
  return { manifest: m, xml, version };
}

// ── 2) YANGI qurilgan mijoz QA arxivi ────────────────────────────────────────

export function buildCustomerQaArchive() {
  execFileSync("bash", [path.join(PLUGIN_SRC, "scripts/build-zxp.sh"), `--${FLAVOR_KEY}`, "--unsigned"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return artifactPath(FLAVOR_KEY, { signed: false });
}

/** Arxiv tarkibini tekshiradi. `signed` — imzo konverti KUTILADI (aks holda TAQIQ). */
export function auditArchive(report, archivePath, { tag, signed, liveManifestXml }) {
  const flavor = getFlavor(FLAVOR_KEY);
  const entries = listEntries(archivePath);
  const files = [...entries].filter((e) => !e.endsWith("/"));
  const envelope = files.filter((f) => f === "mimetype" || f.startsWith("META-INF/"));
  const body = files.filter((f) => !envelope.includes(f));
  const expected = resolveFlavorFiles(FLAVOR_KEY).map((f) => f.to);

  // a) Talab qilinadigan CEP paket tuzilmasi (rasmiy fakt #1)
  report.check(`${tag}: CSXS/manifest.xml bor`, entries.has("CSXS/manifest.xml"));
  report.check(`${tag}: extension HTML bor (${flavor.mainHtml})`, entries.has(flavor.mainHtml));

  // b) Fayl ro'yxati flavor manbasiga AYNAN teng
  const extra = body.filter((f) => !expected.includes(f)).sort();
  const missing = expected.filter((f) => !body.includes(f)).sort();
  report.check(
    `${tag}: fayl ro'yxati flavor manbasiga aynan mos (${expected.length} ta)`,
    extra.length === 0 && missing.length === 0,
    `ortiqcha=[${extra.join(", ")}] yetishmayapti=[${missing.join(", ")}]`
  );

  // c) Imzo konverti — faqat imzolangan artefaktda va faqat yopiq ro'yxatdan
  const rogueEnvelope = envelope.filter((f) => !SIGNATURE_ENVELOPE_ALLOWED.includes(f));
  report.check(
    `${tag}: imzo konvertida yot yo'l yo'q`,
    rogueEnvelope.length === 0,
    rogueEnvelope.join(", ")
  );
  if (signed) {
    // HALOL NOM: bu FAQAT konvert borligini aytadi. Kriptografik haqiqiylikni ZXPSignCmd
    // tekshiradi (`verifySignatureWithZxpSignCmd`) — oddiy zip ham bu faylni saqlashi mumkin.
    report.check(
      `${tag}: imzo konverti mavjud (META-INF/signatures.xml)`,
      envelope.includes("META-INF/signatures.xml"),
      `envelope=[${envelope.join(", ")}]`
    );
  } else {
    report.check(
      `${tag}: imzo konverti YO'Q (QA arxivi topshirilmaydi)`,
      envelope.length === 0,
      `envelope=[${envelope.join(", ")}]`
    );
  }

  // d) Runtime referenslari (verify-zxp-package.mjs mantiqi — nusxa YO'Q)
  const refs = verifyArchiveReferences(archivePath);
  report.check(
    `${tag}: barcha runtime referenslari yechildi (${refs.checks.length} ta)`,
    refs.failed === 0,
    refs.checks.filter((c) => !c.ok).map((c) => c.label).join("; ")
  );
  const unreferenced = body
    .filter((f) => f !== "CSXS/manifest.xml" && !refs.resolved.has(f))
    .sort();
  if (unreferenced.length) {
    report.note(
      `${tag}: paketda bor, lekin runtime referensi yo'q (${unreferenced.length} fayl)`,
      unreferenced.join(", ")
    );
  }

  // e) Qurilgan manifest JONLI manba bilan bayt-ba-bayt bir xil
  if (liveManifestXml != null) {
    report.check(
      `${tag}: arxivdagi CSXS/manifest.xml jonli manba bilan bir xil`,
      entries.has("CSXS/manifest.xml") && readEntry(archivePath, "CSXS/manifest.xml") === liveManifestXml
    );
  }

  // f) Matn skanlari: admin sirti · debug sirti · maxfiy kalit · masofaviy kod
  const texts = body
    .filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => [f, readEntry(archivePath, f)]);

  for (const f of ADMIN_SURFACE.files) {
    report.check(`${tag}: Admin fayli "${f}" yo'q`, !files.includes(f), "arxivda topildi");
  }
  for (const needle of [...ADMIN_SURFACE.identifiers, ...ADMIN_SURFACE.storageKeys]) {
    const hit = texts.find(([, t]) => t.includes(needle));
    report.check(`${tag}: Admin belgisi "${needle}" hech bir faylda yo'q`, !hit, hit && hit[0]);
  }
  for (const f of DEBUG_SURFACE.files) {
    const hit = files.find((e) => e === f || e.endsWith(`/${f}`));
    report.check(`${tag}: debug profili "${f}" yo'q`, !hit, hit);
  }
  for (const marker of DEBUG_SURFACE.markers) {
    const hit = texts.find(([, t]) => t.includes(marker));
    report.check(`${tag}: debug/xavfsizlik marker "${marker}" yo'q`, !hit, hit && hit[0]);
  }
  const secretHits = [];
  for (const [f, t] of texts) {
    for (const p of SECRET_PATTERNS) {
      // FAQAT fayl nomi + naqsh nomi — mos kelgan QIYMAT hech qayerga chiqmaydi.
      if (matchesSecretPattern(t, p)) secretHits.push(`${f} [${p.name}]`);
    }
  }
  report.check(`${tag}: maxfiy kalit/sertifikat naqshi yo'q`, secretHits.length === 0, secretHits.join(", "));

  // g) Masofaviy kod: topshirilgan baytlar bajariladigan baytlar bo'lishi kerak.
  const remote = [];
  for (const [f, t] of texts) {
    if (path.extname(f).toLowerCase() !== ".html") continue;
    for (const raw of [
      ...extractAll(t, /<script[^>]+src=["']([^"']+)["']/gi),
      ...extractAll(t, /<link[^>]+href=["']([^"']+)["']/gi),
    ]) {
      if (/^(?:https?:)?\/\//i.test(raw.trim())) remote.push(`${f} → ${raw}`);
    }
  }
  report.check(
    `${tag}: masofadan yuklanadigan <script>/<link> yo'q (paket o'zi-yetarli)`,
    remote.length === 0,
    remote.join(", ")
  );

  return { files, body, envelope, texts };
}

// ── 3) Paketlangan env moduli: standart endpoint'lar HTTPS ───────────────────

/** `assetflow-env.js` ni AYNAN paketdan olib, CEP paneli sharoitida (file:// → hostname "")
 *  bajaradi va standart endpoint'lar HTTPS ekanini tasdiqlaydi. */
export function auditPackagedEnvDefaults(report, archivePath, tag) {
  let env;
  try {
    const src = readEntry(archivePath, "assetflow-env.js");
    const win = { location: { hostname: "" } };
    env = new Function("window", `${src}\nreturn window.ASSETFLOW_ENV;`)(win);
  } catch (e) {
    report.check(`${tag}: assetflow-env.js bajarildi`, false, String((e && e.message) || e));
    return;
  }
  const api = String(env && env.defaultApi ? env.defaultApi() : "");
  const admin = String(env && env.defaultAdmin ? env.defaultAdmin() : "");
  report.check(`${tag}: panel standart API endpoint'i HTTPS (${api})`, api.startsWith("https://"), api);
  report.check(`${tag}: panel standart admin URL'i HTTPS (${admin})`, admin.startsWith("https://"), admin);
  report.check(
    `${tag}: e'lon qilingan prod endpoint'lari HTTPS`,
    String(env.prodApi || "").startsWith("https://") && String(env.prodAdmin || "").startsWith("https://"),
    `${env.prodApi} · ${env.prodAdmin}`
  );
}

// ── 4) Artefakt nomlari va "imzolangan" da'vosi ──────────────────────────────

export function auditArtifactNaming(report, { signedPath, mode }) {
  const qaName = artifactName(FLAVOR_KEY, { signed: false });
  const signedName = artifactName(FLAVOR_KEY, { signed: true });
  report.check(
    `QA arxivi nomi "-unsigned.zip" bilan tugaydi (topshirib bo'lmaydi): ${qaName}`,
    qaName.endsWith("-unsigned.zip"),
    qaName
  );
  report.check(
    `topshiriladigan artefakt nomi .zxp (manbadan): ${signedName}`,
    signedName.endsWith(".zxp") && !signedName.includes("unsigned"),
    signedName
  );
  report.check(
    `berilgan imzolangan artefakt nomi kutilgan nomga teng`,
    path.basename(signedPath) === signedName,
    `${path.basename(signedPath)} ≠ ${signedName}`
  );

  // Imzolanmagan zip imzolangan nom ostida turishi — "reliz tayyor" degan eng xavfli yolg'on.
  // DIQQAT: konvert borligi imzo HAQIQIYligini isbotlamaydi — bu faqat ARZON birinchi filtr.
  if (existsSync(signedPath)) {
    let entries;
    try {
      entries = listEntries(signedPath);
    } catch (e) {
      report.check(`imzolangan artefakt o'qildi: ${path.basename(signedPath)}`, false, String((e && e.message) || e));
      return { present: true, hasEnvelope: false };
    }
    const hasEnvelope = entries.has("META-INF/signatures.xml");
    report.check(
      `imzolangan nomdagi artefaktda imzo konverti bor (imzolanmagan zip emas)`,
      hasEnvelope,
      "META-INF/signatures.xml yo'q"
    );
    return { present: true, hasEnvelope };
  }
  if (mode === "release") {
    report.check(
      `imzolangan artefakt mavjud: ${path.relative(REPO_ROOT, signedPath)}`,
      false,
      "ZXPSignCmd + haqiqiy sertifikat bilan qurilishi shart (bu skript sertifikat yaratmaydi)"
    );
  } else {
    report.note(
      "imzolangan .zxp YO'Q — QA rejimi uni talab qilmaydi",
      `${path.relative(REPO_ROOT, signedPath)} topilmadi; bu natija TOPSHIRISHGA TAYYOR degani EMAS`
    );
  }
  return { present: false, hasEnvelope: false };
}

/** RELIZ rejimi: imzolangan konteynerning TANASI joriy mijoz payload baytlariga tengligini
 *  isbotlaydi (`installer-payload.mjs` bayt-taqqoslash mantiqi — nusxa YO'Q).
 *  BU KRIPTOGRAFIK IMZO TEKSHIRUVI EMAS — uni `verifySignatureWithZxpSignCmd` bajaradi. */
export function auditSignedArtifact(report, signedPath, liveManifestXml) {
  auditArchive(report, signedPath, { tag: "signed .zxp", signed: true, liveManifestXml });
  auditPackagedEnvDefaults(report, signedPath, "signed .zxp");

  const work = mkdtempSync(path.join(tmpdir(), "ff-mkt-"));
  try {
    const staged = stageCustomerPayload(path.join(work, "payload"), { signedZxp: signedPath });
    const verified = verifyPayload(path.join(work, "payload"));
    report.check(
      "imzolangan konteyner tanasi JORIY mijoz payload baytlariga teng (SHA-256)",
      staged.envelope.includes("META-INF/signatures.xml") && verified.signed === true,
      `envelope=[${staged.envelope.join(", ")}]`
    );
    const expected = expectedPayloadFiles();
    const bodyFiles = verified.files.filter((f) => !verified.envelope.includes(f)).sort();
    report.check(
      `imzolangan payload ro'yxati flavor manbasiga teng (${expected.length} ta)`,
      sameList(bodyFiles, expected),
      `got ${bodyFiles.length}`
    );
  } catch (e) {
    report.check(
      "imzolangan konteyner tanasi JORIY mijoz payload baytlariga teng (SHA-256)",
      false,
      String((e && e.message) || e)
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const size = statSync(signedPath).size;
  report.check(`imzolangan artefakt bo'sh emas (${size} bayt)`, size > 0);
}

// ── 4B) KRIPTOGRAFIK imzo tekshiruvi — Adobe ZXPSignCmd (FAQAT reliz) ────────
//
// Imzo konvertining BORLIGI imzoning HAQIQIYligini isbotlamaydi: har qanday zip'ga
// `META-INF/signatures.xml` nomli fayl qo'shish mumkin. Shuning uchun RELIZ rejimida
// AYNAN topshiriladigan artefakt Adobe'ning RASMIY vositasi bilan tekshiriladi:
//
//     ZXPSignCmd -verify <artefakt>
//
// Bajarish: argument MASSIVI bilan (shell YO'Q, satr interpolatsiyasi YO'Q). Chiqish kodi
// AYNAN 0 bo'lishi shart. Vosita topilmasa, ishga tushmasa yoki kod ≠ 0 → FAIL-CLOSED
// (o'tkazib yuborish YO'Q). Vositaning stdout/stderr'i O'QILADI-YU, HECH QACHON hisobotga
// yoki ekranga chiqmaydi — u sertifikat metadatasini saqlashi mumkin.

export const ZXPSIGNCMD_BIN = "ZXPSignCmd";

export const NATIVE_VERIFY_LABEL =
  "ZXPSignCmd -verify AYNAN shu artefaktda muvaffaqiyatli (kriptografik imzo tekshiruvi)";
const NATIVE_TOOL_LABEL = "Adobe ZXPSignCmd topildi (rasmiy imzo tekshiruvchisi)";

/** build-zxp.sh dagi AYNAN o'sha ma'lum joylar (§ "ZXPSignCmd yo'li") — nusxa siyosat yo'q. */
export function zxpSignCmdSearchPaths() {
  return [
    "/Applications/Adobe Extension Manager CC/ZXPSignCmd",
    path.join(homedir(), "bin", ZXPSIGNCMD_BIN),
    path.join(REPO_ROOT, "tools", ZXPSIGNCMD_BIN),
  ];
}

function isExecutableFile(p) {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** ZXPSignCmd yo'lini topadi. `verifierPath` — ANIQ berilgan vosita yo'li (MAXFIY EMAS:
 *  bu kredensial emas, bajariladigan fayl yo'li). ANIQ berilgan bo'lsa va yaroqsiz bo'lsa —
 *  zaxiraga TUSHMAYDI (jimgina boshqa binarni ishlatib yuborish xavfi yo'q).
 *  @returns {{path: string|null, source: "explicit"|"PATH"|"known-location"|"not-found"}} */
export function resolveZxpSignCmd({ verifierPath = null } = {}) {
  if (verifierPath) {
    const abs = path.resolve(verifierPath);
    return { path: isExecutableFile(abs) ? abs : null, source: "explicit" };
  }
  // build-zxp.sh dagi `command -v ZXPSignCmd` ekvivalenti — shell ishga tushirmasdan.
  for (const dir of String(process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const abs = path.join(dir, ZXPSIGNCMD_BIN);
    if (isExecutableFile(abs)) return { path: abs, source: "PATH" };
  }
  for (const abs of zxpSignCmdSearchPaths()) {
    if (isExecutableFile(abs)) return { path: abs, source: "known-location" };
  }
  return { path: null, source: "not-found" };
}

/** RELIZ rejimi: artefaktni Adobe ZXPSignCmd bilan kriptografik tekshiradi.
 *  @returns {{ok: boolean, source: string}} — `ok` FAQAT chiqish kodi 0 bo'lganda. */
export function verifySignatureWithZxpSignCmd(
  report,
  artifact,
  { verifierPath = null, artifactPresent = true } = {}
) {
  if (!artifactPresent) {
    report.check(NATIVE_VERIFY_LABEL, false, "imzolangan artefakt yo'q — tekshiruv bajarilmadi");
    return { ok: false, source: "no-artifact" };
  }

  const tool = resolveZxpSignCmd({ verifierPath });
  report.check(
    NATIVE_TOOL_LABEL,
    tool.path != null,
    verifierPath
      ? "berilgan vosita yo'li bajariladigan fayl emas (--zxpsigncmd / ZXPSIGNCMD_PATH)"
      : "topilmadi: PATH · /Applications/Adobe Extension Manager CC · ~/bin · <repo>/tools" +
          " (yoki --zxpsigncmd=<path>). O'rnatish: Adobe-CEP/CEP-Resources → ZXPSignCMD"
  );
  if (!tool.path) {
    report.check(NATIVE_VERIFY_LABEL, false, "vosita yo'q — tekshiruv O'TKAZIB YUBORILMAYDI (fail-closed)");
    return { ok: false, source: tool.source };
  }

  // Argument MASSIVI, shell:false. Vosita chiqishi olinadi (quvur to'lib qolmasin), lekin
  // hisobotga HECH QACHON qo'shilmaydi.
  let res;
  try {
    res = spawnSync(tool.path, ["-verify", artifact], {
      shell: false,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
      windowsHide: true,
    });
  } catch (e) {
    report.check(NATIVE_VERIFY_LABEL, false, `vosita ishga tushmadi (${(e && e.code) || "spawn-error"})`);
    return { ok: false, source: tool.source };
  }
  if (res.error) {
    report.check(NATIVE_VERIFY_LABEL, false, `vosita ishga tushmadi (${res.error.code || "spawn-error"})`);
    return { ok: false, source: tool.source };
  }
  if (res.signal) {
    report.check(NATIVE_VERIFY_LABEL, false, `vosita signal bilan tugadi (${res.signal})`);
    return { ok: false, source: tool.source };
  }
  const ok = res.status === 0;
  report.check(
    NATIVE_VERIFY_LABEL,
    ok,
    `chiqish kodi ${res.status} (vosita chiqishi ataylab chop etilmaydi)`
  );
  if (ok) report.note("kriptografik tekshiruv bajarildi", `ZXPSignCmd manbai: ${tool.source}`);
  return { ok, source: tool.source };
}

// ── 5) Ega metadata (submission kit) ─────────────────────────────────────────

const getPath = (obj, key) =>
  key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

const asStrings = (v) => (Array.isArray(v) ? v.map((x) => String(x)) : [String(v == null ? "" : v)]);

/** KONSERVATIV email shakli (RFC 5322 emas — ataylab tor): bo'shliqsiz, AYNAN bitta "@",
 *  nuqtali domen, TLD ≥ 2 harf, ketma-ket/chetdagi nuqta yo'q. Maqsad — "n/a", "OWNER",
 *  "owner-at-example" kabi to'ldirilmagan qiymatlar release rejimidan o'tib ketmasin.
 *  QIYMAT hech qayerga qaytarilmaydi, chop etilmaydi va uzatilmaydi — faqat true/false. */
const EMAIL_SHAPE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
export function looksLikeEmail(value) {
  const s = String(value == null ? "" : value);
  if (s.length < 6 || s.length > 254) return false;
  if (s.includes("..") || s.startsWith(".") || s.split("@")[0].endsWith(".")) return false;
  return EMAIL_SHAPE.test(s);
}

export function auditSubmissionMetadata(report, { mode, manifest, file = SUBMISSION_FILE }) {
  if (!existsSync(file)) {
    report.check(`submission metadata bor: ${path.relative(REPO_ROOT, file)}`, false, "fayl yo'q");
    return;
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    report.check("submission metadata JSON sifatida o'qildi", false, String((e && e.message) || e));
    return;
  }
  report.check("submission metadata JSON sifatida o'qildi", true);

  const flavor = getFlavor(FLAVOR_KEY);
  const declaredHosts = new Set((manifest ? manifest.hosts : flavor.hosts).map((h) => h.name));
  const allowedProducts = [...declaredHosts].flatMap((h) => HOST_PRODUCT_NAMES[h] || []);
  const unresolved = [];

  for (const rule of SUBMISSION_SCHEMA) {
    const raw = getPath(doc, rule.key);
    const values = asStrings(raw);
    const present = raw != null && values.length > 0 && values.every((v) => v.trim() !== "");
    report.check(`metadata "${rule.key}" mavjud`, present, "yo'q yoki bo'sh");
    if (!present) continue;

    const placeholder = values.some((v) => OWNER_PLACEHOLDERS.some((p) => v.includes(p)));
    if (placeholder) {
      unresolved.push(rule.key);
      // QA rejimida joy egallovchi RUXSAT — release rejimida pastda yiqiladi.
      continue;
    }
    if (rule.oneOf) {
      report.check(
        `metadata "${rule.key}" ruxsat etilgan qiymat (${rule.oneOf.join(" | ")})`,
        values.every((v) => rule.oneOf.includes(v)),
        values.join(", ")
      );
    }
    if (rule.url) {
      report.check(
        `metadata "${rule.key}" HTTPS URL`,
        values.every((v) => /^https:\/\/\S+$/.test(v)),
        values.join(", ")
      );
    }
    if (rule.email) {
      // Detal ATAYLAB qiymatsiz: ega email'i logga/ekranga chiqmaydi.
      report.check(
        `metadata "${rule.key}" email shaklida`,
        values.length === 1 && looksLikeEmail(values[0]),
        "shakl noto'g'ri — qiymat ataylab ko'rsatilmaydi"
      );
    }
    if (rule.matchesBundleName) {
      report.check(
        `metadata "${rule.key}" manifest ExtensionBundleName bilan bir xil`,
        values.length === 1 && values[0] === flavor.bundleName,
        `${values.join(", ")} ≠ ${flavor.bundleName}`
      );
    }
    if (rule.assetPath) {
      const abs = path.resolve(REPO_ROOT, values[0]);
      report.check(
        `metadata "${rule.key}" ko'rsatgan vizual asset mavjud`,
        abs.startsWith(REPO_ROOT + path.sep) && existsSync(abs) && statSync(abs).isFile(),
        values[0]
      );
    }
    if (rule.copy) {
      for (const value of values) {
        for (const [label, re] of FABRICATED_CLAIM_PATTERNS) {
          report.check(
            `metadata "${rule.key}" — ${label} da'vosi yo'q`,
            !re.test(value),
            `mos keldi: ${label}`
          );
        }
        for (const product of OTHER_PRODUCT_NAMES) {
          if (allowedProducts.includes(product)) continue;
          report.check(
            `metadata "${rule.key}" — manifestda yo'q "${product}" mosligini va'da qilmaydi`,
            !value.includes(product),
            product
          );
        }
      }
    }
  }

  if (mode === "release") {
    report.check(
      `metadata'da yechilmagan ega joy egallovchisi yo'q (${OWNER_PLACEHOLDERS.join(" / ")})`,
      unresolved.length === 0,
      unresolved.join(", ")
    );
  } else if (unresolved.length) {
    report.note(
      `metadata: ${unresolved.length} maydon hali EGA kiritishini kutmoqda (QA rejimida ruxsat)`,
      unresolved.join(", ")
    );
  }
}

// ── Yig'uvchi ────────────────────────────────────────────────────────────────

export function runPreflight({ mode = "qa", zxpPath = null, verifierPath = null } = {}) {
  const report = createReport();
  const { xml, version } = auditManifestSource(report);

  const qaArchive = buildCustomerQaArchive();
  auditArchive(report, qaArchive, { tag: "QA zip", signed: false, liveManifestXml: xml });
  auditPackagedEnvDefaults(report, qaArchive, "QA zip");

  const signedPath = zxpPath || artifactPath(FLAVOR_KEY, { signed: true });
  const signed = auditArtifactNaming(report, { signedPath, mode });

  // QA rejimi ZXPSignCmd'ni TALAB HAM QILMAYDI, CHAQIRMAYDI HAM (kredensial/vositasiz ishlaydi).
  let nativeVerified = false;
  if (mode === "release") {
    if (signed.present && signed.hasEnvelope) auditSignedArtifact(report, signedPath, xml);
    nativeVerified = verifySignatureWithZxpSignCmd(report, signedPath, {
      verifierPath,
      artifactPresent: signed.present,
    }).ok;
  }

  const flavor = getFlavor(FLAVOR_KEY);
  const live = parseLiveManifest(xml);
  auditSubmissionMetadata(report, { mode, manifest: live });

  return {
    report,
    version,
    qaArchive,
    signedPath,
    signedPresent: signed.present,
    nativeVerified,
    flavor,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  let mode = "qa";
  let zxpPath = null;
  let verifierPath = null;
  for (const arg of argv) {
    if (arg === "--release") mode = "release";
    else if (arg === "--qa") mode = "qa";
    else if (arg.startsWith("--zxp=")) zxpPath = path.resolve(arg.slice(6));
    else if (arg.startsWith("--zxpsigncmd=")) verifierPath = path.resolve(arg.slice(13));
    else {
      console.error(`✗ Noma'lum argument: ${arg} (--qa | --release | --zxp=<path> | --zxpsigncmd=<path>)`);
      process.exit(2);
    }
  }
  // Vosita yo'li — MAXFIY EMAS (kredensial emas). Bayroq berilmasa CI/test env'i ishlatiladi.
  if (!verifierPath && process.env.ZXPSIGNCMD_PATH) verifierPath = path.resolve(process.env.ZXPSIGNCMD_PATH);

  console.log(
    `→ Marketplace preflight — rejim: ${
      mode === "release"
        ? "RELIZ (imzolangan artefakt + ZXPSignCmd -verify SHART)"
        : "QA STRUKTURA (kredensialsiz, ZXPSignCmd chaqirilmaydi)"
    }\n`
  );

  let result;
  try {
    result = runPreflight({ mode, zxpPath, verifierPath });
  } catch (e) {
    console.error(`✗ Preflight bajarilmadi: ${(e && e.message) || e}`);
    process.exit(1);
  }

  const { report } = result;
  for (const c of report.checks) {
    console.log(c.ok ? `✓  ${c.label}` : `✗ FAIL  ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  for (const n of report.notes) console.log(`ⓘ  ${n.label}${n.detail ? ` — ${n.detail}` : ""}`);

  const failed = report.failed;
  console.log(`\n${report.checks.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) {
    console.error(`\nYiqilgan tekshiruvlar:\n - ${failed.map((f) => f.label).join("\n - ")}`);
    process.exit(1);
  }
  if (mode === "release") {
    // Muvaffaqiyat xabari FAQAT Adobe ZXPSignCmd kriptografik tekshiruvidan KEYIN.
    if (!result.nativeVerified) {
      console.error(
        "\n✗ RELIZ preflight: kriptografik imzo tekshiruvi TASDIQLANMADI — natija topshirishga tayyor EMAS."
      );
      process.exit(1);
    }
    console.log(
      `\n✓ RELIZ preflight o'tdi — ZXPSignCmd -verify muvaffaqiyatli: ${path.relative(REPO_ROOT, result.signedPath)} (v${result.version}).` +
        "\n  Bu paketni LOKAL kriptografik tekshiruvi. Yakuniy qabul va ishonch siyosati —" +
        "\n  Adobe portali / Creative Cloud. Ega qadamlari: docs/MARKETPLACE-SUBMISSION.md"
    );
  } else {
    console.log(
      `\n✓ QA struktura preflight o'tdi (v${result.version}).` +
        "\n  ⚠ Bu TOPSHIRISHGA TAYYOR degani EMAS: imzolangan .zxp va kriptografik imzo tekshirilmadi." +
        "\n  Topshirish uchun: imzolangan build → `npm run preflight:marketplace -- --release`"
    );
  }
}
