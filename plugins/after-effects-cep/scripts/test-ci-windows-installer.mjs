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
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
// 2026-07-21 masofaviy run (d1e44e8): validator `error WIX0204: ICE64` bilan 10 marta yiqildi.
// TO'G'RI yechim — avtorlashni tuzatish (generator `RemoveFolder` qatorlari), ICE'ni BOSTIRISH EMAS.
check(
  "ICE bostirish YO'Q: `-sice`/`SuppressIces`/`SuppressValidation` na workflow'da, na build skriptida",
  !/-sice|SuppressIces|SuppressValidation/i.test(winJobCode) && !/-sice|SuppressIces|SuppressValidation/i.test(winBuildCode)
);
check(
  "validate qadami `continue-on-error` bilan yumshatilmagan",
  !/continue-on-error/.test(ymlCode)
);
check(
  "validator xatosi try/catch bilan yutilmaydi (job'da PowerShell try/catch YO'Q)",
  !/\btry\s*\{/.test(winJobCode) && !/\bcatch\b/.test(winJobCode)
);
check(
  "validator chiqish kodi e'tiborsiz qoldirilmaydi (`|| true` / `$LASTEXITCODE` yumshatish YO'Q)",
  !/\|\|\s*true/.test(winJobCode) && !/exit\s+0/.test(winJobCode)
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
check(
  "ps1: ICE64 papka tozalash BO'SH papkaga cheklangani isbotlanadi (nishon + umumiy Adobe papkasi QOLADI)",
  /ma'lumoti BOR nishon papkani o'chirdi/.test(ps1) && /umumiy Adobe CEP papkasini o'chirdi/.test(ps1) &&
    /Test-Path -LiteralPath \$extensionsRoot -PathType Container/.test(ps1)
);
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

// ══ G2) Bitta qatorlik CLI kontrakti — PowerShell skalyar-unroll qorovuli ═══
console.log("\n── G2) Single-line CLI o'qigich (skalyar-unroll) ─────────────");

// 2026-07-22 masofaviy run 29901585416 (windows-installer): ICE64 tuzatilgandan keyin
// `wix msi validate` o'tdi, lekin ps1 111-qatorda `cleanup-registry kontrakti kutilmagan
// shaklda: S` bilan yiqildi — msiexec UMUMAN ishga tushmadi. Sabab: PowerShell funksiyadan
// qaytgan BIR elementli massivni chaqiruvchida skalyar [string]ga "unroll" qiladi, shuning
// uchun `(Invoke-NodeLines …)[0]` qatorni emas, BIRINCHI HARFNI qaytardi ("Software\…" → "S").
// Quyidagi tekshiruvlar jonli ps1 manbasini VA haqiqiy CLI chiqishini o'qiydi.

/** PowerShell skalyar-unroll semantikasining modeli: 1 qatorlik chiqishda `(…)[0]` = 1-harf. */
const psScalarIndexZero = (lines) => (lines.length === 1 ? lines[0].charAt(0) : lines[0] ?? "");

const regLines = cliLines(WIX_CLI, ["cleanup-registry"]);
const dirLines = cliLines(FLAVORS_CLI, ["field", "customer", "installDirName"]);

check("CLI `cleanup-registry` AYNAN 1 qator beradi (ps1 kontrakti shuni talab qiladi)", regLines.length === 1, `${regLines.length} qator`);
check("CLI `field customer installDirName` AYNAN 1 qator beradi", dirLines.length === 1, `${dirLines.length} qator`);

// ps1'ning O'Z shakl kontrakti jonli manbadan o'qiladi (test o'z nusxasini yasamaydi).
const installDirRe = (ps1.match(/\$installDirName -notmatch '(\^[^']+\$)'/) || [])[1] || "";
check("ps1'dagi installDirName shakl regex'i jonli manbadan o'qildi", installDirRe.length > 0, installDirRe);

// (a) TO'LIQ qiymatlar ps1 kontraktlarini qanoatlantiradi.
check(
  "to'liq `cleanup-registry` qatori ps1 kutgan AYNAN 2 maydonga bo'linadi (key<TAB>name)",
  (regLines[0] || "").split("\t").length === 2,
  JSON.stringify(regLines[0] || "")
);
check(
  "to'liq installDirName ps1'dagi shakl regex'iga mos",
  !!installDirRe && new RegExp(installDirRe).test(dirLines[0] || ""),
  dirLines[0] || ""
);

// (b) REGRESSIYA QOROVULI: eski `(…)[0]` naqshi haqiqiy CLI chiqishida buzuq bo'lardi.
const oldReg = psScalarIndexZero(regLines);
const oldDir = psScalarIndexZero(dirLines);
check(
  "eski `(Invoke-NodeLines …)[0]` naqshi cleanup-registry'ni buzardi (1 harf → 2 maydon emas)",
  oldReg.length === 1 && oldReg.split("\t").length !== 2,
  JSON.stringify(oldReg)
);
check(
  "eski naqsh installDirName'ni ham buzardi (1 harf ps1 shakl regex'idan O'TMAYDI)",
  !!installDirRe && oldDir.length === 1 && !new RegExp(installDirRe).test(oldDir),
  JSON.stringify(oldDir)
);

// (c) Jonli ps1 manbasi: xavfli naqsh YO'Q, fail-closed o'qigich BOR.
check(
  "ps1'da `(Invoke-NodeLines …)[0]` xavfli naqshi QOLMAGAN",
  !/\(\s*Invoke-NodeLines\b[^\n]*\)\s*\[\s*0\s*\]/.test(ps1Code)
);
check("ps1'da bitta qatorlik o'qigich `Invoke-NodeLine` e'lon qilingan", /function Invoke-NodeLine\b\s*\{/.test(ps1Code));
const singleFn = (ps1Code.match(/function Invoke-NodeLine\b[\s\S]*?\n\}/) || [""])[0];
check(
  "`Invoke-NodeLine` natijani @() bilan qayta massivga o'raydi (unroll'ga qarshi)",
  /@\(\s*Invoke-NodeLines\b/.test(singleFn),
  singleFn ? "funksiya topildi" : "funksiya topilmadi"
);
check(
  "`Invoke-NodeLine` 0 yoki 2+ qatorda fail-closed (throw)",
  /\$lines\.Count -ne 1/.test(singleFn) && /\bthrow\b/.test(singleFn)
);
check("`Invoke-NodeLine` TO'LIQ qatorni qaytaradi (harf indekslash YO'Q)", /return \[string\] \$lines\[0\]/.test(singleFn));

// (d) HAR IKKALA bitta-qatorlik iste'molchi yangi o'qigichdan foydalanadi.
check(
  "ps1: `installDirName` bitta qatorlik o'qigich orqali olinadi",
  /\$installDirName\s*=\s*Invoke-NodeLine\s+@\(/.test(ps1Code)
);
check(
  "ps1: `cleanupReg` bitta qatorlik o'qigich orqali olinadi va tab bo'yicha bo'linadi",
  /\$cleanupReg\s*=\s*@\(\(Invoke-NodeLine\s+@\([^\n]*\)\)\s*-split/.test(ps1Code)
);
check("ps1: cleanup-registry kontrakti hamon AYNAN 2 maydon talab qiladi (fail-closed)", /\$cleanupReg\.Count -ne 2/.test(ps1Code));

// (e) KO'P qatorlik iste'molchilar SAQLANGAN (o'qigich noto'g'ri joyga tarqalmagan).
for (const [name, cmd] of [
  ["legacyFiles", "stale-files"],
  ["contractFiles", "payload-files"],
]) {
  check(
    `ps1: ko'p qatorlik "${cmd}" iste'molchisi Invoke-NodeLines'da saqlangan`,
    new RegExp(`\\$${name}\\s*=\\s*@\\(Invoke-NodeLines\\s`).test(ps1Code) && ps1Code.includes(`'${cmd}'`)
  );
}
check("ps1: `stage` chaqiruvi ham ko'p qatorlik Invoke-NodeLines'da qolgan", /Invoke-NodeLines @\(\$PayloadCli, 'stage'/.test(ps1Code));

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
  "uses: actions/checkout@v7",
  "uses: actions/setup-node@v7",
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

// ══ J) Node 20 Actions deprecation — REPO-KENG barcha workflow ══════════════
console.log("\n── J) Node 20 deprecation: checkout/setup-node v7, google auth/gcloud v3 ──");

const WORKFLOWS_DIR = path.join(REPO_ROOT, ".github/workflows");
const workflowFiles = existsSync(WORKFLOWS_DIR) ? readdirSync(WORKFLOWS_DIR).filter((f) => /\.ya?ml$/.test(f)) : [];
check("kamida bitta workflow fayli topildi (.github/workflows)", workflowFiles.length > 0, workflowFiles.join(", "));

// Rasmiy joriy major'lar (2026-07-22 direktor tekshiruvi): eski Node 20 runtime'ga
// majburlangan action'lar Node 24'ga o'tgan versiyaga ko'tarilgan.
const EXPECTED_MAJOR = {
  "actions/checkout": "v7",
  "actions/setup-node": "v7",
  "google-github-actions/auth": "v3",
  "google-github-actions/setup-gcloud": "v3",
};
const DEPRECATED_REF = /\b(actions\/checkout@v4|actions\/setup-node@v4|google-github-actions\/auth@v2|google-github-actions\/setup-gcloud@v2)\b/;

for (const file of workflowFiles) {
  const src = readOr(path.join(WORKFLOWS_DIR, file));
  const code = codeOnly(src);
  check(`${file}: eskirgan Node 20 action havolasi (checkout@v4/setup-node@v4/auth@v2/setup-gcloud@v2) YO'Q`, !DEPRECATED_REF.test(code), file);
  for (const [action, major] of Object.entries(EXPECTED_MAJOR)) {
    const re = new RegExp(`uses:\\s*${action.replace(/\//g, "\\/")}@(\\S+)`, "g");
    for (const m of code.matchAll(re)) {
      check(`${file}: ${action} aynan ${major} bilan ishlatilgan (topildi: @${m[1]})`, m[1] === major, m[0]);
    }
  }
  // Birinchi-tomon-yoki-SHA siyosati mavjud tekshiruv (C) bilan bir xil — endi HAR bir
  // workflow uchun, google-github-actions ham "birinchi tomon"ga tenglashtirilib (u ham
  // Google rasmiy action'i, ataylab shu ikki tashkilotga ishlatiladi).
  const usesAll = [...code.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  const badFilePins = usesAll.filter(
    (u) => !/^(actions|google-github-actions)\/[A-Za-z0-9._-]+@v\d+$/.test(u) && !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/.test(u)
  );
  check(`${file}: har bir action birinchi tomon (actions|google-github-actions)/*@vN yoki to'liq SHA bilan qadalgan`, badFilePins.length === 0, badFilePins.join(", "));
  // Loyiha Node versiyasi (20) action major'idan MUSTAQIL — ko'tarilish bilan o'zgarmaydi.
  const nodeVersions = [...code.matchAll(/node-version:\s*"?(\d+)"?/g)].map((m) => m[1]);
  for (const v of nodeVersions) {
    check(`${file}: node-version = 20 saqlangan (topildi: ${v})`, v === "20", file);
  }
}

// Windows job'ida setup-node v7 implicit kesh KIRITMASLIGI aniq o'chirilgan bilan kafolatlanadi.
check(
  `${WIN_JOB}: Setup Node qadamida \`package-manager-cache: false\` aniq o'rnatilgan (implicit kesh YO'Q)`,
  /Setup Node[\s\S]*?uses:\s*actions\/setup-node@v7[\s\S]*?package-manager-cache:\s*false/.test(winJob)
);

// Mutatsiya isboti — detektor haqiqatan eski havolalarni ushlaydi va joriy majorlarni
// soxta-pozitiv qilib belgilamaydi (regex o'zi ham tekshiriladi, konfiguratsiya emas).
for (const bad of [
  "uses: actions/checkout@v4",
  "uses: actions/setup-node@v4",
  "uses: google-github-actions/auth@v2",
  "uses: google-github-actions/setup-gcloud@v2",
]) {
  check(`mutatsiya isboti: detektor "${bad}" eskirganini ushlaydi`, DEPRECATED_REF.test(bad), bad);
}
check(
  "mutatsiya isboti: joriy majorlar (checkout@v7/setup-node@v7/auth@v3/setup-gcloud@v3) detektor tomonidan soxta-pozitiv qilinmaydi",
  !DEPRECATED_REF.test(
    "uses: actions/checkout@v7\nuses: actions/setup-node@v7\nuses: google-github-actions/auth@v3\nuses: google-github-actions/setup-gcloud@v3"
  )
);

// ══ Yakun ═══════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error(`\nYiqilgan tekshiruvlar:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
