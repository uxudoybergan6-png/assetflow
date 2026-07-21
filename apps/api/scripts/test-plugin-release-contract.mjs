// Task A — GET /api/plugin/version kontrakti regressiya testi (test infra yo'q — standalone).
// Ishga tushirish: npm run build -w apps/api && node apps/api/scripts/test-plugin-release-contract.mjs
import {
  computePluginVersionResponse,
  isZxpReleaseKey,
  normalizeInstallerPlatform,
  detectPlatformFromUserAgent,
  resolveInstallerPlatform,
  isSha256Hex,
  installerExtension,
  isAllowedInstallerKey,
  installerFileName,
  validateInstallerInput,
  isHttpsUrl,
  selectInstallerRow,
  buildInstallerPayload,
} from "../dist/lib/plugin-release-contract.js";

const PUBLISHED_AT = new Date("2026-07-01T00:00:00Z");
const release = (overrides) => ({
  version: "1.1.1",
  releaseNotes: "Notes",
  publishedAt: PUBLISHED_AT,
  checksum: "abc123",
  mandatory: false,
  minSupportedVersion: null,
  ...overrides,
});

let fail = 0;
let total = 0;
function check(label, actual, expected) {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}`);
  if (!ok) {
    console.log("  got:     ", JSON.stringify(actual));
    console.log("  expected:", JSON.stringify(expected));
  }
}

// 1) Hech qanday reliz e'lon qilinmagan — beta hali chiqmagan (halol "yo'q" holat).
check(
  "no release published → latest null, no update, no download",
  computePluginVersionResponse("1.0.0", null, "https://example/should-be-ignored.zip"),
  { latest: null, updateAvailable: false, mandatory: false, downloadUrl: null, platform: null, installer: null, installerStatus: "unsupported_platform" }
);

// 2) Reliz bor, storage/S3 hali sozlanmagan (downloadUrl null) — CTA "unavailable" holatga tushishi kerak,
//    lekin kontrakt darajasida `latest` baribir qaytadi (klient buni "unavailable" deb aniqlaydi).
check(
  "release exists but downloadUrl null (storage not configured) → latest present, downloadUrl null",
  computePluginVersionResponse("1.0.0", release(), null).downloadUrl,
  null
);

// 3) Klient eski versiyada — yangilanish bor, downloadUrl mavjud.
check(
  "older client → updateAvailable true, downloadUrl passthrough",
  computePluginVersionResponse("1.0.0", release(), "https://cdn/pack.zip"),
  {
    latest: { version: "1.1.1", releaseNotes: "Notes", publishedAt: PUBLISHED_AT, checksum: "abc123" },
    updateAvailable: true,
    mandatory: false,
    downloadUrl: "https://cdn/pack.zip",
    platform: null,
    installer: null,
    installerStatus: "unsupported_platform",
  }
);

// 4) Klient bir xil versiyada — yangilanish yo'q.
check(
  "same version → updateAvailable false",
  computePluginVersionResponse("1.1.1", release(), "https://cdn/pack.zip").updateAvailable,
  false
);

// 5) Klient versiyasi noma'lum (current="") — yangilanish taklif qilinmaydi (portlamaydi).
check(
  "empty current → updateAvailable false (no false mandatory prompt)",
  computePluginVersionResponse("", release(), "https://cdn/pack.zip").updateAvailable,
  false
);

// 6) mandatory=true bo'lgan reliz — eski klient uchun majburiy yangilanish.
check(
  "mandatory release + older client → mandatory true",
  computePluginVersionResponse("1.0.0", release({ mandatory: true }), "https://cdn/pack.zip").mandatory,
  true
);

// 7) mandatory=false, lekin klient minSupportedVersion'dan past — baribir majburiy.
check(
  "below minSupportedVersion → mandatory true even if release.mandatory=false",
  computePluginVersionResponse("1.0.0", release({ minSupportedVersion: "1.1.0" }), "https://cdn/pack.zip").mandatory,
  true
);

// 8) Yangi klient (masalan 1.1.1) minSupportedVersion 1.1.0'dan yuqori — majburiy EMAS va yangilanish ham yo'q.
check(
  "at/above minSupportedVersion, no update available → mandatory false",
  computePluginVersionResponse("1.1.1", release({ minSupportedVersion: "1.1.0" }), "https://cdn/pack.zip").mandatory,
  false
);

// 9) Reliz kaliti — faqat .zxp qabul qilinadi (admin reliz e'lon qilish kontrakti).
check("accepts releases/frameflow-v1.1.1.zxp", isZxpReleaseKey("releases/frameflow-v1.1.1.zxp"), true);
check("accepts uppercase extension .ZXP", isZxpReleaseKey("releases/frameflow-v1.1.1.ZXP"), true);
check("rejects .zip package", isZxpReleaseKey("releases/frameflow-v1.1.1.zip"), false);
check("rejects extensionless key", isZxpReleaseKey("releases/frameflow-v1.1.1"), false);
check("rejects .zxp hidden inside a different extension", isZxpReleaseKey("releases/frameflow.zxp.exe"), false);
check("rejects empty key", isZxpReleaseKey(""), false);

// ── Task 2 — PLATFORMAGA XOS INSTALLER KONTRAKTI ────────────────────────────
// Panel endi o'zini o'zi yozmaydi: server FAQAT so'ralgan allowlist platformasining
// installerini beradi, SHA-256 majburiy, storage kaliti javobga CHIQMAYDI.

const SHA = "b".repeat(64);
const macRow = { platform: "mac", storageKey: "releases/1753-frameflow.pkg", sha256: SHA, sizeBytes: 4096 };
const winRow = { platform: "win", storageKey: "releases/1753-frameflow.exe", sha256: SHA, sizeBytes: 8192 };

// Platforma normalizatsiyasi (allowlist)
check("normalize mac", normalizeInstallerPlatform("mac"), "mac");
check("normalize darwin", normalizeInstallerPlatform("darwin"), "mac");
check("normalize macOS (case-insensitive)", normalizeInstallerPlatform("MacOS"), "mac");
check("normalize win32", normalizeInstallerPlatform("win32"), "win");
check("normalize windows", normalizeInstallerPlatform("Windows"), "win");
check("linux is not allowlisted", normalizeInstallerPlatform("linux"), null);
check("empty platform is not allowlisted", normalizeInstallerPlatform(""), null);
check("garbage platform is not allowlisted", normalizeInstallerPlatform("mac; rm -rf /"), null);

// UA aniqlash — faqat brauzer uchun zaxira; mobil OS plagin uchun mavjud emas.
check("UA Windows → win", detectPlatformFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "win");
check("UA Macintosh → mac", detectPlatformFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "mac");
check("UA iPhone → null (no plugin)", detectPlatformFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), null);
check("UA Linux → null", detectPlatformFromUserAgent("Mozilla/5.0 (X11; Linux x86_64)"), null);
check("explicit param wins over UA", resolveInstallerPlatform("win", "Mozilla/5.0 (Macintosh; Intel Mac OS X)"), { platform: "win", source: "explicit" });
check("explicit but unsupported → null (never UA-corrected)", resolveInstallerPlatform("linux", "Mozilla/5.0 (Macintosh; Intel Mac OS X)"), { platform: null, source: "explicit" });
check("no param → UA fallback", resolveInstallerPlatform(undefined, "Mozilla/5.0 (Windows NT 10.0)"), { platform: "win", source: "user-agent" });
check("no param, unknown UA → none", resolveInstallerPlatform(undefined, "curl/8.0"), { platform: null, source: "none" });

// SHA-256 shakli — aynan 64 hex
check("64 hex accepted", isSha256Hex(SHA), true);
check("uppercase hex accepted", isSha256Hex("A".repeat(64)), true);
check("63 hex rejected", isSha256Hex("a".repeat(63)), false);
check("65 hex rejected", isSha256Hex("a".repeat(65)), false);
check("non-hex rejected", isSha256Hex("z".repeat(64)), false);
check("empty checksum rejected", isSha256Hex(""), false);
check("null checksum rejected", isSha256Hex(null), false);

// Kalit allowlist'i (kengaytma + traversal)
check("mac accepts .pkg", isAllowedInstallerKey("mac", "releases/frameflow-1.2.0.pkg"), true);
check("mac rejects .exe", isAllowedInstallerKey("mac", "releases/frameflow-1.2.0.exe"), false);
check("mac rejects .zxp (legacy is never an installer)", isAllowedInstallerKey("mac", "releases/frameflow-1.2.0.zxp"), false);
check("mac rejects .zip", isAllowedInstallerKey("mac", "releases/frameflow-1.2.0.zip"), false);
check("win accepts .exe", isAllowedInstallerKey("win", "releases/frameflow-1.2.0.exe"), true);
check("win accepts .msi", isAllowedInstallerKey("win", "releases/frameflow-1.2.0.msi"), true);
check("win rejects .pkg", isAllowedInstallerKey("win", "releases/frameflow-1.2.0.pkg"), false);
check("win rejects .bat", isAllowedInstallerKey("win", "releases/frameflow-1.2.0.bat"), false);
check("rejects key outside releases/", isAllowedInstallerKey("mac", "assets/frameflow.pkg"), false);
check("rejects path traversal", isAllowedInstallerKey("mac", "releases/../secrets/frameflow.pkg"), false);
check("rejects backslash", isAllowedInstallerKey("win", "releases\\frameflow.exe"), false);
check("rejects double slash", isAllowedInstallerKey("mac", "releases//frameflow.pkg"), false);
check("rejects extensionless key", isAllowedInstallerKey("mac", "releases/frameflow"), false);
check("rejects unknown platform even with valid ext", isAllowedInstallerKey("linux", "releases/frameflow.pkg"), false);
check("extension helper is lowercase", installerExtension("releases/FrameFlow.PKG"), "pkg");

// Xavfsiz fayl nomi — server matnidan emas, versiyadan
check("installer file name built from version", installerFileName("1.2.0", "mac", "pkg"), "frameflow-plugin-1.2.0-mac.pkg");
check("traversal in version stripped (separators removed, always prefixed)", installerFileName("../..", "win", "exe"), "frameflow-plugin-....-win.exe");

// Admin publish tekshiruvi (route AYNAN shu funksiyani ishlatadi)
check("valid mac installer input accepted", validateInstallerInput({ platform: "mac", key: "releases/f.pkg", sha256: SHA }).ok, true);
check("input sha is normalised to lowercase", validateInstallerInput({ platform: "mac", key: "releases/f.pkg", sha256: "B".repeat(64) }).sha256, SHA);
check("missing sha rejected", validateInstallerInput({ platform: "mac", key: "releases/f.pkg" }).ok, false);
check("short sha rejected", validateInstallerInput({ platform: "mac", key: "releases/f.pkg", sha256: "abc" }).ok, false);
check("wrong extension rejected", validateInstallerInput({ platform: "mac", key: "releases/f.zip", sha256: SHA }).ok, false);
check("arbitrary file type rejected", validateInstallerInput({ platform: "win", key: "releases/f.sh", sha256: SHA }).ok, false);
check("unsupported platform rejected", validateInstallerInput({ platform: "linux", key: "releases/f.pkg", sha256: SHA }).ok, false);
check("traversal key rejected", validateInstallerInput({ platform: "mac", key: "releases/../f.pkg", sha256: SHA }).ok, false);

// Artefakt havolasi faqat https
check("https url accepted", isHttpsUrl("https://cdn/f.pkg"), true);
check("http url rejected", isHttpsUrl("http://cdn/f.pkg"), false);
check("file url rejected", isHttpsUrl("file:///tmp/f.pkg"), false);

// Qator tanlash — faqat so'ralgan platforma, yaroqsiz qator = yo'q
check("selects the mac row for mac", selectInstallerRow([winRow, macRow], "mac").storageKey, macRow.storageKey);
check("selects the win row for win", selectInstallerRow([winRow, macRow], "win").storageKey, winRow.storageKey);
check("no row for an unsupported platform", selectInstallerRow([winRow, macRow], null), null);
check("row with bad checksum is ignored", selectInstallerRow([{ ...macRow, sha256: "nope" }], "mac"), null);
check("row with mismatched extension is ignored", selectInstallerRow([{ ...macRow, storageKey: "releases/f.exe" }], "mac"), null);
check("row with zero size is ignored", selectInstallerRow([{ ...macRow, sizeBytes: 0 }], "mac"), null);
check("empty installer list → null", selectInstallerRow([], "mac"), null);

// Payload — kalit CHIQMAYDI, http havola qabul qilinmaydi
{
  const payload = buildInstallerPayload("1.2.0", macRow, "https://cdn/signed?x=1");
  check("payload has no storage key", Object.keys(payload).sort(), ["ext", "fileName", "platform", "sha256", "sizeBytes", "url"]);
  check("payload file name is safe", payload.fileName, "frameflow-plugin-1.2.0-mac.pkg");
  check("payload over http is refused", buildInstallerPayload("1.2.0", macRow, "http://cdn/x"), null);
  check("payload without url is refused", buildInstallerPayload("1.2.0", macRow, null), null);
}

// To'liq javob — installer bloki
{
  const payload = buildInstallerPayload("1.1.1", macRow, "https://cdn/signed");
  const res = computePluginVersionResponse("1.0.0", release(), null, { platform: "mac", installer: payload, status: "ok" });
  check("installer returned for the requested platform", res.installer.platform, "mac");
  check("installer status ok", res.installerStatus, "ok");
  check("update semantics unchanged with installers", [res.updateAvailable, res.mandatory], [true, false]);
  check("response never exposes a storage key", JSON.stringify(res).includes("releases/"), false);
}
check(
  "no installer for this platform → honest not_published, nothing to launch",
  (() => { const r = computePluginVersionResponse("1.0.0", release(), null, { platform: "win", installer: null, status: "not_published" }); return [r.installer, r.installerStatus]; })(),
  [null, "not_published"]
);
check(
  "unsupported OS → honest unsupported_platform",
  (() => { const r = computePluginVersionResponse("1.0.0", release(), null, { platform: null, installer: null, status: "unsupported_platform" }); return [r.installer, r.installerStatus]; })(),
  [null, "unsupported_platform"]
);
check(
  "storage down → honest storage_unavailable",
  computePluginVersionResponse("1.0.0", release(), null, { platform: "mac", installer: null, status: "storage_unavailable" }).installerStatus,
  "storage_unavailable"
);
check(
  "status ok without a payload is downgraded (fail-closed)",
  (() => { const r = computePluginVersionResponse("1.0.0", release(), null, { platform: "mac", installer: null, status: "ok" }); return [r.installer, r.installerStatus]; })(),
  [null, "not_published"]
);
check(
  "nothing published at all → not_published for a known platform",
  computePluginVersionResponse("1.0.0", null, null, { platform: "mac", installer: null, status: "not_published" }).installerStatus,
  "not_published"
);

if (fail) {
  console.error(`\n${fail}/${total} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (${total} case).`);

