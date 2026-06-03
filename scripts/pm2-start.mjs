#!/usr/bin/env node
import { execSync, spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pm2 = path.join(root, "node_modules", ".bin", "pm2");
const APP_NAMES = ["assetflow-api", "assetflow-web", "assetflow-admin"];

function runPm2(args, { allowFail = false, quiet = false } = {}) {
  const r = spawnSync(pm2, args, {
    cwd: root,
    stdio: quiet ? "ignore" : "inherit",
    env: process.env,
  });
  if (r.status !== 0 && !allowFail) process.exit(r.status ?? 1);
  return r.status === 0;
}

function removeStaleApps() {
  for (const name of APP_NAMES) {
    runPm2(["delete", name], { allowFail: true, quiet: true });
  }
  runPm2(["delete", "ecosystem.config.cjs"], { allowFail: true, quiet: true });
}

async function waitHealth(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function printStatusSafe() {
  const r = spawnSync(pm2, ["jlist"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  if (r.status !== 0 || !r.stdout) {
    console.warn("  ⚠ pm2 status vaqtincha ishlamadi (PM2 ro'yxati buzilgan bo'lishi mumkin)");
    console.warn("     npm run pm2:reset — keyin qayta npm run pm2:start\n");
    return;
  }
  try {
    const list = JSON.parse(r.stdout);
    const ours = list.filter((p) => APP_NAMES.includes(p.name));
    if (!ours.length) {
      console.warn("  ⚠ AssetFlow jarayonlari PM2 da ko'rinmadi\n");
      return;
    }
    console.log("");
    for (const p of ours) {
      const st = p.pm2_env?.status ?? "?";
      console.log(`  ${p.name.padEnd(18)} ${st}`);
    }
    console.log("");
  } catch {
    console.warn("  ⚠ pm2 jlist parse xato — npm run pm2:reset sinab ko'ring\n");
  }
}

const resetDaemon = process.argv.includes("--reset");

console.log("\n  AssetFlow — PM2 orqali ishga tushirish\n");

if (resetDaemon) {
  console.log("  PM2 daemon qayta yuklanmoqda (pm2 kill)...\n");
  runPm2(["kill"], { allowFail: true });
}

try {
  execSync("node packages/assetflow-studio/scripts/sync-to-web.mjs", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  console.warn("  ⚠ studio:sync xato\n");
}

removeStaleApps();
try {
  execSync("node scripts/free-dev-ports.mjs", { cwd: root, stdio: "inherit" });
} catch {
  /* */
}
runPm2(["start", "ecosystem.config.cjs"]);

printStatusSafe();

const apiOk = await waitHealth("http://localhost:4000/health");
if (!apiOk) {
  console.warn("  ⚠ API hali javob bermadi — npm run pm2:logs\n");
} else {
  console.log("  ✓ API ishlayapti\n");
}

console.log(`  Contributor  →  http://localhost:3000/studio/hub.html
  Admin        →  http://localhost:3001/
  API          →  http://localhost:4000

  Loglar:     npm run pm2:logs
  To'xtatish: npm run pm2:stop
  Qayta:      npm run pm2:restart
  PM2 tozalash: npm run pm2:reset
  Dashboard:  npm run pm2:monit
`);
