#!/usr/bin/env node
/**
 * AE CEP paneli → Premiere UXP paneli: 1:1 mexanik transform.
 *
 * Manba `plugins/after-effects-cep/` — 18k qator HTML, 3.8k qator inline CSS,
 * 3 ta tashqi CSS, 285 inline `<svg>`, 153 inline hodisa atributi.
 * Qo'lda ko'chirish = qayta yozish; shuning uchun ko'chirish SKRIPT bilan
 * bajariladi va AE manbasi o'zgarganda qayta ishga tushiriladi.
 *
 * Nima o'zgartiriladi va NEGA (hammasi jonli o'lchovga asoslangan —
 * `docs/PREMIERE-UXP-SPIKE-NATIJA.md` §3, §9, §10, §11):
 *
 *   CSS
 *     display:grid            → flex (UXP'da grid layout QILMAYDI: bolalar 0,0 da qoladi)
 *     grid-template-columns   → bolalarga `flex` (auto-fill/repeat/fr tahlil qilinadi)
 *     place-items:center      → align-items + justify-content
 *     grid-column:1/-1        → flex-basis:100%
 *     gap                     → bolalarga margin (UXP `gap` ni butunlay e'tiborsiz qoldiradi)
 *     animation + opacity:0   → opacity:1 (UXP animatsiya qilmaydi → element abadiy ko'rinmas qolardi)
 *     backdrop-filter         → olib tashlanadi (qo'llanmaydi; o'rniga qattiq fon)
 *
 *   HTML
 *     <button>                → <div role="button" tabindex="0"> (UXP native widget: bg/color chizmaydi)
 *     inline on*=""           → SAQLANADI; `ae-inline-events.js` delegatsiya bilan bajaradi
 *                               (UXP atributni o'qiydi, lekin o'zi CHAQIRMAYDI)
 *
 * Chiqish: `plugins/premiere-uxp/panel.html` (kirish nuqtasi, plagin ILDIZIDA —
 * UXP nisbiy yo'lni ildizdan yechadi) + `plugins/premiere-uxp/ported/`.
 * Ikkalasi ham GENERATSIYA — qo'lda TAHRIRLAMA.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UXP = path.resolve(HERE, "..");
const AE = path.resolve(UXP, "..", "after-effects-cep");
const OUT = path.join(UXP, "ported");
const UXP_VERSION = JSON.parse(fs.readFileSync(path.join(UXP, "manifest.json"), "utf8")).version;

const stats = {
  gridRules: 0, gapRules: 0, gapOverrides: 0, gapSums: 0, gridColumn: 0, animOpacity: 0, backdrop: 0,
  buttons: 0, buttonSel: 0, disabledSel: 0, selWeak: 0, rowLeakWeak: 0, pseudoGap: 0, gapSpec: 0, gapSideSwap: 0, gapStale: 0, inlineHandlers: 0, cssRules: 0, emitted: 0,
  jsRequire: 0, jsButtons: 0, jsQuery: 0, copy: 0,
  shorthand: 0, svgAttrs: 0, styleBg: 0,
};

/* ══════════════════════════════════════════════════════════════════════════
   CSS — qoida bo'yicha yuruvchi yengil parser
   Butun grammatikani tahlil qilmaydi: bizga faqat `selector { decls }` juftligi
   va at-rule ichiga kirish kerak. Qo'shtirnoq, izoh va `url()` hisobga olinadi.
   ══════════════════════════════════════════════════════════════════════════ */

/** CSS matnini `{type:'rule'|'at'|'raw', …}` tugunlariga ajratadi (rekursiv). */
function parseCss(src) {
  const nodes = [];
  let i = 0, buf = "";

  const flushRaw = () => { if (buf.trim()) nodes.push({ type: "raw", text: buf }); buf = ""; };

  while (i < src.length) {
    const c = src[i];

    // Izoh — o'zgarishsiz o'tadi.
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      buf += src.slice(i, stop); i = stop; continue;
    }
    // Satr — ichida `{`/`}` bo'lishi mumkin.
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      buf += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === "{") {
      const prelude = buf; buf = "";
      // Mos yopuvchi qavsni topamiz.
      let depth = 1, j = i + 1;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === "/" && src[j + 1] === "*") { const e = src.indexOf("*/", j + 2); j = e === -1 ? src.length : e + 2; continue; }
        if (d === '"' || d === "'") { const q = d; j++; while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; } j++; continue; }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        j++;
      }
      const inner = src.slice(i + 1, j - 1);
      // Qoidadan OLDINGI izoh prelyudiyaga yopishib keladi. Oddiy selektorda bu
      // zararsiz (CSS izohni istalgan joyda tashlab yuboradi), ammo at-qoidada
      // halokatli: `/*…*/\n@media (…) and (…)` endi `@` bilan boshlanmaydi va
      // butun blok ODDIY QOIDA deb o'qiladi — ichidagi qoidalar deklaratsiyaga
      // aylanadi, transform ishlamaydi (o'lchovda: `.pd3-simrow` gridi flexga
      // o'girilmagan, "Similar" kartalari 588px kengaygan). Shuning uchun izohni
      // prelyudiyadan AJRATAMIZ va alohida chiqaramiz.
      let head = "", rest = prelude, cm;
      while ((cm = /^\s*\/\*[\s\S]*?\*\//.exec(rest))) { head += cm[0]; rest = rest.slice(cm[0].length); }
      if (head) nodes.push({ type: "raw", text: head });
      const sel = rest.trim();
      if (sel.startsWith("@")) {
        // At-rule: `@media`/`@supports` ichida qoidalar bor; `@font-face`/`@keyframes` — deklaratsiya.
        const nested = /^@(media|supports|layer|container)\b/i.test(sel);
        nodes.push({ type: "at", prelude: sel, children: nested ? parseCss(inner) : null, raw: nested ? null : inner, lead: prelude.slice(0, prelude.length - prelude.trimStart().length) });
      } else {
        nodes.push({ type: "rule", selector: sel, decls: inner, lead: prelude.slice(0, prelude.length - prelude.trimStart().length) });
      }
      i = j; continue;
    }
    buf += c; i++;
  }
  flushRaw();
  return nodes;
}

/** Deklaratsiya satrini `[{prop, value, raw}]` ga ajratadi (izohlar `raw` sifatida). */
function parseDecls(text) {
  const out = [];
  let i = 0, buf = "";
  const push = () => {
    const t = buf.trim();
    buf = "";
    if (!t) return;
    const k = t.indexOf(":");
    if (k === -1) { out.push({ raw: t }); return; }
    out.push({ prop: t.slice(0, k).trim().toLowerCase(), value: t.slice(k + 1).trim() });
  };
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); const s = e === -1 ? text.length : e + 2; buf += text.slice(i, s); i = s; continue; }
    if (c === '"' || c === "'") { const q = c; let j = i + 1; while (j < text.length && text[j] !== q) { if (text[j] === "\\") j++; j++; } buf += text.slice(i, j + 1); i = j + 1; continue; }
    if (c === "(") { let d = 1, j = i + 1; while (j < text.length && d > 0) { if (text[j] === "(") d++; else if (text[j] === ")") d--; j++; } buf += text.slice(i, j); i = j; continue; }
    if (c === ";") { push(); i++; continue; }
    buf += c; i++;
  }
  push();
  return out;
}

const declText = (decls) =>
  decls.map((d) => (d.raw !== undefined ? d.raw : `${d.prop}:${d.value}`)).join(";");

/** CSS uzunligini pikselga aylantiradi (faqat px/oddiy son; boshqasi = null). */
function px(v) {
  if (v == null) return null;
  const m = String(v).trim().match(/^(-?\d*\.?\d+)(px)?$/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * `grid-template-columns` ni bolalar uchun `flex` qoidasiga aylantiradi.
 * Qaytadi: `{childFlex}` yoki `{perChild:[flex,…]}` yoki null (tahlil qilib bo'lmadi).
 */
function columnsToFlex(value, colGap) {
  const v = value.trim();
  if (!v || v === "none") return null;
  const g = colGap || 0;

  // repeat(auto-fill|auto-fit, minmax(Xpx, 1fr)) → o'raladigan, kamida X px karta
  let m = v.match(/^repeat\(\s*auto-(?:fill|fit)\s*,\s*minmax\(\s*([\d.]+)px\s*,\s*1fr\s*\)\s*\)$/i);
  if (m) return { childFlex: `1 0 ${m[1]}px`, minWidth: `${m[1]}px`, wrap: true, autoFill: true };

  // repeat(N, 1fr) → N ta teng ustun
  m = v.match(/^repeat\(\s*(\d+)\s*,\s*1fr\s*\)$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const basis = g ? `calc((100% - ${(n - 1) * g}px) / ${n})` : `calc(100% / ${n})`;
    return { childFlex: `0 0 ${basis}`, wrap: true, n };
  }

  // Aniq ustunlar ro'yxati: `1fr 1fr`, `minmax(0,7fr) minmax(320px,5fr)`, `220px 1fr`
  const parts = splitTop(v);
  if (!parts.length) return null;
  const per = [];
  // `fr` ulushi va qat'iy (px + gap) qismi — shim aniq piksel enini shundan
  // hisoblaydi. Batafsil izoh: `trackCls` ta'rifida.
  const vars = [];
  let sumFr = 0, fixed = 0;
  for (const p of parts) {
    // `minmax(min, Nfr)` da `min` — POL, boshlang'ich o'lcham EMAS. Uni
    // `flex-basis` ga qo'ysak ustun aynan o'shancha kengayadi va fr taqsimoti
    // buziladi (o'lchovda: `minmax(320px,5fr)` → `.pd3-body` 554px, AE'da 375px;
    // `.pd3-hero` esa 179px tor). To'g'ri joyi — `min-width`.
    let mm = p.match(/^minmax\(\s*([^,]+)\s*,\s*([\d.]+)fr\s*\)$/i);
    if (mm) {
      const min = px(mm[1]) ?? 0;
      const fr = parseFloat(mm[2]);
      sumFr += fr;
      per.push(`${mm[2]} 1 0`); vars.push({ fr, min });
      continue;
    }
    mm = p.match(/^minmax\(\s*([\d.]+px)\s*,\s*([\d.]+px)\s*\)$/i);
    if (mm) { per.push(`0 1 ${mm[1]}`); vars.push(null); fixed += px(mm[1]) || 0; continue; }
    mm = p.match(/^([\d.]+)fr$/i);
    if (mm) { const fr = parseFloat(mm[1]); sumFr += fr; per.push(`${mm[1]} 1 0`); vars.push({ fr, min: 0 }); continue; }
    mm = p.match(/^([\d.]+px)$/i);
    if (mm) { per.push(`0 0 ${mm[1]}`); vars.push(null); fixed += px(mm[1]) || 0; continue; }
    // `auto`/`max-content` o'lchami tarkibga bog'liq — qat'iy qismga qo'shib
    // bo'lmaydi, shu sabab bunday ro'yxatda shim ishlatilmaydi.
    if (/^(auto|max-content|min-content|fit-content.*)$/i.test(p)) { per.push("0 0 auto"); vars.push(undefined); continue; }
    return null; // tahlil qilib bo'lmadi — qoidani tegmasdan qoldiramiz
  }
  // Bir xil ustunlar (`1fr 1fr`) — nth-child shart emas.
  if (per.every((x) => x === per[0])) {
    const n = per.length;
    if (/^1 1 0$/.test(per[0])) {
      const basis = g ? `calc((100% - ${(n - 1) * g}px) / ${n})` : `calc(100% / ${n})`;
      return { childFlex: `0 0 ${basis}`, wrap: true, n };
    }
    return { childFlex: per[0], wrap: true };
  }
  // Shim bolaning MUALLIF margin'ini ayirishi kerak, ish vaqtida esa muallif
  // margin'i bilan gap'dan chiqqan margin ajratib bo'lmaydi (ikkalasi bitta
  // `margin-right`). Shu sabab ustun bo'shlig'i bor konteynerni umuman
  // ro'yxatga olmaymiz — u eski `flex-grow` xatti-harakatida qoladi (gap
  // margin'i bo'sh joyni to'g'ri egallaydi, muallif margin'i bo'lsa xato
  // qoladi, ammo hech bo'lmasa ikki marta ayirilmaydi).
  // `auto` ustun bo'lsa qat'iy qism noma'lum → shim'siz, faqat `flex-grow`.
  const measurable = sumFr > 0 && !g && vars.every((x) => x !== undefined);
  return {
    perChild: per,
    wrap: false,
    perMin: vars.map((x) => (x && x.min ? x.min : 0)),
    perFr: measurable ? vars.map((x) => (x ? x.fr / sumFr : 0)) : null,
    trackFixed: fixed + (per.length - 1) * g,
  };
}

/** Yuqori darajadagi bo'shliq bo'yicha ajratadi (qavs ichidagi bo'shliqni saqlaydi). */
function splitTop(v) {
  const out = []; let d = 0, cur = "";
  for (const ch of v) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (/\s/.test(ch) && d === 0) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** Qavsdan TASHQARIDAGI vergullar soni (`rgba(1,2,3,.4)` → 0). */
function topCommas(v) {
  let d = 0, n = 0;
  for (const ch of v) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    else if (ch === "," && d === 0) n++;
  }
  return n;
}

/**
 * `background` / `border` / `inset` QISQARTMASINI longhand'ga yoyadi.
 *
 * SABAB: UXP CSS dvigateli bu qisqartmalarni tushunmay TASHLAB YUBORADI,
 * faqat longhand'ni qabul qiladi. Jonli o'lchovda ko'rindi: login maydonlarida
 * (`.lg-input` `background:rgba(255,255,255,.05)`, `.lg-passinput`
 * `background:none;border:0`) muallif foni umuman qo'llanmadi va UXP `<input>`
 * o'zining native chizmasini ko'rsatib qoldi.
 *
 * Longhand'ning HISOBLANGAN qiymati aynan bir xil, shu sabab brauzerdagi 1:1
 * QA etaloni va geometriya imzosi o'zgarmaydi.
 *
 * Bir joyda yozilgan: qoida deklaratsiyalari HAM, inline `style="…"` /
 * `cssText='…'` HAM shu funksiyadan o'tadi.
 *
 * @returns {Array<[string,string]>|null} `null` = tegilmaydi.
 */
function expandShorthand(prop, v) {
  if (prop === "background") {
    // Ko'p qatlamli/rasmli qisqartmaga TEGMAYMIZ — UXP'da `url()`/gradient
    // baribir yo'q, uni port'ning boshqa bosqichi hal qiladi.
    // Vergul TEPA darajada bo'lsa — ko'p qatlamli qisqartma. `rgba(1,2,3,.4)`
    // ichidagi vergul hisobga olinmasligi SHART (`.lg-input` aynan shunday).
    if (/url\(|gradient\(/i.test(v) || topCommas(v)) return null;
    if (!/^(none|transparent|currentcolor|#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|var\([^)]*\)|[a-zA-Z]+)$/.test(v)) return null;
    return [["background-color", /^none$/i.test(v) ? "transparent" : v]];
  }

  if (prop === "border") {
    if (/^(0|0px|none)$/i.test(v)) return [["border-width", "0"], ["border-style", "none"]];
    // `1px solid X`. `splitTop` qavs ichini butun qoldiradi, ya'ni
    // `rgba(255,255,255,.07)` bo'linib ketmaydi.
    const parts = splitTop(v);
    if (parts.length !== 3) return null;
    const styleIdx = parts.findIndex((p) => /^(solid|dashed|dotted|double|none|hidden)$/i.test(p));
    const widthIdx = parts.findIndex((p) => /^(0|[\d.]+px|thin|medium|thick)$/i.test(p));
    if (styleIdx === -1 || widthIdx === -1) return null;
    const colorIdx = [0, 1, 2].find((n) => n !== styleIdx && n !== widthIdx);
    return [
      ["border-width", parts[widthIdx]],
      ["border-style", parts[styleIdx]],
      ["border-color", parts[colorIdx]],
    ];
  }

  // `inset` — UXP uni butunlay tashlaydi (jonli o'lchov: `position:absolute;
  // inset:0` → hisoblangan `top` = `auto`, nazorat `top:0` esa `0px`). AE'da
  // 48 ta qoida `inset:0` bilan qoplama yasaydi (`.account-sheet` fon pardasi,
  // `.ff-lock`, `.ff-backdrop`, karta media/scrim…) — hammasi joyidan chiqib
  // ketardi. `margin` bilan bir xil 1–4 qiymatli sintaksis.
  if (prop === "inset") {
    const p = splitTop(v);
    if (!p.length || p.length > 4) return null;
    // Faqat oddiy uzunlik/`auto`/`%` — `var()`/`calc()` da tomonlarni ajratib
    // bo'lmaydi (qavs ichida probel bor), noaniqlikda TEGMAYMIZ.
    if (!p.every((x) => /^(auto|-?[\d.]+(px|%|em|rem|vh|vw)?)$/i.test(x))) return null;
    const [t, r = t, b = t, l = r] = p;
    return [["top", t], ["right", r], ["bottom", b], ["left", l]];
  }

  return null;
}

/**
 * Inline deklaratsiya ro'yxati (`style="…"` atributi yoki `cssText='…'`).
 * CSS o'tishi style ATRIBUTIGA tegmaydi — qisqartma u yerda ham tashlanadi.
 * O'lchovda: device-code kartasi (`border:1px solid var(--accent)` +
 * `background:var(--accent-soft)`) Premiere'da butunlay ramkasiz/fonsiz chiqdi.
 */
function expandInlineDeclList(text) {
  if (!/(^|;|\s)(background|border|inset)\s*:/i.test(text)) return text;
  // `;` bo'yicha QAVS DARAJASINI hisobga olib ajratamiz (`url(data:…;base64,…)`).
  const parts = []; let d = 0, cur = "";
  for (const ch of text) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
    if (ch === ";" && d === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);

  let changed = false;
  const out = parts.map((raw) => {
    const i = raw.indexOf(":");
    if (i === -1) return raw;
    const prop = raw.slice(0, i).trim().toLowerCase();
    if (prop !== "background" && prop !== "border" && prop !== "inset") return raw;
    const val = raw.slice(i + 1).trim();

    // Dinamik qiymat (`background:${c}`, `background:'+col+'`) — nima kelishini
    // port vaqtida bilmaymiz, lekin qisqartma UXP'da BARIBIR tashlanadi.
    // Gradient bo'lsa tegmaymiz (UXP uni chizmaydi — yolg'on va'da bermaylik).
    if (prop === "background" && /\$\{|'\s*\+|\+\s*'/.test(val) && !/gradient\s*\(|url\(/i.test(val)) {
      changed = true;
      stats.shorthand++;
      return `background-color:${val}`;
    }

    const pairs = expandShorthand(prop, val);
    if (!pairs) return raw;
    changed = true;
    stats.shorthand++;
    return pairs.map(([p, v]) => `${p}:${v}`).join(";");
  });
  return changed ? out.join(";") : text;
}

/**
 * Matn ichidagi HAR QANDAY inline uslubni qisqartmadan tozalaydi:
 *   `style="…"` / `style='…'`  — markup va JS shablonlari,
 *   `cssText='…'`              — JS'da dinamik yasalgan elementlar,
 *   `.style.background=`       — DOM xossasi (UXP faqat `backgroundColor` ni biladi).
 *
 * Oxirgisi gradient/funksiya qiymatiga TEGMAYDI: `hero.style.background=pd3Grad(x)`
 * va `'linear-gradient(…)'` — UXP'da baribir chizilmaydi, `backgroundColor` ga
 * o'girish esa yolg'on "ishladi" degan taassurot berardi.
 */
function expandInlineStyles(text) {
  // DIQQAT: qiymat ichida IKKINCHI turdagi tirnoq bo'lishi mumkin
  // (`style="background:'+col+'"` — JS konkatenatsiyasi, `${escHtml(a.bg||'')}`),
  // shu sabab har bir chegara uchun alohida naqsh — «ikkalasidan boshqa» EMAS.
  let out = text
    .replace(/(\sstyle\s*=\s*)"([^"]*)"/gi, (_m, pre, body) => `${pre}"${expandInlineDeclList(body)}"`)
    .replace(/(\sstyle\s*=\s*)'([^']*)'/gi, (_m, pre, body) => `${pre}'${expandInlineDeclList(body)}'`);

  out = out
    .replace(/(cssText\s*=\s*)'([^']*)'/g, (_m, pre, body) => `${pre}'${expandInlineDeclList(body)}'`)
    .replace(/(cssText\s*=\s*)"([^"]*)"/g, (_m, pre, body) => `${pre}"${expandInlineDeclList(body)}"`);

  out = out.replace(/\.style\.background\s*=\s*([^;\n]*)/g, (m, rhs) => {
    // `var(` chaqiruv sifatida hisoblanmasin — u yagona ruxsat etilgan funksiya.
    const probe = rhs.replace(/\bvar\s*\(/g, "(");
    if (/gradient\s*\(/i.test(rhs) || /[A-Za-z_$][\w$]*\s*\(/.test(probe)) return m;
    stats.styleBg++;
    return m.replace(".style.background", ".style.backgroundColor");
  });

  return out;
}

/**
 * Xarita kaliti uchun selektorni normallashtiradi.
 * CSS parseri qoida oldidagi izohni selektor matniga qo'shib beradi
 * (`/* … *\/\n.axroot .cats`), shu sabab xom matn kalit sifatida yaroqsiz —
 * keyingi qoida uni topa olmaydi va gap/ustun holati yo'qoladi.
 */
function selKey(sel) {
  return sel.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").trim();
}

/** Selektorni bolalar qoidasi uchun kengaytiradi: `.a, .b` → `.a > *, .b > *`. */
function childSel(sel, extra = "> *") {
  // `selKey` SHART: xom selektor oldidagi izoh ham shu matnda keladi va
  // vergul bo'yicha bo'lganda suffiks izoh ICHIGA tushib qolardi.
  return selKey(sel).split(",").map((s) => `${s.trim()} ${extra}`).join(",");
}

/**
 * Gap'dan chiqqan margin qoidasining ustunligini BIR klassga oshiradi
 * (`.axws-genwrap > *:…` → `.axws-genwrap.axws-genwrap > *:…`).
 *
 * Nega: haqiqiy `gap` ni margin bilan BEKOR QILIB bo'lmaydi — u alohida
 * xossa. Portda esa u oddiy `margin` ga aylanadi va keyingi TENG ustunlikdagi
 * qoida uni yuvib yuboradi. AE'da aynan shunday joy bor:
 *
 *     .axws-genwrap{gap:9px}          (3622)
 *     .axws .gensend{…;margin:0;…}    (3629)  ← qisqartma margin gap'ni o'chirardi
 *
 * (o'lchovda: `#igGen` chapida 9px yo'q, `.axws-setgroup` esa o'sha 9px+ ni
 * o'ziga olib +58px keng chiqqandi.) Bir klass qo'shish gap'ni teng ustunlikdagi
 * qoidalardan ustun qiladi, lekin MAQSADLI (yuqoriroq ustunlikdagi) bekor
 * qilishlarni saqlab qoladi — masalan `.axws-genwrap .ai-set.enhance{margin-left:0}`
 * hamon g'olib, chunki uning ustunligi bir pog'ona yuqori.
 */
function bumpGapSel(sel) {
  return selKey(sel).split(",").map((one) => {
    const t = one.trim();
    const i = t.lastIndexOf(" > ");
    if (i < 0) return t;
    const cont = t.slice(0, i);
    const cls = classesOf(splitCompound(cont).last);
    if (!cls.length) return t;
    stats.gapSpec++;
    return cont + cls[cls.length - 1] + t.slice(i);
  }).join(",");
}

/**
 * Konteyner selektori → bolalarga berilgan `flex` qiymati (manba tartibida).
 *
 * Nima uchun: `grid-column:1/-1` → `flex:0 0 100%` bo'ladi, lekin AE'da bu
 * ba'zan keyingi media-so'rovda `grid-column:auto` bilan BEKOR qilinadi
 * (masalan AI launcher: 2 ustunda oxirgi yolg'iz karta butun qatorni oladi,
 * `cep-mode`'da 3 ustun bo'lgani uchun olmasligi kerak). Flexda "bekor qilish"
 * degan qiymat yo'q — konteyner bolasiga berilgan flexni QAYTA yozish kerak.
 * Selektor prefiksi bo'yicha eng uzun moslikni topamiz.
 */
const containerChildFlex = new Map();

/**
 * Konteyner selektori → e'lon qilingan ustunlararo `gap` (manba tartibida).
 * Kerak, chunki AE'da `gap` bir qoidada, `grid-template-columns` esa boshqasida
 * (media-so'rovda) turadi; gapsiz hisoblangan `100%/3` bola qatorga sig'maydi.
 * Evristika: oxirgi e'lon g'olib (manba tartibi) — bir klass ikki xil gap bilan
 * ishlatilsa taxminiy, lekin gapni butunlay e'tiborsiz qoldirishdan aniqroq.
 */
const containerGap = new Map();
const containerRowGap = new Map();
/**
 * Konteyner selektori → `{media → ustunlar soni}` (aniq N bo'lsa).
 *
 * MEDIA KONTEKSTI bilan saqlanadi, chunki bitta konteyner turli enlarda turli
 * ustun soniga ega bo'ladi: `.fhome-cattiles{grid-template-columns:repeat(2,1fr)}`
 * va `@media (min-width:560px){…repeat(3,1fr)}`. Keyinroq faqat `gap` ni qayta
 * belgilaydigan zichlik qoidasi ustun bazasini QAYTA hisoblashi kerak — agar
 * u kontekstsiz "oxirgi e'lon" ni olsa, media-so'rovdagi 3 ustunni SHARTSIZ
 * qilib qo'yadi va tor panelda ham 3 ustun chiqadi (o'lchovda: 440px'da AE 2
 * ustun × 204px, port 3 ustun × 133px — Home'da 27 farq, 5 ekranga tarqagan).
 */
const containerColsCtx = new Map();

/**
 * Shu media kontekstida kuchda bo'lgan ustunlar soni.
 * Avval AYNAN shu kontekstdagi e'lon, bo'lmasa asosiy (mediasiz) e'lon.
 */
function lookupCols(sel, media) {
  const first = selKey(sel).split(",")[0].trim();
  let best = null, bestLen = -1;
  for (const [cont, byMedia] of containerColsCtx) {
    for (const c of cont.split(",")) {
      const t = c.trim();
      if (!(first === t || first.endsWith(" " + t)) || t.length < bestLen) continue;
      const v = byMedia.has(media) ? byMedia.get(media) : byMedia.get("");
      if (v == null) continue;
      best = v; bestLen = t.length;
    }
  }
  return best;
}

/** Shu selektor uchun BOSHQA media kontekstlaridagi ustun sonlari: `[[media, N], …]`. */
function colsOtherMedia(sel, media) {
  const first = selKey(sel).split(",")[0].trim();
  let hit = null, bestLen = -1;
  for (const [cont, byMedia] of containerColsCtx) {
    for (const c of cont.split(",")) {
      const t = c.trim();
      if ((first === t || first.endsWith(" " + t)) && t.length >= bestLen) { hit = byMedia; bestLen = t.length; }
    }
  }
  if (!hit) return [];
  return [...hit].filter(([m]) => m && m !== media);
}
/** Konteyner selektori → o'raladimi (`flex-wrap`). Gap qoidasi boshqa blokda
 *  bo'lganda ham o'ralishni bilishimiz kerak: o'raladigan konteynerda `* + *`
 *  naqshi yangi qatorning birinchi elementiga noto'g'ri margin beradi. */
const containerWrap = new Map();
/** Konteyner selektori → `flex-direction`. Wrap kabi: AE'da yo'nalish bir
 *  qoidada (`.card{display:flex;flex-direction:column;gap:6px}`), keyingi
 *  zichlik qoidasida esa faqat `gap:5px` qayta belgilanadi. Yo'nalishni
 *  bilmasak, ustunli konteynerga qator margin'i tushadi (o'lchovda:
 *  `.ck-title` chapdan +5px, eni −5px va gap 6px'da qolib ketgan). */
const containerDir = new Map();
/**
 * Konteyner selektori → gap o'rniga qaysi margin xossalari chiqarilgani.
 * Kerak, chunki AE'da konteyner `display`i keyingi (aniqroq) qoidada
 * `block` ga o'zgarishi mumkin — `.env-filter-bar{display:flex;gap:8px}` va
 * `.env-filter-bar.cmp-wrap{display:block}`. Haqiqiy CSS'da blokda `gap`
 * hech nima qilmaydi, bizning margin'imiz esa qolib ketadi (o'lchovda:
 * `#afTabs` chapdan +8px). Shu sabab display bloklashtirilganda AYNAN shu
 * xossalarni nolga qaytaramiz.
 */
const containerGapProps = new Map();

/**
 * Konteyner selektori → `{gap, mode}`: gap o'rniga QAYSI naqsh ishlatilgani.
 *
 * Psevdo-element (`::before`/`::after`) ham flex bolasi bo'ladi, LEKIN
 * `nth-child` uni sanamaydi — shu sabab bizning `> *:nth-child(n+2)` qoidamiz
 * unga tegmaydi va AE'dagi bo'shliq yo'qoladi (o'lchovda: `.fsheet-catchip.on`
 * chipi 50px o'rniga 45px — nuqta bilan matn orasidagi 5px tushib qolgan).
 * `mode`: `row-left` — `nth-child(n+2){margin-left}`; `row-right` — hamma
 * bolaga `margin-right`; `col-top` — `nth-child(n+2){margin-top}`.
 */
const containerSelfGap = new Map();

/**
 * Konteyner selektori → o'sha konteyner uchun OXIRGI marta chiqarilgan gap
 * margin xossalari (`margin-left`, `margin-right`, …).
 *
 * Bitta konteynerning gap naqshi qoidadan qoidaga o'zgarishi mumkin: asosiy
 * qoida `display:flex;gap:9px` (o'ralmaydi → `nth-child(n+2){margin-left:9px}`),
 * media-so'rovdagisi esa `flex-wrap:wrap;gap:16px 14px` (o'raladi → hamma
 * bolaga `margin-right:14px`). Yangi naqsh eskisining TOMONINI tozalamaydi va
 * ikkalasi qo'shilib ketadi (o'lchovda: `.pd3-simrow` kartalari orasi 14+9=23px,
 * uchinchi karta qatorga sig'may pastga tushgan — AE'da uchalasi bitta qatorda).
 */
const containerGapSides = new Map();

/**
 * `.a.b::before` uchun `.a` konteynerining gap naqshini topadi.
 * `gapPropsForOverride` bilan bir xil moslash: prefiks bir xil, konteyner
 * klasslari psevdo egasining klasslari ichida bo'lishi kerak.
 * Cheklov: konteyner qoidasi manbada OLDIN kelishi shart (AE CSS'ida shunday).
 */
function selfGapFor(sel) {
  const first = selKey(sel).split(",")[0].trim();
  const mine = splitCompound(first);
  const myCls = classesOf(mine.last);
  let best = null, bestLen = 0;
  for (const [cont, info] of containerSelfGap) {
    for (const c of cont.split(",")) {
      const g = splitCompound(selKey(c).trim());
      if (g.prefix !== mine.prefix) continue;
      const gCls = classesOf(g.last);
      if (!gCls.length || !gCls.every((x) => myCls.includes(x))) continue;
      if (gCls.length >= bestLen) { best = info; bestLen = gCls.length; }
    }
  }
  return best;
}

/**
 * Gap naqshiga ko'ra psevdo-element QAYSI tomonga margin olishi kerakligi.
 * `row-right` naqshida oxirgi (`::after`) uchun kerak emas — oldingi bolaning
 * `margin-right`i bo'shliqni allaqachon bergan.
 */
function pseudoGapSide(mode, before) {
  return mode === "col-top" ? (before ? "margin-bottom" : "margin-top")
    : mode === "row-right" ? (before ? "margin-right" : null)
    : (before ? "margin-right" : "margin-left");
}

/**
 * Gap kompensatsiyasi berilgan `::before`/`::after` egalari ro'yxati.
 *
 * NEGA KERAK: psevdoning bo'shlig'i uning O'Z qoidasida qattiq yozilgan, chunki
 * `> *:nth-child(n+2)` psevdoga yetib bormaydi. Keyinchalik ZICHLIK (kc1…kc6)
 * yoki media qoidasi o'sha konteynerning gap'ini o'zgartirsa, port `> *`
 * qoidasini QAYTA chiqaradi, psevdodagi qattiq margin esa ESKI qiymatda qoladi.
 * (o'lchov: `#igModelSeg`/`#vgModelSeg` 440px'da +2px — kc6 bolalar gap'ini
 * 6→4 qilgan, `.axws-dock .pillseg::after` esa 6px'da qolgan.)
 *
 * Shu sabab har bir psevdo egasini eslab qolamiz va gap qayta e'lon qilinganda
 * psevdoga ham mos override chiqaramiz.
 */
const pseudoOwners = [];

/** `sel` konteyneri shu psevdo egalaridan qaysilarini o'z ichiga oladi. */
function pseudoOwnersFor(sel) {
  const first = selKey(sel).split(",")[0].trim();
  if (first.includes("::")) return [];
  const myCls = classesOf(splitCompound(first).last);
  if (!myCls.length) return [];
  return pseudoOwners.filter((p) => p.cls.every((c) => myCls.includes(c)));
}

/**
 * Konteynerning gap naqshini qaydlaydi va psevdo bolalariga (agar bo'lsa) mos
 * override chiqaradi. Naqsh TOMONI ham o'zgargan bo'lsa eskisi asl qiymatiga
 * qaytariladi — aks holda ikki tomon qo'shilib ketardi.
 */
function setSelfGap(S, gap, mode, emit) {
  containerSelfGap.set(selKey(S), { gap, mode });
  for (const p of pseudoOwnersFor(S)) {
    const before = p.which === "before";
    const side = pseudoGapSide(mode, before);
    const val = side ? (p.own[side] || 0) + gap : 0;
    if (side === p.side && val === p.applied) continue;      // o'zgarish yo'q
    const d = [];
    if (p.side && p.side !== side) d.push(`${p.side}:${p.own[p.side] || 0}px`);
    if (side) d.push(`${side}:${val}px`);
    if (!d.length) continue;
    emit(`${selKey(S).split(",").map((s) => `${s.trim()}::${p.which}`).join(",")}{${d.join(";")}}`);
    stats.pseudoGap++;
  }
}

/**
 * Konteyner selektori → MUALLIF e'lon qilgan padding (px, 4 tomon).
 *
 * `repeat(auto-fill,…)` gridni flexda takrorlaganda ustunlar sonini oldindan
 * bilib bo'lmaydi, shu sabab qator oxiridagi bolaga margin bermaslikning iloji
 * yo'q. Yechim: HAR bolaga `margin-right`/`margin-top` beramiz va konteyner
 * padding'ini AYNAN shu qiymatga kamaytiramiz — natijada tarkib qutisi
 * `gap` ga kengayadi, birinchi qator joyida qoladi va konteyner balandligi
 * AE'dagidek bo'ladi (o'lchovda: karta eni 165→167, `#grid` balandligi −16px).
 */
const containerPad = new Map();

/** `padding` qisqartmasini 4 tomonga yoyadi (faqat px/0; aks holda null). */
function padSides(decls) {
  const find = (p) => { const d = decls.find((x) => x.prop === p); return d ? d.value : null; };
  const sh = find("padding");
  let out = null;
  if (sh) {
    const parts = splitTop(sh).map(px);
    if (parts.every((v) => v != null) && parts.length >= 1 && parts.length <= 4) {
      const [a, b = a, c = a, d = b] = parts;
      out = { top: a, right: b, bottom: c, left: d };
    }
  }
  for (const side of ["top", "right", "bottom", "left"]) {
    const v = px(find(`padding-${side}`));
    if (v != null) { out = out || { top: null, right: null, bottom: null, left: null }; out[side] = v; }
  }
  return out;
}

/** Selektorning oxirgi kompaundi va undan oldingi qismi. */
function splitCompound(sel) {
  const parts = sel.split(/(\s*[>+~]\s*|\s+)/).filter((p) => p.trim());
  const last = parts.pop() || "";
  return { prefix: parts.join(" ").replace(/\s+/g, " ").trim(), last };
}
const classesOf = (c) => (c.match(/\.[A-Za-z0-9_-]+/g) || []);

/**
 * Selektor spetsifikligini bitta klassga oshiradi (`.a .b` → `.a .b.b`).
 * Element AYNAN o'sha bo'lib qoladi, faqat kaskaddagi og'irligi ortadi.
 * Oxirgi qism klasssiz bo'lsa (`*`, `div`) yoki psevdo-elementga tegishli
 * bo'lsa — tegilmaydi (sanaladi, `stats.selWeak`).
 */
function bumpSel(sel) {
  return selKey(sel)
    .split(",")
    .map((one) => {
      const t = one.trim();
      const cls = classesOf(splitCompound(t).last);
      if (!cls.length || t.includes("::")) { stats.selWeak++; return t; }
      return t + cls[cls.length - 1];
    })
    .join(",");
}

/**
 * Shu selektor avval gap→margin olgan konteynerni "aniqlashtiradimi"?
 * (`.a` ⊂ `.a.b`, ajdod qismi bir xil bo'lishi shart). Agar ha — o'sha
 * konteyner uchun chiqarilgan margin xossalari qaytariladi.
 */
function gapPropsForOverride(sel) {
  const first = selKey(sel).split(",")[0].trim();
  const mine = splitCompound(first);
  const myCls = classesOf(mine.last);
  for (const [cont, props] of containerGapProps) {
    for (const c of cont.split(",")) {
      const g = splitCompound(selKey(c).trim());
      if (g.prefix !== mine.prefix) continue;
      const gCls = classesOf(g.last);
      if (!gCls.length) continue;
      if (gCls.every((x) => myCls.includes(x))) return props;
    }
  }
  return null;
}

/* ── muallif margin'i × gap to'qnashuvi ────────────────────────────────────
   Haqiqiy CSS'da `gap` va bolaning `margin`i QO'SHILADI (`.card{gap:5px}` +
   `.ck-sub{margin-top:-3px}` → 2px). Bizda gap ham margin bo'lgani uchun ular
   bitta xossada to'qnashadi va spetsifikligi yuqori bo'lgan bizning qoidamiz
   muallif nudge'ini yutib yuboradi (o'lchovda: `.ck-sub` 3px pastda).

   Yechim: yig'indini oldindan hisoblab, `KONTEYNER > MUALLIF_SELEKTORI`
   qoidasini chiqaramiz. Qaysi muallif qoidasi qaysi konteyner ichida ekanini
   HTML'dan bilib bo'lmaydi (kartalar JS shablonida yasaladi) — shu sabab
   uni CSS'ning O'ZIDAN chiqaramiz: `.card .ck-sub{…}` kabi har qanday avlod
   selektori "`.ck-sub` `.card` ichida uchraydi" degan dalil.                */

/**
 * Gap'i margin'ga o'girilgan konteynerlarning klass nomlari.
 *
 * CSS bola selektori FAQAT elementga tegadi — `<i>Ae</i>After Effects` kabi
 * markupda matn anonim flex element bo'lib qoladi va undan oldingi bo'shliq
 * yo'qoladi (o'lchovda: `.ck-app` AE'dan 4px tor). Runtime shim
 * (`js/ae-shim/gap-text.js`) shu ro'yxatdagi konteynerlarda yalang'och matnni
 * `<span>` ga o'raydi — shundan keyin gap qoidasi unga ham tegadi.
 */
const gapTextCls = new Set();

/**
 * `border-radius` quti yarmidan katta bo'lgan klasslar (`999px`, `var(--r-full)`…).
 * UXP radiusni spetsifikatsiya talab qilganidek KLAMPLAMAYDI — natijada pill
 * tugma "linza" bo'lib qo'shni elementlarga chiqib ketadi. To'g'ri qiymat
 * `min(w,h)/2`, ya'ni faqat ish vaqtida ma'lum → `js/ae-shim/pill-radius.js`.
 */
const pillCls = new Set();
const PILL_MIN_PX = 90;   // bundan katta radius hech qanday real qutiga sig'maydi

/**
 * `position:fixed` selektorlari — qoplama (overlay/sheet/modal) NOMZODLARI.
 *
 * `js/ae-shim/uxp-repaint.js` modal yopilgach qora qolgan tanani turtadi, lekin
 * qaysi element qoplama ekanini bilishi kerak. UXP'da `MutationObserver`
 * otilmaydi (spike §2), ya'ni "o'zgargan tugun" yo'li yo'q — davriy tekshiruv
 * qoladi. Butun daraxtni skanerlash qimmat, shuning uchun nomzodlarni CSS'dan
 * oldindan yig'amiz: `fixed` bo'lmagan element hech qachon panelni qoplamaydi.
 */
const fixSel = new Set();

/**
 * Foizli `transform: translate(...)` bilan MARKAZLANGAN qoidalar.
 *
 * UXP `transform`ni o'qib qaytaradi, lekin RENDERDA qo'llashi tasdiqlanmagan
 * (spike §3). Agar qo'llanmasa, `left:50%; transform:translateX(-50%)` idiomasi
 * elementni yarim kenglikka O'NGGA surib qo'yadi — mehmon Home'dagi
 * "A PEEK AT THE CATALOG" ustma-ust tushishi shundan gumon qilinadi.
 *
 * CSS qiymatiga TEGMAYMIZ (brauzerdagi QA etaloni buzilmasin) — ro'yxat
 * yig'amiz, `js/ae-shim/xform-center.js` esa AVVAL jonli zond bilan
 * `transform` haqiqatan ishlaydimi deb o'lchaydi va faqat ISHLAMASA
 * `margin-left/top` bilan kompensatsiya qiladi.
 */
const xfcRules = [];
/**
 * `translate(-50%, -50%)`, `translateX(-50%)`, `translateY(0)` …
 * Birlik IXTIYORIY: `translateY(0)` — bekor qiluvchi holat qoidalarida
 * (`.toast.show`) aynan shunday yoziladi va u ham yig'ilishi SHART.
 */
const XFC_RE = /translate(X|Y)?\(\s*(-?[\d.]+)(%|px)?\s*(?:,\s*(-?[\d.]+)(%|px)?\s*)?\)/i;

/**
 * `min()` / `max()` / `clamp()` ishlatgan o'lcham qoidalari.
 *
 * Jonli o'lchov (panel ichidagi CSS zondi): UXP bu funksiyalarni BUTUNLAY
 * tashlaydi — 200px'lik hostda `width:min(50px,100%)` → 200px, `clamp(20px,
 * 50%,40px)` → 200px. `calc()`, `%`, `vw`, `vh` esa ISHLAYDI. Ya'ni qiymatni
 * ish vaqtida O'ZIMIZ hisoblab, inline qo'yishimiz mumkin.
 *
 * CSS qiymatiga TEGMAYMIZ (brauzerdagi 1:1 QA etaloni buzilmasin) — faqat
 * ro'yxat yig'amiz; `js/ae-shim/uxp-mmc.js` uni FAQAT UXP ichida qo'llaydi.
 * Tegishli qoidalar: toast/dropdown `max-width`, `.account-panel` balandligi,
 * `.ai-menu` `max-width`/`max-height`, progress va popover kengliklari.
 */
const mmcRules = [];
const MMC_PROPS = new Set([
  "width", "min-width", "max-width", "height", "min-height", "max-height",
]);
/** `minmax()` grid funksiyasi emas — faqat mustaqil `min(`/`max(`/`clamp(`. */
const MMC_RE = /(^|[^a-z-])(min|max|clamp)\(/i;

/**
 * Xuddi shu ro'yxat, LEKIN oxirgi kompaundi klasssiz selektorlar uchun
 * (`.axroot .set-ltot span`, `.foo > b` …).
 *
 * Klass nomi bo'lmasa shim konteynerni taniy olmaydi va yalang'och matn
 * o'ralmay qoladi (o'lchovda: `.set-ltot span` ichidagi 2px ustun bo'shlig'i
 * tushib qolgandi — matn "SPENT" va `<b>` orasida). Bunday holatda TO'LIQ
 * selektorni beramiz, shim esa `el.matches()` bilan tekshiradi.
 */
const gapTextSel = new Set();

/**
 * O'raladigan (`flex-wrap:wrap`), ustunlar soni NOMA'LUM konteynerlar — qator
 * bo'shlig'i `margin-bottom` ga o'girilgan va padding bilan qoplab bo'lmagan.
 *
 * Har bolaga `margin-bottom:rowGap` berilgani uchun OXIRGI qatordan keyin ham
 * bo'shliq qoladi va konteyner AE'dagidan aynan `rowGap` ga baland chiqadi
 * (o'lchovda: `.set-ltot` +14px, undan keyingi hamma narsa +12px pastda).
 * Qator chegarasini faqat ish vaqtida bilish mumkin — `js/ae-shim/autofill.js`
 * oxirgi qatordagi bolalarning `margin-bottom`ini nolga tushiradi.
 */
const rowLeakCls = new Set();

/**
 * `repeat(auto-fill, minmax(Xpx,1fr))` gridlarining klass nomlari.
 *
 * Flexda ustunlar soni CSS bilan hisoblanmaydi: `flex:1 0 148px` bolalarni
 * O'STIRADI, grid esa o'stirmaydi — 5 karta sig'adigan joyda 4 karta bo'lsa AE
 * 167px'lik 4 karta chizadi, flex esa 211px'lik 4 karta (o'lchovda: Motion
 * tabida 40 farq, Video tabida esa 0 — u yerda kartalar soni tasodifan ustun
 * soniga teng edi). `js/ae-shim/autofill.js` konteyner enini o'lchab ustun
 * enini o'zi hisoblaydi.
 */
const autoFillCls = new Set();

/**
 * Padding kompensatsiyasi qo'llangan konteynerlar (`padding-right` gap'ga
 * kamaytirilgan, har bolaga `margin-right` berilgan).
 *
 * Bunday konteynerning TARKIB qutisi AE'dagidan aynan `gap` ga keng — oddiy
 * kartalar uchun bu to'g'ri (ortiqcha margin o'sha joyni egallaydi), lekin
 * BUTUN QATOR bolasi (`flex:0 0 100%`) o'sha kengaygan qutidan 100% oladi va
 * AE'dan `gap` ga keng chiqadi (o'lchovda: `.af7-state` +10px, bolalari +5px
 * o'ngda). `js/ae-shim/autofill.js` bunday bolaga `100% − gap` beradi.
 */
const padCompCls = new Set();

/**
 * `auto-fill` konteynerlar, ularda ustun bo'shlig'ini padding bilan QOPLAB
 * BO'LMAGAN (`padding-right < gap`, ko'pincha umuman padding yo'q).
 *
 * Kompensatsiya bo'lganda tarkib qutisi aynan `gap` ga keng bo'ladi va shim
 * sodda hisobdan foydalanadi (`N = ⌊W/(min+gap)⌋`, `colW = W/N − gap`). Bu
 * yerda esa quti AE'nikiga TENG, shu sabab o'sha hisob bir ustunni yo'qotadi
 * va qolganlarini toraytiradi (o'lchovda: `.pd3-simrow` 868px, AE'da 280px'lik
 * 3 karta bitta qatorda, portda 275.33px'lik 2+1 karta ikki qatorda).
 *
 * Bundan tashqari HAR bolada `margin-right:gap` qolgani uchun qator oxiridagi
 * ortiqcha margin keyingi kartani pastga uloqtiradi — shim uni ham nolga
 * tushiradi (qator chegarasi faqat `N` ma'lum bo'lgach hisoblanadi).
 */
const noPadCompCls = new Set();

/**
 * ANIQ `fr` ustunlar ro'yxati bo'lgan konteynerlar (`minmax(0,7fr) minmax(320px,5fr)`).
 *
 * `flex-grow` ulushni to'g'ri taqsimlaydi, LEKIN faqat bolalarning margin'i
 * bo'lmasa: gridda ustun eni bolaning margin'ini ham O'Z ICHIGA oladi, flexda
 * esa margin `flex-basis` dan tashqarida turadi va bo'sh joyni kamaytiradi
 * (o'lchovda: `.pd3-hero{margin-left:16px}` → hero 6.67px keng, `.pd3-body`
 * shuncha tor). Margin CSS'da o'qib bo'lmaydi, shu sabab `--af-fr` (ulush) va
 * `--af-fx` (qat'iy px + gap) bolalarga yoziladi va `js/ae-shim/autofill.js`
 * aniq piksel enini o'zi hisoblaydi. Shim ishlamasa `flex-grow` fallback
 * qoladi — margin'siz konteynerlarda u allaqachon to'g'ri.
 */
const trackCls = new Set();

/** Bola klassi → uni o'z ichiga olishi CSS'da tasdiqlangan ajdod klasslari. */
const descIndex = new Map();
/** Muallifning bola-margin e'lonlari: {sel, side → value}. */
const authorMargins = [];

const MARGIN_SIDES = ["top", "right", "bottom", "left"];

/** Bitta selektordan ajdod↔avlod juftliklarini indeksga qo'shadi. */
function indexSelector(sel) {
  for (const one of selKey(sel).split(",")) {
    // Faqat avlod/bola kombinatorlari ajdodlik beradi; `+`/`~` — qardosh.
    const chunks = one.trim().split(/\s*[+~]\s*/);
    for (const chunk of chunks) {
      const comps = chunk.split(/\s*>\s*|\s+/).filter(Boolean);
      for (let i = 1; i < comps.length; i++) {
        const kids = classesOf(comps[i]);
        if (!kids.length) continue;
        for (let j = 0; j < i; j++) {
          for (const anc of classesOf(comps[j])) {
            for (const k of kids) {
              if (!descIndex.has(k)) descIndex.set(k, new Set());
              descIndex.get(k).add(anc);
            }
          }
        }
      }
    }
  }
}

/** Muallif qoidasidan margin e'lonlarini yig'adi (px qiymat yoki `auto`). */
function indexAuthorMargins(sel, decls) {
  const first = selKey(sel).split(",")[0].trim();
  const last = splitCompound(first).last;
  if (!classesOf(last).length) return;          // klasssiz selektor — juftlab bo'lmaydi
  if (/[>+~]/.test(first)) return;              // allaqachon aniq: aralashtirmaymiz
  const sides = {};
  for (const d of decls) {
    if (!d.prop) continue;
    if (d.prop === "margin") {
      const p = splitTop(d.value);
      if (!p.length || p.length > 4) continue;
      const [a, b = a, c = a, e = b] = p;
      Object.assign(sides, { top: a, right: b, bottom: c, left: e });
    } else if (/^margin-(top|right|bottom|left)$/.test(d.prop)) {
      sides[d.prop.slice(7)] = d.value.trim();
    }
  }
  const keep = {};
  for (const s of MARGIN_SIDES) {
    const v = sides[s];
    if (v == null) continue;
    if (v === "auto" || px(v) != null) keep[s] = v;
  }
  if (Object.keys(keep).length) authorMargins.push({ sel: first, cls: classesOf(last), sides: keep });
}

/**
 * Konteyner C ichida muallif `margin-<side>:auto` e'lon qilgan bola bormi.
 *
 * `auto` — bo'sh joyni yutish idiomasi, gap esa aniq bo'shliq: AE'da ikkalasi
 * BIR VAQTDA ishlaydi (`gap` alohida xossa), portda esa bitta `margin-left`
 * ustida to'qnashadi va biri yo'qoladi (o'lchovda: `.axws-genwrap` chapidagi
 * 7px tushib qolgan → `.axws-setgroup` +7px keng). Chaqiruvchi shu holatda
 * gap'ni QARAMA-QARSHI tomonga o'tkazadi.
 */
function autoMarginChild(contSel, side) {
  const contCls = new Set();
  for (const one of selKey(contSel).split(",")) for (const c of classesOf(splitCompound(one.trim()).last)) contCls.add(c);
  if (!contCls.size) return false;
  for (const am of authorMargins) {
    if (am.sides[side] !== "auto") continue;
    const ancestors = descIndex.get(am.cls[0]);
    if (!ancestors) continue;
    for (const c of contCls) if (c && ancestors.has(c)) return true;
  }
  return false;
}

/**
 * Konteyner C uchun gap chiqarilganda, uning ichidagi muallif margin'lari
 * bilan yig'indi qoidalarini beradi. Spetsifiklik `C > .x` (0,2,0) — gap
 * qoidasi bilan TENG, shu sabab BUNDAN KEYIN chiqarilishi shart.
 */
function gapSumRules(contSel, side, gapPx, nth) {
  const out = [];
  const contCls = new Set();
  for (const one of selKey(contSel).split(",")) for (const c of classesOf(splitCompound(one.trim()).last)) contCls.add(c);
  if (!contCls.size) return out;
  for (const am of authorMargins) {
    const v = am.sides[side];
    if (v == null) continue;
    const ancestors = descIndex.get(am.cls[0]);
    if (!ancestors) continue;
    let inside = false;
    for (const c of contCls) if (c && ancestors.has(c)) { inside = true; break; }
    if (!inside) continue;
    // `auto` — bo'sh joyni yutadi; qo'shib bo'lmaydi, muallif niyati ustun.
    const val = v === "auto" ? "auto" : `${gapPx + px(v)}px`;
    if (val === `${gapPx}px`) continue;         // farqi yo'q — qoida chiqarmaymiz
    out.push(`${childSel(contSel, `> ${am.sel}${nth}`)}{margin-${side}:${val}}`);
  }
  return out;
}

/**
 * Selektor bo'yicha "shu paytgacha kuchda bo'lgan" qiymatni topadi.
 * Xarita manba tartibida to'ldiriladi, shu sabab qidiruv CSS kaskadining
 * shu nuqtadagi holatini beradi (keyingi media-so'rov hali yozilmagan).
 * Moslik: aynan o'zi yoki selektor OXIRI (`html.cep-mode .a .b` ⊃ `.a .b`).
 *
 * Teng uzunlikda KEYINGISI g'olib (`>=`): bir selektor ikki marta e'lon qilinsa
 * kaskadda oxirgisi kuchda bo'ladi. Aks holda `.grid{padding:14px}` (umumiy) va
 * `.grid,html.cep-mode .grid{padding:12px}` (keyingi blok) orasidan birinchisi
 * tanlanardi va `html.dens-md .grid` uchun gap kompensatsiyasi 14 dan hisoblanib
 * padding-top 2px ortiqcha chiqardi (o'lchovda: Motion kartalari +2px pastda).
 */
function lookupBySuffix(map, sel) {
  const first = selKey(sel).split(",")[0].trim();
  let best = null, bestLen = 0;
  for (const [cont, v] of map) {
    for (const c of cont.split(",")) {
      const t = c.trim();
      if ((first === t || first.endsWith(" " + t)) && t.length >= bestLen) { best = v; bestLen = t.length; }
    }
  }
  return best;
}

const lookupGap = (sel) => lookupBySuffix(containerGap, sel);

function lookupChildFlex(sel) {
  const first = selKey(sel).split(",")[0].trim();
  let best = null, bestLen = 0;
  for (const [cont, flex] of containerChildFlex) {
    for (const c of cont.split(",")) {
      const t = c.trim();
      if (first.startsWith(t + " ") && t.length > bestLen) { best = flex; bestLen = t.length; }
    }
  }
  return best;
}

/**
 * Bitta CSS qoidasini transform qiladi; qo'shimcha qoidalar `emit` ga qo'shiladi.
 * `media` — qoida qaysi `@media` bloki ichida turgani (tashqarida bo'lsa `""`).
 */
function transformRule(node, emit, media = "") {
  stats.cssRules++;
  const decls = parseDecls(node.decls);
  const get = (p) => { const d = decls.find((x) => x.prop === p); return d ? d.value : null; };
  const drop = (p) => { for (let i = decls.length - 1; i >= 0; i--) if (decls[i].prop === p) decls.splice(i, 1); };
  const set = (p, v) => { const d = decls.find((x) => x.prop === p); if (d) d.value = v; else decls.push({ prop: p, value: v }); };

  // ── UXP: klamplanmagan `border-radius` ─────────────────────────────────
  // Qiymatni O'ZGARTIRMAYMIZ (brauzerdagi QA etaloni buzilmasin) — faqat
  // qaysi klasslarga shim tegishini yig'amiz.
  {
    const rad = ["border-radius", "border-top-left-radius", "border-top-right-radius",
      "border-bottom-left-radius", "border-bottom-right-radius"].map(get).filter(Boolean).join(" ");
    if (rad && (/var\(\s*--r-full\s*\)/.test(rad)
      || (rad.match(/(\d+(?:\.\d+)?)px/g) || []).some((v) => parseFloat(v) >= PILL_MIN_PX))) {
      for (const one of selKey(node.selector).split(",")) {
        for (const c of classesOf(splitCompound(one.trim()).last)) pillCls.add(c.slice(1));
      }
    }
  }

  // ── UXP: qoplama nomzodlari (`position:fixed`) va markazlovchi `translate`.
  // Ikkalasi ham FAQAT ro'yxat — CSS qiymati o'zgarmaydi.
  {
    const pos = (get("position") || "").trim().toLowerCase();
    const xf = String(get("transform") || "").replace(/ !important$/i, "").trim();
    const m = xf ? XFC_RE.exec(xf) : null;
    // `transform:none` ham yig'iladi: u avvalgi siljishni BEKOR qiladi
    // (`.toast{translateY(14px)}` + `.toast.show{none}`). Yig'masak, ko'ringan
    // toast 14px pastda osilib qolardi — davo nuqsonga aylanardi.
    const isNone = /^none$/i.test(xf);
    if (pos === "fixed" || m || isNone) {
      for (const one of node.selector.split(",")) {
        const s = one.trim();
        // Psevdo-element/holat selektoriga `querySelectorAll` ham, inline uslub
        // ham berib bo'lmaydi — o'tkazib yuboramiz.
        if (!s || /::|:hover|:focus|:active|:disabled|:not\(/.test(s)) continue;
        // `@keyframes` qadamlari (`from`/`to`/`50%`). AE manbasida bitta buzilgan
        // keyframes bloki oddiy qoidaga aylanib qolgan (`.axroot from{…}`) —
        // hech qanday elementga tushmaydi, ro'yxatni ifloslantirmasin.
        if (/(^|\s)(from|to|\d+%)$/i.test(s)) continue;
        if (pos === "fixed") fixSel.add(s);
        if (isNone) {
          xfcRules.push({ s, m: media, p: pos || "", x: { v: 0, u: "px" }, y: { v: 0, u: "px" } });
        } else if (m) {
          // `translateX(a)` → x=a; `translateY(a)` → y=a; `translate(a[,b])` → x=a, y=b.
          const axis = (m[1] || "").toUpperCase();
          const one1 = { v: parseFloat(m[2]), u: m[3] || "px" };
          const two = m[4] != null ? { v: parseFloat(m[4]), u: m[5] || "px" } : null;
          const x = axis === "Y" ? null : one1;
          const y = axis === "Y" ? one1 : (axis === "X" ? null : two);
          xfcRules.push({ s, m: media, p: pos || "", x, y });
        }
      }
    }
  }

  // ── UXP: `min()`/`max()`/`clamp()` — ro'yxatga yig'amiz (qiymat o'zgarmaydi).
  // Psevdo-element/holat selektorlarini o'tkazib yuboramiz: shim inline uslub
  // qo'yadi, uni esa `::before` yoki `:hover` ga berib bo'lmaydi.
  for (const d of decls) {
    if (!MMC_PROPS.has(d.prop)) continue;
    const v = String(d.value).replace(/ !important$/i, "").trim();
    if (!MMC_RE.test(v)) continue;
    for (const one of node.selector.split(",")) {
      const s = one.trim();
      if (!s || /::|:hover|:focus|:active|:disabled/.test(s)) continue;
      mmcRules.push({ s, m: media, p: d.prop, v });
    }
  }

  // ── UXP: `background` / `border` QISQARTMASI → longhand (`expandShorthand`).
  for (let i = decls.length - 1; i >= 0; i--) {
    const d = decls[i];
    if (!d.prop) continue;
    const imp = / !important$/i.test(d.value) ? " !important" : "";
    const pairs = expandShorthand(d.prop, String(d.value).replace(/ !important$/i, "").trim());
    if (!pairs) continue;
    decls.splice(i, 1, ...pairs.map(([p, v]) => ({ prop: p, value: v + imp })));
    stats.shorthand++;
  }

  const display = (get("display") || "").trim().toLowerCase();
  const isGrid = display === "grid" || display === "inline-grid";

  // Muallif padding'ini O'ZGARTIRISHDAN OLDIN yozib olamiz — auto-fill gap
  // kompensatsiyasi keyingi qoidalarda ham asl qiymatga tayanadi.
  const ownPad = padSides(decls);
  if (ownPad) containerPad.set(selKey(node.selector), { ...(lookupBySuffix(containerPad, node.selector) || {}), ...ownPad });

  // ── psevdo-element flex bolasi: gap qoplamasi ───────────────────────────
  // `::before`/`::after` ham flex bolasi bo'ladi va AE'da unga ham `gap`
  // tegadi, lekin `nth-child` psevdo-elementni SANAMAYDI — port qoidamiz unga
  // yetib bormaydi. Shu sabab bo'shliqni to'g'ridan-to'g'ri psevdoning O'ZIGA
  // margin qilib beramiz (o'lchovda: `.fsheet-catchip.on` 45px, AE'da 50px —
  // nuqta bilan matn orasidagi 5px yo'q edi).
  {
    const pseudo = /::(before|after)\b/.exec(node.selector);
    const pos = (get("position") || "").trim().toLowerCase();
    if (pseudo && get("content") != null && pos !== "absolute" && pos !== "fixed") {
      const ownerSel = node.selector.replace(/::(before|after)\b/g, "");
      const info = selfGapFor(ownerSel);
      if (info && info.gap) {
        const before = pseudo[1] === "before";
        const side = pseudoGapSide(info.mode, before);
        const own = {};
        for (const k of ["margin-top", "margin-right", "margin-bottom", "margin-left"]) own[k] = px(get(k)) || 0;
        if (side) {
          set(side, `${own[side] + info.gap}px`);
          stats.pseudoGap++;
        }
        // Keyingi (zichlik/media) gap qoidalari psevdoni ham yangilashi uchun
        // egani eslab qolamiz — batafsil izoh `pseudoOwners` ta'rifida.
        const cls = classesOf(splitCompound(selKey(ownerSel).split(",")[0].trim()).last);
        if (cls.length) {
          pseudoOwners.push({ cls, which: pseudo[1], own, side, applied: side ? own[side] + info.gap : 0 });
        }
      }
    }
  }

  // ── gap → margin ────────────────────────────────────────────────────────
  const gapRaw = get("gap") || get("grid-gap");
  let rowGap = px(get("row-gap")), colGap = px(get("column-gap"));
  if (gapRaw) {
    const p = splitTop(gapRaw);
    const a = px(p[0]); const b = p.length > 1 ? px(p[1]) : a;
    if (rowGap == null) rowGap = a;
    if (colGap == null) colGap = b;
  }
  ["gap", "grid-gap", "row-gap", "column-gap"].forEach(drop);
  if (colGap != null) containerGap.set(selKey(node.selector), colGap);
  if (rowGap != null) containerRowGap.set(selKey(node.selector), rowGap);

  // ── grid → flex ─────────────────────────────────────────────────────────
  // `display:grid` SHART EMAS: AE'da ustunlar ko'pincha keyingi media-so'rovda
  // faqat `grid-template-columns` bilan qayta belgilanadi (konteyner display'i
  // avvalgi qoidada). Shu sabab ustunlar bo'lsa ham kiramiz, lekin `display`ga
  // faqat asl qoida grid bo'lganda tegamiz.
  // `cols`/`colsN` gap→margin blokida ham kerak — shu sabab tashqarida.
  let cols = null;
  let colsN = null;
  if (isGrid || get("grid-template-columns")) {
    stats.gridRules++;
    cols = get("grid-template-columns");
    const place = (get("place-items") || "").trim();
    const placeC = (get("place-content") || "").trim();
    const autoFlow = (get("grid-auto-flow") || "").trim().toLowerCase();
    ["grid-template-columns", "grid-template-rows", "grid-template-areas", "grid-auto-rows",
      "grid-auto-columns", "grid-auto-flow", "place-items", "place-content", "grid-template"].forEach(drop);

    if (isGrid) set("display", display === "inline-grid" ? "inline-flex" : "flex");
    if (autoFlow.startsWith("column")) set("flex-direction", "row");

    if (place) {
      const [a, b] = place.split(/\s+/);
      if (!get("align-items")) set("align-items", a === "center" ? "center" : a);
      if (!get("justify-content")) set("justify-content", (b || a) === "center" ? "center" : (b || a));
    }
    if (placeC && !get("justify-content")) set("justify-content", placeC.split(/\s+/)[0]);

    // Gap shu qoidada bo'lmasa — shu konteyner uchun avval e'lon qilinganini olamiz.
    const effGap = colGap != null ? colGap : (lookupGap(node.selector) || 0);
    const mapped = cols ? columnsToFlex(cols, effGap) : null;
    if (mapped) {
      if (mapped.wrap !== false) set("flex-wrap", "wrap");
      if (mapped.childFlex) {
        const extra = mapped.minWidth ? `;min-width:${mapped.minWidth}` : "";
        emit(`${childSel(node.selector)}{flex:${mapped.childFlex}${extra}}`);
        containerChildFlex.set(selKey(node.selector), mapped.childFlex);
        if (mapped.n) {
          colsN = mapped.n;
          const k = selKey(node.selector);
          if (!containerColsCtx.has(k)) containerColsCtx.set(k, new Map());
          containerColsCtx.get(k).set(media, mapped.n);
        }
        // `auto-fill` — ustunlar soni konteyner enidan kelib chiqadi; flexda uni
        // CSS bilan hisoblab bo'lmaydi (`autofill.js` runtime'da o'lchaydi).
        if (mapped.autoFill) {
          for (const one of selKey(node.selector).split(",")) {
            for (const c of classesOf(splitCompound(one.trim()).last)) autoFillCls.add(c.slice(1));
          }
        }
      } else if (mapped.perChild) {
        mapped.perChild.forEach((f, i) => {
          const d = [`flex:${f}`];
          if (mapped.perMin && mapped.perMin[i]) d.push(`min-width:${mapped.perMin[i]}px`);
          // Shim uchun ulush + qat'iy qism. CSS'ning O'ZI yetarli emas: `fr`
          // ustunning eni bolaning MARGIN'ini ham ichiga oladi, flexda esa
          // margin `flex-basis` dan TASHQARIDA (o'lchovda: `.pd3-hero`ning
          // `margin-left:16px` i hero'ni 6.67px keng qilib, `.pd3-body`ni
          // shuncha torroq qilgan). Margin faqat ish vaqtida ma'lum.
          if (mapped.perFr) {
            d.push(`--af-fr:${Math.round(mapped.perFr[i] * 1e6) / 1e6}`);
            d.push(`--af-fx:${mapped.trackFixed}px`);
          }
          emit(`${childSel(node.selector, `> *:nth-child(${i + 1})`)}{${d.join(";")}}`);
        });
        if (mapped.perFr) {
          for (const one of selKey(node.selector).split(",")) {
            for (const c of classesOf(splitCompound(one.trim()).last)) trackCls.add(c.slice(1));
          }
        }
      }
    } else if (cols) {
      // Tahlil qilib bo'lmadi — hech bo'lmasa o'ralsin, bolalar siqilib ketmasin.
      set("flex-wrap", "wrap");
    }
  }

  {
    const w = get("flex-wrap");
    if (w) containerWrap.set(selKey(node.selector), /wrap/.test(w.toLowerCase()) && !/nowrap/.test(w.toLowerCase()));
    const fd = get("flex-direction");
    if (fd) containerDir.set(selKey(node.selector), fd.trim().toLowerCase());
    const fl = (get("flex-flow") || "").trim().toLowerCase();
    if (fl) {
      if (/\bcolumn/.test(fl)) containerDir.set(selKey(node.selector), fl.includes("column-reverse") ? "column-reverse" : "column");
      if (/\bwrap\b/.test(fl)) containerWrap.set(selKey(node.selector), !/nowrap/.test(fl));
    }
  }

  // ── grid-column: 1/-1 (butun qatorni egallash) ──────────────────────────
  const gcol = get("grid-column") || get("grid-column-start");
  if (gcol) {
    stats.gridColumn++;
    // Alohida qoida + `!important`. Gridda `grid-column` va
    // `grid-template-columns` BOSHQA-BOSHQA xossalar — to'qnashuv yo'q, butun
    // qator har doim ustun tarkibidan ustun turadi. Flexda esa ikkalasi ham
    // `flex`ga aylanadi va konteyner qoidasi element qoidasini bosib ketadi:
    // `html.cep-mode .grid > *` (0,2,2) vs `.af7-state` (0,1,0) — o'lchovda bo'sh
    // holat bloki butun qator o'rniga bitta ustunga siqilgandi (709px tor).
    // Spetsifiklikni oshirish yetmadi (0,2,0 ham yutqazadi), shuning uchun
    // ikkala tomon ham `!important` — g'olibni manba tartibi hal qiladi.
    const bumped = bumpSel(node.selector);
    if (/1\s*\/\s*-1/.test(gcol) || /span\s+\d+/.test(gcol)) emit(`${bumped}{flex:0 0 100%!important}`);
    else if (/^(auto|initial|unset|revert)$/i.test(gcol.trim())) {
      // Bekor qilish: konteyner bolalariga berilgan flexni qayta yozamiz, aks
      // holda avvalgi `0 0 100%` kuchda qolardi.
      const back = lookupChildFlex(node.selector);
      if (back) emit(`${bumped}{flex:${back}!important}`);
    }
    ["grid-column", "grid-column-start", "grid-column-end", "grid-row", "grid-row-start", "grid-row-end", "grid-area"].forEach(drop);
  }

  // ── margin bilan gap ────────────────────────────────────────────────────
  // UXP `gap` ni butunlay e'tiborsiz qoldiradi, shu sabab uni margin bilan
  // qayta quramiz. Naqsh tanlash MUHIM — sodda "hammasiga margin-right + oxirgi
  // bolaga 0" ikki joyda sinadi va ikkalasi ham o'lchovda ko'rindi:
  //   · yashirin OXIRGI bola (`af-tb-hidden`) `:last-child` ni o'ziga oladi →
  //     ko'rinadigan oxirgi elementda margin qoladi → butun klaster 10px siljiydi;
  //   · o'raladigan gridda oxirgi QATORDAN keyin ortiqcha `margin-bottom` qoladi
  //     → konteyner AE'dagidan `rowGap` ga baland bo'ladi.
  // Shuning uchun: qatorda `* + *` (oxirida margin YO'Q, yashirin bola zararsiz),
  // o'raladigan aniq N ustunli gridda esa `nth-child(Nn)`/`nth-child(n+N+1)`.
  const effColGap = colGap != null ? colGap : lookupGap(node.selector);
  const effRowGap = rowGap != null ? rowGap : lookupBySuffix(containerRowGap, node.selector);
  const nCols = colsN || lookupCols(node.selector, media);
  const declaresGap = rowGap != null || colGap != null;

  // Ustunlar SHU qoidada qayta belgilangan bo'lsa (masalan media-so'rovda 3→2),
  // margin qoidalarini ham shu yerda qayta chiqaramiz — aks holda avvalgi N
  // uchun yozilgan `nth-child` qoidalari kuchda qolardi.
  if (declaresGap || (cols && (effColGap || effRowGap))) {
    stats.gapRules++;
    const dir = (get("flex-direction") || lookupBySuffix(containerDir, node.selector) || "row").trim().toLowerCase();
    const wrapDecl = get("flex-wrap");
    const wraps = wrapDecl
      ? /wrap/.test(wrapDecl.toLowerCase()) && !/nowrap/.test(wrapDecl.toLowerCase())
      : !!lookupBySuffix(containerWrap, node.selector);
    const col = dir.startsWith("column");
    const S = node.selector;
    const used = new Set();
    // Yig'indi qoidasi gap qoidasi bilan AYNAN bir xil bolalar to'plamiga
    // tegishi kerak — aks holda birinchi bolaga ham gap qo'shilib ketadi.
    let sumNth = ":nth-child(n+2)";
    const emitM = (rule) => {
      (rule.match(/margin-(top|right|bottom|left)/g) || []).forEach((p) => used.add(p));
      emit(rule.replace(/^([^{]+)\{/, (_m, s) => `${bumpGapSel(s)}{`));
    };
    if (col) {
      if (effRowGap) {
        emitM(`${childSel(S, "> *:nth-child(n+2)")}{margin-top:${effRowGap}px}`);
        setSelfGap(S, effRowGap, "col-top", emit);
      }
    } else if (wraps && nCols) {
      sumNth = ":nth-child(n+1)";
      // Faqat `gap` qayta belgilangan qoida (ustunlar boshqa qoidada).
      const gapOnly = colGap != null && !cols;

      /**
       * Bitta ustun soni uchun bola-flex + `nth-child` margin qoidalari.
       * `wrapMedia` berilsa qoidalar o'sha media blokiga o'raladi.
       */
      const emitCols = (n, wrapMedia) => {
        const W = wrapMedia ? (r) => `${wrapMedia}{${r}}` : (r) => r;
        const em = wrapMedia
          ? (r) => emit(W(r.replace(/^([^{]+)\{/, (_m, s) => `${bumpGapSel(s)}{`)))
          : emitM;
        // Gap o'zgargan bo'lsa, ustunlar bazasi ham o'zgaradi (grid buni o'zi
        // qayta hisoblaydi, flex-basis esa qotib qolgan) — qayta chiqaramiz.
        if (gapOnly && effColGap != null) {
          const basis = effColGap
            ? `calc((100% - ${(n - 1) * effColGap}px) / ${n})`
            : `calc(100% / ${n})`;
          emit(W(`${childSel(S)}{flex:0 0 ${basis}}`));
          if (!wrapMedia) containerChildFlex.set(selKey(S), `0 0 ${basis}`);
        }
        // Avvalgi N uchun yozilgan margin'larni shu qoidada nolga qaytaramiz.
        // `:nth-child(n+1)` — barcha bolalar, LEKIN spetsifikligi `nth-child(2n)`
        // bilan TENG (0,2,1). Oddiy `> *` (0,1,1) bo'lsa, avvalgi bloknning
        // `nth-child(2n){margin-right:0}` qoidasi kaskadda g'olib qolar edi va
        // 3 ustunli layoutda ikkinchi karta gapsiz yopishib qolardi (o'lchovda
        // ko'rindi: `#homeCatTiles` +11px, 3-karta noto'g'ri qatorda).
        const base = [];
        if (effColGap) base.push(`margin-right:${effColGap}px`);
        if (effRowGap) base.push("margin-top:0");
        if (base.length) em(`${childSel(S, "> *:nth-child(n+1)")}{${base.join(";")}}`);
        if (effColGap) em(`${childSel(S, `> *:nth-child(${n}n)`)}{margin-right:0}`);
        if (effRowGap) em(`${childSel(S, `> *:nth-child(n+${n + 1})`)}{margin-top:${effRowGap}px}`);
      };

      emitCols(nCols, null);
      // Gap qoidasi SHARTSIZ (media tashqarisida) bo'lsa, u media-so'rovdagi
      // ustun sonini ham buzadi: bizning `calc(…/N)` va `nth-child(Nn)`
      // qoidalarimiz kaskadda keyin turadi va media blokini yengib ketadi.
      // Haqiqiy CSS'da esa `gap` va `grid-template-columns` ALOHIDA xossalar —
      // grid har enda o'z ustun sonini saqlaydi. Shu sabab har bir boshqa
      // kontekst uchun ham mos to'plamni chiqaramiz.
      if (gapOnly && !media) {
        for (const [m2, n2] of colsOtherMedia(S, media)) if (n2 !== nCols) emitCols(n2, m2);
      }
      if (effColGap) setSelfGap(S, effColGap, "row-right", emit);
    } else if (wraps) {
      sumNth = ":nth-child(n+1)";
      // N noma'lum (auto-fill): qator oxirini bilib bo'lmaydi. Hammasiga margin
      // beramiz va konteyner padding'idan AYNAN shuncha ayiramiz — ortiqcha
      // margin padding o'rnini egallaydi, tarkib qutisi `gap` ga kengayadi.
      // Padding yetmasa (pad < gap) eski xatti-harakat qoladi: eng yomoni
      // oxirgi ustun/qator biroz siqiladi, layout buzilmaydi.
      const pad = padSides(decls) || lookupBySuffix(containerPad, S) || {};
      const canX = effColGap ? pad.right != null && pad.right >= effColGap : false;
      const canY = effRowGap ? pad.top != null && pad.top >= effRowGap : false;
      // Yuqoridagi padding yetmasa PASTDAGISI bilan urinib ko'ramiz: bolalarda
      // `margin-bottom` qolgani uchun ortiqcha bo'shliqni `padding-bottom`dan
      // ayirsak ham konteyner balandligi AE'nikiga to'g'ri keladi.
      const canYb = !canY && effRowGap ? pad.bottom != null && pad.bottom >= effRowGap : false;
      const m = [];
      if (effColGap) m.push(`margin-right:${effColGap}px`);
      if (effRowGap) m.push(canY ? `margin-top:${effRowGap}px;margin-bottom:0` : "margin-top:0;margin-bottom:" + effRowGap + "px");
      if (m.length) emitM(`${childSel(S, "> *:nth-child(n+1)")}{${m.join(";")}}`);
      if (effColGap) setSelfGap(S, effColGap, "row-right", emit);
      if (canX) {
        set("padding-right", `${pad.right - effColGap}px`);
        // Butun qator bolasi uchun shim'ga xabar (`__AF_PADC`).
        for (const one of selKey(S).split(",")) {
          for (const c of classesOf(splitCompound(one.trim()).last)) padCompCls.add(c.slice(1));
        }
      } else if (effColGap) {
        // Qoplanmadi → tarkib qutisi kengaymagan. Shim boshqa hisobdan
        // foydalanishi va qator oxiridagi margin'ni olib tashlashi kerak.
        for (const one of selKey(S).split(",")) {
          for (const c of classesOf(splitCompound(one.trim()).last)) noPadCompCls.add(c.slice(1));
        }
      }
      if (canY) set("padding-top", `${pad.top - effRowGap}px`);
      else if (canYb) set("padding-bottom", `${pad.bottom - effRowGap}px`);
      // Padding kompensatsiyasi BOLA BOR degan taxminga tayanadi: ayirilgan
      // bo'shliqni birinchi qator/ustunning margin'i qaytaradi. Konteyner BO'SH
      // bo'lsa qaytaradigan hech kim yo'q va u aynan `gap`cha kichrayadi
      // (o'lchovda: yuklab olinmagan holatda `#dlGrid` 12px past, `#dlEmpty`
      // 12px tepaga siljigan). Bo'sh holatda asl padding'ni tiklaymiz.
      if (canX || canY || canYb) {
        // Shu qoida O'ZI e'lon qilgan HAMMA tomonni tiklaymiz, faqat
        // kompensatsiya qilinganini emas: `:empty` psevdo-klassi ustunlikni
        // bir pog'ona oshiradi, shu sabab keyingi blokdagi PASTROQ ustunlikli
        // `padding` qayta e'loni bizning `:empty` qoidamizni yenga olmaydi va
        // eski qiymat sizib qolardi (o'lchovda: `#dlGrid` pastdan 18px, R5-E
        // bloki 16px bergan bo'lsa ham → +2px).
        const e = [];
        for (const k of ["top", "right", "bottom", "left"]) {
          if (ownPad && ownPad[k] != null) e.push(`padding-${k}:${ownPad[k]}px`);
        }
        const has = (k) => ownPad && ownPad[k] != null;
        if (canX && !has("right")) e.push(`padding-right:${pad.right}px`);
        if (canY && !has("top")) e.push(`padding-top:${pad.top}px`);
        else if (canYb && !has("bottom")) e.push(`padding-bottom:${pad.bottom}px`);
        emitM(`${selKey(S).split(",").map((s) => `${s.trim()}:empty`).join(",")}{${e.join(";")}}`);
      }
      else if (effRowGap) {
        // Padding bilan qoplab bo'lmadi → oxirgi qator margin'ini shim yechadi.
        for (const one of selKey(S).split(",")) {
          const cls = classesOf(splitCompound(one.trim()).last);
          if (cls.length) rowLeakCls.add(cls[cls.length - 1].slice(1));
          else stats.rowLeakWeak++;
        }
      }
    } else if (effColGap) {
      // Odatda gap CHAP margin bo'ladi (birinchi bolaga tegmasin). Ammo
      // konteyner ichida muallif `margin-left:auto` ishlatgan bo'lsa ikkalasi
      // bitta xossada to'qnashadi va `auto` (!important) g'olib kelib gap
      // yo'qoladi. Bunday konteynerda gap'ni O'NG tomonga o'tkazamiz —
      // natija bir xil, to'qnashuv esa yo'q. O'ngda ham `auto` bo'lsa foyda
      // yo'q: eski (chap) shakl qoladi.
      const swap = autoMarginChild(S, "left") && !autoMarginChild(S, "right");
      if (swap) {
        stats.gapSideSwap++;
        sumNth = ":nth-last-child(n+2)";   // oxirgisidan boshqa hammasi
        emitM(`${childSel(S, "> *:nth-last-child(n+2)")}{margin-right:${effColGap}px}`);
      } else {
        emitM(`${childSel(S, "> *:nth-child(n+2)")}{margin-left:${effColGap}px}`);
      }
      setSelfGap(S, effColGap, swap ? "row-right" : "row-left", emit);
    }

    // Naqsh almashgan bo'lsa eski TOMONNI nolga qaytaramiz — batafsil izoh
    // `containerGapSides` ta'rifida. Reset `emitM` orqali EMAS: u xossani
    // `used` ga qo'shar edi va quyidagi yig'indi sikli o'sha o'lik tomonga
    // ham gap qo'shib yuborardi. Qoida shu qoidaning KONTEKSTIDA (media
    // bloki ichida) chiqadi, shuning uchun blokdan tashqarida eski naqsh
    // buzilmay qoladi.
    const nowSides = new Set(used);
    const prevSides = containerGapSides.get(selKey(S));
    if (prevSides) {
      const stale = [...prevSides].filter((p) => !nowSides.has(p));
      if (stale.length) {
        stats.gapStale++;
        const s = childSel(S, "> *:nth-child(n+1)");
        emit(`${bumpGapSel(s)}{${stale.map((p) => `${p}:0`).join(";")}}`);
      }
    }
    if (nowSides.size) containerGapSides.set(selKey(S), nowSides);

    // Muallif nudge'lari (`.ck-sub{margin-top:-3px}`) gap bilan QO'SHILISHI
    // kerak — yig'indini shu yerda, gap qoidasidan KEYIN chiqaramiz.
    for (const side of used) {
      const g = side === "margin-top" ? effRowGap : side === "margin-bottom" ? effRowGap : effColGap;
      if (!g) continue;
      for (const r of gapSumRules(S, side.slice(7), g, sumNth)) { stats.gapSums++; emit(r); }
    }
    if (used.size) {
      containerGapProps.set(selKey(S), [...used]);
      // Yalang'och matn bolasi uchun (`gap-text.js` runtime shim'i shu ro'yxatdan
      // ishlaydi) konteyner klasslarini yig'amiz.
      for (const one of selKey(S).split(",")) {
        const t = one.trim();
        const cls = classesOf(splitCompound(t).last);
        if (cls.length) for (const c of cls) gapTextCls.add(c.slice(1));
        // `@media …` prelyudiyasi selektor emas — shim'ga bermaymiz.
        else if (!t.includes("::") && t[0] !== "@") gapTextSel.add(t);   // `.set-ltot span` kabi
      }
    }
  } else if (/^(block|inline|inline-block|list-item|table)$/.test(display)) {
    // Konteyner endi flex EMAS → gapdan kelgan margin'lar bekor qilinsin.
    // Spetsifiklik: `.a.b > *:nth-child(n+1)` (0,3,0) > `.a > *:nth-child(n+1)` (0,2,0);
    // aynan bir xil selektor bo'lsa manba tartibi hal qiladi (biz keyinmiz).
    const props = gapPropsForOverride(node.selector);
    if (props) {
      stats.gapOverrides++;
      emit(`${childSel(node.selector, "> *:nth-child(n+1)")}{${props.map((p) => `${p}:0`).join(";")}}`);
    }
  }

  // ── `margin:auto` — flexda "o'ngga/pastga surish" idiomasi ──────────────
  // Gap endi margin bo'lgani uchun ikkalasi bitta xossada to'qnashadi va bizning
  // `:nth-child` qoidamiz spetsifiklik bo'yicha g'olib keladi. Muallifning
  // `auto` si esa gap emas — pozitsiya; uni yo'qotsak element joyidan uchadi
  // (AE'da 56 ta shunday e'lon bor). Shu sabab uni `!important` bilan saqlaymiz.
  for (const d of decls) {
    if (!d.prop || !/^margin(-(top|right|bottom|left))?$/.test(d.prop)) continue;
    if (!/\bauto\b/.test(d.value) || /!important/.test(d.value)) continue;
    d.value = `${d.value} !important`;
  }

  // ── animatsiya boshlanish holati ────────────────────────────────────────
  // UXP animatsiyani BAJARMAYDI. `opacity:0` + `animation:…in` = element abadiy
  // ko'rinmas. Boshlang'ich holatni ko'rinadigan qilib qo'yamiz.
  if (get("animation") || get("animation-name")) {
    const op = get("opacity");
    if (op != null && parseFloat(op) === 0) { set("opacity", "1"); stats.animOpacity++; }
    const tr = get("transform");
    if (tr && /translate|scale/i.test(tr)) drop("transform");
  }

  // ── qo'llanmaydigan effektlar ───────────────────────────────────────────
  if (get("backdrop-filter") || get("-webkit-backdrop-filter")) {
    stats.backdrop++;
    drop("backdrop-filter"); drop("-webkit-backdrop-filter");
  }

  node.decls = declText(decls);
}

/**
 * Transformdan OLDIN butun stil varag'ini o'qib, avlodlik indeksi va muallif
 * margin e'lonlarini yig'adi. Alohida yurish shart: `.card{gap:6px}` (897-qator)
 * `.ck-sub{margin-top:-3px}` (925-qator) dan OLDIN keladi — bir yurishda
 * yig'indini hisoblab bo'lmaydi.
 */
export function indexCss(src) {
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === "at") { if (n.children) walk(n.children); continue; }
      if (n.type !== "rule") continue;
      n.selector = disabledSel(buttonSel(n.selector));
      indexSelector(n.selector);
      indexAuthorMargins(n.selector, parseDecls(n.decls));
    }
  };
  walk(parseCss(src));
}

/**
 * `button` element selektori → `[role="button"]`.
 *
 * `buttonsToDivs()` markupdagi `<button>` ni `<div role="button">` ga o'girgani
 * uchun `button` tipli selektorlar HECH NIMAGA tegmay qoladi (AE'da 7 ta shunday
 * qoida bor: `.b8 button`, `.ai-zoom button`, `.recentgrid .empt button`,
 * `.axroot button:focus-visible` …). Selektorni ham birga o'giramiz.
 *
 * Spetsifiklik o'zgaradi (0,0,1 → 0,1,0). Bu ataylab: UA taqlidi bo'lgan bazaviy
 * `[role="button"]` qoidasi varaqning ENG BOSHIDA turadi, shu sabab teng
 * spetsifiklikda manba tartibi bo'yicha muallif qoidasi baribir ustun keladi.
 */
function buttonSel(sel) {
  return sel.replace(/(^|[\s>+~,(])button\b(?![-\w])/g, (m, pre) => {
    stats.buttonSel++;
    return `${pre}[role="button"]`;
  });
}

/**
 * `:disabled` → `[disabled]`.
 *
 * `:disabled` psevdo-klassi FAQAT forma elementlariga tegadi. `<button>` biz
 * uchun `<div role="button">` bo'lgach (atribut saqlanadi: `disabled=""`)
 * qoida hech nimaga tushmay qoladi (o'lchovda: `.axws .gensend:disabled`
 * `border:1px solid var(--border)` bermay qolgan → `#igGen` 2px tor, undan
 * keyingi butun amal-guruhi siljigan). Atribut selektori ikkala holatda ham
 * ishlaydi: haqiqiy `<input disabled>` da ham atribut bor.
 *
 * Ustunlik 0,1,0 → 0,1,0 (psevdo-klass ham, atribut ham bir xil vaznda) —
 * ya'ni tartib va boshqa qoidalarga ta'sir qilmaydi.
 */
function disabledSel(sel) {
  return sel.replace(/:disabled\b/g, () => { stats.disabledSel++; return "[disabled]"; });
}

/** Butun CSS daraxtini transform qiladi va matn qaytaradi. */
function transformCss(src, label) {
  const tree = parseCss(src);
  const render = (nodes, indent, media = "") => {
    let out = "";
    for (const n of nodes) {
      if (n.type === "raw") { out += n.text; continue; }
      if (n.type === "at") {
        // Ichma-ich blokda ENG ICHKI shart olinadi (AE CSS'ida ichma-ichlik yo'q).
        const inner = /^@(media|container)\b/i.test(n.prelude) ? n.prelude : media;
        if (n.children) out += `${n.prelude}{\n${render(n.children, indent + "  ", inner)}\n}\n`;
        else out += `${n.prelude}{${n.raw}}\n`;
        continue;
      }
      n.selector = disabledSel(buttonSel(n.selector));
      const extra = [];
      transformRule(n, (r) => { extra.push(r); stats.emitted++; }, media);
      out += `${n.selector}{${n.decls}}\n`;
      for (const e of extra) out += `${e}\n`;
    }
    return out;
  };
  return `/* ── ${label} (generatsiya: scripts/ae-port.mjs — QO'LDA TAHRIRLAMA) ── */\n` + render(tree, "");
}

/* ══════════════════════════════════════════════════════════════════════════
   HTML
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `<button …>…</button>` → `<div role="button" tabindex="0" …>…</div>`.
 * UXP `<button>` ni native widget qilib chizadi: `background-color`/`color`
 * e'tiborsiz qoladi (SPIKE-NATIJA §9). Tugmalar ichma-ich joylashmaydi,
 * shuning uchun ketma-ket skan yetarli.
 */
function buttonsToDivs(html) {
  let out = "", i = 0;
  const open = /<button(\s[^>]*)?>/gi;
  let m;
  const depthStack = [];
  while ((m = open.exec(html))) {
    out += html.slice(i, m.index);
    let attrs = m[1] || "";
    // `type=` UXP'da ma'nosiz; `disabled` → aria + data (CSS `[disabled]` ga mos qolishi uchun).
    attrs = attrs.replace(/\stype\s*=\s*(['"])[^'"]*\1/gi, "");
    const isDisabled = /\sdisabled(\s|=|$)/i.test(attrs);
    attrs = attrs.replace(/\sdisabled(\s*=\s*(['"])[^'"]*\2)?/gi, "");
    out += `<div role="button" tabindex="0"${attrs}${isDisabled ? ' disabled="" aria-disabled="true"' : ""}>`;
    stats.buttons++;
    i = open.lastIndex;
    // Mos `</button>` ni topamiz (ichma-ich <button> yo'q deb hisoblaymiz).
    const close = html.toLowerCase().indexOf("</button>", i);
    if (close === -1) break;
    out += html.slice(i, close) + "</div>";
    i = close + "</button>".length;
    open.lastIndex = i;
  }
  out += html.slice(i);
  void depthStack;
  return out;
}

/**
 * Ildiz `<svg>` dagi prezentatsiya atributlarini bolalarga KO'CHIRADI.
 *
 * UXP SVG dvigateli `fill`/`stroke` ni ildizdan meros qilmaydi — natijada
 * lucide uslubidagi kontur ikonalari (`<svg fill="none" stroke="currentColor">`)
 * standart `fill:black; stroke:none` bilan chiziladi: kontur yo'qoladi, ichki
 * shakl esa qora dog' bo'lib qoladi. Jonli o'lchov (login "ko'z" tugmasi):
 * ko'z konturi umuman ko'rinmadi, `<circle r="3">` to'ldirilgan nuqta bo'ldi.
 *
 * Bolada o'z atributi bo'lsa TEGILMAYDI (to'ldirilgan + konturli aralash
 * ikonalar buzilmasin). Brauzerda natija piksel-bir xil — meros qiymati aynan
 * shu qiymatning o'zi, shu sabab 1:1 QA etaloni o'zgarmaydi.
 */
const SVG_INHERIT = ["fill", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-miterlimit", "fill-rule", "clip-rule"];
const SVG_SHAPES = /^(path|circle|rect|line|polyline|polygon|ellipse|g)$/i;

function svgInheritAttrs(html) {
  return html.replace(/<svg(\s[^>]*)?>([\s\S]*?)<\/svg>/gi, (whole, rootAttrs, inner) => {
    const attrs = rootAttrs || "";
    const own = {};
    for (const name of SVG_INHERIT) {
      const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*(['"])([^'"]*)\\1`, "i"));
      if (m) own[name] = m[2];
    }
    if (!Object.keys(own).length) return whole;

    const patched = inner.replace(/<([a-zA-Z][\w-]*)((?:\s[^>]*?)?)(\/?)>/g, (tag, name, tagAttrs, slash) => {
      if (!SVG_SHAPES.test(name)) return tag;
      let extra = "";
      for (const [k, v] of Object.entries(own)) {
        if (new RegExp(`\\s${k}\\s*=`, "i").test(tagAttrs)) continue;
        extra += ` ${k}="${v}"`;
        stats.svgAttrs++;
      }
      return `<${name}${tagAttrs}${extra}${slash}>`;
    });
    return `<svg${attrs}>${patched}</svg>`;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   JS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Host nomi va host tushunchalari — AE → Premiere.
 *
 * "1:1" degani PIKSEL va OQIM bir xil, LEKIN boshqa dasturning nomini yozib
 * turish 1:1 emas, XATO bo'lardi: Premiere ichidagi panel "Make After Effects
 * move faster" desa, bu halol emas. Shu sabab faqat HOST atamalari
 * almashtiriladi; layout, klass, ikona, oqim — tegilmaydi.
 *
 * Ehtiyot: `\bcomp\b` kabi keng shablon TAQIQ (`comp-x` klasslariga tushadi) —
 * faqat aniq iboralar almashtiriladi.
 */
/**
 * TEXT_COPY — faqat FOYDALANUVCHIGA KO'RINADIGAN atamalar. Bu ro'yxat ikki joyda
 * ishlatiladi: (1) port vaqtida statik matnga, (2) ish vaqtida CMS'dan kelgan
 * matnga (`host-copy.js` shu ro'yxatdan GENERATSIYA qilinadi) — chunki plagin
 * bosh sahifa matnlari serverdagi `/api/plugin/content-config` dan keladi va
 * port vaqtidagi almashtirish faqat zaxira (offline) matnni tuzatadi.
 */
const TEXT_COPY = [
  [/After Effects/g, "Premiere Pro"],
  [/AfterEffects/g, "PremierePro"],
  // Qisqartma: manbada 'AE' FAQAT host nomi sifatida uchraydi — tekshirildi:
  // `'AE'`/`"AE"` literal YO'Q, `class="…AE…"`/`id="…AE…"` YO'Q, `AE_` kabi
  // identifikator ham yo'q (`\b` uni tutmaydi). Shu sabab almashtirish xavfsiz.
  [/\bAE\b/g, "Premiere"],
  [/into your comp\b/g, "into your sequence"],
  [/your comp\b/g, "your sequence"],
  [/the comp\b/g, "the sequence"],
  // `composition` — TANLAB. `compositionstart`/`compositionend` IME hodisalari
  // (11851-qator) tegilmasligi shart, shu sabab keng shablon TAQIQ.
  [/\bactive composition\b/g, "active sequence"],
  [/\byour composition\b/g, "your sequence"],
  [/\ba composition\b/g, "a sequence"],
  [/\bComposition\b/g, "Sequence"],
  [/'composition'/g, "'sequence'"],
  [/frame from composition/g, "frame from sequence"],
  // Ko'rinadigan fayl turi yorliqlari. FUNKSIONAL `.aep` mantiqi (pack ochish,
  // import) TEGILMAYDI — u FAZA 3 (importer) ishi.
  [/\(\.aep\/\.zip\)/g, "(.mogrt/.zip)"],
  [/\(\.aep \+ footage\)/g, "(.mogrt + footage)"],
  [/No pack \(\.aep\)/g, "No pack (.mogrt)"],
  [/Project \(\.aep\) file/g, "Project (.mogrt) file"],
];

/** CODE_COPY — faqat kod mantiqi; CMS matniga HECH QACHON qo'llanmaydi. */
const CODE_COPY = [
  // Katalog so'rovi: AE plagin `?app=ae` yuboradi — Premiere paneli `pr` bo'lishi shart.
  [/p\.set\(\s*(['"])app\1\s*,\s*(['"])ae\2\s*\)/g, 'p.set("app", "pr")'],
  // Klient zaxira filtri (server filtri ustidan): AE bo'lmaganini emas, PR bo'lmaganini tashla.
  [/String\(a\.templateApp\)\.toLowerCase\(\)\s*!==\s*(['"])ae\1/g, "String(a.templateApp).toLowerCase()!=='pr'"],
];

const HOST_COPY = [...TEXT_COPY, ...CODE_COPY];

function transformCopy(text) {
  let out = text;
  for (const [re, to] of HOST_COPY) {
    const n = (out.match(re) || []).length;
    if (n) { stats.copy += n; out = out.replace(re, to); }
  }
  return out;
}

/**
 * AE JS'ini UXP uchun moslaydi. Ikkita mexanik almashtirish — mantiqqa tegmaydi:
 *
 *   require(…)   → __ffRequire(…)   UXP `require` faqat `fs`/`os`/`path` beradi;
 *                                   `child_process`/`http`/`zlib`/`buffer` yo'q.
 *                                   Shim ularni halol xato yoki UXP muqobiliga
 *                                   yo'naltiradi (`js/ae-shim/require-shim.js`).
 *   <button …>   → <div role=…>     JS ichidagi HTML shablonlaridagi tugmalar.
 *                                   UXP `<button>` ni native widget qilib chizadi
 *                                   va `background-color`/`color` ni tashlab yuboradi
 *                                   (SPIKE-NATIJA §9), shu sabab markupdagilar bilan
 *                                   bir xil qilinadi.
 */
function transformJs(code) {
  let out = code;
  const reqBefore = (out.match(/\brequire\s*\(/g) || []).length;
  out = out.replace(/\brequire\s*\(/g, "__ffRequire(");
  stats.jsRequire += reqBefore;

  const btnBefore = (out.match(/<button\b/gi) || []).length;
  out = out.replace(/<button\b/gi, '<div role="button" tabindex="0"')
    .replace(/<\/button>/gi, "</div>");
  stats.jsButtons += btnBefore;

  // `createElement('button')` (13 joy) ish vaqtida shim orqali div qaytaradi,
  // lekin CSS selektori `button` endi hech nimaga tushmaydi — uni ham yangilaymiz.
  const qsBefore = (out.match(/(['"`])button\1/g) || []).length;
  out = out.replace(/querySelector(All)?\(\s*(['"])button\2\s*\)/g,
    (_m, all) => `querySelector${all || ""}('[role="button"]')`);
  stats.jsQuery += qsBefore ? (out.match(/\[role="button"\]/g) || []).length : 0;

  // Inline `style="grid-column:1/-1"` (virtualizatsiya spacer'lari, bo'sh holat
  // maslahatlari — 12 joy). CSS o'tishi style ATRIBUTIGA tegmaydi, flexda esa
  // `grid-column` ma'nosiz: spacer butun qator o'rniga bitta ustunga tushardi.
  out = out.replace(/grid-column:\s*1\s*\/\s*-1/g, () => { stats.gridColumn++; return "flex:0 0 100%"; });

  // Premiere UXP'da ResizeObserver layout yozuvlari bilan feedback loop hosil
  // qiladi; spike'dagi kuzatuvchilarga tayanmaslik qoidasiga mos ravishda
  // portda uni o'chiramiz. Mavjud `resize` hodisasi + dastlabki fit yetarli.
  out = out.replace(/if\s*\(\s*window\.ResizeObserver\s*\)/g,
    "if (false && window.ResizeObserver)");

  // FFCMS vizual muharriri faqat brauzerdagi `?ffcms=1` iframe uchun. Uning
  // har-kadr overlay joylash loop'i UXP paketiga umuman kerak emas va host
  // callback dispatcherida blank exception storm hosil qilishi mumkin.
  out = out.replace(
    /\(function loop\(\) \{ if \(selected\) place\(\); requestAnimationFrame\(loop\); \}\)\(\);/g,
    "/* FFCMS frame loop UXP portida o'chirilgan. */",
  );

  // JS shablonlari ichidagi SVG ikonalari ham ildizdan meros olmaydi.
  out = svgInheritAttrs(out);
  // Inline `style="…"` / `cssText='…'` — CSS o'tishi ularga tegmaydi.
  out = expandInlineStyles(out);

  // CEP picker SINXRON, UXP picker ASINXRON. `cep-fs.js` Promise qaytaradi;
  // FAQAT portlangan nusxadagi picker egalari async bo'ladi (AE manbasi o'zgarmaydi).
  // Oltita haqiqiy chaqiruvning enclosing funksiyalari aniq nom/naqsh bilan
  // yangilanadi — keng "har function async" transformi yo'q.
  if (out.indexOf("window.cep.fs.showOpenDialog") >= 0) {
    out = out
      .replace(/\bfunction\s+(cepPickFolder|axRefUpload|pickFileMedia|pickFileFrame)\s*\(/g, "async function $1(")
      .replace(/(\$\('igSrcFile'\)\.addEventListener\('click',)function\s*\(/g, "$1async function(")
      .replace(/\b(const|let|var)\s+r\s*=\s*window\.cep\.fs\.showOpenDialog\(/g,
        "$1 r=await window.cep.fs.showOpenDialog(")
      .replace(/\br\s*=\s*window\.cep\.fs\.showOpenDialog\(/g,
        "r=await window.cep.fs.showOpenDialog(")
      .replace(/\blet\s+path\s*=\s*cepPickFolder\(\)/g, "let path=await cepPickFolder() ");
  }

  // UXP o'z versiyasi va o'z release kanalini ishlatadi. AE manbasidagi
  // `1.1.1`/default `app=ae` qoldirilsa Premiere paneli .zxp yangilanishini
  // taklif qilib, noto'g'ri installerga yuborardi.
  out = out.replace(/window\.AF_PLUGIN_VERSION\s*=\s*(['"])[^'"]+\1/,
    `window.AF_PLUGIN_VERSION=${JSON.stringify(UXP_VERSION)}`);
  out = out.replace(/\/api\/plugin\/version\?current=/g,
    "/api/plugin/version?app=pr&current=");
  return transformCopy(out);
}

/* ══════════════════════════════════════════════════════════════════════════
   Qurish
   ══════════════════════════════════════════════════════════════════════════ */

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(a, b);
    else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

/**
 * `ported/host-copy.js` — ish vaqtidagi host-atama qatlami.
 *
 * Nega kerak: plagin bosh sahifasi matnlari CMS'dan keladi
 * (`GET /api/plugin/content-config` → `afCmsApply()`), shu sabab port vaqtidagi
 * almashtirish faqat server yetib bo'lmaganda ko'rinadigan ZAXIRA matnni tuzatadi.
 * Server ulanishi bilan sahifa yana "After Effects" deb yozardi.
 *
 * Nima QILMAYDI: DOM matnini kuzatmaydi (UXP'da `MutationObserver` yo'q) va
 * serverga tegmaydi — faqat shu plagin oladigan JSON javob matnini xaritalaydi.
 * Ro'yxat TEXT_COPY dan generatsiya qilinadi — yagona manba.
 */
function hostCopyShim() {
  const rules = TEXT_COPY.map(([re, to]) =>
    `  [${String(re)}, ${JSON.stringify(to)}]`).join(",\n");
  return `/* Generatsiya: scripts/ae-port.mjs (TEXT_COPY) — QO'LDA TAHRIRLAMA. */
(function () {
  "use strict";
  var RULES = [
${rules}
  ];

  function mapText(s) {
    var out = s;
    for (var i = 0; i < RULES.length; i++) out = out.replace(RULES[i][0], RULES[i][1]);
    return out;
  }

  // JSON daraxtidagi HAR satrni xaritalaymiz: CMS tugunlari erkin shaklda
  // (matn, massiv, ichma-ich obyekt) — kalitlarni qattiq yozib qo'yish mo'rt bo'lardi.
  function mapDeep(v, depth) {
    if (depth > 12) return v;
    if (typeof v === "string") return mapText(v);
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = mapDeep(v[i], depth + 1); return v; }
    if (v && typeof v === "object") { for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) v[k] = mapDeep(v[k], depth + 1); return v; }
    return v;
  }
  window.__ffHostCopy = mapText;
  window.__ffHostCopyDeep = function (v) { return mapDeep(v, 0); };

  // ── 1. Tarmoq qatlami: CMS javobini xaritalash ───────────────────────────
  var CMS_RE = /\\/api\\/plugin\\/content-config/;
  var nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var p = nativeFetch.apply(this, arguments);
      if (!CMS_RE.test(url)) return p;
      return p.then(function (res) {
        // \`Response\` konstruktoriga tayanmaymiz (UXP'da bor-yo'qligi kafolatsiz) —
        // asl javobni o'rab, faqat \`json()\`/\`text()\` ni ustidan yozamiz.
        var wrap = Object.create(res);
        wrap.ok = res.ok; wrap.status = res.status; wrap.statusText = res.statusText;
        wrap.headers = res.headers; wrap.url = res.url;
        wrap.json = function () { return res.json().then(function (d) { return mapDeep(d, 0); }); };
        wrap.text = function () { return res.text().then(mapText); };
        return wrap;
      });
    };
  } else {
    (window.FFLog ? FFLog.warn : console.warn)("host-copy: fetch yo'q — CMS matni xaritalanmaydi");
  }

  // ── 2. Kesh qatlami: oldingi sessiyada saqlangan CMS matni ───────────────
  // \`afCmsApply()\` boot'da localStorage keshidan o'qiydi — tarmoqdan oldin.
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || !/cms/i.test(key)) continue;
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      var fixed = mapText(raw);
      if (fixed !== raw) localStorage.setItem(key, fixed);
    }
  } catch (e) { /* storage yo'q → jim */ }
})();
`;
}

function main() {
  const src = read(path.join(AE, "AssetFlow_Plugin.html"));

  // ── 1. Inline <style> bloklari ────────────────────────────────────────
  const styleBlocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(src))) styleBlocks.push(sm[1]);

  // ── 2. Tashqi CSS ─────────────────────────────────────────────────────
  const cssFiles = ["css/tokens.css", "css/ff-components.css", "css/styles.css"];
  // UA-tugma standartlari — HAMMA narsadan OLDIN (muallif qoidalari ustun bo'lsin).
  // `<button>` → `<div role="button">` almashtirilgani uchun brauzer/UXP endi
  // tugma UA uslublarini bermaydi: `line-height` meros bo'lib qoladi va matn
  // qutisi AE'dagidan farq qiladi (o'lchovda: `.ct-tx` 15.5 → 13.2px).
  // `font` qisqartmasi UA `button{font:400 13.3333px Arial}` ni aynan takrorlaydi
  // (AE'da 57 ta tugma shu standart o'lchamda, 51 tasi Arial'da qoladi). Faqat
  // `line-height` yetmasdi: `.ct-tx` o'lchovda 15.5 → 13.2px bo'lib qolgandi.
  // Qoida ATAYLAB varaqning eng boshida — muallif klass qoidalari (teng
  // spetsifiklik) manba tartibi bo'yicha ustun kelsin.
  let css = `[role="button"]{font:400 13.3333px Arial;text-align:center}\n`;
  // Oldindan yurish: avlodlik + muallif margin indeksi (gap yig'indisi uchun).
  for (const f of cssFiles) indexCss(read(path.join(AE, f)));
  styleBlocks.forEach((b) => indexCss(b));
  stats.buttonSel = 0;   // indeks yurishida sanalganini bekor qilamiz
  for (const f of cssFiles) css += transformCss(read(path.join(AE, f)), f) + "\n";
  styleBlocks.forEach((b, i) => { css += transformCss(b, `inline <style> #${i + 1}`) + "\n"; });

  // UXP tuzatishlari — transform qilingan CSS'dan KEYIN (kaskadda ustun).
  css += read(path.join(HERE, "ae-port-overrides.css"));
  write(path.join(OUT, "ae.css"), css);

  // ── 3+4. Tana markupi va skriptlar — BITTA o'tishda ────────────────────
  // MUHIM: AE tanasida `<script src=…>` bloki markup O'RTASIDA (5351-qator), undan
  // keyin yana ~12 000 qator UI bor. Shu sabab "birinchi skriptgacha kesish" TAQIQ —
  // butun tanani olamiz, skriptlarni HUJJAT TARTIBIDA ajratib chiqaramiz.
  const bodyStart = src.search(/<body[^>]*>/i);
  const afterBody = src.indexOf(">", bodyStart) + 1;
  const bodyEnd = src.search(/<\/body>/i);
  const rawBody = src.slice(afterBody, bodyEnd < 0 ? src.length : bodyEnd);

  const scripts = [];
  const scriptRe = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let body = rawBody.replace(scriptRe, (_m, attrs, code) => {
    const srcAttr = (attrs || "").match(/src\s*=\s*['"]([^'"]+)['"]/i);
    if (srcAttr) scripts.push({ ext: srcAttr[1] });
    else if (code.trim()) scripts.push({ code });
    return "";
  });
  body = transformCopy(expandInlineStyles(svgInheritAttrs(buttonsToDivs(body))))
    // Markupdagi inline `style="grid-column:1/-1"` — JS shablonlaridagidek.
    .replace(/grid-column:\s*1\s*\/\s*-1/g, () => { stats.gridColumn++; return "flex:0 0 100%"; });
  // UXP `contenteditable`ni chizadi, ammo klaviatura fokusini bermaydi: prompt
  // yozuvi Premiere shortcut'lariga o'tib ketadi. Native textarea UXP'da
  // fokus/IME/selection bilan ishlaydi; afChipEditor textarea fallback'i token
  // qiymatini shu bir xil `.value` kontraktida saqlaydi.
  body = body.replace(
    /<div id="(igPrompt|vgPrompt)" class="chipedit" contenteditable="true" role="textbox" aria-multiline="true" data-ph="([^"]*)"><\/div>/g,
    '<textarea id="$1" class="chipedit" aria-multiline="true" placeholder="$2"></textarea>',
  );
  stats.inlineHandlers = (body.match(/\son[a-z]+\s*=/gi) || []).length;
  write(path.join(OUT, "ae-body.html"), body);
  const inlineFiles = [];
  let n = 0;
  const order = [];
  for (const s of scripts) {
    if (s.ext) {
      if (/CSInterface\.js$/i.test(s.ext)) { order.push("js/ae-shim/csinterface-shim.js"); continue; }
      order.push(`ae-src/${path.basename(s.ext)}`);
      continue;
    }
    n++;
    const f = `ae-inline-${String(n).padStart(2, "0")}.js`;
    inlineFiles.push(f);
    write(path.join(OUT, f), transformJs(s.code));
    order.push(`ported/${f}`);
  }

  // ── 5. AE tashqi JS + shriftlar ───────────────────────────────────────
  let copied = 0;
  for (const f of fs.readdirSync(AE)) {
    if (!/^assetflow-.*\.js$/.test(f)) continue;
    fs.mkdirSync(path.join(OUT, "ae-src"), { recursive: true });
    write(path.join(OUT, "ae-src", f), transformJs(read(path.join(AE, f))));
    copied++;
  }
  const fonts = copyDir(path.join(AE, "css", "fonts"), path.join(OUT, "fonts"));

  // ── 6. To'liq UXP hujjati ─────────────────────────────────────────────
  // Shim qatlami HAR DOIM AE kodidan OLDIN: `__ffRequire`, `CSInterface`,
  // inline hodisa delegatsiyasi va media o'lchami AE kodi ishga tushishidan
  // avval mavjud bo'lishi shart.
  // Gap konteynerlari ro'yxati — `gap-text.js` shim'i uchun (yalang'och matn).
  write(path.join(OUT, "gap-text-classes.js"),
    `/* Generatsiya: scripts/ae-port.mjs — QO'LDA TAHRIRLAMA.\n` +
    `   Gap'i margin'ga o'girilgan konteyner klasslari; js/ae-shim/gap-text.js o'qiydi. */\n` +
    `window.__AF_GAPC=${JSON.stringify([...gapTextCls].sort())};\n` +
    `window.__AF_GAPSEL=${JSON.stringify([...gapTextSel].sort())};\n` +
    `window.__AF_FILLC=${JSON.stringify([...autoFillCls].sort())};\n` +
    `window.__AF_PADC=${JSON.stringify([...padCompCls].sort())};\n` +
    `window.__AF_ROWLEAK=${JSON.stringify([...rowLeakCls].sort())};\n` +
    // Kompensatsiya BIR marta qo'llansa ham konteyner padding'i o'sha holicha
    // qoladi → quti kengaygan. Shu sabab `padCompCls` ustun: zichlik/media
    // variantlari gap'ni qayta e'lon qilib padding'ni tilga olmaydi va o'sha
    // qoidalar `.grid`ni xato ravishda "padding'siz" deb belgilardi.
    `window.__AF_NOPADC=${JSON.stringify([...noPadCompCls].filter((c) => !padCompCls.has(c)).sort())};\n` +
    `window.__AF_TRACKC=${JSON.stringify([...trackCls].sort())};\n` +
    `window.__AF_PILLC=${JSON.stringify([...pillCls].sort())};\n` +
    `window.__AF_MMC=${JSON.stringify(mmcRules)};\n` +
    `window.__AF_FIXSEL=${JSON.stringify([...fixSel].sort())};\n` +
    `window.__AF_XFC=${JSON.stringify(xfcRules)};\n`);

  const SHIMS = [
    "js/log.js",                     // FFLog — shim'lar diagnostikasi
    "js/bytes.js",                   // FFBytes — TextDecoder/Encoder o'rnini bosadi
    "ported/gap-text-classes.js",    // __AF_GAPC — gap konteynerlari (generatsiya)
    "js/ae-shim/gap-text.js",        // yalang'och matnni <span> ga o'raydi
    "js/ae-shim/autofill.js",        // auto-fill grid ustun enini o'lchaydi
    "js/ae-shim/node-io.js",         // http/https → fetch, fs oqim, os.tmpdir (require-shim'dan OLDIN)
    "js/ae-shim/require-shim.js",    // __ffRequire (fs/os/path bor, qolganiga halol xato)
    "js/ae-shim/cep-fs.js",          // window.cep.fs picker/readFile (FAQAT UXP; picker async)
    "js/ae-shim/uxp-indexeddb.js",   // indexedDB o'rni (FAQAT UXP; disk backend zaxirasi)
    "js/ae-shim/element-fix.js",     // createElement('button'), DOMParser, animate
    "js/ae-shim/button-box.js",      // tugma tarkibini vertikal markazlaydi
    "js/ae-shim/csinterface-shim.js", // evalScript → premierepro API
    "js/ae-shim/inline-events.js",   // onclick="…" delegatsiyasi
    "js/ae-shim/media-fix.js",       // <img>/<video> aniq o'lchami
    "js/ae-shim/pill-radius.js",     // border-radius klampi (UXP o'zi klamplamaydi)
    "js/ae-shim/uxp-mmc.js",         // min()/max()/clamp() ni hisoblaydi (FAQAT UXP)
    "js/ae-shim/xform-center.js",    // translate(-50%) markazlash (zond bilan; FAQAT UXP)
    "js/ae-shim/uxp-input-chrome.js", // <input> native chizmasi (FAQAT UXP ichida)
    "js/ae-shim/uxp-clipboard.js",   // execCommand('copy') o'rni (FAQAT UXP)
    "js/ae-shim/uxp-external-link.js", // "brauzer ochildi" da'vosini halol qiladi
    "js/ae-shim/strip-settle.js",    // pill lentalari: layout tinchigach qayta hisob
    "js/ae-shim/wrap-gap.js",        // o'ralishda qator oxiridagi ortiqcha margin
    "js/ae-shim/uxp-repaint.js",     // modal yopilgach qayta chizish turtkisi (FAQAT UXP)
    "js/ae-shim/uxp-diag.js",        // panel ichidagi xato oynasi (FAQAT UXP + dev)
  ];
  // CMS matn qatlami — generatsiya, `ported/` ichida (TEXT_COPY dan).
  write(path.join(OUT, "host-copy.js"), hostCopyShim());
  SHIMS.push("ported/host-copy.js");

  // Hujjat plagin ILDIZIDA (`panel.html`), `ported/` ichida EMAS.
  // SABAB: UXP nisbiy yo'lni hujjat papkasiga emas, plagin ildiziga nisbatan
  // yechadi. `ported/index.html` da `href="ae.css"` → `/ae.css` (yo'q) bo'lib
  // ketardi va panel Premiere'da BUTUNLAY stilsiz, skriptsiz chiqardi
  // (`../js/…` esa ildizdan tashqariga chiqib yana yiqilardi). Hujjat ildizda
  // bo'lsa ikkala yechim qoidasi ham BIR XIL natija beradi — taxminga bog'liq
  // emasmiz. Shu sabab barcha yo'l ildizdan boshlanadi: `js/…`, `ported/…`.
  // KECH shim'lar — AE skriptlaridan KEYIN. Faqat AE o'zi `window.X=…` bilan
  // e'lon qiladigan global'ni almashtirish uchun (oldin qo'yilsa AE bosib ketadi).
  const LATE_SHIMS = [
    "js/ae-shim/uxp-copy-late.js",   // afCopyText → UXP buferi (FAQAT UXP)
    "js/ae-shim/uxp-account-events.js", // login/Google → native UXP click (inline onclick emas)
    "js/ae-shim/uxp-import-events.js", // detail Import → native UXP async click
    "js/ae-shim/uxp-native-events.js", // barcha inline UI amallari → element native listener
  ];

  // Premiere 26 UXP throws blank host-side exceptions while these legacy
  // layout scanners walk the live catalog DOM. The ported CSS already has
  // deterministic flex fallbacks, so keep the scanners out of production.
  // `uxp-diag` ham foydalanuvchi panelini qoplaydigan dev strip — release/dev
  // o'rnatmada mahsulot UI'siga aralashmaydi; loglar FFLog orqali qoladi.
  const HOST_UNSAFE_LAYOUT_SHIMS = new Set([
    "js/ae-shim/gap-text.js",
    "js/ae-shim/autofill.js",
    "js/ae-shim/button-box.js",
    "js/ae-shim/media-fix.js",
    "js/ae-shim/pill-radius.js",
    "js/ae-shim/uxp-mmc.js",
    "js/ae-shim/xform-center.js",
    "js/ae-shim/uxp-diag.js",
  ]);
  const tagPaths = [
    ...SHIMS.filter((p) => !HOST_UNSAFE_LAYOUT_SHIMS.has(p)),
    ...order.filter((p) => p !== "js/ae-shim/csinterface-shim.js"),
    ...LATE_SHIMS,
  ];
  const tags = tagPaths
    .map((p) => `    <script src="${p.startsWith("ae-src/") ? "ported/" + p : p}"></script>`)
    .join("\n");

  // Eski (stilsiz) kirish nuqtasi qolib ketmasin — `manifest.main` endi ildizda.
  fs.rmSync(path.join(OUT, "index.html"), { force: true });

  write(path.join(UXP, "panel.html"),
    // DOCTYPE SHART: usiz brauzer QUIRKS rejimida yuradi va u yerda "faqat inline
    // element bo'lgan" qator qutisi strut'siz o'lchanadi — `.ct-tx` AE'dagi
    // 15.5px o'rniga 13.2px bo'lib qolgandi (o'lchovda 6 ta karta bo'yicha).
    `<!DOCTYPE html>\n` +
    `<!-- Generatsiya: scripts/ae-port.mjs — QO'LDA TAHRIRLAMA.\n` +
    `     Manba: plugins/after-effects-cep/AssetFlow_Plugin.html -->\n` +
    // `cep-mode` — AE'da "panel butun oynani to'ldiradi, soxta AE saxnasi yashirin"
    // rejimi. UXP paneli aynan shunday; AE'ning IS_CEP aniqlovchisiga tayanmaymiz.
    `<html data-theme="noir" class="cep-mode">\n  <head>\n    <meta charset="utf-8" />\n` +
    `    <title>FrameFlow</title>\n` +
    // Boot fon: `ae.css` yuklanguncha oq yaltirash bo'lmasin. Ayni paytda bu —
    // diagnostika: panel qora, lekin tartibsiz chiqsa, tashqi CSS yiqilgan.
    `    <style>html,body{margin:0;background:#0b0b0c;color:#e8e8ea}</style>\n` +
    `    <link rel="stylesheet" href="ported/ae.css" />\n  </head>\n` +
    `  <body>\n${body}\n${tags}\n  </body>\n</html>\n`);

  write(path.join(OUT, "script-order.json"), JSON.stringify({
    generated: "scripts/ae-port.mjs", shims: SHIMS, lateShims: LATE_SHIMS, order,
  }, null, 2));

  // ── 7. Hisobot ────────────────────────────────────────────────────────
  const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + " KB";
  console.log("AE → UXP port");
  console.log(`  CSS qoidalari      : ${stats.cssRules} (${kb(path.join(OUT, "ae.css"))})`);
  console.log(`    grid → flex      : ${stats.gridRules}`);
  console.log(`    gap → margin     : ${stats.gapRules} (block bekor: ${stats.gapOverrides}, muallif yig'indi: ${stats.gapSums})`);
  console.log(`    auto-fill grid   : ${autoFillCls.size} klass (ustun eni runtime'da o'lchanadi)` +
    (noPadCompCls.size ? `, ${noPadCompCls.size} tasi padding'siz (qator oxiri margin'i shim'da olinadi)` : ""));
  console.log(`    gap matn konteyner: ${gapTextCls.size} klass + ${gapTextSel.size} selektor (yalang'och matn <span> ga o'raladi)`);
  console.log(`    psevdo gap       : ${stats.pseudoGap} (::before/::after flex bolasi)`);
  console.log(`    gap ustunligi    : ${stats.gapSpec} qoida kuchaytirildi (keyingi \`margin\` yuvib ketmasin)`);
  console.log(`    gap tomoni almashdi: ${stats.gapSideSwap} konteyner (ichida \`margin-left:auto\` bor)`);
  console.log(`    eski gap tomoni  : ${stats.gapStale} qoida nolga qaytarildi (naqsh o'zgargan konteyner)`);
  console.log(`    oxirgi qator gap : ${rowLeakCls.size} klass runtime'da tozalanadi` +
    (stats.rowLeakWeak ? ` (${stats.rowLeakWeak} klasssiz — qoplanmadi)` : ""));
  console.log(`    grid-column      : ${stats.gridColumn}` +
    (stats.selWeak ? ` (${stats.selWeak} selektor kuchaytirilmadi — klasssiz)` : ""));
  console.log(`    animatsiya opacity: ${stats.animOpacity}`);
  console.log(`    backdrop-filter  : ${stats.backdrop} olib tashlandi`);
  console.log(`    qo'shilgan qoida : ${stats.emitted}`);
  console.log(`  <button> → <div>   : ${stats.buttons} (markup) + ${stats.jsButtons} (JS shablon) + ${stats.buttonSel} (CSS selektor)`);
  console.log(`  :disabled → [disabled]: ${stats.disabledSel} selektor`);
  console.log(`  require() → shim   : ${stats.jsRequire}`);
  console.log(`  host atamasi (AE→PR): ${stats.copy}`);
  console.log(`  inline hodisa      : ${stats.inlineHandlers} (delegatsiya bilan bajariladi)`);
  console.log(`  qisqartma → longhand: ${stats.shorthand} (background/border — UXP qisqartmani tashlaydi)`);
  console.log(`  SVG atribut merosi : ${stats.svgAttrs} (ildiz fill/stroke → bolalarga)`);
  console.log(`  .style.background  : ${stats.styleBg} → backgroundColor (gradientlarga tegilmadi)`);
  console.log(`  inline skript      : ${inlineFiles.length} fayl`);
  console.log(`  AE tashqi JS       : ${copied} fayl · shrift: ${fonts}`);
  console.log(`  → ${path.relative(process.cwd(), OUT)}`);
}

main();
