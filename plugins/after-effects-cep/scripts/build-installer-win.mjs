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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  INSTALLERS_DIR,
  installerArtifactPath,
  installerVersion,
  recordArtifact,
  stageCustomerPayload,
  verifyPayload,
  writeChecksumSidecar,
} from "./installer-payload.mjs";

const DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";
// Barqaror identifikatorlar — SIR EMAS, faqat MSI upgrade zanjirining langari.
const UPGRADE_CODE = "{8F2B6C34-1D57-4E2A-9C10-7F3A5E6B41D9}";
const GUID_NAMESPACE = "6f6a3f5e-9b41-4d2c-8a77-1c0d5e2f4b83";

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
      "  Reliz payload'i Adobe imzo konverti (META-INF) bilan kelishi SHART, aks holda AE panelni",
      "  yuklamaydi yoki mijoz mashinasida CEP PlayerDebugMode yoqish kerak bo'lardi.",
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

// ── WiX manbasini generatsiya qilish ───────────────────────────────────────

/** UUIDv5 — bir xil yo'l DOIM bir xil GUID beradi (MSI upgrade'i buzilmasin). */
function stableGuid(name) {
  const ns = Buffer.from(GUID_NAMESPACE.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex").toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

/** WiX Id — harf bilan boshlanadi, faqat [A-Za-z0-9_.]; noyoblik uchun hash qo'shiladi. */
function wixId(prefix, name) {
  const slug = name.replace(/[^A-Za-z0-9_.]/g, "_").slice(-40);
  const h = createHash("sha1").update(name).digest("hex").slice(0, 8);
  return `${prefix}_${slug}_${h}`;
}

function xmlAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Payload yo'llaridan ichma-ich Directory daraxti + har fayl uchun bitta Component. */
function buildWxs() {
  const components = [];
  const tree = { dirs: new Map(), files: [] };
  for (const rel of payloadFiles) {
    const parts = rel.split("/");
    const fileName = parts.pop();
    let node = tree;
    for (const part of parts) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push({ rel, fileName });
  }

  const lines = [];
  const emit = (depth, text) => lines.push(`${" ".repeat(depth * 2)}${text}`);

  function emitNode(node, depth) {
    for (const f of node.files) {
      const cid = wixId("C", f.rel);
      components.push(cid);
      emit(depth, `<Component Id="${cid}" Guid="${stableGuid(f.rel)}">`);
      emit(
        depth + 1,
        `<RegistryValue Root="HKCU" Key="Software\\FrameFlow\\Plugin\\Components" ` +
          `Name="${xmlAttr(f.rel)}" Type="integer" Value="1" KeyPath="yes"/>`
      );
      emit(
        depth + 1,
        `<File Id="${wixId("F", f.rel)}" Name="${xmlAttr(f.fileName)}" ` +
          `Source="payload\\${xmlAttr(f.rel.replace(/\//g, "\\"))}"/>`
      );
      emit(depth, "</Component>");
    }
    for (const [name, child] of [...node.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      emit(depth, `<Directory Id="${wixId("D", name)}" Name="${xmlAttr(name)}">`);
      emitNode(child, depth + 1);
      emit(depth, "</Directory>");
    }
  }

  emit(7, "<!-- generatsiya: build-installer-win.mjs — qo'lda tahrirlanmaydi -->");
  emitNode(tree, 7);
  const body = lines.join("\n");

  const featureRefs = components.map((c) => `        <ComponentRef Id="${c}"/>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- FrameFlow mijoz paneli — PER-USER MSI. Manba ro'yxati: scripts/package-flavors.mjs -->
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package Name="FrameFlow for After Effects"
           Manufacturer="FrameFlow"
           Version="${version}"
           UpgradeCode="${UPGRADE_CODE}"
           Scope="perUser"
           Compressed="yes"
           InstallerVersion="500">
    <SummaryInformation Description="FrameFlow panel for Adobe After Effects"/>
    <MajorUpgrade DowngradeErrorMessage="A newer version of FrameFlow is already installed."/>
    <MediaTemplate EmbedCab="yes"/>
    <Property Id="ARPNOMODIFY" Value="1"/>
    <Property Id="ARPNOREPAIR" Value="1"/>
    <StandardDirectory Id="AppDataFolder">
      <Directory Id="FF_Adobe" Name="Adobe">
        <Directory Id="FF_CEP" Name="CEP">
          <Directory Id="FF_extensions" Name="extensions">
            <Directory Id="INSTALLFOLDER" Name="com.frameflow">
${body}
            </Directory>
          </Directory>
        </Directory>
      </Directory>
    </StandardDirectory>
    <Feature Id="FrameFlowPanel" Title="FrameFlow panel" Level="1">
${featureRefs}
    </Feature>
  </Package>
</Wix>
`;
}

const wxsPath = path.join(work, "frameflow.wxs");
writeFileSync(wxsPath, buildWxs());

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
if (!existsSync(msiTmp) || statSync(msiTmp).size === 0) {
  fail("✗ MSI yo'q yoki bo'sh — yakuniy artefakt YARATILMADI.");
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
  if (!existsSync(msiTmp) || statSync(msiTmp).size === 0) {
    fail("✗ Imzolangan MSI yo'q yoki bo'sh — yakuniy artefakt YARATILMADI.");
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
