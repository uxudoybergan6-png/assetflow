#!/usr/bin/env node
// R5 — AE panel responsive kontrakt testi (deterministik, DOM/brauzer talab qilmaydi).
// Tekshiradi: CEP'da 392×800 AI ramkasi yo'q, Home hero ixcham cap, katalog grid
// minimumi, yagona chrome, feature yo'qolmagan (ID/handler'lar joyida).
// Mutation-proof: qoidalar TARTIBI ham tekshiriladi (layer bazadan KEYIN kelishi shart).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'AssetFlow_Plugin.html'), 'utf8');
const stylesCss = readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const fail = (name, why) => { failures++; console.error(`  ✗ ${name} — ${why}`); };
const check = (name, cond, why) => (cond ? ok(name) : fail(name, why));

console.log('panel-responsive contract:');

// ── 1. Yakuniy density layer mavjud va kaskadning OXIRIDA (baza qoidalardan keyin) ──
const layerAt = html.indexOf('R5 · AE-PANEL DENSITY LAYER');
check('density layer marker present', layerAt !== -1, 'R5 layer marker missing');
const layer = layerAt === -1 ? '' : html.slice(layerAt, html.indexOf('</style>', layerAt));
const phoneBaseAt = html.indexOf('.axroot .app{width:392px');
check('legacy 392px base rule still present (demo mode)', phoneBaseAt !== -1,
  'base .axroot .app rule not found — selector renamed? update this test');
check('layer comes AFTER 392px base rule (cascade order)', layerAt > phoneBaseAt,
  'override layer must be later in the cascade than the phone-frame base rule');
check('styles.css linked BEFORE inline layer', html.indexOf('css/styles.css') < layerAt,
  'inline layer must load after css/styles.css to win ties');

// ── 2. CEP rejimida AI sheli full-bleed (392×800 telefon-ramka YO'Q) ──
check('cep-mode AI shell fills panel width',
  layer.includes('html.cep-mode .axroot .app{width:100%;max-width:none;height:auto'),
  'full-bleed cep-mode .app override missing');
check('cep-mode AI shell drops demo frame chrome',
  /html\.cep-mode \.axroot \.app\{[^}]*border:0;border-radius:0;box-shadow:none/.test(layer),
  'demo radius/shadow/border must be stripped in cep-mode');
check('cep-mode strips showcase padding',
  layer.includes('html.cep-mode .axroot{padding:0'),
  '.axroot showcase padding must be 0 in cep-mode');
check('axws-tool height chain untouched',
  html.includes('#aiPage.axws-tool .axroot .app{height:100%}'),
  'workspace height chain (#aiPage.axws-tool) must survive');

// ── 3. Home hero ixcham cap — marketing balandligi o'chirilgan ──
check('home hero compact cap in layer',
  /\.fhome-hero\{height:auto;min-height:0/.test(layer),
  'compact .fhome-hero override missing');
check('marketing hero clamp only in base stylesheet (overridden later)',
  stylesCss.includes('.fhome-hero{height:clamp(') && !layer.includes('height:clamp('),
  'clamp() hero height must not survive into the final layer');

// ── 4. Katalog grid minimumi — ixcham 2 ustun ~336px dan ──
check('catalog grid compact minimum (148px)',
  layer.includes('.grid,html.cep-mode .grid{grid-template-columns:repeat(auto-fill,minmax(148px,1fr))'),
  'compact catalog grid override missing');
check('density variants preserved (sm/md/lg)',
  layer.includes('html.dens-sm .grid') && layer.includes('html.dens-lg .grid'),
  'density toggle variants must be re-declared in the layer');

// ── 5. Yagona chrome — dublikat headerlar yashirin qoladi ──
for (const rule of ['#homeHd{display:none!important}', '#v-launcher>.ai-hdr{display:none!important}', '.axroot .pbar{display:none!important}']) {
  check(`duplicate chrome hidden: ${rule.split('{')[0]}`, html.includes(rule), 'single-chrome rule missing');
}
check('credit pill never fully hidden',
  !/\.af-tb-cred\s*\{[^}]*display:\s*none/.test(html),
  'credit/balance must never be display:none');

// ── 6. Launcher: 3-karta kompozitsiyasi (yetim karta yo'q) ──
check('launcher odd-last card spans full width',
  layer.includes('.axroot .cats .cat:last-child:nth-child(odd){grid-column:1/-1}'),
  'orphan-card composition rule missing');
check('launcher 3-col on wide panels',
  layer.includes('html.cep-mode .axroot .cats{grid-template-columns:repeat(3,1fr)}'),
  'wide-panel launcher columns missing');

// ── 7. Feature yo'qolmagan — ID / handler'lar joyida ──
const requiredIds = ['homeHeroPrompt', 'homeBArt', 'homeBModel', 'homeGreet', 'homeRecent',
  'homeCatTiles', 'homeSessRow', 'aiCatGrid', 'searchInput', 'filterToggleBtn', 'densityBtn',
  'sortBtn', 'hdrCred', 'hdrPlanPill', 'hdrAva', 'afPillarSeg', 'sbCredit', 'grid', 'dlGrid'];
for (const id of requiredIds) {
  check(`id preserved: #${id}`, html.includes(`id="${id}"`), 'required element id missing');
}
const requiredHandlers = ['afHomeHeroSubmit', 'afOpenTopup', 'openAccountSheet', 'afNavTab', 'afCycleDensity', 'toggleFilterPanel'];
for (const fn of requiredHandlers) {
  check(`handler wired: ${fn}`, html.includes(`${fn}(`), 'required handler reference missing');
}

if (failures) {
  console.error(`\npanel-responsive contract FAILED (${failures} failure${failures > 1 ? 's' : ''})`);
  process.exit(1);
}
console.log('\npanel-responsive contract OK');
