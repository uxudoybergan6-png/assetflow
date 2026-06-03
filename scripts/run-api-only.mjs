#!/usr/bin/env node
/**
 * Faqat API — alohida terminalda ushlab turing.
 * npm run api:only
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function healthOk() {
  try {
    const r = await fetch("http://localhost:4000/health");
    return r.ok;
  } catch {
    return false;
  }
}

const port = process.env.API_PORT || "4000";

console.log(`
  ╔══════════════════════════════════════════════╗
  ║  AssetFlow API (alohida terminal)            ║
  ║  http://localhost:${port}                      ║
  ║  To'xtatish: Ctrl+C                           ║
  ║  Web/Admin: boshqa terminalda npm run studio:ui ║
  ╚══════════════════════════════════════════════╝
`);

if (await healthOk()) {
  console.log("  ✓ API allaqachon ishlayapti — qayta ishga tushirmasdan ishlating.");
  console.log("    Yangidan boshlash uchun avval Ctrl+C yoki: kill $(lsof -t -i :" + port + ")\n");
  process.exit(0);
}

const child = spawn("npm", ["run", "dev:api"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => {
  child.kill("SIGTERM");
  process.exit(0);
});
