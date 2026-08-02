#!/usr/bin/env node
/*
 * UXP plaginni UDT'siz "developer" rejimida o'rnatadi.
 *
 * Adobe UXP host'i plaginlarni ikki joydan o'qiydi:
 *   ~/Library/Application Support/Adobe/UXP/Plugins/External/<id>_<version>/
 *   ~/Library/Application Support/Adobe/UXP/PluginsInfo/v1/premierepro.json  (registr)
 * UDT ham aynan shu ikkisini yozadi — biz o'sha naqshni takrorlaymiz, shuning uchun
 * UDT o'rnatilmagan mashinada ham panelni Premiere ichida sinash mumkin.
 *
 * Foydalanish:
 *   node plugins/premiere-uxp/scripts/install-uxp-dev.mjs <plagin-papkasi> [--host premierepro] [--uninstall]
 * Masalan:
 *   node plugins/premiere-uxp/scripts/install-uxp-dev.mjs plugins/premiere-uxp/spike
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const uninstall = args.includes("--uninstall");
const hostIdx = args.indexOf("--host");
const host = hostIdx >= 0 ? args[hostIdx + 1] : "premierepro";
const srcArg = args.find((a) => !a.startsWith("--") && a !== host);

if (!srcArg) {
  console.error("Foydalanish: node install-uxp-dev.mjs <plagin-papkasi> [--host premierepro] [--uninstall]");
  process.exit(1);
}

const src = path.resolve(srcArg);
const manifestPath = path.join(src, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`manifest.json topilmadi: ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const pluginId = manifest.id;
const version = manifest.version;
if (!pluginId || !version) {
  console.error("manifest.json ichida id yoki version yo'q");
  process.exit(1);
}

const uxpRoot = path.join(os.homedir(), "Library", "Application Support", "Adobe", "UXP");
const pluginsDir = path.join(uxpRoot, "Plugins", "External");
const infoPath = path.join(uxpRoot, "PluginsInfo", "v1", `${host}.json`);
const folderName = `${pluginId}_${version}`;
const dest = path.join(pluginsDir, folderName);

/** Registrni o'qib, shu plagin yozuvini olib tashlaydi (qayta yozishdan oldin). */
function readRegistry() {
  if (!fs.existsSync(infoPath)) return { plugins: [] };
  try {
    const j = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    if (!Array.isArray(j.plugins)) j.plugins = [];
    return j;
  } catch {
    return { plugins: [] };
  }
}

function writeRegistry(reg) {
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  fs.writeFileSync(infoPath, JSON.stringify(reg), "utf8");
}

if (uninstall) {
  const reg = readRegistry();
  const before = reg.plugins.length;
  reg.plugins = reg.plugins.filter((p) => p.pluginId !== pluginId);
  writeRegistry(reg);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  console.log(`O'chirildi: ${pluginId} (registrdan ${before - reg.plugins.length} yozuv, papka ${dest})`);
  process.exit(0);
}

// Papkani toza ko'chirish (eski versiya papkalarini ham tozalaymiz).
if (fs.existsSync(pluginsDir)) {
  for (const name of fs.readdirSync(pluginsDir)) {
    if (name.startsWith(`${pluginId}_`)) {
      fs.rmSync(path.join(pluginsDir, name), { recursive: true, force: true });
    }
  }
}
// Runtime'ga tegishli bo'lmagan papkalar ko'chirilmaydi: `spike/` o'z manifestiga ega
// (host chalkashmasin), `scripts/`+`dist/` esa Node kodi, `dev/` — brauzer stub
// harness (fikstura ma'lumot bilan) — UXP paketiga aloqasi yo'q.
const SKIP_DIRS = new Set(["scripts", "spike", "dist", "dev", "node_modules", ".git"]);
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, {
  recursive: true,
  filter: (from) => {
    const rel = path.relative(src, from);
    if (!rel) return true;
    return !SKIP_DIRS.has(rel.split(path.sep)[0]);
  },
});

const reg = readRegistry();
reg.plugins = reg.plugins.filter((p) => p.pluginId !== pluginId);
reg.plugins.push({
  hostMinVersion: (manifest.host && manifest.host.minVersion) || "25.6.0",
  name: manifest.name || pluginId,
  path: `$localPlugins/External/${folderName}`,
  pluginId,
  status: "enabled",
  type: "uxp",
  versionString: version,
});
writeRegistry(reg);

console.log(`O'rnatildi: ${pluginId} v${version}`);
console.log(`  papka:   ${dest}`);
console.log(`  registr: ${infoPath}`);
console.log(`Premiere Pro'ni qayta ishga tushiring → Window > Extensions (yoki Plugins) > ${manifest.name}`);
