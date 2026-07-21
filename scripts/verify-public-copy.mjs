#!/usr/bin/env node
// Launch Task B — public sahifalar (landing/pricing/plugin) uchun STATIK regressiya tekshiruvi.
// Haqiqiy manba fayllarni o'qiydi (nusxa/kopiya emas) va:
//   1) qo'llab-quvvatlanmaydigan miqdoriy/ijtimoiy da'volarni ("10,000+ shablon", "millionlab
//      foydalanuvchi", soxta reyting, Premiere/DaVinci qo'llab-quvvatlash, 5-o'rinli jamoa,
//      brand kit, shaxsiy account manager) qidiradi;
//   2) fabrikatsiya qilingan mijoz ismlarini (avvalgi testimonial'lar) qidiradi;
//   3) media-xato fallback handler'lari (axMediaError/axMediaLoaded + umumiy .va-media listener)
//      manba kodida chinakam FUNKSIYA sifatida aniqlanganini tasdiqlaydi.
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
  "axMediaError workspace fallback funksiya sifatida aniqlangan",
  hasFunctionDefinition(htmlSrc, "axMediaError"),
);
check(
  "axMediaLoaded workspace fallback funksiya sifatida aniqlangan",
  hasFunctionDefinition(htmlSrc, "axMediaLoaded"),
);
check(
  "_onMediaError global public-media fallback listener funksiya sifatida aniqlangan",
  hasFunctionDefinition(htmlSrc, "this\\._onMediaError"),
);
check(
  "_onMediaError componentWillUnmount'da tozalanadi (removeEventListener)",
  /removeEventListener\('error', this\._onMediaError, true\)/.test(htmlSrc),
);
check(
  "'.va-mediaerr' CSS qoidasi mavjud (fallback overlay uslubi)",
  /\.va-mediaerr\s*\{/.test(htmlSrc),
);

console.log(`\n${checks - fails}/${checks} tekshiruv o'tdi.`);
if (fails > 0) {
  console.log(`${fails} ta muammo topildi.`);
  process.exit(1);
}
console.log("Barcha public-copy regressiya tekshiruvlari muvaffaqiyatli.");
