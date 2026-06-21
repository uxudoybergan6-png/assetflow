#!/usr/bin/env node
/**
 * AssetFlow — bitta buyruq: API + Web + Admin + brauzerda hub
 * npm run studio
 */
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPEN_HUB = !process.argv.includes("--no-open");

function run(cmd, args, name) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  child.on("error", (e) => console.error(`[${name}]`, e.message));
  return child;
}

async function waitHealth(url, tries = 40) {
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

function openUrl(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", shell: true });
}

console.log("\n  AssetFlow Studio ishga tushmoqda...\n");
try {
  execSync("node packages/assetflow-studio/scripts/sync-to-web.mjs", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  console.warn("  ⚠ studio:sync xato — hub.html yo'q bo'lishi mumkin");
}
console.log("  Contributor  →  http://localhost:3000/studio/hub.html");
console.log("  Admin        →  http://localhost:3001/");
console.log("  API          →  http://localhost:4000\n");
console.log("  Barqaror ishlash: API ni alohida terminalda npm run api:only");
console.log("  keyin UI: npm run studio:ui\n");
console.log("  To'xtatish: Ctrl+C\n");

const api = run("npm", ["run", "dev:api"], "api");
const web = run("npm", ["run", "dev:studio-web"], "web");
const admin = run("npm", ["run", "dev:studio-admin"], "admin");

const shutdown = () => {
  [api, web, admin].forEach((p) => {
    try {
      p.kill("SIGTERM");
    } catch {
      /* */
    }
  });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

(async () => {
  const ok = await waitHealth("http://localhost:4000/health");
  if (!ok) console.warn("  ⚠ API sekin ishga tushmoqda — hub baribir ochiladi\n");
  await waitHealth("http://localhost:3000/studio/hub.html", 60).catch(() => false);
  if (OPEN_HUB) {
    openUrl("http://localhost:3000/studio/hub.html");
  }
})();
