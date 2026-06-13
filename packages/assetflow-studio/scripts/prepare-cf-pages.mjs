/**
 * Cloudflare Pages build — dist/ papkaga to'liq ko'chirish + routing fayllari
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// dist/ ni tozalab qayta yarat
if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
fs.mkdirSync(dist, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Asosiy papka va fayllarni dist/ ga ko'chir
const DIRS = ["js", "styles", "admin", "contributor", "studio"];
for (const d of DIRS) copyDir(path.join(root, d), path.join(dist, d));

const FILES = [
  "hub.html",
  "login.html",
  "admin-login.html",
  "index.html",
  "reset-password.html",
  "design-system.html",
];
for (const f of FILES) copyFile(path.join(root, f), path.join(dist, f));

// _redirects — Cloudflare Pages routing
const redirects = `\
/studio/js/*        /js/:splat                  200
/studio/styles/*    /styles/:splat              200
/studio/login.html  /login.html                 200
/studio/hub.html    /hub.html                   200
/studio/contributor /contributor/index.html     200
/studio/contributor/ /contributor/index.html   200
/contributor        /contributor/index.html     200
/contributor/       /contributor/index.html     200
/admin/js/*         /js/:splat                  200
/admin/styles/*     /styles/:splat              200
/admin/login.html   /admin-login.html           200
/admin              /admin/index.html           200
/admin/             /admin/index.html           200
/                   /hub.html                   200
`;
fs.writeFileSync(path.join(dist, "_redirects"), redirects);

// _headers — cache sozlamalari
const headers = `\
/js/*
  Cache-Control: public, max-age=31536000, immutable

/styles/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache, must-revalidate

/_redirects
  Cache-Control: no-store
`;
fs.writeFileSync(path.join(dist, "_headers"), headers);

console.log("CF Pages build tayyor: dist/");
console.log("  _redirects va _headers yaratildi");
