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

// _headers — xavfsizlik (#17 v3 CSP) + cache (#6) sozlamalari.
//
// CSP — REPORT-ONLY (hozircha bloklamaydi, faqat konsolga xato beradi). Sabab:
// Studio 168+ inline event handler (onclick/oninput…) va 312+ inline style= dan
// foydalanadi → `script-src`/`style-src` 'unsafe-inline'SIZ butun UI sinadi
// (inline handler'larni nonce/hash bilan qoplab bo'lmaydi). Shu sabab CSP'ning
// asosiy qiymati — `connect-src`/`img-src` (XSS token-exfil'ni begona domenga
// yuborishni to'sish) + clickjacking. Report-Only deploy'dan keyin konsolda
// buzilishni kuzatib (o'tkazib yuborilgan domen/resurs), so'ng `-Report-Only`
// qo'shimchasini olib tashlab ENFORCE qilamiz.
// connect/img/media: 'self' + API (assetflow-rqbq.onrender.com) + R2 CDN (*.r2.dev,
// thumb/preview API → R2 302 redirect). eval/WebSocket ishlatilmaydi.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https://assetflow-rqbq.onrender.com https://*.r2.dev",
  "media-src 'self' https://assetflow-rqbq.onrender.com https://*.r2.dev",
  "connect-src 'self' https://assetflow-rqbq.onrender.com https://*.r2.dev",
  "font-src 'self' https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

// X-Frame-Options/nosniff/Referrer-Policy — ENFORCE (xavfsiz, UI buzmaydi):
// darhol clickjacking + MIME-sniffing himoyasi (CSP Report-Only fazasida ham).
const headers = `\
/*
  Content-Security-Policy-Report-Only: ${CSP}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/js/*
  Cache-Control: public, max-age=300, must-revalidate

/styles/*
  Cache-Control: public, max-age=300, must-revalidate

/*.html
  Cache-Control: no-cache, must-revalidate

/_redirects
  Cache-Control: no-store
`;
fs.writeFileSync(path.join(dist, "_headers"), headers);

console.log("CF Pages build tayyor: dist/");
console.log("  _redirects va _headers yaratildi");
