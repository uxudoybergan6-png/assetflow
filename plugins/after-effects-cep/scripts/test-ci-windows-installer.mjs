// WINDOWS CI SHARTNOMASI TESTI — kross-platforma (macOS/Linux'da ham to'liq ishlaydi).
//
// Muammo: haqiqiy `wix build`, MSI ICE validatsiyasi va MSI'dan OLDINGI o'rnatma ustidan
// migratsiya FAQAT Windows'da tekshiriladi. Ular `.github/workflows/ci.yml` dagi
// `windows-installer` job'ida yashaydi — ya'ni jimgina "yo'qolib qolishi" mumkin
// (job o'chirilsa, WiX "latest"ga aylansa, validator olib tashlansa, soxta MSI yasalsa,
// eski fayllar ro'yxati qo'lda takrorlansa, sentinel tekshiruvi tushib qolsa yoki
// imzolanmagan `.msi` artefakt sifatida yuklansa).
//
// Shuning uchun bu test JONLI manba fayllarni o'qiydi (o'z nusxasini EMAS):
//   .github/workflows/ci.yml
//   plugins/after-effects-cep/scripts/ci-verify-win-install.ps1
//   plugins/after-effects-cep/scripts/build-installer-win.mjs
//   plugins/after-effects-cep/scripts/installer-{payload,wix}.mjs  (CLI kontrakti — bajariladi)
//   package.json
//
// Ishga tushirish: node plugins/after-effects-cep/scripts/test-ci-windows-installer.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PLUGIN_SRC, REPO_ROOT } from "./package-flavors.mjs";
import {
  INSTALL_DIR_NAME,
  expectedPayloadFiles,
  installerArtifactPath,
  obsoleteInstallFiles,
} from "./installer-payload.mjs";
// Nom fazosi orqali: eksport yo'qolса ham fayl yuklanadi va tekshiruv HALOL "failed" bo'ladi
// (import SyntaxError'i bilan butun test yiqilmaydi).
import * as wixGen from "./installer-wix.mjs";

const SCRIPTS = path.join(PLUGIN_SRC, "scripts");
const CI_YML = path.join(REPO_ROOT, ".github/workflows/ci.yml");
const PS1 = path.join(SCRIPTS, "ci-verify-win-install.ps1");
const WIN_BUILD = path.join(SCRIPTS, "build-installer-win.mjs");
const PAYLOAD_CLI = path.join(SCRIPTS, "installer-payload.mjs");
const WIX_CLI = path.join(SCRIPTS, "installer-wix.mjs");
const FLAVORS_CLI = path.join(SCRIPTS, "package-flavors.mjs");
const PKG_JSON = path.join(REPO_ROOT, "package.json");

const WIN_JOB = "windows-installer";
const CONTRACT_SCRIPT = "test:ci-windows-installer";

let passed = 0;
let failed = 0;
const failures = [];

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

function readOr(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

/** CLI'ni HAQIQATAN ishga tushiradi (kontrakt "aytilgan" emas, "ishlaydigan" bo'lsin). */
function cli(script, args) {
  try {
    return execFileSync(process.execPath, [script, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return `__CLI_FAIL__${(e && e.status) ?? -1}`;
  }
}
const cliLines = (script, args) =>
  cli(script, args)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Skanerlar KOD ustida ishlaydi — izohda "upload-artifact YO'Q" deb yozilgani buyruq emas
 *  (aks holda halol hujjat testni yiqitardi). YAML/PowerShell to'liq-qator izohlari va
 *  PowerShell blok izohi (`<# … #>`) olib tashlanadi. */
function codeOnly(src) {
  return src
    .replace(/<#[\s\S]*?#>/g, "")
    .split("\n")
    .filter((l) => !/^\s*(#|\/\/)/.test(l))
    .join("\n");
}

/** ci.yml ichidan bitta job blokini kesib oladi (2 probel chekinish darajasi). */
function ymlJob(yml, name) {
  const lines = yml.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

const yml = readOr(CI_YML);
const ps1 = readOr(PS1);
const winBuildSrc = readOr(WIN_BUILD);
const pkg = readOr(PKG_JSON);
const winJob = ymlJob(yml, WIN_JOB);
const buildJob = ymlJob(yml, "build");
const ymlCode = codeOnly(yml);
const winJobCode = codeOnly(winJob);
const winBuildCode = codeOnly(winBuildSrc);
const ps1Code = codeOnly(ps1);

// ══ A) Workflow mavjudligi va sintaksisi ════════════════════════════════════
console.log("\n── A) ci.yml — job mavjud va sintaksis ───────────────────────");

check(".github/workflows/ci.yml mavjud va bo'sh emas", yml.length > 0);
check(`ci.yml'da \`${WIN_JOB}\` job'i bor`, winJob.length > 0);
check("ci.yml'da mavjud Linux \`build\` job'i saqlangan", buildJob.length > 0);

// YAML sintaksisi — js-yaml mavjud bo'lsa (repo'ning o'z bog'liqligi emas, opportunistik).
let yamlDoc = null;
let yamlErr = null;
try {
  const { load } = await import("js-yaml");
  yamlDoc = load(yml);
} catch (e) {
  yamlErr = String((e && e.message) || e);
}
if (yamlDoc) {
  check("ci.yml YAML sifatida parse bo'ladi (js-yaml)", !!yamlDoc && typeof yamlDoc === "object");
  check(
    "YAML tuzilmasi: ikkala job ham e'lon qilingan",
    !!yamlDoc.jobs && !!yamlDoc.jobs[WIN_JOB] && !!yamlDoc.jobs.build,
    Object.keys((yamlDoc && yamlDoc.jobs) || {}).join(", ")
  );
  check("YAML: workflow ruxsati aynan { contents: read }", JSON.stringify(yamlDoc.permissions) === '{"contents":"read"}', JSON.stringify(yamlDoc.permissions));
  check(`YAML: ${WIN_JOB} runs-on = windows-latest`, yamlDoc.jobs?.[WIN_JOB]?.["runs-on"] === "windows-latest");
  check("YAML: build job runs-on = ubuntu-latest (Linux CI o'zgarmadi)", yamlDoc.jobs?.build?.["runs-on"] === "ubuntu-latest");
} else {
  // js-yaml yo'q bo'lsa ham kafolatlar matn darajasida quyida to'liq tekshiriladi.
  console.log(`⊘ js-yaml yo'q — YAML parse tekshiruvi matn tekshiruvlari bilan qoplandi (${yamlErr})`);
}

// ══ B) Trigger · ruxsat · concurrency · timeout ═════════════════════════════
console.log("\n── B) Trigger, ruxsat, concurrency, timeout ──────────────────");

check("trigger: har `pull_request`", /^on:\n(?:.*\n)*?\s{2}pull_request:\s*$/m.test(yml));
check("trigger: `main`ga push", /push:\s*\n\s+branches:\s*\n\s+- main\b/.test(yml));
check("workflow ruxsati minimal: `contents: read`", /^permissions:\s*\n\s+contents:\s*read\s*$/m.test(yml));
check("workflow'da hech qanday `write` ruxsati YO'Q", !/:\s*write\b/.test(ymlCode));
check("concurrency guruhi + cancel-in-progress bor", /^concurrency:/m.test(yml) && /cancel-in-progress:\s*true/.test(yml));
check(`${WIN_JOB}: runs-on windows-latest`, /runs-on:\s*windows-latest/.test(winJob));
check(`${WIN_JOB}: timeout-minutes qo'yilgan`, /timeout-minutes:\s*\d+/.test(winJob));
check(`${WIN_JOB}: default shell = pwsh`, /defaults:\s*\n\s+run:\s*\n\s+shell:\s*pwsh/.test(winJob));
check("build job timeout-minutes saqlangan", /timeout-minutes:\s*\d+/.test(buildJob));

// ══ C) Action'lar: birinchi tomon yoki SHA bilan qadalgan ═══════════════════
console.log("\n── C) Action'lar pinlangan · artefakt/sir YO'Q ───────────────");

const uses = [...ymlCode.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
check("workflow kamida bitta `uses:` action ishlatadi", uses.length > 0);
const badPins = uses.filter((u) => !/^actions\/[A-Za-z0-9._-]+@v\d+$/.test(u) && !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(u));
check(
  "har bir action birinchi tomon (actions/*@vN) yoki to'liq SHA bilan qadalgan",
  badPins.length === 0,
  badPins.join(", ")
);
check("uchinchi tomon action `@main`/`@master`/teg bilan ishlatilmaydi", !/uses:\s*(?!actions\/)[^\s@]+@(?:main|master|v\d+(?:\.\d+)*)\s*$/m.test(ymlCode));

check("imzolanmagan MSI artefakt sifatida YUKLANMAYDI (upload-artifact YO'Q)", !/upload-artifact/.test(ymlCode));
check("CI'da hech qanday `secrets.` ishlatilmaydi", !/secrets\./.test(ymlCode));
for (const env of ["FF_WIN_CERT", "FF_WIN_CERT_PASS", "FF_WIN_CERT_SHA1", "FF_SIGNED_ZXP", "ZXP_CERT"]) {
  check(`${WIN_JOB}: imzolash env'i "${env}" YO'Q`, !winJobCode.includes(env));
}
check(
  `${WIN_JOB}: sertifikat o'rnatish/yaratish buyrug'i YO'Q`,
  !/New-SelfSignedCertificate|Import-PfxCertificate|certutil|signtool/i.test(winJobCode)
);
check(`${WIN_JOB}: imzolangan build ishga tushirilmaydi (faqat --unsigned)`, !/build-installer-win\.mjs\s*$/m.test(winJobCode));

// ══ D) Qadalgan WiX toolchain ═══════════════════════════════════════════════
console.log("\n── D) WiX toolchain QADALGAN (latest emas) ───────────────────");

const wixPin = (winJob.match(/^\s*WIX_VERSION:\s*"(\d+\.\d+\.\d+)"\s*$/m) || [])[1] || null;
check("WIX_VERSION aniq semver bilan qadalgan (x.y.z)", !!wixPin, wixPin || "topilmadi");
check(
  "`dotnet tool install --global wix` versiya bilan chaqiriladi",
  /dotnet tool install --global wix --version \$env:WIX_VERSION/.test(winJob)
);
check(
  "cheklanmagan `latest` o'rnatma YO'Q (versiyasiz `dotnet tool install ... wix` qatori yo'q)",
  !/dotnet tool install[^\n]*\bwix\b(?![^\n]*--version)/.test(winJobCode)
);
check("`--prerelease` WiX o'rnatmasi YO'Q", !/--prerelease/.test(winJobCode));
check("o'rnatilgan WiX versiyasi qadalgan qiymatga solishtiriladi (fail-closed)", /wix --version/.test(winJob) && /StartsWith\(\$env:WIX_VERSION\)/.test(winJob));
check("WiX global tool yo'li PATH'ga aniq qo'shiladi", /GITHUB_PATH/.test(winJob) && /\.dotnet\\tools/.test(winJob));
check("`.NET` birinchi tomon action bilan o'rnatiladi", /uses:\s*actions\/setup-dotnet@v\d+/.test(winJob));
check("Node birinchi tomon action bilan o'rnatiladi", /uses:\s*actions\/setup-node@v\d+/.test(winJob));

// ══ E) Haqiqiy build + haqiqiy validator ════════════════════════════════════
console.log("\n── E) Haqiqiy build va MSI validatsiyasi ─────────────────────");

check(
  "MSI mavjud HAQIQIY skript bilan quriladi (build-installer-win.mjs --unsigned)",
  /node plugins\/after-effects-cep\/scripts\/build-installer-win\.mjs --unsigned/.test(winJob)
);
check("build-installer-win.mjs manbada mavjud", winBuildSrc.length > 0);
check(
  "job MSI baytlarini O'ZI YASAMAYDI (soxta OLE sarlavha/printf YO'Q)",
  !/d0cf11e0|\\320\\317/.test(winJobCode) && !/Set-Content[^\n]*\.msi/i.test(winJobCode)
);
check("MSI yo'li kontrakt CLI'sidan olinadi (qattiq yozilmagan)", /installer-payload\.mjs artifact win msi unsigned/.test(winJob));
check("rasmiy WiX/Windows validatsiyasi ishga tushadi (`wix msi validate`)", /wix msi validate/.test(winJob));
check(
  "validatsiya bostirilmaydi — workflow'da `-sval`/`-sw` YO'Q",
  !/(^|\s)-sval(\s|$)/m.test(winJobCode) && !/(^|\s)-sw\d*(\s|$)/m.test(winJobCode)
);
check(
  "build skriptida ham validatsiya bostirilmaydi (`wix build` standart ICE'lari kuchda)",
  !/(^|\s|")-sval(\s|"|$)/m.test(winBuildCode) && !/(^|\s|")-sw\d*(\s|"|$)/m.test(winBuildCode)
);
check("PowerShell qadamlari native xatoda to'xtaydi", (winJob.match(/\$ErrorActionPreference = 'Stop'/g) || []).length >= 4);
check(
  "PowerShell native chiqish kodlari xato deb qabul qilinadi",
  (winJob.match(/\$PSNativeCommandUseErrorActionPreference = \$true/g) || []).length >= 4
);

// ══ F) O'rnatish/o'chirish isboti (ci-verify-win-install.ps1) ═══════════════
console.log("\n── F) Jimgina o'rnatish · migratsiya · o'chirish ──────────────");

check("ci-verify-win-install.ps1 mavjud", ps1.length > 0);
check("workflow shu skriptni chaqiradi", /ci-verify-win-install\.ps1/.test(winJob));
check("skriptga MSI va ish papkasi uzatiladi", /-MsiPath \$msi/.test(winJob) && /-WorkDir "\$env:RUNNER_TEMP/.test(winJob));

check("ps1: `Set-StrictMode` yoqilgan", /Set-StrictMode -Version/.test(ps1));
check("ps1: `$ErrorActionPreference = 'Stop'`", /\$ErrorActionPreference = 'Stop'/.test(ps1));
check("ps1: native chiqish kodlari xato deb qabul qilinadi", /\$PSNativeCommandUseErrorActionPreference = \$true/.test(ps1));
check(
  "ps1: FAQAT ephemeral GitHub runner'da ishlaydi (aks holda darhol throw)",
  /\$env:GITHUB_ACTIONS -ne 'true'/.test(ps1) && /throw/.test(ps1)
);

check("ps1: jimgina o'rnatish `msiexec /i … /qn`", /'\/i'/.test(ps1) && /'\/qn'/.test(ps1) && /msiexec\.exe/.test(ps1));
check("ps1: jimgina o'chirish `msiexec /x … /qn`", /'\/x'/.test(ps1));
check("ps1: msiexec `-Wait -PassThru` bilan kutiladi (async qaytish qabul qilinmaydi)", (ps1.match(/-Wait -PassThru/g) || []).length >= 3);
check("ps1: o'rnatish/o'chirish chiqish kodi AYNAN 0 bo'lishi shart", (ps1.match(/\.ExitCode -ne 0/g) || []).length >= 2);

check("ps1: fayl butunligi SHA-256 bilan tekshiriladi", /Get-FileHash/.test(ps1) && /SHA256/.test(ps1));
check("ps1: o'rnatilgan ro'yxat manba payload'i bilan AYNAN solishtiriladi", /Assert-SetsEqual/.test(ps1) && /stagedFiles/.test(ps1));
check("ps1: eski qoldiqlar o'rnatmadan keyin YO'Qligi tekshiriladi", /MIGRATSIYA YIQILDI/.test(ps1));
check("ps1: `assetflow-data` sentinel yaratiladi", /assetflow-data\//.test(ps1));
check(
  "ps1: sentinel HAM o'rnatishdan, HAM o'chirishdan keyin tekshiriladi",
  (ps1.match(/sentinelAbs -PathType Leaf/g) || []).length >= 2 && (ps1.match(/sentinelSha/g) || []).length >= 3
);
check("ps1: o'chirishdan keyin MSI payload qoldig'i YO'Qligi tekshiriladi", /o'chirishdan keyin MSI payload qoldig|afterOwned/i.test(ps1));
check("ps1: per-user isboti — tizim papkasiga yozilmagani tekshiriladi", /ProgramFiles/.test(ps1));

// ══ G) Ro'yxatlar YAGONA manbadan (nusxa YO'Q) ══════════════════════════════
console.log("\n── G) Kontrakt yagona manbadan (drift YO'Q) ──────────────────");

check("ps1 eski fayllar ro'yxatini CLI'dan oladi", /'stale-files'/.test(ps1));
check("ps1 payload ro'yxatini CLI'dan oladi", /'payload-files'/.test(ps1));
check("ps1 manba payload'ini CLI bilan yig'adi (`stage`)", /'stage'/.test(ps1));
check("ps1 o'rnatma papkasi nomini flavor manbasidan oladi", /'field', 'customer', 'installDirName'/.test(ps1));
check("ps1 migratsiya keypath'ini generator CLI'sidan oladi", /'cleanup-registry'/.test(ps1));

const stale = obsoleteInstallFiles();
for (const rel of stale) {
  check(`ps1'da eski fayl nomi "${rel}" QATTIQ YOZILMAGAN (faqat CLI'dan)`, !ps1.includes(rel));
  check(`ci.yml'da eski fayl nomi "${rel}" QATTIQ YOZILMAGAN`, !yml.includes(rel));
}
const payloadNames = expectedPayloadFiles();
const hardcodedPayload = payloadNames.filter((f) => ps1.includes(f) || yml.includes(f));
check("payload fayl nomlari na ps1'da, na ci.yml'da qattiq yozilgan", hardcodedPayload.length === 0, hardcodedPayload.join(", "));

// Kontraktning O'ZI: eski ro'yxat aynan 4 ta ma'lum ichki fayl (qulf).
check(
  `obsoleteInstallFiles() aynan 4 ta ichki qoldiq beradi (${stale.join(", ")})`,
  JSON.stringify(stale) === JSON.stringify([".debug", ".debug.admin", "AssetFlow_Admin.html", "CSXS/manifest.admin.xml"]),
  stale.join(", ")
);
check("eski ro'yxat joriy payload bilan kesishmaydi", stale.every((f) => !payloadNames.includes(f)));

// ── CLI'lar HAQIQATAN ishlaydi va eksport bilan bayt-ba-bayt mos ───────────
check(
  "`installer-payload.mjs stale-files` obsoleteInstallFiles() bilan AYNAN mos",
  JSON.stringify(cliLines(PAYLOAD_CLI, ["stale-files"])) === JSON.stringify(stale)
);
check(
  "`installer-payload.mjs payload-files` expectedPayloadFiles() bilan AYNAN mos",
  JSON.stringify(cliLines(PAYLOAD_CLI, ["payload-files"])) === JSON.stringify(payloadNames)
);
check(
  "`installer-payload.mjs artifact win msi unsigned` kutilgan yo'lni beradi",
  cliLines(PAYLOAD_CLI, ["artifact", "win", "msi", "unsigned"])[0] === installerArtifactPath("win", "msi", { signed: false })
);
check(
  "`package-flavors.mjs field customer installDirName` o'rnatma papkasini beradi",
  cliLines(FLAVORS_CLI, ["field", "customer", "installDirName"])[0] === INSTALL_DIR_NAME
);
const regLine = cliLines(WIX_CLI, ["cleanup-registry"])[0] || "";
check(
  "`installer-wix.mjs cleanup-registry` HKCU keypath kontraktini beradi (key<TAB>name)",
  regLine === `${wixGen.CLEANUP_REGISTRY_KEY}\t${wixGen.CLEANUP_REGISTRY_NAME}` && regLine.includes("\t"),
  regLine
);
const sampleWxs =
  typeof wixGen.buildWxsSource === "function"
    ? wixGen.buildWxsSource({ version: "9.9.9", payloadFiles: ["CSXS/manifest.xml"], installDirName: INSTALL_DIR_NAME })
    : "";
check(
  "CLI bergan keypath generatsiya qilingan `.wxs` ichidagi qiymat bilan bir xil (drift qorovuli)",
  !!regLine && sampleWxs.includes(`Key="${regLine.split("\t")[0]}"`) && sampleWxs.includes(`Name="${regLine.split("\t")[1]}"`)
);

// ══ H) Xavfsiz tozalash (keng o'chirish YO'Q) ═══════════════════════════════
console.log("\n── H) Tozalash: `finally` + AYNAN per-user nishon ────────────");

check("ps1'da `finally` bloki bor (nosozlikda ham tozalanadi)", /\nfinally \{/.test(ps1));
const removeLines = ps1Code.split("\n").filter((l) => /Remove-Item/.test(l));
check("ps1 `Remove-Item` ishlatadi (tozalash haqiqiy)", removeLines.length > 0);
check(
  "har bir `Remove-Item` -LiteralPath bilan va faqat tekshirilgan o'zgaruvchiga",
  removeLines.every((l) => /-LiteralPath \$(target|workFull)\b/.test(l)),
  removeLines.join(" | ")
);
check("tozalashda joker (`*`/`?`) yo'l YO'Q", !/Remove-Item[^\n]*[*?]/.test(ps1Code));
check(
  "tozalash `finally` ichida va nishon tekshirilgandagina bajariladi",
  /\$targetValidated -and \(Test-Path -LiteralPath \$target/.test(ps1)
);
check(
  "keng nishonlar o'chirilmaydi (APPDATA/USERPROFILE/extensions ildizi/Program Files)",
  !/Remove-Item[^\n]*\$env:(APPDATA|USERPROFILE|ProgramFiles|SystemRoot|TEMP)\b/.test(ps1Code) &&
    !/Remove-Item[^\n]*\$extensionsRoot\b/.test(ps1Code) &&
    !/Remove-Item[^\n]*\$profileRoot\b/.test(ps1Code)
);
check(
  "nishon yo'li qattiq tekshiriladi (APPDATA + Adobe\\CEP\\extensions + profil ichida)",
  /\$env:APPDATA 'Adobe\\CEP\\extensions'/.test(ps1) &&
    /StartsWith\(\$profileRoot/.test(ps1) &&
    /EndsWith\("\\Adobe\\CEP\\extensions\\\$installDirName"/.test(ps1)
);
check("mavjud o'rnatma ustidan ishlash RAD ETILADI (fail-closed)", /allaqachon mavjud/.test(ps1));
check("ish papkasi RUNNER_TEMP ichida bo'lishi majburiy", /RUNNER_TEMP ichida bo'lishi SHART/.test(ps1));

// ── Adobe/tizim holatiga tegilmaydi ────────────────────────────────────────
for (const needle of ["PlayerDebugMode", "com.adobe.CSXS", "HKLM", "reg add", "Set-ItemProperty", "New-ItemProperty"]) {
  check(`ps1 Adobe/tizim holatini o'zgartirmaydi — "${needle}" YO'Q`, !ps1.includes(needle));
}
check("ps1 tizim papkasiga YOZMAYDI (ProgramFiles faqat Test-Path bilan o'qiladi)", !/(New-Item|Set-Content|Copy-Item)[^\n]*ProgramFiles/.test(ps1Code));

// ══ I) Linux CI o'zgarmadi + npm skript ═════════════════════════════════════
console.log("\n── I) Linux CI saqlangan · npm skript ────────────────────────");

for (const step of [
  "uses: actions/checkout@v4",
  "uses: actions/setup-node@v4",
  "run: npm ci",
  "run: npm run generate -w @creative-tools/database",
  "run: npm run build -w @creative-tools/database",
  "run: npm run build -w apps/api",
]) {
  check(`Linux build job'ida "${step}" saqlangan`, buildJob.includes(step));
}
check("Linux build job'i `cache: npm` bilan qolgan", /cache:\s*npm/.test(buildJob));
check(`Linux build job'i shu shartnoma testini ishga tushiradi (${CONTRACT_SCRIPT})`, buildJob.includes(`npm run ${CONTRACT_SCRIPT}`));
check(`package.json'da "${CONTRACT_SCRIPT}" skripti bor`, new RegExp(`"${CONTRACT_SCRIPT}":\\s*"node plugins/after-effects-cep/scripts/test-ci-windows-installer\\.mjs"`).test(pkg));
check("mavjud installer test skriptlari o'chirilmagan", /"test:plugin-installers"/.test(pkg) && /"test:plugin-package"/.test(pkg));

// ══ Yakun ═══════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`\nYiqilgan tekshiruvlar:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
