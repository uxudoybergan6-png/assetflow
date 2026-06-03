#!/usr/bin/env node
/**
 * To'liq zanjir tekshiruvi: PM2, API, DB, Contributor, Admin, Plugin, fayllar
 * npm run check:stack
 */
import { execSync, spawnSync } from "child_process";

const API = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const issues = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => {
  console.log(`  ⚠ ${m}`);
  issues.push(m);
};
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  issues.push(m);
};

async function httpOk(url) {
  try {
    const r = await fetch(url);
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, err: e.message };
  }
}

function pm2List() {
  const r = spawnSync("npx", ["pm2", "jlist"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

console.log("\n=== AssetFlow stack tekshiruvi ===\n");

// PM2
const pm2 = pm2List();
if (!pm2) {
  warn("PM2 ro'yxati o'qilmadi (npm run pm2:start qiling)");
} else {
  for (const name of ["assetflow-api", "assetflow-web", "assetflow-admin"]) {
    const p = pm2.find((x) => x.name === name);
    if (!p) bad(`${name} PM2 da yo'q`);
    else if (p.pm2_env?.status !== "online") {
      bad(`${name}: ${p.pm2_env?.status} (↺ ${p.pm2_env?.restart_time ?? "?"})`);
    } else ok(`${name}: online`);
  }
}

// HTTP
const health = await httpOk(`${API}/health`);
if (health.ok) ok(`API ${API}/health`);
else bad(`API ishlamayapti (${health.status || health.err})`);

for (const [label, url] of [
  ["Contributor hub", "http://localhost:3000/studio/hub.html"],
  ["Contributor login", "http://localhost:3000/studio/login.html"],
  ["Admin login", "http://localhost:3001/login.html"],
  ["Admin panel", "http://localhost:3001/"],
]) {
  const r = await httpOk(url);
  if (r.ok) ok(`${label}: ${r.status}`);
  else bad(`${label}: ${r.status || "ulanmadi"}`);
}

const adminProxy = await httpOk("http://localhost:3001/api/plugin/catalog");
if (adminProxy.ok) ok("Admin → API proxy (/api/plugin/catalog)");
else warn("Admin proxy ishlamayapti (video preview muammo bo'lishi mumkin)");

// Catalog + assets
let catalog;
try {
  const r = await fetch(`${API}/api/plugin/catalog`);
  catalog = await r.json();
  ok(`Plugin katalog: ${catalog.items?.length ?? 0} ta tasdiqlangan`);
} catch (e) {
  bad(`Plugin katalog: ${e.message}`);
  catalog = { items: [] };
}

for (const item of catalog.items || []) {
  if (item.hasPreview) {
    const prev = await httpOk(item.previewUrl);
    if (prev.ok) ok(`  preview: ${item.name.slice(0, 40)}…`);
    else warn(`  preview 404: ${item.name.slice(0, 40)}…`);
  } else {
    warn(`  preview yo'q: ${item.name.slice(0, 50)}…`);
  }

  if (item.hasPack) {
    const pack = await httpOk(item.packUrl);
    if (pack.ok) ok(`  pack: ${item.fileName || "ok"}`);
    else bad(`  pack URL ishlamayapti: ${item.name.slice(0, 40)}…`);
  } else {
    warn(`  pack yo'q (.aep): ${item.name.slice(0, 50)}… — AE Download ishlamaydi`);
  }
}

// Auth smoke
try {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@assetflow.uz", password: "admin123" }),
  });
  const data = await login.json();
  if (login.ok && data.user?.role === "ADMIN") ok("Admin login (admin@assetflow.uz)");
  else bad(`Admin login: ${data.error || login.status}`);
} catch (e) {
  bad(`Admin login: ${e.message} (npm run db:seed:assetflow?)`);
}

// CEP install
const cep =
  process.env.HOME +
  "/Library/Application Support/Adobe/CEP/extensions/com.assetflow.demo";
try {
  const fs = await import("fs");
  const need = ["assetflow-init.js", "assetflow-catalog.js", "AssetFlow_Plugin.html"];
  const miss = need.filter((f) => !fs.existsSync(`${cep}/${f}`));
  if (miss.length) warn(`CEP plugin: ${miss.join(", ")} yo'q — install-cep.sh`);
  else ok("CEP plugin fayllari o'rnatilgan");
} catch {
  warn("CEP papkasi tekshirilmadi");
}

console.log("\n--- Xulosa ---");
if (!issues.length) {
  console.log("  Hammasi asosan yaxshi. AE da Video Templates + Sync sinang.\n");
} else {
  console.log(`  ${issues.length} ta ogohlantirish/xato:\n`);
  issues.forEach((i) => console.log(`    • ${i}`));
  console.log("\n  Tuzatish: npm run pm2:reset\n");
  process.exitCode = 1;
}
