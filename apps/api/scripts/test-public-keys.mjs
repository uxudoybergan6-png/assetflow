// SC_02 — isPublicReadKey allow-list regressiya testi (test infra yo'q — standalone).
// Ishga tushirish: npm run build -w apps/api && node apps/api/scripts/test-public-keys.mjs
import { isPublicReadKey } from "../dist/lib/public-keys.js";

const cases = [
  // HALI HAM false — pullik/shaxsiy kalitlar himoyada qoladi
  ["templates/x/pack.zip", false],
  ["templates/x/pack.dl.zip", false],
  ["templates/x/mogrt/a", false],
  ["gen/u/123-456.png", false],
  ["gen-refs/a", false],
  ["gen-ref-src/a", false],
  ["avatars/a", false],
  ["incoming/a", false],
  ["landing/a/b.jpg", false],
  ["site/plugin/a/b.mp4", false],
  ["site/a.jpg", false],
  ["landing/", false],
  // ENDI true — admin CMS media (flat kalitlar)
  ["landing/1712-hero.jpg", true],
  ["site/plugin/1712-bg.mp4", true],
  // Mavjud ommaviy qoidalar buzilmagan
  ["templates/x/thumb.jpg", true],
  ["templates/x/preview.mp4", true],
  ["templates/x/scenes/s1/thumb.jpg", true],
  ["gen/u/123-456-thumb.jpg", true],
  ["gen/u/123-456-poster.jpg", true],
  ["gen/u/123-456-preview.mp4", true],
  ["gen/u/123-456-disp.webp", true],
];

let fail = 0;
for (const [key, expected] of cases) {
  const got = isPublicReadKey(key);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${key}  → ${got} (expected ${expected})`);
}
if (fail) {
  console.error(`\n${fail} test(lar) yiqildi`);
  process.exit(1);
}
console.log(`\nHammasi o'tdi (${cases.length} case).`);
