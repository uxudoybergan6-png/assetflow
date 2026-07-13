/**
 * Cloudflare Pages build — dist/ papkaga to'liq ko'chirish + routing fayllari
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
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

// MANBADAN generatsiya — committed studio/admin artefaktlariga BOG'LIQ EMAS.
// (Incident: artefaktlar untrack qilinganda build stilsiz chiqardi. Endi root
// manbadan — js/, styles/, admin/index.html, contributor/index.html, *.html —
// dist yasaladi. Natija committed-artefakt build bilan bayt-bayt AYNI.)
const SRC_JS = path.join(root, "js");
const SRC_STYLES = path.join(root, "styles");

// 1) Kanonik asset'lar (HTML'lar /js/, /styles/ ga ishora qiladi yoki redirect)
copyDir(SRC_JS, path.join(dist, "js"));
copyDir(SRC_STYLES, path.join(dist, "styles"));

// 2) /admin/ — admin/index.html MANBA; js/styles root manbadan regeneratsiya.
//    Admin login REAL fayl sifatida /admin/login.html'da (root'da EMAS) — CF
//    clean-URL 308'i uni /admin/login'da qoldiradi, platforma /login'iga
//    aralashmaydi.
copyFile(path.join(root, "admin", "index.html"), path.join(dist, "admin", "index.html"));
copyFile(path.join(root, "admin-login.html"), path.join(dist, "admin", "login.html"));
copyDir(SRC_JS, path.join(dist, "admin", "js"));
copyDir(SRC_STYLES, path.join(dist, "admin", "styles"));

// 3) /studio/ — html'lar manbadan, js/styles root manbadan regeneratsiya
//    (_redirects bularni baribir /js/,/styles/,/login.html,... ga yo'naltiradi)
copyDir(SRC_JS, path.join(dist, "studio", "js"));
copyDir(SRC_STYLES, path.join(dist, "studio", "styles"));
copyFile(path.join(root, "login.html"), path.join(dist, "studio", "login.html"));
copyFile(path.join(root, "hub.html"), path.join(dist, "studio", "hub.html"));
copyFile(
  path.join(root, "contributor", "index.html"),
  path.join(dist, "studio", "contributor", "index.html")
);

// 4) /contributor/ — MANBA
copyFile(
  path.join(root, "contributor", "index.html"),
  path.join(dist, "contributor", "index.html")
);

// PORTAL AJRATISH: login.html/admin-login.html endi ROOT'ga KO'CHIRILMAYDI —
// aks holda CF Pages clean-URL (login.html → /login) platforma SPA'sining
// /login yo'lini egallab olardi. Studio login /studio/login.html (3-bosqichda
// real fayl), admin login /admin/login.html (2-bosqichda). Root /login endi
// SPA fallback orqali PLATFORMA auth ekraniga tushadi.
const FILES = [
  "hub.html",
  "reset-password.html",
  "verify-email.html",
  "device.html",
  "design-system.html",
];
for (const f of FILES) copyFile(path.join(root, f), path.join(dist, f));

// 5) Public platforma (getframeflow.app root) — platform/ manbadan.
//    index.html dist ROOT'ga tushadi (CF Pages / ni avtomatik shu faylga beradi),
//    shu sabab eski root index.html endi FILES ro'yxatida EMAS.
copyDir(path.join(root, "platform"), dist);

// 5b) ff-api.js cache-bust — manbadagi `ff-api.js?v=dev` dist index.html'da fayl
//     KONTENT-HASH'i bilan almashtiriladi. Aks holda brauzer/CF keshi eski
//     ff-api.js beradi ("FFAPI.projectCreate is not a function" jonli incidenti).
{
  const apiSrc = path.join(dist, "ff-api.js");
  const idx = path.join(dist, "index.html");
  if (fs.existsSync(apiSrc) && fs.existsSync(idx)) {
    const hash = createHash("sha256").update(fs.readFileSync(apiSrc)).digest("hex").slice(0, 10);
    const html = fs.readFileSync(idx, "utf8").replace(/ff-api\.js\?v=[\w-]+/g, `ff-api.js?v=${hash}`);
    fs.writeFileSync(idx, html);
    console.log(`  ff-api.js cache-bust: ?v=${hash}`);
  }
}

// 5c) Umumiy JS cache-bust — BARCHA dist HTML'lardagi lokal `js/<nom>.js`
//     havolalariga fayl KONTENT-HASH'i (?v=) qo'shiladi (ff-api.js naqshi).
//     Aks holda deploy'dan keyin eski studio-api.js/admin-*.js keshdan kelib
//     "undefined is not a function" beradi (admin Website editori jonli incidenti).
{
  const jsDir = path.join(dist, "js");
  const jsHash = new Map(); // nom → kontent-hash (js/ dist nusxasidan — hamma joyda bir xil)
  if (fs.existsSync(jsDir)) {
    for (const name of fs.readdirSync(jsDir)) {
      if (!name.endsWith(".js")) continue;
      jsHash.set(name, createHash("sha256").update(fs.readFileSync(path.join(jsDir, name))).digest("hex").slice(0, 10));
    }
  }
  const bustHtml = (file) => {
    let html = fs.readFileSync(file, "utf8");
    let n = 0;
    // "js/x.js", "/js/x.js", "/studio/js/x.js", "/admin/js/x.js" — hammasi bitta manba nusxasi
    html = html.replace(/(src|href)="((?:\/(?:studio|admin))?\/?js\/)([\w.-]+\.js)(?:\?v=[\w-]*)?"/g, (m, attr, prefix, name) => {
      const h = jsHash.get(name);
      if (!h) return m;
      n++;
      return `${attr}="${prefix}${name}?v=${h}"`;
    });
    if (n) fs.writeFileSync(file, html);
    return n;
  };
  const walk = (dir) => {
    let total = 0;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) total += walk(p);
      else if (name.endsWith(".html")) total += bustHtml(p);
    }
    return total;
  };
  console.log(`  js cache-bust: ${walk(dist)} ta havola (${jsHash.size} fayl hash'landi)`);
}

// _redirects — Cloudflare Pages routing.
// Login sahifalari endi real fayllar (/studio/login.html, /admin/login.html);
// eski root URL'lar (login.html, admin-login.html — bookmark/email havolalari)
// 301 bilan yangi joyga. /login rule YO'Q — u platforma SPA'siga (auth ekrani).
const redirects = `\
/studio/js/*        /js/:splat                  200
/studio/styles/*    /styles/:splat              200
/studio/hub.html    /hub.html                   200
/studio/contributor /contributor/index.html     200
/studio/contributor/ /contributor/index.html   200
/contributor        /contributor/index.html     200
/contributor/       /contributor/index.html     200
/admin/js/*         /js/:splat                  200
/admin/styles/*     /styles/:splat              200
/admin              /admin/index.html           200
/admin/             /admin/index.html           200
/login.html         /studio/login.html          301
/admin-login.html   /admin/login.html           301
/admin-login        /admin/login.html           301
/templates          /stock                      301
/templates/*        /stock                      301
`;
fs.writeFileSync(path.join(dist, "_redirects"), redirects);

// _headers — xavfsizlik (#17 v3 CSP) + cache (#6) sozlamalari.
//
// CSP — ENFORCE (2 tur Report-Only test toza o'tdi → endi bloklaydi). Sabab:
// Studio 168+ inline event handler (onclick/oninput…) va 312+ inline style= dan
// foydalanadi → `script-src`/`style-src` 'unsafe-inline'SIZ butun UI sinadi
// (inline handler'larni nonce/hash bilan qoplab bo'lmaydi). Shu sabab CSP'ning
// asosiy qiymati — `connect-src`/`img-src` (XSS token-exfil'ni begona domenga
// yuborishni to'sish) + clickjacking. Report-Only fazasida (login/hub/contributor/
// admin + grafiklar) konsol toza bo'lgani tasdiqlangach enforce'ga o'tildi.
// connect/img/media: 'self' + API (Cloud Run) + GCS (storage.googleapis.com,
// thumb/preview API → GCS signed-URL redirect). eval/WebSocket ishlatilmaydi.
// Yangi domen + eski run.app (o'tish davri: keshlangan HTML/eski CEP hali eski
// originga murojaat qiladi; api. domain-mapping kechiksa ham ish to'xtamaydi)
const API_ORIGINS =
  "https://api.getframeflow.app https://assetflow-api-331762958776.europe-west1.run.app";
// GCS: path-style (storage.googleapis.com/<bucket>/…) VA virtual-hosted
// (<bucket>.storage.googleapis.com/…) hostlarini qamrash uchun. Presigned PUT
// URL'lar virtual-hosted (forcePathStyle default false) → wildcard SHART; CSP
// host-source moslashuvi ANIQ, bucket-subdomain bare hostga kirmaydi. Bare host
// ham qoldiriladi — wildcard apex hostni qoplamaydi.
const GCS_ORIGIN = "https://storage.googleapis.com https://*.storage.googleapis.com";
// P1 #3 (CDN, Plan B) — thumb/preview/scene/gen-derivativ Worker-proksi orqali
// (bucket yopiq). CDN_BASE_URL=https://cdn.getframeflow.app → img/media-src ruxsat.
const CDN_ORIGIN = "https://cdn.getframeflow.app";
// Google Identity Services (Studio login "Google bilan kirish" tugmasi) —
// gsi/client skripti + hisob tanlash popup/iframe shu origin'lardan yuklanadi.
const GOOGLE_GSI_ORIGINS = "https://accounts.google.com https://accounts.google.com/gsi/";
// Cloudflare Turnstile (register formadagi bot-himoya widget'i) — widget skripti
// + challenge iframe shu origin'dan yuklanadi.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
// YAGONA CSP (platforma darajasida, 'unsafe-eval' + blob: bilan) — INCIDENT:
// avval 'unsafe-eval' faqat `/` va `/index.html` yo'llariga berilgan edi, lekin
// platforma SPA'si IXTIYORIY path route'da (masalan /templates) ham index.html
// bilan xizmat qiladi (CF Pages SPA fallback), `_headers` esa SO'ROV yo'liga
// mos keladi → bunday yo'llarda dc-runtime'ning new Function() bloklanib butun
// interaktivlik o'lardi. Path route'lar ochiq to'plam bo'lgani uchun per-path
// scoping ishonchsiz — endi bitta CSP hamma yo'lga.
// Xavf bahosi: script-src'da 'unsafe-inline' baribir bor (168+ inline handler),
// ya'ni script-src XSS'dan deyarli himoya qilmaydi; CSP'ning asl qiymati
// connect/img-src origin-allowlist (token-exfil to'sish) — u o'zgarmadi.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${GOOGLE_GSI_ORIGINS} ${TURNSTILE_ORIGIN}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${API_ORIGINS} ${GCS_ORIGIN} ${CDN_ORIGIN}`,
  `media-src 'self' blob: ${API_ORIGINS} ${GCS_ORIGIN} ${CDN_ORIGIN}`,
  `connect-src 'self' ${API_ORIGINS} ${GCS_ORIGIN} https://accounts.google.com ${TURNSTILE_ORIGIN}`,
  `frame-src ${GOOGLE_GSI_ORIGINS} ${TURNSTILE_ORIGIN}`,
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
  Content-Security-Policy: ${CSP}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/js/*
  Cache-Control: public, max-age=300, must-revalidate

/styles/*
  Cache-Control: public, max-age=300, must-revalidate

/assets/*
  Cache-Control: public, max-age=86400, must-revalidate

/*.html
  Cache-Control: no-cache, must-revalidate

/_redirects
  Cache-Control: no-store
`;
fs.writeFileSync(path.join(dist, "_headers"), headers);

console.log("CF Pages build tayyor: dist/");
console.log("  _redirects va _headers yaratildi");
