// WiX MANBA GENERATORI — `build-installer-win.mjs` uchun (va test uchun) YAGONA manba.
//
// Nega alohida modul: identifikator/GUID hosil qilish qoidasi testda TO'G'RIDAN sinaladi
// (ichma-ich takrorlangan papka nomlari to'qnashmasligi kabi holatlar build'siz isbotlanadi).
//
// QOIDA: Directory Id TO'LIQ nisbiy yo'ldan quriladi (faqat basename'dan EMAS) — aks holda
// `css/fonts` va `js/fonts` bir xil Id olib, WiX daraxti to'qnashardi.

import { createHash } from "node:crypto";

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

/** Payload yo'llaridan ichma-ich Directory daraxti + har fayl uchun bitta Component.
 *  @param {{version:string, payloadFiles:string[], installDirName:string}} opts */
export function buildWxsSource({ version, payloadFiles, installDirName = "com.frameflow" }) {
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
      emit(depth, `<Directory Id="${wixId("D", childPath)}" Name="${xmlAttr(name)}">`);
      emitNode(child, depth + 1, childPath);
      emit(depth, "</Directory>");
    }
  }

  emit(7, "<!-- generatsiya: build-installer-win.mjs — qo'lda tahrirlanmaydi -->");
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
      <Directory Id="FF_Adobe" Name="Adobe">
        <Directory Id="FF_CEP" Name="CEP">
          <Directory Id="FF_extensions" Name="extensions">
            <Directory Id="INSTALLFOLDER" Name="${xmlAttr(installDirName)}">
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
