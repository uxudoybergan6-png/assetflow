// WiX MANBA GENERATORI — `build-installer-win.mjs` uchun (va test uchun) YAGONA manba.
//
// Nega alohida modul: identifikator/GUID hosil qilish qoidasi testda TO'G'RIDAN sinaladi
// (ichma-ich takrorlangan papka nomlari to'qnashmasligi kabi holatlar build'siz isbotlanadi).
//
// QOIDA: Directory Id TO'LIQ nisbiy yo'ldan quriladi (faqat basename'dan EMAS) — aks holda
// `css/fonts` va `js/fonts` bir xil Id olib, WiX daraxti to'qnashardi.
//
// Bu yerda MSI'dan OLDINGI o'rnatma qoldiqlari uchun `RemoveFile` qatorlari ham generatsiya
// qilinadi (pastdagi "MSI'dan OLDINGI o'rnatma qoldiqlari" bo'limiga qara).
//
// QOIDA (ICE64 — Windows Installer rasmiy talabi): foydalanuvchi profili ostida (bizda
// `AppDataFolder`) paket E'LON QILGAN HAR BIR papka `RemoveFile` jadvalida bo'lishi SHART
// (FileName NULL qatori = WiX `<RemoveFolder>`), aks holda profil o'chirishdan keyin
// ifloslanadi. Shuning uchun pastdagi "Profil papkalari" bo'limiga qara.

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { obsoleteInstallFiles } from "./installer-payload.mjs";

/** Barqaror identifikatorlar — SIR EMAS, faqat MSI upgrade zanjirining langari. */
export const UPGRADE_CODE = "{8F2B6C34-1D57-4E2A-9C10-7F3A5E6B41D9}";
const GUID_NAMESPACE = "6f6a3f5e-9b41-4d2c-8a77-1c0d5e2f4b83";

/** UUIDv5 — bir xil yo'l DOIM bir xil GUID beradi (MSI upgrade'i buzilmasin). */
export function stableGuid(name) {
  const ns = Buffer.from(GUID_NAMESPACE.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex").toUpperCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

/** WiX Id — harf bilan boshlanadi, faqat [A-Za-z0-9_.]; noyoblik TO'LIQ yo'l hash'idan.
 *  `name` HAR DOIM to'liq nisbiy yo'l bo'lishi kerak (fayl uchun ham, papka uchun ham). */
export function wixId(prefix, name) {
  const slug = String(name).replace(/[^A-Za-z0-9_.]/g, "_").slice(-40);
  const h = createHash("sha1").update(String(name)).digest("hex").slice(0, 8);
  return `${prefix}_${slug}_${h}`;
}

export function xmlAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── MSI'dan OLDINGI o'rnatma qoldiqlari (Windows migratsiyasi) ──────────────
//
// `MajorUpgrade` FAQAT MSI o'zi o'rnatgan komponentlarni olib tashlaydi. Qo'lda nusxalangan
// yoki `.zxp` orqali o'rnatilgan eski papkada MSI hech qachon ko'rmagan ICHKI fayllar
// (`.debug`, Admin sirti) qolib ketardi — birinchi MSI o'rnatmasidan keyin ham. Shuning uchun
// standart `RemoveFile` (On="install") qatorlari generatsiya qilinadi: MSI `RemoveFiles`
// amali `InstallFiles` dan OLDIN ishlaydi, ya'ni qoldiq yangi payload joylashdan avval ketadi.
//
// QAT'IY chegara (macOS postinstall bilan bir xil siyosat):
//   • ro'yxat FAQAT `obsoleteInstallFiles()` dan — installerda qattiq yozilgan nom YO'Q;
//   • har yo'l uchun AYNAN bitta `RemoveFile`, aniq `Name` — wildcard (`*`/`?`) YO'Q;
//   • CustomAction YO'Q — faqat standart `RemoveFiles` amali;
//   • joriy payload va foydalanuvchi ma'lumoti (`assetflow-data`) TEGILMAYDI (quyida tekshiriladi).
//
// WiX `Subdirectory=` ATAYLAB ISHLATILMAYDI: u qatorga YANGI, avto-Id'li `Directory` qatori
// yasaydi — unga `RemoveFolder` biriktirib bo'lmaydi va ICE64 uni "profilda qolib ketgan papka"
// deb RAD ETADI. O'rniga daraxtdagi deterministik Directory Id'ga to'g'ridan ishora qilinadi.

/** Migratsiya komponenti — HKCU keypath (per-user, ICE-mos), GUID ro'yxatdan MUSTAQIL
 *  (komponent keypath'i o'zgarmaydi → MSI komponent qoidasi buzilmaydi). */
export const CLEANUP_COMPONENT_ID = "FF_LegacyCleanup";
const CLEANUP_COMPONENT_GUID_NAME = "component:legacy-cleanup";
/** Migratsiya komponentining HKCU keypath'i — Windows CI isboti shu YAGONA manbadan o'qiydi
 *  (`node installer-wix.mjs cleanup-registry`), PowerShell'da takror yozilmaydi. */
export const CLEANUP_REGISTRY_KEY = "Software\\FrameFlow\\Plugin\\Migration";
export const CLEANUP_REGISTRY_NAME = "obsolete-internal-files";

// ── Profil papkalari (ICE64) ────────────────────────────────────────────────
//
// ICE64: `AppDataFolder` ostida paket e'lon qilgan HAR BIR `Directory` qatori `RemoveFile`
// jadvalida (FileName NULL — WiX `<RemoveFolder>`) bo'lishi SHART. Aks holda MSI validatsiyasi
// `error WIX0204: ICE64` bilan RAD ETADI (2026-07-21 masofaviy run'ida aynan shu 10 marta yiqildi).
//
// XAVFSIZ, chunki Windows Installer `RemoveFile`ning papka qatorini FAQAT PAPKA BO'SH bo'lsa
// bajaradi (RemoveFile jadvali, FileName ustuni: "null bo'lsa papka BO'SH bo'lsagina o'chiriladi"):
//   • `assetflow-data` (yoki boshqa har qanday foydalanuvchi fayli) → nishon papka BO'SH EMAS → QOLADI;
//   • umumiy `…\Adobe\CEP\extensions`, `…\CEP`, `…\Adobe` → boshqa Adobe kengaytmasi/holati
//     bo'lsa BO'SH EMAS → TEGILMAYDI; butunlay bo'sh bo'lsagina yo'qoladi (profil ifloslanmaydi).
// Rekursiv o'chirish YO'Q: `RemoveFolderEx`, wildcard va CustomAction ISHLATILMAYDI.

/** Papkalar komponenti — HKCU keypath, ro'yxatdan MUSTAQIL (DOIM generatsiya qilinadi). */
export const FOLDER_COMPONENT_ID = "FF_ProfileFolders";
const FOLDER_COMPONENT_GUID_NAME = "component:profile-folders";
export const FOLDER_REGISTRY_KEY = "Software\\FrameFlow\\Plugin\\Directories";
export const FOLDER_REGISTRY_NAME = "profile-folders";

/** Nishon papka Id va uning ustidagi profil papkalari (chuqurdan yuzaga). */
export const INSTALL_FOLDER_ID = "INSTALLFOLDER";
export const PROFILE_ANCESTOR_DIR_IDS = Object.freeze(["FF_extensions", "FF_CEP", "FF_Adobe"]);

/** Nisbiy papka yo'li → Directory Id (ildiz = INSTALLFOLDER). Yagona qoida: `wixId("D", yo'l)`. */
export function dirIdForPath(relDir) {
  return relDir ? wixId("D", relDir) : INSTALL_FOLDER_ID;
}

/** `obsoleteInstallFiles()` → WiX `RemoveFile` qatorlari uchun ma'lumot.
 *  Id TO'LIQ nisbiy yo'ldan (deterministik va noyob); nishon papka — daraxtdagi Directory Id
 *  (`Subdirectory=` ATAYLAB YO'Q — u avto-Id'li qo'shimcha Directory qatori yasab ICE64'ni buzadi). */
export function obsoleteRemoveRows(payloadFiles = []) {
  const shipped = new Set(payloadFiles);
  return obsoleteInstallFiles().map((rel) => {
    if (shipped.has(rel)) throw new Error(`Eski fayllar ro'yxati joriy payload bilan kesishdi: ${rel}`);
    if (/[*?]/.test(rel)) throw new Error(`Eski fayl yo'lida wildcard: ${rel}`);
    const parts = rel.split("/");
    const fileName = parts.pop();
    if (!fileName || parts.some((p) => !p || p === "." || p === "..")) {
      throw new Error(`Eski fayl yo'li noto'g'ri: ${rel}`);
    }
    const dirPath = parts.join("/");
    return { rel, fileName, dirPath, directoryId: dirIdForPath(dirPath), id: wixId("R", rel) };
  });
}

/** Payload yo'llaridan ichma-ich Directory daraxti + har fayl uchun bitta Component.
 *  @param {{version:string, payloadFiles:string[], installDirName:string}} opts */
export function buildWxsSource({ version, payloadFiles, installDirName = "com.frameflow" }) {
  const components = [];
  const tree = { dirs: new Map(), files: [] };
  const dirNode = (relDir) => {
    let node = tree;
    for (const part of relDir ? relDir.split("/") : []) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    return node;
  };
  for (const rel of payloadFiles) {
    const parts = rel.split("/");
    const fileName = parts.pop();
    dirNode(parts.join("/")).files.push({ rel, fileName });
  }

  // Eski qoldiq ichma-ich yo'lda bo'lsa — o'sha papka daraxtda ham bo'lishi SHART, chunki
  // `RemoveFile` uning deterministik Directory Id'siga ishora qiladi (`Subdirectory=` YO'Q).
  const stale = obsoleteRemoveRows(payloadFiles);
  for (const s of stale) dirNode(s.dirPath);

  // Profil papkalari (ICE64) — chuqurdan yuzaga, ya'ni bola papka ota-papkadan OLDIN.
  const dirPaths = [];
  (function collect(node, base) {
    for (const [name, child] of node.dirs) {
      const p = base ? `${base}/${name}` : name;
      collect(child, p);
      dirPaths.push(p);
    }
  })(tree, "");
  dirPaths.sort((a, b) => b.split("/").length - a.split("/").length || a.localeCompare(b));

  const lines = [];
  const emit = (depth, text) => lines.push(`${" ".repeat(depth * 2)}${text}`);

  function emitNode(node, depth, dirPath) {
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
      // Id TO'LIQ yo'ldan — ichma-ich bir xil papka nomlari to'qnashmaydi.
      const childPath = dirPath ? `${dirPath}/${name}` : name;
      emit(depth, `<Directory Id="${dirIdForPath(childPath)}" Name="${xmlAttr(name)}">`);
      emitNode(child, depth + 1, childPath);
      emit(depth, "</Directory>");
    }
  }

  emit(7, "<!-- generatsiya: build-installer-win.mjs — qo'lda tahrirlanmaydi -->");

  // MSI'dan oldingi (qo'lda/ZXP) o'rnatma qoldiqlari — aniq nomlar, faqat fayl.
  if (stale.length) {
    components.push(CLEANUP_COMPONENT_ID);
    emit(7, `<Component Id="${CLEANUP_COMPONENT_ID}" Guid="${stableGuid(CLEANUP_COMPONENT_GUID_NAME)}">`);
    emit(
      8,
      `<RegistryValue Root="HKCU" Key="${xmlAttr(CLEANUP_REGISTRY_KEY)}" ` +
        `Name="${CLEANUP_REGISTRY_NAME}" Type="integer" Value="1" KeyPath="yes"/>`
    );
    for (const s of stale) {
      emit(8, `<RemoveFile Id="${s.id}" Directory="${s.directoryId}" Name="${xmlAttr(s.fileName)}" On="install"/>`);
    }
    emit(7, "</Component>");
  }

  // Profil papkalari (ICE64) — HAR bir e'lon qilingan papka uchun AYNAN bitta `RemoveFolder`.
  // FAQAT BO'SH papka o'chadi → `assetflow-data` va umumiy Adobe papkalari saqlanadi.
  components.push(FOLDER_COMPONENT_ID);
  emit(7, `<Component Id="${FOLDER_COMPONENT_ID}" Guid="${stableGuid(FOLDER_COMPONENT_GUID_NAME)}">`);
  emit(
    8,
    `<RegistryValue Root="HKCU" Key="${xmlAttr(FOLDER_REGISTRY_KEY)}" ` +
      `Name="${FOLDER_REGISTRY_NAME}" Type="integer" Value="1" KeyPath="yes"/>`
  );
  for (const id of [...dirPaths.map(dirIdForPath), INSTALL_FOLDER_ID, ...PROFILE_ANCESTOR_DIR_IDS]) {
    emit(8, `<RemoveFolder Id="${wixId("RD", id)}" Directory="${id}" On="uninstall"/>`);
  }
  emit(7, "</Component>");

  emitNode(tree, 7, "");
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
      <Directory Id="${PROFILE_ANCESTOR_DIR_IDS[2]}" Name="Adobe">
        <Directory Id="${PROFILE_ANCESTOR_DIR_IDS[1]}" Name="CEP">
          <Directory Id="${PROFILE_ANCESTOR_DIR_IDS[0]}" Name="extensions">
            <Directory Id="${INSTALL_FOLDER_ID}" Name="${xmlAttr(installDirName)}">
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

// ── CLI ───────────────────────────────────────────────────────────────────────
// Faqat MASHINA O'QIYDIGAN kontrakt (Windows CI PowerShell isboti shundan oladi — nusxa YO'Q).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd] = process.argv.slice(2);
  if (cmd === "cleanup-registry") {
    console.log(`${CLEANUP_REGISTRY_KEY}\t${CLEANUP_REGISTRY_NAME}`);
  } else {
    console.error("Foydalanish: installer-wix.mjs cleanup-registry");
    process.exit(2);
  }
}
