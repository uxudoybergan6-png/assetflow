#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pm2 = path.join(root, "node_modules", ".bin", "pm2");

const names = ["assetflow-api", "assetflow-web", "assetflow-admin"];

for (const name of names) {
  spawnSync(pm2, ["delete", name], { cwd: root, stdio: "inherit", env: process.env });
}
spawnSync(pm2, ["delete", "ecosystem.config.cjs"], {
  cwd: root,
  stdio: "ignore",
  env: process.env,
});

console.log("\n  PM2: AssetFlow to'xtatildi\n");
console.log("  Agar pm2 status xato bersa: npm run pm2:reset\n");
