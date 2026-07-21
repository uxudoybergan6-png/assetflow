// Task A — GET /api/plugin/version kontrakti regressiya testi (test infra yo'q — standalone).
// Ishga tushirish: npm run build -w apps/api && node apps/api/scripts/test-plugin-release-contract.mjs
import { computePluginVersionResponse } from "../dist/lib/plugin-release-contract.js";

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
function check(label, actual, expected) {
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
  { latest: null, updateAvailable: false, mandatory: false, downloadUrl: null }
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

if (fail) {
  console.error(`\n${fail} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (8 case).`);
