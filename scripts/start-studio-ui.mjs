#!/usr/bin/env node
/**
 * Web + Admin — API allaqachon npm run api:only da ishlashi kerak.
 * npm run studio:ui
 */
import { spawn, execSync } from "child_process";
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
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", shell: true });
}

console.log("\n  AssetFlow Studio (UI) — API alohida terminalda bo'lishi kerak\n");
try {
  execSync("node packages/assetflow-studio/scripts/sync-to-web.mjs", {
    cwd: root,
    stdio: "inherit",
  });
} catch {
  console.warn("  ⚠ studio:sync xato\n");
}

console.log("  Contributor  →  http://localhost:3000/studio/hub.html");
console.log("  Admin        →  http://localhost:3001/");
console.log("  API          →  http://localhost:4000  (npm run api:only)\n");
console.log("  To'xtatish: Ctrl+C\n");

const web = run("npm", ["run", "dev:web"], "web");
const admin = run("npm", ["run", "dev:studio-admin"], "admin");

const shutdown = () => {
  [web, admin].forEach((p) => {
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
  const apiOk = await waitHealth("http://localhost:4000/health", 8);
  if (!apiOk) {
    console.warn(
      "  ⚠ API javob bermadi. Avval boshqa terminalda: npm run api:only\n"
    );
  } else {
    console.log("  ✓ API ulangan\n");
  }
  await waitHealth("http://localhost:3000/studio/hub.html", 60).catch(() => false);
  if (OPEN_HUB) openUrl("http://localhost:3000/studio/hub.html");
})();
