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
  if (!fs.existsSync(registryPath)) return { plugins: [] };
  const value = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!value || !Array.isArray(value.plugins)) {
    throw new Error(`UXP registry is invalid; refusing to overwrite it: ${registryPath}`);
  }
  return value;
}

const reg = registry();
fs.mkdirSync(external, { recursive: true });
const stage = `${dest}.stage-${process.pid}`;
const backup = `${dest}.backup-${process.pid}`;
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const name of ["manifest.json", "index.html", "bridge.js"]) {
  fs.copyFileSync(path.join(source, name), path.join(stage, name));
}
fs.copyFileSync(path.join(root, "js", "log.js"), path.join(stage, "log.js"));
fs.copyFileSync(path.join(root, "js", "ae-shim", "csinterface-shim.js"), path.join(stage, "host-dispatch.js"));

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
const registryTmp = `${registryPath}.tmp-${process.pid}`;
try {
  fs.rmSync(backup, { recursive: true, force: true });
  if (fs.existsSync(dest)) fs.renameSync(dest, backup);
  fs.renameSync(stage, dest);
  fs.writeFileSync(registryTmp, JSON.stringify(reg), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(registryTmp, registryPath);
  for (const name of fs.readdirSync(external)) {
    if (name.startsWith(`${manifest.id}_`) && path.join(external, name) !== dest) {
      fs.rmSync(path.join(external, name), { recursive: true, force: true });
    }
  }
} catch (error) {
  fs.rmSync(registryTmp, { force: true });
  fs.rmSync(stage, { recursive: true, force: true });
  if (fs.existsSync(backup)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(backup, dest);
  }
  throw error;
}

console.log(`O'rnatildi: ${manifest.name} ${manifest.version}`);
console.log(`  ${dest}`);
console.log("Premiere Pro'ni qo'lda to'liq qayta ishga tushirgandan keyin companion avtomatik yuklanadi.");
