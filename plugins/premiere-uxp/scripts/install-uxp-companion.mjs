#!/usr/bin/env node
/** Build + per-user install the invisible FrameFlow Premiere host companion. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "companion");
const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
const uxpRoot = path.join(os.homedir(), "Library", "Application Support", "Adobe", "UXP");
const external = path.join(uxpRoot, "Plugins", "External");
const registryPath = path.join(uxpRoot, "PluginsInfo", "v1", "premierepro.json");
const folderName = `${manifest.id}_${manifest.version}`;
const dest = path.join(external, folderName);

function registry() {
  try {
    const value = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    if (!Array.isArray(value.plugins)) value.plugins = [];
    return value;
  } catch { return { plugins: [] }; }
}

fs.mkdirSync(external, { recursive: true });
for (const name of fs.readdirSync(external)) {
  if (name.startsWith(`${manifest.id}_`)) fs.rmSync(path.join(external, name), { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });
for (const name of ["manifest.json", "index.html", "bridge.js"]) {
  fs.copyFileSync(path.join(source, name), path.join(dest, name));
}
fs.copyFileSync(path.join(root, "js", "log.js"), path.join(dest, "log.js"));
fs.copyFileSync(path.join(root, "js", "ae-shim", "csinterface-shim.js"), path.join(dest, "host-dispatch.js"));

const reg = registry();
reg.plugins = reg.plugins.filter((item) => item.pluginId !== manifest.id);
reg.plugins.push({
  hostMinVersion: manifest.host.minVersion,
  name: manifest.name,
  path: `$localPlugins/External/${folderName}`,
  pluginId: manifest.id,
  status: "enabled",
  type: "uxp",
  versionString: manifest.version,
});
fs.mkdirSync(path.dirname(registryPath), { recursive: true });
fs.writeFileSync(registryPath, JSON.stringify(reg), "utf8");

console.log(`O'rnatildi: ${manifest.name} ${manifest.version}`);
console.log(`  ${dest}`);
console.log("Premiere Pro'ni qo'lda to'liq qayta ishga tushirgandan keyin companion avtomatik yuklanadi.");
