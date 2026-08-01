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

// #21 (W1) — `_` bilan boshlanadigan fayl/papkalar ICHKI (dizayn mockup, qoralama):
// ular deploy'ga TUSHMASLIGI kerak edi, lekin copyDir hammasini ko'chirardi va 17 ta
// mockup (~1MB) production domenida ochiq turardi. `_headers`/`_redirects` — Cloudflare
// Pages'ning O'Z fayllari, ular istisno.
const CF_RESERVED = new Set(["_headers", "_redirects", "_routes.json", "_worker.js"]);
function isInternal(name) {
  return name.startsWith("_") && !CF_RESERVED.has(name);
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (isInternal(name)) continue;
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

// 2b) /admin/plugin-preview/ — AE CEP panelining BRAUZER nusxasi. Admin
//     "Plugin CMS" ekrani uni iframe'da ochadi (…?ffcms=1) va vizual muharrir
//     shu real panel ustida ishlaydi. Same-origin bo'lishi SHART: CSP bitta
//     `/*` blok (`frame-src 'self'`), cross-origin iframe bloklanardi.
//     Faqat panel ishlashi uchun kerak bo'lgani ko'chiriladi — `scripts/`
//     (build/install asboblari), `jsx/` (ExtendScript, brauzerda ishlamaydi),
//     `CSXS/` (manifest) va admin panel HTML'i TASHQARIDA. `_` bilan
//     boshlanadigan mockup'larni copyDir o'zi tashlab ketadi.
{
  const cep = path.resolve(root, "..", "..", "plugins", "after-effects-cep");
  const pv = path.join(dist, "admin", "plugin-preview");
  copyFile(path.join(cep, "AssetFlow_Plugin.html"), path.join(pv, "AssetFlow_Plugin.html"));
  for (const d of ["css", "icons", "js"]) copyDir(path.join(cep, d), path.join(pv, d));
  if (fs.existsSync(cep)) {
    for (const name of fs.readdirSync(cep)) {
      if (name.startsWith("assetflow-") && name.endsWith(".js")) {
        copyFile(path.join(cep, name), path.join(pv, name));
      }
    }
  }
}

// 3) /studio/ — html'lar manbadan, js/styles root manbadan regeneratsiya
//    (_redirects bularni baribir /js/,/styles/,/login.html,... ga yo'naltiradi)
copyDir(SRC_JS, path.join(dist, "studio", "js"));
copyDir(SRC_STYLES, path.join(dist, "studio", "styles"));
copyFile(path.join(root, "login.html"), path.join(dist, "studio", "login.html"));
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
// #21 (W1) — `hub.html` ("Which panel?" ichki ops chooser) va `design-system.html`
// (dizayn-tizim referensi) endi DEPLOY QILINMAYDI: ikkalasi ham ichki asboblar,
// ommaviy domenda ular ichki tuzilmani oshkor qilardi. Lokal dev'da o'zgarishsiz
// (dev-studio-server.mjs manbadan servlaydi).
const FILES = [
  "reset-password.html",
  "verify-email.html",
  "device.html",
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

// 5d) CSS cache-bust — js bilan bir xil naqsh (5c): BARCHA dist HTML'lardagi
//     lokal `styles/<nom>.css` havolalariga fayl KONTENT-HASH'i (?v=) qo'shiladi.
//     Aks holda deploy'dan keyin eski app.css/admin.css keshdan kelib stilsiz UI
//     ko'rinishi mumkin.
{
  const stylesDir = path.join(dist, "styles");
  const cssHash = new Map(); // nom → kontent-hash (styles/ dist nusxasidan — hamma joyda bir xil)
  if (fs.existsSync(stylesDir)) {
    for (const name of fs.readdirSync(stylesDir)) {
      if (!name.endsWith(".css")) continue;
      cssHash.set(name, createHash("sha256").update(fs.readFileSync(path.join(stylesDir, name))).digest("hex").slice(0, 10));
    }
  }
  const bustHtml = (file) => {
    let html = fs.readFileSync(file, "utf8");
    let n = 0;
    // "styles/x.css", "/styles/x.css", "/studio/styles/x.css", "/admin/styles/x.css" — hammasi bitta manba nusxasi
    html = html.replace(/(src|href)="((?:\/(?:studio|admin))?\/?styles\/)([\w.-]+\.css)(?:\?v=[\w-]*)?"/g, (m, attr, prefix, name) => {
      const h = cssHash.get(name);
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
  console.log(`  css cache-bust: ${walk(dist)} ta havola (${cssHash.size} fayl hash'landi)`);
}

// _redirects — Cloudflare Pages routing.
// Login sahifalari endi real fayllar (/studio/login.html, /admin/login.html);
// eski root URL'lar (login.html, admin-login.html — bookmark/email havolalari)
// 301 bilan yangi joyga. /login rule YO'Q — u platforma SPA'siga (auth ekrani).
const redirects = `\
/studio/js/*        /js/:splat                  200
/studio/styles/*    /styles/:splat              200
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

// robots.txt + sitemap.xml — #157 (L10).
// Ilgari IKKALASI HAM yo'q edi: qidiruv botlari SPA fallback tufayli /dashboard, /account,
// /projects kabi shaxsiy ekranlarni ham (index.html qobig'ini) indekslashga urinardi va
// ochiq sahifalar uchun hech qanday indekslash yo'riqnomasi yo'q edi.
// Kanonik domen — `apps/api/src/lib/app-urls.ts` DEFAULT_WEB_URL bilan bir xil.
const ORIGIN = "https://getframeflow.app";
// Faqat OCHIQ (auth talab qilmaydigan) yo'llar. Auth ortidagi ekranlar — Disallow.
const PUBLIC_ROUTES = ["/", "/stock", "/pricing", "/plugin", "/terms", "/privacy", "/refund", "/dmca", "/help"];
fs.writeFileSync(
  path.join(dist, "robots.txt"),
  `User-agent: *
Allow: /
${["/dashboard", "/account", "/projects", "/aistudio", "/auth", "/login", "/device", "/verify-email", "/reset-password", "/admin/", "/studio/", "/contributor/"]
  .map((p) => `Disallow: ${p}`)
  .join("\n")}

Sitemap: ${ORIGIN}/sitemap.xml
`
);
{
  // lastmod — build sanasi (YYYY-MM-DD). Har deploy'da yangilanadi.
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_ROUTES.map(
    (p) =>
      `  <url><loc>${ORIGIN}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>${p === "/" || p === "/stock" ? "daily" : "monthly"}</changefreq><priority>${p === "/" ? "1.0" : p === "/stock" || p === "/pricing" ? "0.8" : "0.4"}</priority></url>`
  ).join("\n");
  fs.writeFileSync(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
  );
  console.log(`  robots.txt + sitemap.xml (${PUBLIC_ROUTES.length} ta ochiq yo'l)`);
}

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
// FFCMS — admin vizual muharriri platformani iframe'da ochadi (admin.getframeflow.app
// → getframeflow.app/?ffcms=1). Shu bois:
//   frame-ancestors: 'none' → 'self' + admin origin (faqat admin embed qila oladi;
//     boshqa har qanday sayt uchun clickjacking himoyasi SAQLANADI).
//   frame-src: + 'self' + platforma origin (admin sahifasi iframe ochishi uchun —
//     _headers admin.* hostiga ham xizmat qiladi, funksiya-router bitta dist).
//   X-Frame-Options olib tashlandi: DENY frame-ancestors allow-list bilan zid;
//     zamonaviy brauzerlarda frame-ancestors yagona to'g'ri mexanizm.
const ADMIN_ORIGIN = "https://admin.getframeflow.app";
const PLATFORM_ORIGIN = "https://getframeflow.app";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${GOOGLE_GSI_ORIGINS} ${TURNSTILE_ORIGIN}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${API_ORIGINS} ${GCS_ORIGIN} ${CDN_ORIGIN}`,
  `media-src 'self' blob: ${API_ORIGINS} ${GCS_ORIGIN} ${CDN_ORIGIN}`,
  `connect-src 'self' ${API_ORIGINS} ${GCS_ORIGIN} https://accounts.google.com ${TURNSTILE_ORIGIN}`,
  `frame-src 'self' ${PLATFORM_ORIGIN} ${GOOGLE_GSI_ORIGINS} ${TURNSTILE_ORIGIN}`,
  "font-src 'self' https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  `frame-ancestors 'self' ${ADMIN_ORIGIN}`,
  "form-action 'self'",
].join("; ");

// nosniff/Referrer-Policy — ENFORCE (xavfsiz, UI buzmaydi).
const headers = `\
/*
  Content-Security-Policy: ${CSP}
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
