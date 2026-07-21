#!/usr/bin/env node
// Launch Task B — public sahifalar (landing/pricing/plugin) uchun STATIK regressiya tekshiruvi.
// Haqiqiy manba fayllarni o'qiydi (nusxa/kopiya emas) va:
//   1) qo'llab-quvvatlanmaydigan miqdoriy/ijtimoiy da'volarni ("10,000+ shablon", "millionlab
//      foydalanuvchi", soxta reyting, Premiere/DaVinci qo'llab-quvvatlash, 5-o'rinli jamoa,
//      brand kit, shaxsiy account manager) qidiradi;
//   2) fabrikatsiya qilingan mijoz ismlarini (avvalgi testimonial'lar) qidiradi;
//   3) media yuklanish/xato fallback'i delegatsiya orqali ulanganini tasdiqlaydi (capture-fazadagi
//      error/load/loadedmetadata listener'lari + unmount tozalash);
//   4) [Correction audit, 2026-07-21] aniq "14-day money-back guarantee" da'vosi HECH QAYERDA
//      qaytmasligini tasdiqlaydi (refund.html'da hali lawyer-review ostida — final muddat/shart
//      tasdiqlanmagan, shuning uchun public marketing bu aniq iborani va'da qilmasligi SHART);
//   5) platform/index.html'dagi <script> teglari sonini (4 inline + 6 tashqi = 10 jami) va har bir
//      inline skript tanasining `new Function()` bilan sintaksis jihatdan yaroqli ekanini tekshiradi;
//   6) [Correction audit #2, 2026-07-21] NATIVE INLINE HANDLER KONTRAKTI — manba VA deploy-shaklidagi
//      dist/index.html'da hech qanday avtomatik ishga tushadigan media atributi
//      (onload/onerror/onloadedmetadata/...) qolmaganini tasdiqlaydi. Sabab: dc-runtime shablonni
//      kompilyatsiya qilishdan oldin brauzer <x-dc> ichidagi xom DOM'ni parse qiladi va atribut
//      qiymatini JS sifatida bajaradi — `onerror="{{ axMediaError }}"` real brauzerda
//      "ReferenceError: axMediaError is not defined" berardi. Funksiya ta'rifi mavjudligini
//      tekshirish buni USHLAMAYDI (false-positive), shuning uchun atribut kontrakti tekshiriladi;
//   7) FF-MEDIA-DELEGATION blokini JONLI manbadan ajratib olib, soxta DOM ustida HAQIQATAN
//      BAJARADI: skeleton olinishi, 1 martalik cache-bust retry, "Media unavailable" qoplama.
// Ishlatish: node scripts/verify-public-copy.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LANDING_CONFIG = path.join(ROOT, "apps/api/src/lib/landing-config.ts");
const PLATFORM_HTML = path.join(ROOT, "packages/assetflow-studio/platform/index.html");

let fails = 0;
let checks = 0;

function readSource(file) {
  return fs.readFileSync(file, "utf8");
}

function check(label, ok, detail) {
  checks++;
  if (!ok) { fails++; console.log(`FAIL  ${label}${detail ? " — " + detail : ""}`); }
  else console.log(`PASS  ${label}`);
}

// ── 1) Qo'llab-quvvatlanmaydigan miqdoriy/imkoniyat da'volari ──
// Har bir naqsh: [label, regexp]. Muvofiqlik topilsa FAIL (qatorlar bilan).
const PROHIBITED_PATTERNS = [
  ["'10,000+' / \"10,000+\" miqdor da'vosi", /10,000\+|10000\+/],
  ["'5,000+' / '5000+' miqdor da'vosi", /5,000\+|5000\+/],
  ["'millions of creators' / 'millionlab foydalanuvchi'", /millions? of (creators|users)/i],
  ["soxta reyting (\"Average rating\")", /Average rating/],
  ["\"AE / Premiere plugin\" / \"For AE / Premiere\"", /AE \/ Premiere|For AE \/ Premiere/],
  ["5 o'rinli jamoa ishchi maydoni (\"Team workspace (5 seats)\")", /Team workspace \(5 seats\)/],
  ["Brand kit da'vosi", /Brand kit/],
  ["Shaxsiy account manager da'vosi", /Dedicated account manager/],
];

// platform/index.html'da haqiqiy ko'p-ilova katalog teglash funksiyasi (FAZA 5, apps.ts) bor —
// real shablonlar Premiere/DaVinci uchun ham teglanishi mumkin (appOptions/appFull/metaPills,
// faqat dRaw.a real ma'lumotidan). Bu OG'ZAKI PLAGIN VA'DASI emas, shuning uchun bare "Premiere
// Pro"/"DaVinci Resolve" tekshiruvi faqat marketing manba (landing-config.ts) uchun qo'llanadi —
// u yerda bunday matn faqat marketing nusxasi bo'lishi mumkin, haqiqiy katalog metama'lumoti emas.
const MARKETING_ONLY_PATTERNS = [
  ["Premiere Pro qo'llab-quvvatlash da'vosi", /Premiere Pro/],
  ["DaVinci Resolve qo'llab-quvvatlash da'vosi", /DaVinci Resolve/],
];

// ── 2) Fabrikatsiya qilingan mijoz ismlari (avvalgi testimonial'lar) ──
const FABRICATED_NAMES = [
  ["Dilnoza Karimova (soxta testimonial)", /Dilnoza Karimova/],
  ["Sardor Aliyev (soxta testimonial)", /Sardor Aliyev/],
  ["Madina Yusupova (soxta testimonial)", /Madina Yusupova/],
];

function scanFileForPatterns(file, patterns) {
  const src = readSource(file);
  const rel = path.relative(ROOT, file);
  for (const [label, re] of patterns) {
    const m = src.match(re);
    check(`${rel}: ${label} yo'q`, !m, m ? `topildi: "${m[0]}"` : undefined);
  }
}

console.log("── Qo'llab-quvvatlanmaydigan da'volar (landing-config.ts) ──");
scanFileForPatterns(LANDING_CONFIG, PROHIBITED_PATTERNS);
scanFileForPatterns(LANDING_CONFIG, MARKETING_ONLY_PATTERNS);
scanFileForPatterns(LANDING_CONFIG, FABRICATED_NAMES);

console.log("\n── Qo'llab-quvvatlanmaydigan da'volar (platform/index.html) ──");
scanFileForPatterns(PLATFORM_HTML, PROHIBITED_PATTERNS);
scanFileForPatterns(PLATFORM_HTML, FABRICATED_NAMES);

// ── 3) Media-xato fallback handler'lari mavjud va FUNKSIYA sifatida aniqlangan ──
const htmlSrc = readSource(PLATFORM_HTML);

function hasFunctionDefinition(src, name) {
  // `name = (ev) => {` yoki `name: (ev) => {` yoki `function name(` shakllaridan birini qidiradi —
  // faqat o'zgaruvchi/holat NOMINI emas, HAQIQIY funksiya ta'rifini talab qiladi.
  const patterns = [
    new RegExp(`\\b${name}\\s*=\\s*\\([^)]*\\)\\s*=>`),
    new RegExp(`\\b${name}\\s*:\\s*\\([^)]*\\)\\s*=>`),
    new RegExp(`function\\s+${name}\\s*\\(`),
  ];
  return patterns.some((re) => re.test(src));
}

check(
  "_onMediaError delegatsiya listener'i funksiya sifatida aniqlangan",
  hasFunctionDefinition(htmlSrc, "this\\._onMediaError"),
);
check(
  "_onMediaLoad delegatsiya listener'i funksiya sifatida aniqlangan",
  hasFunctionDefinition(htmlSrc, "this\\._onMediaLoad"),
);
check(
  "'error' listener capture fazasida ro'yxatdan o'tgan",
  /addEventListener\('error', this\._onMediaError = [\s\S]{0,2000}?\}, true\)/.test(htmlSrc),
);
check(
  "'load' listener capture fazasida ro'yxatdan o'tgan",
  /addEventListener\('load', this\._onMediaLoad = [\s\S]{0,2000}?\}, true\)/.test(htmlSrc),
);
check(
  "'loadedmetadata' listener capture fazasida ro'yxatdan o'tgan (video skeleton)",
  /addEventListener\('loadedmetadata', this\._onMediaLoad, true\)/.test(htmlSrc),
);
check(
  "_onMediaError componentWillUnmount'da tozalanadi (removeEventListener)",
  /removeEventListener\('error', this\._onMediaError, true\)/.test(htmlSrc),
);
check(
  "_onMediaLoad componentWillUnmount'da tozalanadi (load + loadedmetadata)",
  /removeEventListener\('load', this\._onMediaLoad, true\)/.test(htmlSrc) &&
    /removeEventListener\('loadedmetadata', this\._onMediaLoad, true\)/.test(htmlSrc),
);
check(
  "'.va-mediaerr' CSS qoidasi mavjud (fallback overlay uslubi)",
  /\.va-mediaerr\s*\{/.test(htmlSrc),
);

// ── 4) Aniq "14-day money-back guarantee" da'vosi HECH QAYERDA yo'q ──
// refund.html'ning o'zi 14 kunlik oyna/chegara/final shartlar hali lawyer-review ostida deydi —
// shuning uchun public marketing bu aniq iborani va'da qilishi MUMKIN EMAS. Refund.html o'ziga
// tegilmaydi/tekshirilmaydi (u yerdagi lawyer-review izohli matn — bu tekshiruv doirasidan tashqarida).
const FOURTEEN_DAY_GUARANTEE = /14-day money-back guarantee/;
check(
  "apps/api/src/lib/landing-config.ts: aniq '14-day money-back guarantee' iborasi yo'q",
  !FOURTEEN_DAY_GUARANTEE.test(readSource(LANDING_CONFIG).replace(/\/\/.*$/gm, "")),
);
check(
  "packages/assetflow-studio/platform/index.html: aniq '14-day money-back guarantee' iborasi yo'q",
  !FOURTEEN_DAY_GUARANTEE.test(htmlSrc),
);

// ── 5) platform/index.html <script> teglari: 4 inline + 6 tashqi = 10 jami; har bir inline
//      skript tanasi `new Function()` bilan sintaksis jihatdan yaroqli ──
function scanScriptTags(src) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  const inline = [];
  let external = 0;
  let total = 0;
  let m;
  while ((m = re.exec(src))) {
    total++;
    if (/\bsrc\s*=/.test(m[1])) external++;
    else inline.push(m[2]);
  }
  return { total, external, inline };
}

const { total: scriptTotal, external: scriptExternal, inline: inlineScripts } = scanScriptTags(htmlSrc);
check("platform/index.html: jami <script> teglari soni = 10", scriptTotal === 10, `topildi: ${scriptTotal}`);
check("platform/index.html: tashqi (src=) <script> soni = 6", scriptExternal === 6, `topildi: ${scriptExternal}`);
check("platform/index.html: inline <script> soni = 4", inlineScripts.length === 4, `topildi: ${inlineScripts.length}`);
inlineScripts.forEach((body, i) => {
  let ok = true;
  let errMsg;
  try {
    new Function(body);
  } catch (e) {
    ok = false;
    errMsg = e.message;
  }
  check(`platform/index.html: inline <script> #${i + 1} sintaksis OK (new Function)`, ok, errMsg);
});

// ── 6) NATIVE INLINE HANDLER KONTRAKTI (manba + deploy-shaklidagi dist) ──
// Brauzer <x-dc> shablonini dc-runtime kompilyatsiyasidan OLDIN xom HTML sifatida parse qiladi.
// Shu sababli `<img src="{{ g.imgSrc }}" onerror="{{ axMediaError }}">` real 404 beradi va
// atribut qiymati NATIVE JS sifatida bajariladi → ReferenceError. Quyidagi tekshiruv aynan shu
// muvaffaqiyatsizlik rejimini ushlaydi: avtomatik ishga tushadigan media atributlari mutlaqo
// bo'lmasligi va HECH BIR inline `on...=` atributi ichida axMediaError/axMediaLoaded
// identifikatori uchramasligi SHART.
console.log("\n── Native inline media handler kontrakti ──");

// Brauzer element yuklanishida FOYDALANUVCHI ARALASHUVISIZ ishga tushiradigan atributlar.
const AUTO_FIRING_MEDIA_ATTRS = /\son(load|error|loadedmetadata|loadstart|loadeddata|abort|stalled|suspend|canplay|canplaythrough|emptied)\s*=\s*(["'])([\s\S]*?)\2/gi;
// Har qanday inline `on...="..."` atributi (dc-runtime ularni React prop'ga aylantiradi; lekin
// shablon DOM'i brauzerda xom holda ham mavjud bo'ladi).
const ANY_INLINE_HANDLER_ATTR = /\son([a-z]+)\s*=\s*(["'])([\s\S]*?)\2/gi;

function auditInlineHandlers(label, src) {
  const autoFiring = [];
  let m;
  AUTO_FIRING_MEDIA_ATTRS.lastIndex = 0;
  while ((m = AUTO_FIRING_MEDIA_ATTRS.exec(src))) autoFiring.push(`on${m[1]}="${m[3]}"`);
  check(
    `${label}: avtomatik ishga tushadigan inline media atributi yo'q (on load/error/loadedmetadata/…)`,
    autoFiring.length === 0,
    autoFiring.length ? `topildi: ${autoFiring.slice(0, 3).join(" | ")}` : undefined,
  );

  const leaked = [];
  ANY_INLINE_HANDLER_ATTR.lastIndex = 0;
  while ((m = ANY_INLINE_HANDLER_ATTR.exec(src))) {
    if (/\bax(MediaError|MediaLoaded)\b/.test(m[3])) leaked.push(`on${m[1]}="${m[3]}"`);
  }
  check(
    `${label}: hech bir inline handler atributi axMediaError/axMediaLoaded'ga murojaat qilmaydi`,
    leaked.length === 0,
    leaked.length ? `topildi: ${leaked.slice(0, 3).join(" | ")}` : undefined,
  );

  // Global identifikator sifatida ham sizib chiqmasin (window.axMediaError = … kabi "yamoq").
  check(
    `${label}: axMediaError/axMediaLoaded global identifikator sifatida e'lon qilinmagan`,
    !/\b(window|globalThis|self)\s*(\.\s*ax(MediaError|MediaLoaded)\b|\[\s*['"]ax(MediaError|MediaLoaded)['"]\s*\])/.test(src),
  );
}

auditInlineHandlers("platform/index.html (manba)", htmlSrc);

const DIST_HTML = path.join(ROOT, "packages/assetflow-studio/dist/index.html");
if (fs.existsSync(DIST_HTML)) {
  const distSrc = readSource(DIST_HTML);
  auditInlineHandlers("dist/index.html (deploy shakli)", distSrc);
  // Deploy shaklidagi har bir inline skript tanasi ham sintaksis jihatdan yaroqli bo'lsin.
  const distScripts = scanScriptTags(distSrc);
  distScripts.inline.forEach((body, i) => {
    let ok = true;
    let errMsg;
    try { new Function(body); } catch (e) { ok = false; errMsg = e.message; }
    check(`dist/index.html: inline <script> #${i + 1} sintaksis OK (new Function)`, ok, errMsg);
  });
} else {
  console.log(
    "NOTE  dist/index.html topilmadi — `node packages/assetflow-studio/scripts/prepare-cf-pages.mjs`" +
      " ishga tushirilsa deploy-shakli ham tekshiriladi.",
  );
}

// ── 7) FF-MEDIA-DELEGATION blokini JONLI manbadan bajarib tekshirish ──
// Bu tekshiruv nusxa-kodni emas, aynan index.html ichidagi blokni ishga tushiradi.
console.log("\n── Media delegatsiyasi (jonli manba bajariladi) ──");

const DELEG_RE = /\/\* FF-MEDIA-DELEGATION:START \*\/([\s\S]*?)\/\* FF-MEDIA-DELEGATION:END \*\//;
const delegMatch = htmlSrc.match(DELEG_RE);
check("FF-MEDIA-DELEGATION bloki manbada markerlar bilan ajratilgan", !!delegMatch);

if (delegMatch) {
  class FakeEl {
    constructor(tag, classes = []) {
      this.tag = tag;
      this._cls = new Set(classes);
      this._attrs = {};
      this.children = [];
      this.parentElement = null;
      this.style = {};
      this.textContent = "";
      const self = this;
      this.classList = {
        contains: (c) => self._cls.has(c),
        remove: (c) => self._cls.delete(c),
        add: (c) => self._cls.add(c),
      };
    }
    get className() { return [...this._cls].join(" "); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get src() { return this._attrs.src || ""; }
    set src(v) { this._attrs.src = v; }
    getAttribute(n) { return n in this._attrs ? this._attrs[n] : null; }
    setAttribute(n, v) { this._attrs[n] = v; }
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    closest(sel) {
      const cls = sel.replace(/^\./, "");
      let n = this;
      while (n) { if (n._cls.has(cls)) return n; n = n.parentElement; }
      return null;
    }
    querySelector(sel) {
      const cls = sel.replace(/^\./, "");
      for (const c of this.children) {
        if (c._cls.has(cls)) return c;
        const d = c.querySelector(sel);
        if (d) return d;
      }
      return null;
    }
  }

  const registered = [];
  const fakeWindow = {
    addEventListener: (type, fn, capture) => registered.push({ type, fn, capture }),
    removeEventListener: () => {},
  };
  const fakeDocument = { createElement: (t) => new FakeEl(t) };
  const component = {};
  let bootErr = null;
  try {
    new Function("window", "document", delegMatch[1]).call(component, fakeWindow, fakeDocument);
  } catch (e) {
    bootErr = e.message;
  }
  check("delegatsiya bloki xatosiz bajariladi", !bootErr, bootErr || undefined);

  const fire = (type, target) => {
    for (const r of registered) if (r.type === type) r.fn({ target });
  };
  const hasCapture = (type) => registered.some((r) => r.type === type && r.capture === true);

  check("error/load/loadedmetadata — uchalasi ham capture fazasida ulangan",
    hasCapture("error") && hasCapture("load") && hasCapture("loadedmetadata"));

  // (a) Workspace rasm xatosi: 1-xato = cache-bust retry, qoplama YO'Q.
  const host = new FakeEl("div", ["va-axres", "va-skel"]);
  host.setAttribute("data-id", "gen-1");
  const img = new FakeEl("img", ["va-media"]);
  img.setAttribute("src", "https://cdn.example/a.jpg");
  host.appendChild(img);
  fire("error", img);
  check("1-xato: src cache-bust bilan bir marta qayta urinildi",
    /_r=\d+/.test(img.getAttribute("src")), `src="${img.getAttribute("src")}"`);
  check("1-xato: hali 'Media unavailable' qoplamasi qo'yilmagan", !host.querySelector(".va-mediaerr"));
  check("1-xato: element hali yashirilmagan", img.style.display !== "none");

  // (b) 2-xato: retry tugadi → halol qoplama + elementni yashirish.
  fire("error", img);
  const ov = host.querySelector(".va-mediaerr");
  check("2-xato: 'Media unavailable' qoplamasi qo'yildi",
    !!ov && ov.textContent === "Media unavailable", ov ? `matn: "${ov.textContent}"` : "qoplama yo'q");
  check("2-xato: element yashirildi (display:none)", img.style.display === "none");
  check("2-xato: skeleton olib tashlandi", !host.classList.contains("va-skel"));
  check("2-xato: qoplama takrorlanmaydi (ikkinchi marta qo'shilmaydi)", host.children.filter((c) => c.classList.contains("va-mediaerr")).length === 1);

  // (c) Rasm yuklandi → skeleton olinadi + _mediaLoaded belgilanadi.
  const okHost = new FakeEl("div", ["va-axres", "va-skel"]);
  okHost.setAttribute("data-id", "gen-2");
  const okImg = new FakeEl("img", ["va-media"]);
  okHost.appendChild(okImg);
  fire("load", okImg);
  check("load: skeleton olib tashlandi", !okHost.classList.contains("va-skel"));
  check("load: _mediaLoaded'ga id yozildi", !!component._mediaLoaded && component._mediaLoaded.has("gen-2"));

  // (d) Video: `load` bermaydi — `loadedmetadata` ayni ishni qiladi.
  const vHost = new FakeEl("div", ["va-axres", "va-skel"]);
  vHost.setAttribute("data-id", "gen-3");
  const video = new FakeEl("video", ["va-media", "va-hovplay"]);
  vHost.appendChild(video);
  fire("loadedmetadata", video);
  check("loadedmetadata: video skeletoni olib tashlandi", !vHost.classList.contains("va-skel"));
  check("loadedmetadata: _mediaLoaded'ga video id yozildi", !!component._mediaLoaded && component._mediaLoaded.has("gen-3"));

  // (e) Ochiq (public) sahifa media'si — .va-axres yo'q, qoplama ota elementga tushadi.
  const pubHost = new FakeEl("div", ["ffl-shot"]);
  const pubImg = new FakeEl("img", ["va-media"]);
  pubImg.setAttribute("src", "https://cdn.example/hero.webp");
  pubHost.appendChild(pubImg);
  fire("error", pubImg);
  fire("error", pubImg);
  check("public media: fallback qoplamasi ota elementga qo'yildi", !!pubHost.querySelector(".va-mediaerr"));

  // (f) `.va-media` bo'lmagan element umuman tegilmaydi (masalan, tashqi skript xatosi).
  const otherHost = new FakeEl("div", ["x"]);
  const other = new FakeEl("img", ["other"]);
  otherHost.appendChild(other);
  fire("error", other);
  check("'.va-media' bo'lmagan element tegilmaydi", !otherHost.querySelector(".va-mediaerr") && other.style.display !== "none");
}

console.log(`\n${checks - fails}/${checks} tekshiruv o'tdi.`);
if (fails > 0) {
  console.log(`${fails} ta muammo topildi.`);
  process.exit(1);
}
console.log("Barcha public-copy regressiya tekshiruvlari muvaffaqiyatli.");
