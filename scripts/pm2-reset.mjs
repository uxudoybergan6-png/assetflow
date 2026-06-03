#!/usr/bin/env node
/**
 * PM2 daemon va AssetFlow ro'yxatini tozalash (buzilgan pm2_env xatosi uchun).
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pm2 = path.join(root, "node_modules", ".bin", "pm2");

console.log("\n  PM2 reset — daemon to'xtatiladi va qayta ishga tushiriladi\n");

spawnSync(pm2, ["kill"], { cwd: root, stdio: "inherit", env: process.env });
spawnSync(process.execPath, ["scripts/free-dev-ports.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const start = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "pm2-start.mjs")],
  { cwd: root, stdio: "inherit", env: process.env }
);

process.exit(start.status ?? 1);
