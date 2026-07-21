// FrameFlow Windows INSTALLER (.msi) — MIJOZ paneli uchun, FAIL-CLOSED.
//
// Nima quriladi: WiX Toolset v5 bilan PER-USER (`Scope="perUser"`) MSI. U mijoz flavor
// fayllarini FAQAT foydalanuvchi papkasiga yozadi:
//   %APPDATA%\Adobe\CEP\extensions\com.frameflow
// UAC/administrator TALAB QILINMAYDI, Program Files'ga va boshqa Adobe holatiga tegilmaydi.
// O'chirish — Windows "Apps & features" (MSI o'z komponentlarini o'zi olib tashlaydi;
// foydalanuvchi ma'lumoti `assetflow-data` MSI komponenti emas, shuning uchun saqlanadi).
//
// Payload ro'yxati — scripts/package-flavors.mjs (yagona manba); ichki Admin paneli
// installerga HECH QACHON kirmaydi (installer-payload.mjs buni majburlaydi).
//
// NIMA UCHUN .msi (.exe emas): server kontrakti (plugin-release-contract.ts) win uchun
// `.msi` va `.exe` ni ham qabul qiladi, panel esa `.msi` ni `msiexec /i` bilan topshiradi —
// ya'ni MSI to'liq yetarli. MSI per-user o'rnatma, avtomatik upgrade (MajorUpgrade) va
// standart o'chirish beradi; Burn (.exe) bundle qo'shimcha qatlam bo'lardi, foyda bermaydi.
//
// Foydalanish (Windows yoki windows-latest CI):
//   node build-installer-win.mjs --unsigned
//   FF_WIN_CERT=C:\secure\ff.pfx FF_WIN_CERT_PASS=… node build-installer-win.mjs
//   FF_WIN_CERT_SHA1=<thumbprint>              node build-installer-win.mjs   # HSM/token
//
// Kredensiallar FAQAT env'dan (repo'da/artefaktda/logda hech qachon saqlanmaydi):
//   FF_WIN_CERT + FF_WIN_CERT_PASS  — Authenticode .pfx (parol argv'da ko'rinadi → CI uchun)
//   yoki FF_WIN_CERT_SHA1           — sertifikat do'konidagi thumbprint (EV token/HSM — TAVSIYA)
//   FF_WIN_TIMESTAMP_URL            — RFC3161 timestamp (default: DigiCert)
//   FF_SIGNED_ZXP                   — imzolangan mijoz .zxp (CEP imzo konverti; relizda SHART)
//
// FAIL-CLOSED: kredensial yoki asbob bo'lmasa yakuniy artefakt YARATILMAYDI va vaqtinchalik
// papka QOLMAYDI. O'z-o'zidan imzolangan sertifikat YARATILMAYDI, standart parol YO'Q.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  INSTALLERS_DIR,
  INSTALL_DIR_NAME,
  assertMsiArtifact,
  installerArtifactPath,
  installerVersion,
  recordArtifact,
  stageCustomerPayload,
  verifyPayload,
  writeChecksumSidecar,
} from "./installer-payload.mjs";
import { buildWxsSource } from "./installer-wix.mjs";

const DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log("node build-installer-win.mjs [--unsigned]   (batafsil: fayl boshidagi izoh)");
  process.exit(0);
}
const unsigned = args.includes("--unsigned");
for (const a of args) {
  if (a !== "--unsigned") {
    console.error(`✗ Noma'lum argument: ${a} (--unsigned)`);
    process.exit(2);
  }
}

const version = installerVersion();
const out = installerArtifactPath("win", "msi", { signed: !unsigned });
mkdirSync(INSTALLERS_DIR, { recursive: true });

// ── Eski/qisman chiqishni DARHOL bekor qilish (tekshiruvlardan OLDIN) ────────
for (const stale of [out, `${out}.sha256`]) {
  if (existsSync(stale)) {
    rmSync(stale, { force: true });
    if (stale === out) console.log(`  ⓘ Eski chiqish bekor qilindi: ${path.basename(out)}`);
  }
}

// ── Chegaralangan ish papkasi + ishonchli tozalash ──────────────────────────
const work = mkdtempSync(path.join(INSTALLERS_DIR, "_build.win."));
if (!path.basename(work).startsWith("_build.win.") || path.dirname(work) !== INSTALLERS_DIR) {
  console.error(`✗ Ish papkasi yo'li kutilmagan: ${work}`);
  process.exit(1);
}
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* tozalash xatosi build natijasini o'zgartirmaydi */
  }
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

function fail(lines) {
  for (const l of [].concat(lines)) console.error(l);
  cleanup();
  process.exit(1);
}

console.log(`→ FrameFlow Windows installer · versiya ${version}`);
console.log("  Nishon (per-user): %APPDATA%\\Adobe\\CEP\\extensions\\com.frameflow");

// ── FAIL-CLOSED siyosat tekshiruvi — asboblardan OLDIN ─────────────────────
const signedZxp = process.env.FF_SIGNED_ZXP || "";
let signMode = "";
if (!unsigned) {
  const hasPfx = !!process.env.FF_WIN_CERT;
  const hasThumb = !!process.env.FF_WIN_CERT_SHA1;
  if (!hasPfx && !hasThumb) {
    fail([
      "✗ Authenticode kredensiali berilmagan — imzolangan build BEKOR QILINDI.",
      "  FF_WIN_CERT=<.pfx yo'li> + FF_WIN_CERT_PASS='…'  yoki  FF_WIN_CERT_SHA1=<thumbprint>",
      "  (bu skript o'z-o'zidan imzolangan sertifikat YARATMAYDI — reliz autentikligi shart)",
    ]);
  }
  if (hasPfx && hasThumb) {
    fail("✗ FF_WIN_CERT va FF_WIN_CERT_SHA1 birga berilmaydi — bittasini tanlang.");
  }
  if (hasPfx) {
    if (!existsSync(process.env.FF_WIN_CERT)) fail(`✗ FF_WIN_CERT fayli topilmadi: ${process.env.FF_WIN_CERT}`);
    if (!process.env.FF_WIN_CERT_PASS) {
      fail([
        "✗ FF_WIN_CERT_PASS berilmagan — imzolangan build BEKOR QILINDI.",
        "  Parolni env orqali bering (standart/zaxira parol YO'Q, qiymat log qilinmaydi).",
      ]);
    }
    signMode = "pfx";
  } else {
    signMode = "thumbprint";
  }
  if (!signedZxp) {
    fail([
      "✗ FF_SIGNED_ZXP berilmagan — imzolangan build BEKOR QILINDI.",
      "  Reliz payload'i Adobe imzo konverti (META-INF) bilan kelishi SHART — aks holda CEP",
      "  o'rnatilgan papkani imzosiz deb hisoblaydi va AE panelni yuklamaydi.",
      "  Avval: bash plugins/after-effects-cep/scripts/build-zxp.sh  (ZXP_CERT/ZXP_CERT_PASS bilan)",
    ]);
  }
  if (!existsSync(signedZxp)) fail(`✗ FF_SIGNED_ZXP fayli topilmadi: ${signedZxp}`);
}

// ── Payload ────────────────────────────────────────────────────────────────
const payloadDir = path.join(work, "payload");
let payloadFiles;
try {
  stageCustomerPayload(payloadDir, { signedZxp: signedZxp || null });
  const res = verifyPayload(payloadDir);
  payloadFiles = res.files;
  console.log(`  Payload: ${payloadFiles.length} fayl (${res.signed ? "signed-envelope" : "plain"})`);
} catch (e) {
  fail(`✗ Payload tayyorlanmadi: ${(e && e.message) || e}`);
}

// ── WiX manbasini generatsiya qilish (generator: scripts/installer-wix.mjs) ─

const wxsPath = path.join(work, "frameflow.wxs");
writeFileSync(wxsPath, buildWxsSource({ version, payloadFiles, installDirName: INSTALL_DIR_NAME }));

// `--wxs-only` yo'q: WiX manbasi har doim ish papkasida qoladi va build bilan birga o'chadi.
// Uni ko'rish kerak bo'lsa test (test-installer-artifacts.mjs) generatsiyani alohida tekshiradi.

// ── Asboblar (siyosatdan KEYIN) ────────────────────────────────────────────
function toolPath(name) {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    const found = execFileSync(which, [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")[0]
      .trim();
    return found || null;
  } catch {
    return null;
  }
}

if (!toolPath("wix")) {
  fail([
    "✗ WiX Toolset (`wix`) topilmadi — MSI QURILMADI.",
    "  O'rnatish (Windows / windows-latest CI): dotnet tool install --global wix",
    "  Hujjat: https://wixtoolset.org/docs/intro/",
  ]);
}

const msiTmp = path.join(work, "frameflow.msi");
try {
  execFileSync("wix", ["build", "-arch", "x64", "-o", msiTmp, wxsPath], {
    cwd: work,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  const detail = `${(e && e.stdout) || ""}${(e && e.stderr) || ""}`.trim();
  fail(["✗ `wix build` muvaffaqiyatsiz — yakuniy artefakt YARATILMADI.", detail.slice(0, 2000)]);
}
// Chiqish HAQIQATAN MSI (OLE2 compound) ekanini tekshiramiz — "bo'sh emas" YETARLI EMAS.
try {
  const { sizeBytes } = assertMsiArtifact(msiTmp, { stage: "wix build" });
  console.log(`  MSI tuzilmasi tasdiqlandi (OLE compound, ${sizeBytes} bayt)`);
} catch (e) {
  fail([`✗ ${(e && e.message) || e}`, "  Yakuniy artefakt YARATILMADI."]);
}

// ── Imzolash ───────────────────────────────────────────────────────────────
if (!unsigned) {
  if (!toolPath("signtool")) {
    fail([
      "✗ `signtool` topilmadi — imzolangan build BEKOR QILINDI.",
      "  Windows SDK o'rnating (Windows 10/11 SDK → Signing Tools).",
    ]);
  }
  const tsUrl = process.env.FF_WIN_TIMESTAMP_URL || DEFAULT_TIMESTAMP_URL;
  const signArgs = ["sign", "/fd", "sha256", "/tr", tsUrl, "/td", "sha256"];
  if (signMode === "pfx") signArgs.push("/f", process.env.FF_WIN_CERT, "/p", process.env.FF_WIN_CERT_PASS);
  else signArgs.push("/sha1", process.env.FF_WIN_CERT_SHA1);
  signArgs.push(msiTmp);

  console.log("→ signtool sign /fd sha256 (sertifikat env'dan — chop etilmaydi)");
  try {
    execFileSync("signtool", signArgs, { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    // signtool chiqishi parolni aks ettirishi mumkin — tafsilot BOSILMAYDI.
    fail([
      "✗ signtool imzolashda muvaffaqiyatsiz tugadi — yakuniy artefakt YARATILMADI.",
      "  (qisman imzolangan fayl o'chiriladi; sertifikat/parol qiymatlari chop etilmaydi)",
    ]);
  }
  try {
    execFileSync("signtool", ["verify", "/pa", msiTmp], { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    fail("✗ signtool verify o'tmadi — yakuniy artefakt YARATILMADI.");
  }
  // Imzolashdan KEYIN ham tuzilma tekshiriladi (signtool faylni joyida qayta yozadi).
  try {
    assertMsiArtifact(msiTmp, { stage: "signtool" });
  } catch (e) {
    fail([`✗ ${(e && e.message) || e}`, "  Imzolangan fayl MSI emas — yakuniy artefakt YARATILMADI."]);
  }
}

// ── Faqat HAMMASI muvaffaqiyatli tugagach — atomik ko'chirish ─────────────
renameSync(msiTmp, out);
const sha = writeChecksumSidecar(out);
recordArtifact("win", "msi", out, { signed: !unsigned });
cleanup();

if (unsigned) {
  console.log(`✓ Imzolanmagan QA installer: ${out}`);
  console.log(`  SHA-256: ${sha}`);
  console.log("  ⚠ FAQAT lokal QA uchun — Authenticode imzosi yo'q, mijozga tarqatilmaydi.");
} else {
  console.log(`✓ Imzolangan installer: ${out}`);
  console.log(`  SHA-256: ${sha}`);
  console.log("  Admin → Releases → Upload Windows installer (.msi) — server SHA-256'ni qayta hisoblaydi.");
}
