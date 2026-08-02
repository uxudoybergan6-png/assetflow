/*
 * FAZA 0 spike — Premiere Pro UXP imkoniyatlarini EMPIRIK tekshiradi.
 * Har probe: OK / FAIL / SKIP + tafsilot. Natija markdown hisobot sifatida
 * plugin-data:/spike-report.md ga yoziladi (Save report) va panelda ko'rinadi.
 *
 * Bu fayl mahsulot kodi EMAS — faqat razvedka. Natijalari
 * docs/PREMIERE-UXP-SPIKE-NATIJA.md ga ko'chiriladi.
 */
"use strict";

var uxp = require("uxp");
var fsmod = null;
try { fsmod = require("fs"); } catch (e) { fsmod = null; }
var ppro = null;
var pproError = null;
try { ppro = require("premierepro"); } catch (e) { pproError = String(e && e.message || e); }

var API_BASE = "https://api.getframeflow.app";
var SAMPLE_MP4 = "https://cdn.getframeflow.app/templates/cmrl3rf1r0018s601jepn9bmn/preview.mp4";
var SAMPLE_JPG = "https://cdn.getframeflow.app/templates/cmrl3rf1r0018s601jepn9bmn/thumb.jpg";

var results = [];
var listEl, outEl, statusEl;

/* ---------- probe infratuzilmasi ---------- */

function log() {
  var s = Array.prototype.slice.call(arguments).join(" ");
  if (outEl) { outEl.value += s + "\n"; outEl.scrollTop = outEl.scrollHeight; }
  console.log("[spike]", s);
}

function render() {
  if (!listEl) return;
  listEl.innerHTML = "";
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var row = document.createElement("div");
    row.className = "probe";
    var top = document.createElement("div");
    top.className = "top";
    var b = document.createElement("span");
    b.className = "badge " + (r.status === "OK" ? "ok" : r.status === "FAIL" ? "fail" : r.status === "SKIP" ? "skip" : "run");
    b.textContent = r.status;
    var n = document.createElement("span");
    n.className = "nm";
    n.textContent = r.name;
    top.appendChild(b); top.appendChild(n);
    row.appendChild(top);
    if (r.detail) {
      var d = document.createElement("div");
      d.className = "det";
      d.textContent = String(r.detail).slice(0, 600);
      row.appendChild(d);
    }
    listEl.appendChild(row);
  }
}

function short(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}

/** Bitta probe ishga tushiradi va natijani ro'yxatga yozadi. */
async function probe(group, name, fn) {
  var rec = { group: group, name: name, status: "RUN", detail: "" };
  results.push(rec); render();
  var t0 = Date.now();
  try {
    var out = await fn();
    if (out && out.skip) { rec.status = "SKIP"; rec.detail = out.skip; }
    else { rec.status = "OK"; rec.detail = (out && out.detail) || (typeof out === "string" ? out : ""); }
  } catch (e) {
    rec.status = "FAIL";
    rec.detail = String((e && (e.message || e.description)) || e);
  }
  rec.ms = Date.now() - t0;
  render();
  log(rec.status + " · " + name + (rec.detail ? " · " + String(rec.detail).slice(0, 200) : ""));
  return rec;
}

/* ---------- yordamchilar ---------- */

/** Obyektdagi (va prototipidagi) funksiya nomlari ro'yxati. */
function methodNames(obj) {
  var seen = {}, out = [];
  var o = obj;
  var depth = 0;
  while (o && o !== Object.prototype && depth < 4) {
    Object.getOwnPropertyNames(o).forEach(function (k) {
      if (k === "constructor" || seen[k]) return;
      seen[k] = 1;
      try { if (typeof obj[k] === "function") out.push(k); } catch (e) { /* getter otishi mumkin */ }
    });
    o = Object.getPrototypeOf(o);
    depth++;
  }
  return out.sort();
}

/** Har qanday binar chunk'ni Uint8Array'ga keltiradi (UXP chunk turi barqaror emas). */
function toU8(v) {
  if (!v) return new Uint8Array(0);
  if (v instanceof Uint8Array) return v;
  if (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v.buffer) return new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength);
  if (typeof v.length === "number") return Uint8Array.from(v);
  return new Uint8Array(0);
}

function hex2(n) {
  return ("0" + Number(n).toString(16)).slice(-2).toUpperCase();
}

/** TextDecoder yo'q — UTF-8 ni qo'lda dekodlaymiz (secureStorage/binar o'qish uchun kerak). */
function utf8Decode(u8) {
  var s = "", i = 0;
  while (i < u8.length) {
    var c = u8[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (u8[i++] & 0x3f));
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f));
    else {
      var cp = ((c & 0x07) << 18) | ((u8[i++] & 0x3f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f);
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return s;
}

/** plugin-temp:/ffspike papkasini idempotent qaytaradi (mavjud bo'lsa xato bermaydi). */
async function ensureTmpDir() {
  var lfs = uxp.storage.localFileSystem;
  try {
    return await lfs.getEntryWithUrl("plugin-temp:/ffspike");
  } catch (e) {
    return await lfs.createEntryWithUrl("plugin-temp:/ffspike", { type: uxp.storage.types.folder });
  }
}

/** CSS xossasi UXP tomonidan qabul qilinadimi — inline set/read-back bilan. */
function cssSupported(prop, value) {
  var el = document.createElement("div");
  try { el.style[prop] = value; } catch (e) { return false; }
  var got = el.style[prop];
  return !!got && String(got).length > 0;
}

var testState = { project: null, sequence: null, tmpDir: null, mogrtPath: null };

/* ---------- probe to'plamlari ---------- */

async function probeEnvironment() {
  await probe("env", "require('premierepro')", async function () {
    if (!ppro) throw new Error(pproError || "modul yo'q");
    return { detail: "top-level kalitlar: " + Object.keys(ppro).length };
  });

  await probe("env", "Host versiya / UXP versiya", async function () {
    var v = {};
    try { v.uxp = uxp.versions && JSON.parse(JSON.stringify(uxp.versions)); } catch (e) { v.uxp = "?"; }
    try {
      var app = await ppro.Application;
      v.appKeys = app ? Object.keys(app).slice(0, 10) : null;
    } catch (e) { /* ignore */ }
    try {
      if (ppro && ppro.Application && ppro.Application.getVersion) v.pproVersion = await ppro.Application.getVersion();
    } catch (e) { v.pproVersionErr = String(e.message || e); }
    return { detail: short(v) };
  });

  await probe("env", "premierepro eksportlari (API yuzasi)", async function () {
    if (!ppro) return { skip: "premierepro yo'q" };
    return { detail: Object.keys(ppro).sort().join(", ") };
  });

  await probe("env", "Node modullari YO'Qligini tasdiqlash", async function () {
    var got = [];
    ["child_process", "zlib", "http", "https", "crypto", "buffer", "stream"].forEach(function (m) {
      try { require(m); got.push(m); } catch (e) { /* kutilgan */ }
    });
    return { detail: got.length ? "KUTILMAGAN: mavjud → " + got.join(", ") : "hech biri yo'q (kutilgani)" };
  });

  await probe("env", "fs / os / path modullari", async function () {
    var have = [];
    ["fs", "os", "path"].forEach(function (m) {
      try { require(m); have.push(m); } catch (e) { /* yo'q */ }
    });
    return { detail: "mavjud: " + (have.join(", ") || "hech biri") };
  });

  await probe("env", "Global'lar (fetch/WebSocket/IntersectionObserver/FormData...)", async function () {
    var names = ["fetch", "WebSocket", "IntersectionObserver", "FormData", "Blob", "URL",
      "URLSearchParams", "TextDecoder", "TextEncoder", "AbortController", "crypto",
      "localStorage", "requestAnimationFrame", "ResizeObserver", "MutationObserver", "structuredClone"];
    var have = [], miss = [];
    names.forEach(function (n) {
      var g = (typeof globalThis !== "undefined" ? globalThis : window);
      (typeof g[n] !== "undefined" ? have : miss).push(n);
    });
    return { detail: "BOR: " + have.join(", ") + "\nYO'Q: " + (miss.join(", ") || "—") };
  });
}

async function probeCss() {
  var checks = [
    ["display", "grid"], ["display", "flex"], ["gap", "8px"], ["rowGap", "8px"],
    ["transform", "translateX(4px)"], ["transition", "all .2s"], ["animation", "x 1s"],
    ["boxShadow", "0 2px 8px #000"], ["zIndex", "5"], ["lineHeight", "1.4"],
    ["objectFit", "cover"], ["aspectRatio", "16 / 9"], ["position", "fixed"],
    ["position", "sticky"], ["position", "absolute"], ["position", "relative"],
    ["backgroundImage", "linear-gradient(90deg,#000,#fff)"], ["opacity", "0.5"],
    ["borderRadius", "6px"], ["overflow", "hidden"], ["textOverflow", "ellipsis"],
    ["whiteSpace", "nowrap"], ["flexWrap", "wrap"], ["cursor", "pointer"],
    ["outline", "1px solid #fff"], ["filter", "blur(2px)"], ["backdropFilter", "blur(2px)"],
    ["minWidth", "0"], ["maxHeight", "10px"], ["letterSpacing", "1px"]
  ];
  await probe("css", "CSS xossalari qabul qilinishi (inline read-back)", async function () {
    var yes = [], no = [];
    checks.forEach(function (c) {
      (cssSupported(c[0], c[1]) ? yes : no).push(c[0] + ":" + c[1]);
    });
    return { detail: "QABUL: " + yes.join(" | ") + "\nRAD: " + (no.join(" | ") || "—") };
  });

  // Inline read-back faqat PARSER qabul qilishini isbotlaydi. Haqiqiy savol —
  // layout dvigateli qo'llaydimi? Uni bolalar koordinatasini o'lchab tekshiramiz.
  await probe("css", "LAYOUT haqiqati: grid vs flex vs gap (o'lchangan)", async function () {
    // offsetLeft/offsetTop UXP'da har doim 0 — getBoundingClientRect ishlatamiz.
    // MUHIM: UXP appendChild'dan keyin darhol layout qilmaydi — rAF kutish shart.
    function nextFrame() {
      return new Promise(function (res) {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { res(); });
        else setTimeout(res, 32);
      });
    }
    async function measure(css) {
      var host = document.createElement("div");
      host.setAttribute("style", "width:300px;height:200px;" + css);
      for (var i = 0; i < 4; i++) {
        var kid = document.createElement("div");
        kid.setAttribute("style", "width:100px;height:40px;background:#333;");
        host.appendChild(kid);
      }
      document.body.appendChild(host);
      await nextFrame();
      await nextFrame();
      var k = host.children;
      var base = host.getBoundingClientRect ? host.getBoundingClientRect() : { left: 0, top: 0 };
      var pos = [];
      for (var j = 0; j < k.length; j++) {
        var r = k[j].getBoundingClientRect ? k[j].getBoundingClientRect() : null;
        pos.push(r ? Math.round(r.left - base.left) + "," + Math.round(r.top - base.top) : "rect yo'q");
      }
      document.body.removeChild(host);
      return pos.join(" | ");
    }
    // 300px kenglikda 100px'lik 4 bola: grid(2 ustun) → 2 qator; flex-wrap → 3+1; blok → 4 qator.
    var block = await measure("display:block;");
    var grid = await measure("display:grid;grid-template-columns:1fr 1fr;");
    var gridGap = await measure("display:grid;grid-template-columns:1fr 1fr;gap:20px;");
    var flexWrap = await measure("display:flex;flex-direction:row;flex-wrap:wrap;");
    var flexGap = await measure("display:flex;flex-direction:row;flex-wrap:wrap;gap:20px;");
    var laidOut = block !== "0,0 | 0,0 | 0,0 | 0,0";
    var gridWorks = laidOut && grid !== block && grid !== flexWrap;
    var gapWorks = laidOut && flexGap !== flexWrap;
    return {
      detail:
        (laidOut ? "" : "⚠️ layout umuman o'lchanmadi (hammasi 0,0)\n") +
        "block=" + block + "\ngrid(2col)=" + grid + "\ngrid+gap20=" + gridGap +
        "\nflex-wrap=" + flexWrap + "\nflex+gap20=" + flexGap +
        "\n→ grid layout " + (gridWorks ? "ISHLAYDI" : "flex bilan bir xil (ishlamaydi)") +
        " · gap " + (gapWorks ? "ISHLAYDI" : "ta'sir qilmaydi"),
    };
  });

  await probe("css", "calc() va CSS o'zgaruvchilari", async function () {
    var el = document.createElement("div");
    el.style.width = "calc(50% - 6px)";
    var w = el.style.width;
    var st = document.createElement("style");
    st.textContent = ":root { --ff-probe: #c8f24c; } .ff-probe-el { color: var(--ff-probe); }";
    document.head.appendChild(st);
    var p = document.createElement("div");
    p.className = "ff-probe-el";
    document.body.appendChild(p);
    var col = "";
    try { col = window.getComputedStyle(p).color; } catch (e) { col = "getComputedStyle xato: " + e.message; }
    document.body.removeChild(p);
    return { detail: "calc → " + short(w) + " · var() computed color → " + short(col) };
  });

  await probe("css", "::before / :hover / :nth-child selektorlari", async function () {
    var st = document.createElement("style");
    st.textContent = ".ff-pb::before{content:'x';} .ff-pb:hover{color:#f00;} .ff-pb:nth-child(1){color:#0f0;}";
    document.head.appendChild(st);
    var p = document.createElement("div");
    p.className = "ff-pb";
    document.body.appendChild(p);
    var col = "";
    try { col = window.getComputedStyle(p).color; } catch (e) { col = "?"; }
    document.body.removeChild(p);
    return { detail: "nth-child qo'llandi → color=" + short(col) + " (yashil bo'lsa selektor ishlaydi)" };
  });

  await probe("css", "@font-face (woff2 remote)", async function () {
    var st = document.createElement("style");
    st.textContent = "@font-face{font-family:'FFProbe';src:url('" +
      "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" +
      "') format('woff2');}";
    document.head.appendChild(st);
    var el = document.createElement("span");
    el.style.fontFamily = "'FFProbe', monospace";
    el.textContent = "probe";
    document.body.appendChild(el);
    await new Promise(function (r) { setTimeout(r, 1200); });
    var fam = "";
    try { fam = window.getComputedStyle(el).fontFamily; } catch (e) { fam = "?"; }
    var w = el.offsetWidth;
    document.body.removeChild(el);
    return { detail: "computed font-family=" + short(fam) + " offsetWidth=" + w + " (xato konsolda yo'q bo'lsa yuklangan)" };
  });

  await probe("css", "Panel o'lchami va tema", async function () {
    var t = "?";
    try { t = document.theme && document.theme.getCurrent ? document.theme.getCurrent() : "document.theme yo'q"; } catch (e) { t = "xato: " + e.message; }
    var hasListener = !!(document.theme && document.theme.onUpdated && document.theme.onUpdated.addListener);
    return {
      detail: "theme=" + short(t) + " onUpdated=" + hasListener +
        " · window " + window.innerWidth + "x" + window.innerHeight +
        " · body " + document.body.clientWidth + "x" + document.body.clientHeight
    };
  });
}

/* ---------- PARITY: AE CEP panelini UXP'ga 1:1 ko'chirish mumkinmi ---------- */
/*
 * AE plagini (AssetFlow_Plugin.html) = 18k qator HTML + 3.8k qator inline CSS +
 * 285 inline <svg> + 64 `display:grid` + 406 `gap:` + butunlay inline `onclick`.
 * "1:1 bir xil" talabi shu bloklarning UXP'da HAQIQATAN chizilishiga bog'liq.
 * Quyidagi probe'lar har birini alohida o'lchaydi — taxmin qilinmaydi.
 */

function nextFrame2() {
  return new Promise(function (res) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { res(); });
    else setTimeout(res, 32);
  });
}

/** Elementni body'ga qo'yib, 2×rAF dan keyin o'lchaydi va olib tashlaydi. */
async function withMounted(html, fn) {
  var host = document.createElement("div");
  host.setAttribute("style", "position:relative;width:300px;height:200px;");
  host.innerHTML = html;
  document.body.appendChild(host);
  await nextFrame2();
  await nextFrame2();
  var out;
  try { out = await fn(host); } finally { document.body.removeChild(host); }
  return out;
}

function rectOf(el) {
  if (!el || !el.getBoundingClientRect) return null;
  var r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) };
}

function rectStr(el) {
  var r = rectOf(el);
  return r ? r.w + "x" + r.h : "rect yo'q";
}

async function probeParity() {
  // ── P1. Inline SVG — AE ikonalarining 100% i shu ── */
  await probe("parity", "Inline <svg> (innerHTML) chiziladimi", async function () {
    var svg = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#c8f24c" ' +
      'stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="10" y1="5" x2="10" y2="19"/></svg>';
    return await withMounted('<div id="p1a">' + svg + '</div>', async function (host) {
      var s = host.querySelector("svg");
      var kids = s ? s.children.length : -1;
      var tag = s ? String(s.tagName) : "yo'q";
      var ns = s ? String(s.namespaceURI || "—") : "—";
      return {
        detail: "querySelector('svg') → " + tag + " · bolalar=" + kids + " · ns=" + ns +
          " · rect=" + (s ? rectStr(s) : "—") +
          "\n→ SVG " + (s && rectOf(s) && rectOf(s).w > 0 ? "O'LCHAMLI (chizilgan bo'lishi mumkin)" : "0 o'lchamli — IKONALAR KO'RINMAYDI"),
      };
    });
  });

  // createElementNS bilan qurilgan SVG innerHTML'dan farq qilishi mumkin.
  await probe("parity", "createElementNS bilan SVG", async function () {
    var el = null, err = "";
    try {
      el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.setAttribute("width", "24"); el.setAttribute("height", "24");
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M4 4 L20 20"); p.setAttribute("stroke", "#fff");
      el.appendChild(p);
      document.body.appendChild(el);
      await nextFrame2(); await nextFrame2();
    } catch (e) { err = String(e && e.message || e); }
    var r = el ? rectStr(el) : "—";
    if (el && el.parentNode) el.parentNode.removeChild(el);
    return { detail: "createElementNS " + (err ? "XATO: " + err : "OK") + " · rect=" + r };
  });

  // ── P2. Inline onclick — AE'da barcha tugmalar shunday ── */
  await probe("parity", "Inline onclick=\"…\" atributi ishlaydimi", async function () {
    window.__ffP2 = 0;
    return await withMounted('<div id="p2" onclick="window.__ffP2=1">bos</div>', async function (host) {
      var el = host.querySelector("#p2");
      var attr = el ? el.getAttribute("onclick") : null;
      var propType = el ? typeof el.onclick : "—";
      var fired = false;
      try {
        if (el && el.click) el.click();
        else if (el) el.dispatchEvent(new Event("click", { bubbles: true }));
        fired = window.__ffP2 === 1;
      } catch (e) { /* dispatch qo'llab-quvvatlanmasligi mumkin */ }
      return {
        detail: "atribut=" + short(attr) + " · el.onclick turi=" + propType + " · click() dan keyin bajarildi=" + fired +
          "\n→ " + (fired ? "inline onclick ISHLAYDI" : "inline onclick ISHLAMAYDI — shim kerak (attr → addEventListener)"),
      };
    });
  });

  // Shim'ning o'zi mumkinmi: onclick matnini funksiyaga aylantirish.
  await probe("parity", "new Function / eval (onclick shim uchun)", async function () {
    var nf = "yo'q", ev = "yo'q";
    try { nf = new Function("return 1+1")() === 2 ? "ISHLAYDI" : "g'alati natija"; }
    catch (e) { nf = "XATO: " + String(e && e.message || e); }
    try { ev = eval("1+1") === 2 ? "ISHLAYDI" : "g'alati natija"; }
    catch (e) { ev = "XATO: " + String(e && e.message || e); }
    return { detail: "new Function → " + nf + " · eval → " + ev };
  });

  // ── P3. Murakkab innerHTML parse fidelity ── */
  await probe("parity", "innerHTML murakkab markup parse qiladimi", async function () {
    var html = '<div class="a" data-x="1"><span class="b">t</span>' +
      '<button type="button" class="c" title="x">B</button>' +
      '<input type="text" value="v"/><select><option>1</option></select>' +
      '<input type="checkbox"/><input type="range" min="0" max="10"/>' +
      '<a href="#">l</a><img src="" alt=""/><video></video></div>';
    return await withMounted(html, async function (host) {
      var got = [];
      ["div.a", "span.b", "button.c", "input[type=text]", "select", "input[type=checkbox]",
        "input[type=range]", "a", "img", "video"].forEach(function (sel) {
        var e = null;
        try { e = host.querySelector(sel); } catch (er) { got.push(sel + "=SELEKTOR XATO"); return; }
        got.push(sel + "=" + (e ? "bor(" + rectStr(e) + ")" : "YO'Q"));
      });
      var dx = host.querySelector(".a") ? host.querySelector(".a").getAttribute("data-x") : null;
      return { detail: got.join(" · ") + "\ndata-x=" + short(dx) };
    });
  });

  // ── P4. Murakkab CSS selektorlar (AE varag'i ularga to'la) ── */
  await probe("parity", "Selektorlar: > + ~ [attr] :not() :first-child", async function () {
    var st = document.createElement("style");
    st.textContent =
      ".pz > .k { width: 11px; }" +
      ".pz .k + .k { width: 22px; }" +
      '.pz [data-q="1"] { height: 33px; }' +
      ".pz .k:not(.skip) { border-left-width: 4px; }" +
      ".pz .k:first-child { border-top-width: 5px; }" +
      ".pz .k:last-child { border-bottom-width: 6px; }";
    document.head.appendChild(st);
    var out = await withMounted(
      '<div class="pz"><div class="k">1</div><div class="k" data-q="1">2</div><div class="k skip">3</div></div>',
      async function (host) {
        var ks = host.querySelectorAll(".k");
        var res = [];
        for (var i = 0; i < ks.length; i++) {
          var cs = window.getComputedStyle(ks[i]);
          res.push("#" + (i + 1) + " w=" + cs.width + " h=" + cs.height +
            " bl=" + cs.borderLeftWidth + " bt=" + cs.borderTopWidth + " bb=" + cs.borderBottomWidth);
        }
        return { detail: res.join("\n") };
      }
    );
    document.head.removeChild(st);
    return out;
  });

  // ── P5. Matn kesish: ellipsis va line-clamp ── */
  await probe("parity", "text-overflow:ellipsis va -webkit-line-clamp", async function () {
    var long = "Juda uzun sarlavha matni bu yerda davom etadi va albatta sig'maydi";
    return await withMounted(
      '<div style="width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" id="e1">' + long + '</div>' +
      '<div style="width:120px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;" id="e2">' + long + '</div>',
      async function (host) {
        var e1 = host.querySelector("#e1"), e2 = host.querySelector("#e2");
        var r1 = rectOf(e1), r2 = rectOf(e2);
        return {
          detail: "ellipsis: rect=" + (r1 ? r1.w + "x" + r1.h : "?") + " scrollW=" + (e1 && e1.scrollWidth) +
            " (h ≈ 1 qator bo'lsa kesildi)\nline-clamp: rect=" + (r2 ? r2.w + "x" + r2.h : "?") +
            " (h ≈ 2 qator bo'lsa ishladi)",
        };
      }
    );
  });

  // ── P6. Joylashuv: absolute / fixed / sticky HAQIQATAN qo'llanadimi ── */
  await probe("parity", "position absolute / fixed / sticky (o'lchangan)", async function () {
    return await withMounted(
      '<div id="pa" style="position:absolute;left:40px;top:24px;width:20px;height:20px;"></div>' +
      '<div id="pf" style="position:fixed;left:8px;top:8px;width:20px;height:20px;"></div>' +
      '<div id="pr" style="position:relative;left:12px;width:20px;height:20px;"></div>',
      async function (host) {
        var base = host.getBoundingClientRect();
        function rel(id) {
          var e = host.querySelector(id);
          var r = e && e.getBoundingClientRect ? e.getBoundingClientRect() : null;
          return r ? Math.round(r.left - base.left) + "," + Math.round(r.top - base.top) : "?";
        }
        var f = host.querySelector("#pf").getBoundingClientRect();
        return {
          detail: "absolute(40,24) → " + rel("#pa") +
            " · relative(left12) → " + rel("#pr") +
            " · fixed viewport(8,8) → " + Math.round(f.left) + "," + Math.round(f.top),
        };
      }
    );
  });

  // ── P7. Scroll konteyner ── */
  await probe("parity", "overflow-y:auto scroll (scrollTop/scrollHeight)", async function () {
    var kids = "";
    for (var i = 0; i < 30; i++) kids += '<div style="height:20px;">' + i + "</div>";
    return await withMounted('<div id="sc" style="height:100px;overflow-y:auto;">' + kids + "</div>",
      async function (host) {
        var sc = host.querySelector("#sc");
        var before = sc.scrollHeight;
        sc.scrollTop = 200;
        await nextFrame2();
        return {
          detail: "clientH=" + sc.clientHeight + " scrollH=" + before +
            " · scrollTop=200 yozgandan keyin → " + sc.scrollTop +
            "\n→ " + (sc.scrollTop > 0 ? "scroll ISHLAYDI" : "scrollTop qo'llanmadi"),
        };
      });
  });

  // ── P8. ::before/::after quti egallaydimi (AE'da nishon/nuqtalar shunday) ── */
  await probe("parity", "::before content quti egallaydimi", async function () {
    var st = document.createElement("style");
    st.textContent = '.pb2::before{content:"";display:block;width:30px;height:12px;background:#c8f24c;}';
    document.head.appendChild(st);
    var out = await withMounted('<div class="pb2" style="width:100px;"></div>', async function (host) {
      var e = host.querySelector(".pb2");
      return { detail: "ota rect=" + rectStr(e) + " (h≈12 bo'lsa ::before quti bor)" };
    });
    document.head.removeChild(st);
    return out;
  });

  // ── P9. flex:1 taqsimoti va min-width:0 ── */
  await probe("parity", "flex:1 taqsimot + min-width:0", async function () {
    return await withMounted(
      '<div style="display:flex;flex-direction:row;width:300px;">' +
      '<div id="f1" style="flex:1;height:10px;"></div>' +
      '<div id="f2" style="flex:2;height:10px;"></div>' +
      '<div id="f3" style="width:60px;height:10px;flex-shrink:0;"></div></div>',
      async function (host) {
        return {
          detail: "flex1=" + rectStr(host.querySelector("#f1")) +
            " flex2=" + rectStr(host.querySelector("#f2")) +
            " fixed60=" + rectStr(host.querySelector("#f3")) +
            "\n→ kutilgan 80 / 160 / 60",
        };
      });
  });

  // ── P10. Tema: ish vaqtida :root o'zgaruvchini almashtirish ── */
  await probe("parity", "runtime CSS var almashtirish (tema)", async function () {
    var st = document.createElement("style");
    st.textContent = ":root{--ff-t:#111111}.pt1{color:var(--ff-t)}";
    document.head.appendChild(st);
    var out = await withMounted('<div class="pt1"></div>', async function (host) {
      var e = host.querySelector(".pt1");
      var a = window.getComputedStyle(e).color;
      document.documentElement.style.setProperty("--ff-t", "#c8f24c");
      await nextFrame2();
      var b = window.getComputedStyle(e).color;
      document.documentElement.style.removeProperty("--ff-t");
      return { detail: "avval=" + a + " → keyin=" + b + " · " + (a !== b ? "ALMASHDI" : "o'zgarmadi") };
    });
    document.head.removeChild(st);
    return out;
  });

  // ── P11. @media so'rovlari (AE tor panel uchun ishlatadi) ── */
  await probe("parity", "@media (max-width) qo'llanadimi", async function () {
    var st = document.createElement("style");
    st.textContent = ".pm1{height:10px}@media (max-width:5000px){.pm1{height:44px}}";
    document.head.appendChild(st);
    var out = await withMounted('<div class="pm1" style="width:50px;"></div>', async function (host) {
      var h = window.getComputedStyle(host.querySelector(".pm1")).height;
      return { detail: "height=" + h + " (44px bo'lsa @media ISHLAYDI, 10px bo'lsa yo'q)" };
    });
    document.head.removeChild(st);
    return out;
  });

  // ── P12. Native widget'lar ko'rinishi (AE'da custom stil beriladi) ── */
  await probe("parity", "Native widget stillari (button/input/select/range)", async function () {
    var st = document.createElement("style");
    st.textContent = ".pw button,.pw input,.pw select{background-color:#c8f24c;color:#101010;border:1px solid #f00;border-radius:9px;}";
    document.head.appendChild(st);
    var out = await withMounted(
      '<div class="pw"><button type="button">b</button><input type="text" value="i"/>' +
      '<select><option>o</option></select><input type="range"/><input type="checkbox"/></div>',
      async function (host) {
        var res = [];
        ["button", "input[type=text]", "select", "input[type=range]", "input[type=checkbox]"].forEach(function (sel) {
          var e = host.querySelector(sel);
          if (!e) { res.push(sel + "=YO'Q"); return; }
          var cs = window.getComputedStyle(e);
          res.push(sel + " bg=" + cs.backgroundColor + " color=" + cs.color + " r=" + cs.borderRadius + " " + rectStr(e));
        });
        return { detail: res.join("\n") };
      }
    );
    document.head.removeChild(st);
    return out;
  });

  // ── P13. Animatsiya/o'tish haqiqatan bajariladimi ── */
  await probe("parity", "transition / Element.animate() bajariladimi", async function () {
    var waapi = typeof document.createElement("div").animate === "function";
    return await withMounted('<div id="tr" style="opacity:1;transition:opacity 300ms linear;width:10px;height:10px;"></div>',
      async function (host) {
        var e = host.querySelector("#tr");
        e.style.opacity = "0";
        await new Promise(function (r) { setTimeout(r, 120); });
        var mid = window.getComputedStyle(e).opacity;
        await new Promise(function (r) { setTimeout(r, 350); });
        var end = window.getComputedStyle(e).opacity;
        return {
          detail: "opacity o'rtada=" + mid + " oxirida=" + end +
            " · Element.animate=" + waapi +
            "\n→ o'tish " + (mid !== "0" && mid !== end ? "ANIMATSIYA QILINDI" : "sakrab o'tdi (transition yo'q)"),
        };
      });
  });

  // ── P14. Gradient / soya / filter computed qiymati ── */
  await probe("parity", "gradient / box-shadow / filter / backdrop-filter", async function () {
    var st = document.createElement("style");
    st.textContent = ".pg1{background-image:linear-gradient(135deg,#fff,#a6a6ae);box-shadow:0 28px 80px rgba(0,0,0,.45);" +
      "filter:blur(1px);backdrop-filter:blur(8px);}";
    document.head.appendChild(st);
    var out = await withMounted('<div class="pg1" style="width:40px;height:40px;"></div>', async function (host) {
      var cs = window.getComputedStyle(host.querySelector(".pg1"));
      return {
        detail: "background-image=" + String(cs.backgroundImage).slice(0, 70) +
          "\nbox-shadow=" + String(cs.boxShadow).slice(0, 60) +
          "\nfilter=" + cs.filter + " · backdrop-filter=" + (cs.backdropFilter || cs.webkitBackdropFilter || "—"),
      };
    });
    document.head.removeChild(st);
    return out;
  });

  // ── P15. Mahalliy @font-face (AE shriftlari plagin ichida keladi) ── */
  await probe("parity", "@font-face — mahalliy fayl (plugin papkasidan)", async function () {
    var st = document.createElement("style");
    st.textContent = "@font-face{font-family:'FFLocal';src:url('fonts/probe.woff2') format('woff2');}";
    document.head.appendChild(st);
    var el = document.createElement("span");
    el.setAttribute("style", "font-family:'FFLocal',monospace;font-size:20px;");
    el.textContent = "iiiii";
    document.body.appendChild(el);
    await new Promise(function (r) { setTimeout(r, 800); });
    var fam = "";
    try { fam = window.getComputedStyle(el).fontFamily; } catch (e) { fam = "?"; }
    var w = rectStr(el);
    document.body.removeChild(el);
    document.head.removeChild(st);
    return {
      detail: "computed family=" + short(fam) + " rect=" + w +
        "\n(fayl yo'q — bu probe faqat @font-face url() SINTAKSISI xato bermasligini tekshiradi)",
    };
  });

  // ── P16. Fokus / klaviatura ── */
  await probe("parity", "tabindex fokus + keydown", async function () {
    return await withMounted('<div id="fk" tabindex="0" style="width:40px;height:20px;"></div>', async function (host) {
      var e = host.querySelector("#fk");
      var got = "";
      e.addEventListener("keydown", function (ev) { got = ev.key || "(key yo'q)"; });
      try { e.focus(); } catch (er) { /* ignore */ }
      var active = document.activeElement === e;
      try { e.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }
      catch (er) { try { var ev2 = document.createEvent("Event"); ev2.initEvent("keydown", true, true); ev2.key = "Enter"; e.dispatchEvent(ev2); } catch (e3) { /* ignore */ } }
      return { detail: "focus() → activeElement mos=" + active + " · keydown qabul qilindi=" + short(got) };
    });
  });

  // ── P17. DOM API'lari (AE kodi ularga tayanadi) ── */
  await probe("parity", "DOM API yuzasi (closest/matches/dataset/cloneNode/…)", async function () {
    var d = document.createElement("div");
    var has = [], no = [];
    [["closest", d.closest], ["matches", d.matches], ["cloneNode", d.cloneNode],
    ["insertAdjacentHTML", d.insertAdjacentHTML], ["scrollIntoView", d.scrollIntoView],
    ["animate", d.animate], ["append", d.append], ["remove", d.remove],
    ["replaceChildren", d.replaceChildren], ["getAnimations", d.getAnimations]].forEach(function (p) {
      (typeof p[1] === "function" ? has : no).push(p[0]);
    });
    var extras = [];
    [["dataset", !!d.dataset], ["classList", !!d.classList], ["template", !!document.createElement("template").content],
    ["DOMParser", typeof DOMParser !== "undefined"], ["MutationObserver", typeof MutationObserver !== "undefined"],
    ["ResizeObserver", typeof ResizeObserver !== "undefined"], ["CustomEvent", typeof CustomEvent !== "undefined"],
    ["KeyboardEvent", typeof KeyboardEvent !== "undefined"], ["clipboard", !!(navigator && navigator.clipboard)]]
      .forEach(function (p) { extras.push(p[0] + "=" + p[1]); });
    return { detail: "BOR: " + has.join(", ") + "\nYO'Q: " + (no.join(", ") || "—") + "\n" + extras.join(" · ") };
  });

  // ── P18. Katta DOM yuki (AE sahifasi ~ mingdan ortiq tugun) ── */
  await probe("parity", "Katta DOM: 1200 tugun qo'yish + o'lchash vaqti", async function () {
    var host = document.createElement("div");
    host.setAttribute("style", "display:flex;flex-direction:row;flex-wrap:wrap;width:320px;");
    var t0 = Date.now();
    var html = "";
    for (var i = 0; i < 400; i++) {
      html += '<div style="width:100px;height:60px;margin:0 4px 4px 0;"><span>a</span><span>b</span></div>';
    }
    host.innerHTML = html;
    document.body.appendChild(host);
    var tParse = Date.now() - t0;
    await nextFrame2(); await nextFrame2();
    var t1 = Date.now();
    var last = host.children[host.children.length - 1];
    var r = rectOf(last);
    var tMeasure = Date.now() - t1;
    document.body.removeChild(host);
    return {
      detail: "400 karta (1200 tugun): innerHTML " + tParse + "ms · layout+o'lchash " + tMeasure +
        "ms · oxirgi karta " + (r ? r.l + "," + r.t : "?"),
    };
  });
}

async function probeStorageAndNet() {
  await probe("storage", "localStorage yozish/o'qish", async function () {
    localStorage.setItem("ff.spike", "v1");
    var v = localStorage.getItem("ff.spike");
    return { detail: "o'qildi: " + short(v) };
  });

  await probe("storage", "secureStorage (uxp.storage.secureStorage)", async function () {
    var ss = uxp.storage && uxp.storage.secureStorage;
    if (!ss) return { skip: "secureStorage eksport qilinmagan" };
    await ss.setItem("ff.spike.token", "secret-123");
    var got = await ss.getItem("ff.spike.token");
    var asStr = "";
    try {
      // UXP Uint8Array qaytaradi; TextDecoder yo'q → qo'lda UTF-8 dekod.
      asStr = (got && got.byteLength !== undefined) ? utf8Decode(toU8(got)) : String(got);
    } catch (e) { asStr = "dekod xato: " + e.message; }
    await ss.removeItem("ff.spike.token");
    var ok = asStr === "secret-123";
    if (!ok) throw new Error("qaytgan qiymat mos emas: " + short(asStr));
    return { detail: "tur=" + (got && got.constructor && got.constructor.name) + " · utf8Decode → " + short(asStr) + " ✓" };
  });

  await probe("fs", "plugin-data:/ ga yozish + nativePath", async function () {
    var lfs = uxp.storage.localFileSystem;
    var f = await lfs.createEntryWithUrl("plugin-data:/ff-spike.txt", { overwrite: true });
    await f.write("hello");
    var back = await f.read();
    testState.dataDirNative = f.nativePath.replace(/[/\\][^/\\]+$/, "");
    return { detail: "nativePath=" + f.nativePath + " · o'qildi=" + short(back) };
  });

  await probe("fs", "plugin-temp:/ papka yaratish (idempotent)", async function () {
    var dir = await ensureTmpDir();
    // Ikkinchi chaqiruv ham xato bermasligi kerak — bu FAZA 3 yuklab olish yo'lida majburiy.
    var again = await ensureTmpDir();
    return { detail: "tmp nativePath=" + dir.nativePath + " · qayta chaqiruv=" + (again ? "OK" : "xato") };
  });

  await probe("net", "fetch GET JSON (api.getframeflow.app)", async function () {
    var r = await fetch(API_BASE + "/api/plugin/catalog?limit=1");
    var j = await r.json();
    return { detail: "status=" + r.status + " items=" + (j.items ? j.items.length : "?") };
  });

  await probe("net", "fetch — ruxsat berilmagan domen bloklanishi", async function () {
    try {
      await fetch("https://example.com/");
      return { detail: "KUTILMAGAN: allowlist tashqarisidagi domen ochildi" };
    } catch (e) {
      return { detail: "to'g'ri bloklandi: " + String(e.message || e).slice(0, 120) };
    }
  });

  await probe("net", "Streaming fetch (reader) chunk turi + progress", async function () {
    var r = await fetch(SAMPLE_JPG);
    if (!r.ok) throw new Error("HTTP " + r.status);
    var len = r.headers && r.headers.get ? r.headers.get("content-length") : null;
    if (!r.body || !r.body.getReader) {
      var ab = await r.arrayBuffer();
      return { detail: "response.body/getReader YO'Q — arrayBuffer fallback, " + ab.byteLength + " bayt (content-length=" + len + ")" };
    }
    var reader = r.body.getReader();
    var chunks = [], got = 0, n = 0, kind = "?";
    while (true) {
      var st = await reader.read();
      if (st.done) break;
      var u = toU8(st.value);
      if (n === 0) {
        kind = (st.value && st.value.constructor && st.value.constructor.name) || typeof st.value;
        kind += " (.length=" + (st.value && st.value.length) + " .byteLength=" + (st.value && st.value.byteLength) + ")";
      }
      chunks.push(u); got += u.length; n++;
    }
    testState.streamBytes = got;
    return {
      detail: "chunk=" + n + " · chunk turi=" + kind + " · yig'ilgan=" + got + " bayt · content-length=" + len +
        (len && Number(len) !== got ? "  ⚠️ MOS EMAS" : "  ✓ mos"),
    };
  });

  await probe("net", "Binar yuklab olish → fayl butunligi (magic + o'lcham)", async function () {
    var r = await fetch(SAMPLE_JPG);
    if (!r.ok) throw new Error("HTTP " + r.status);
    var expect = Number(r.headers.get("content-length") || 0);
    var buf = new Uint8Array(await r.arrayBuffer());
    var dir = await ensureTmpDir();
    var f = await dir.createFile("probe.jpg", { overwrite: true });
    await f.write(buf, { format: uxp.storage.formats.binary });
    // Diskdan qaytib o'qib, JPEG magic (FF D8 FF) va o'lchamni tekshiramiz.
    var back = toU8(await f.read({ format: uxp.storage.formats.binary }));
    var magic = [back[0], back[1], back[2]].map(hex2).join(" ");
    var okMagic = back[0] === 0xff && back[1] === 0xd8 && back[2] === 0xff;
    testState.jpgNative = f.nativePath;
    testState.jpgOk = okMagic && back.length === buf.length;
    if (!okMagic) throw new Error("magic noto'g'ri: " + magic + " (yozildi " + buf.length + ", o'qildi " + back.length + ")");
    if (expect && expect !== buf.length) throw new Error("content-length " + expect + " ≠ " + buf.length);
    return { detail: "yozildi=" + buf.length + " o'qildi=" + back.length + " magic=" + magic + " ✓ · " + f.nativePath };
  });

  await probe("net", "FormData multipart POST", async function () {
    if (typeof FormData === "undefined") return { skip: "FormData yo'q → presigned PUT kerak" };
    var fd = new FormData();
    fd.append("probe", "1");
    var r = await fetch(API_BASE + "/api/plugin/catalog?limit=1", { method: "GET" });
    return { detail: "FormData konstruktori bor; jonli multipart endpoint sinovi FAZA 1'da (GET status=" + r.status + ")" };
  });

  await probe("net", "shell.openExternal mavjudligi", async function () {
    var sh = uxp.shell;
    if (!sh || !sh.openExternal) throw new Error("uxp.shell.openExternal yo'q");
    return { detail: "mavjud (haqiqiy ochish sinovi qo'lda — brauzer ochiladi)" };
  });
}

async function probeVideo() {
  await probe("media", "<video> https MP4 metadata + play", async function () {
    var v = document.createElement("video");
    v.setAttribute("src", SAMPLE_MP4);
    v.setAttribute("muted", "");
    v.style.width = "1px"; v.style.height = "1px";
    document.body.appendChild(v);
    var info = await new Promise(function (resolve) {
      var done = false;
      var to = setTimeout(function () { if (!done) { done = true; resolve({ ok: false, why: "10s timeout, readyState=" + v.readyState }); } }, 10000);
      v.addEventListener("loadedmetadata", function () {
        if (done) return; done = true; clearTimeout(to);
        resolve({ ok: true, w: v.videoWidth, h: v.videoHeight, d: v.duration });
      });
      v.addEventListener("error", function () {
        if (done) return; done = true; clearTimeout(to);
        resolve({ ok: false, why: "error event, code=" + (v.error && v.error.code) });
      });
    });
    var played = "?";
    if (info.ok) {
      try { await v.play(); played = "play() OK, currentTime=" + v.currentTime; }
      catch (e) { played = "play() xato: " + (e.message || e); }
    }
    try { v.pause(); } catch (e) { /* ignore */ }
    v.removeAttribute("src");
    document.body.removeChild(v);
    if (!info.ok) throw new Error(info.why);
    return { detail: info.w + "x" + info.h + " dur=" + info.d + " · " + played };
  });

  await probe("media", "<img> remote + lazy/IntersectionObserver", async function () {
    var im = document.createElement("img");
    im.style.width = "1px"; im.style.height = "1px";
    document.body.appendChild(im);
    var ok = await new Promise(function (resolve) {
      var to = setTimeout(function () { resolve(false); }, 8000);
      im.addEventListener("load", function () { clearTimeout(to); resolve(true); });
      im.addEventListener("error", function () { clearTimeout(to); resolve(false); });
      im.src = SAMPLE_JPG;
    });
    var natural = im.naturalWidth + "x" + im.naturalHeight;
    document.body.removeChild(im);
    var io = typeof IntersectionObserver !== "undefined";
    if (!ok) throw new Error("img yuklanmadi");
    return { detail: "yuklandi " + natural + " · IntersectionObserver=" + io };
  });
}

async function probeHostApi() {
  if (!ppro) { await probe("host", "premierepro API", async function () { return { skip: "modul yo'q" }; }); return; }

  await probe("host", "Project.getActiveProject()", async function () {
    var p = await ppro.Project.getActiveProject();
    if (!p) return { skip: "ochiq loyiha yo'q — 'Prepare test project' bosing" };
    testState.project = p;
    return { detail: "name=" + short(p.name) + " path=" + short(p.path) + "\nmetodlar: " + methodNames(p).join(", ") };
  });

  await probe("host", "project.getActiveSequence()", async function () {
    if (!testState.project) return { skip: "loyiha yo'q" };
    var s = await testState.project.getActiveSequence();
    if (!s) return { skip: "faol ketma-ketlik yo'q — 'Prepare test project' bosing" };
    testState.sequence = s;
    return { detail: "name=" + short(s.name) + "\nmetodlar: " + methodNames(s).join(", ") };
  });

  await probe("host", "TickTime factory nomlari", async function () {
    var tt = ppro.TickTime;
    if (!tt) throw new Error("ppro.TickTime yo'q");
    var names = methodNames(tt);
    var made = null, how = "";
    var tries = [
      ["createWithSeconds", 0], ["createWithTicks", 0], ["createWithFrames", 0]
    ];
    for (var i = 0; i < tries.length; i++) {
      if (typeof tt[tries[i][0]] === "function") {
        try { made = tt[tries[i][0]](tries[i][1]); how = tries[i][0]; break; } catch (e) { /* keyingisi */ }
      }
    }
    testState.zeroTime = made;
    return { detail: "static: " + names.join(", ") + "\nTIME_ZERO=" + (tt.TIME_ZERO !== undefined) + " · yaratildi=" + how };
  });

  await probe("host", "SequenceEditor.getEditor()", async function () {
    if (!testState.sequence) return { skip: "ketma-ketlik yo'q" };
    var ed = await ppro.SequenceEditor.getEditor(testState.sequence);
    testState.editor = ed;
    return { detail: "metodlar: " + methodNames(ed).join(", ") };
  });

  await probe("host", "SequenceEditor.getInstalledMogrtPath()", async function () {
    var p = await ppro.SequenceEditor.getInstalledMogrtPath();
    testState.egDir = p;
    var listing = "";
    try {
      var lfs = uxp.storage.localFileSystem;
      var dir = await lfs.getEntryWithUrl("file:" + (p.charAt(0) === "/" ? p : "/" + p));
      var kids = await dir.getEntries();
      var mogrts = kids.filter(function (k) { return /\.mogrt$/i.test(k.name); });
      if (mogrts.length) testState.mogrtPath = mogrts[0].nativePath;
      listing = " · ichida " + kids.length + " element, " + mogrts.length + " ta .mogrt";
    } catch (e) { listing = " · ro'yxat o'qilmadi: " + (e.message || e); }
    return { detail: p + listing };
  });

  // FAZA 3 "Essential Graphics'ga o'rnatish" yo'li: faylni EG papkasiga yozib bo'ladimi?
  await probe("host", "EG papkasiga yozish huquqi (.mogrt o'rnatish yo'li)", async function () {
    if (!testState.egDir) return { skip: "EG papka yo'li yo'q" };
    var lfs = uxp.storage.localFileSystem;
    var p = testState.egDir;
    var dir = await lfs.getEntryWithUrl("file:" + (p.charAt(0) === "/" ? p : "/" + p));
    var f = await dir.createFile("ff-spike-write-test.txt", { overwrite: true });
    await f.write("ok");
    var back = await f.read();
    await f.delete();
    return { detail: "yozildi+o'qildi+o'chirildi (" + short(back) + ") → EG'ga to'g'ridan-to'g'ri o'rnatish MUMKIN · " + p };
  });

  await probe("host", "insertMogrtFromPath() — timeline'ga qo'yish", async function () {
    if (!testState.editor) return { skip: "editor yo'q" };
    if (!testState.mogrtPath) return { skip: "sinov uchun .mogrt topilmadi (EG papkasi bo'sh)" };
    var tt = ppro.TickTime;
    var t = tt.TIME_ZERO !== undefined ? tt.TIME_ZERO : (testState.zeroTime || tt.createWithSeconds(0));
    var res = await testState.editor.insertMogrtFromPath(testState.mogrtPath, t, 0, 0);
    var n = res && res.length !== undefined ? res.length : (res ? 1 : 0);
    return { detail: "qaytdi: " + n + " trackItem · manba=" + testState.mogrtPath };
  });

  // FAZA 3 haqiqiy oqimi: .mogrt EG papkasida EMAS, plugin-temp'ga yuklab olinadi.
  // insertMogrtFromPath ixtiyoriy yo'lni qabul qiladimi — shu yerda tekshiriladi.
  await probe("host", "insertMogrtFromPath(plugin-temp yo'li) — yuklab olingan .mogrt", async function () {
    if (!testState.editor) return { skip: "editor yo'q" };
    if (!testState.mogrtPath) return { skip: "sinov uchun .mogrt topilmadi" };
    var lfs = uxp.storage.localFileSystem;
    var src = await lfs.getEntryWithUrl("file:" + testState.mogrtPath);
    var bytes = toU8(await src.read({ format: uxp.storage.formats.binary }));
    var dir = await ensureTmpDir();
    var dst = await dir.createFile("ff-downloaded.mogrt", { overwrite: true });
    await dst.write(bytes, { format: uxp.storage.formats.binary });
    var tt = ppro.TickTime;
    var t = tt.TIME_ZERO !== undefined ? tt.TIME_ZERO : tt.createWithSeconds(0);
    var res = await testState.editor.insertMogrtFromPath(dst.nativePath, t, 1, 0);
    var n = res && res.length !== undefined ? res.length : (res ? 1 : 0);
    if (!n) throw new Error("qaytdi bo'sh — tashqi yo'ldan mogrt qo'yilmadi (" + dst.nativePath + ")");
    return { detail: "nusxa=" + bytes.length + " bayt · V2 trekka qo'yildi, trackItem=" + n + " · " + dst.nativePath };
  });

  await probe("host", "project.importFiles() — media bin'ga (butun fayl)", async function () {
    if (!testState.project) return { skip: "loyiha yo'q" };
    if (!testState.jpgNative) return { skip: "sinov fayli yo'q (binar probe ishlamadi)" };
    if (!testState.jpgOk) return { skip: "fayl buzuq — import sinovi o'tkazilmadi (modal xato oldini olish)" };
    var root = await testState.project.getRootItem();
    var ok = await testState.project.importFiles([testState.jpgNative], true, root);
    return { detail: "importFiles → " + short(ok) + " · manba=" + testState.jpgNative };
  });

  await probe("host", "Exporter.exportSequenceFrame() — joriy kadr", async function () {
    if (!testState.sequence) return { skip: "ketma-ketlik yo'q" };
    if (!ppro.Exporter || !ppro.Exporter.exportSequenceFrame) throw new Error("Exporter.exportSequenceFrame yo'q");
    var tt = ppro.TickTime;
    var t = tt.TIME_ZERO !== undefined ? tt.TIME_ZERO : tt.createWithSeconds(0);
    var dir = await ensureTmpDir();
    var tried = [];
    // Qaysi konteyner formati qo'llab-quvvatlanadi — empirik aniqlaymiz.
    var names = ["ffspike.jpg", "ffspike.png", "ffspike.tga", "ffspike.dpx", "ffspike.tif", "ffspike.bmp", "ffspike"];
    var found = "";
    // Export ASINXRON: qaytish qiymati true bo'lsa ham fayl bir necha yuz ms keyin paydo bo'ladi.
    async function waitForFile(name, ms) {
      var deadline = Date.now() + ms;
      var last = -1;
      while (Date.now() < deadline) {
        try {
          var f = await dir.getEntry(name);
          var md = await f.getMetadata();
          if (md.size > 0 && md.size === last) return { entry: f, size: md.size };
          last = md.size; // hali yozilyapti — o'lchov barqarorlashguncha kutamiz
        } catch (e) { /* hali yaratilmagan */ }
        await new Promise(function (r) { setTimeout(r, 120); });
      }
      return last > 0 ? { entry: null, size: last } : null;
    }
    for (var i = 0; i < names.length; i++) {
      var verdict;
      try {
        // Eski (oldingi seansdagi) faylni o'chirib, natija toza bo'lsin.
        try { var old = await dir.getEntry(names[i]); await old.delete(); } catch (e0) { /* yo'q */ }
        var ret = await ppro.Exporter.exportSequenceFrame(testState.sequence, t, names[i], dir.nativePath, 640, 360);
        verdict = "qaytdi=" + short(ret);
        var hit = await waitForFile(names[i], 4000);
        if (hit) {
          verdict += " fayl=" + hit.size + "b";
          if (!found) { found = names[i]; testState.framePath = hit.entry ? hit.entry.nativePath : ""; }
        } else { verdict += " fayl=yo'q (4s)"; }
      } catch (e) {
        verdict = "XATO: " + String(e.message || e).slice(0, 60);
      }
      tried.push(names[i] + " → " + verdict);
    }
    var kids = await dir.getEntries();
    tried.push("papka: " + kids.map(function (k) { return k.name; }).join(", "));
    if (!found) throw new Error(tried.join(" ‖ "));
    return { detail: "ISHLAYDI: " + found + " ‖ " + tried.join(" ‖ ") };
  });

  await probe("host", "lockedAccess + executeTransaction", async function () {
    if (!testState.project) return { skip: "loyiha yo'q" };
    var seq = testState.sequence;
    if (!seq) return { skip: "ketma-ketlik yo'q" };
    var tracks = null;
    try { tracks = await seq.getVideoTrackCount(); } catch (e) { /* nom boshqa bo'lishi mumkin */ }
    var did = false, err = "";
    try {
      testState.project.lockedAccess(function () {
        var vt = null;
        try { vt = seq.getVideoTrack ? seq.getVideoTrack(0) : null; } catch (e2) { /* async bo'lishi mumkin */ }
        if (vt && vt.createSetNameAction) {
          testState.project.executeTransaction(function (ca) {
            ca.addAction(vt.createSetNameAction("FF Spike"));
          }, "FF spike rename");
          did = true;
        }
      });
    } catch (e) { err = String(e.message || e); }
    return {
      detail: "lockedAccess chaqirildi · videoTrackCount=" + short(tracks) +
        " · transaction bajarildi=" + did + (err ? " · xato=" + err : "")
    };
  });

  await probe("host", "importSequences imzosi (.prproj)", async function () {
    if (!testState.project) return { skip: "loyiha yo'q" };
    var f = testState.project.importSequences;
    if (typeof f !== "function") throw new Error("importSequences yo'q");
    return { detail: "mavjud, arity=" + f.length + " (jonli .prproj sinovi FAZA 3'da — sequenceId Guid[] talab qiladi)" };
  });

  await probe("host", "Muhim sinf'lar API yuzasi", async function () {
    var out = [];
    ["Project", "SequenceEditor", "Exporter", "TickTime", "Utils", "ProjectUtils", "SequenceUtils", "Constants"].forEach(function (k) {
      if (ppro[k]) out.push("### " + k + ": " + methodNames(ppro[k]).join(", "));
    });
    return { detail: out.join("\n") };
  });
}

/* ---------- sinov loyihasini tayyorlash ---------- */

async function prepareTestProject() {
  statusEl.textContent = "Sinov loyihasi tayyorlanmoqda…";
  try {
    var p = await ppro.Project.getActiveProject();
    if (!p) {
      var lfs = uxp.storage.localFileSystem;
      var dir = await lfs.createEntryWithUrl("plugin-temp:/ffspike", { type: uxp.storage.types.folder, overwrite: true });
      var path = dir.nativePath + "/ff-spike.prproj";
      p = await ppro.Project.createProject(path);
      log("loyiha yaratildi: " + path);
    }
    var s = await p.getActiveSequence();
    if (!s) {
      s = await p.createSequence("FF Spike Seq");
      log("ketma-ketlik yaratildi: " + (s && s.name));
      if (s && p.setActiveSequence) await p.setActiveSequence(s);
    }
    testState.project = p; testState.sequence = s;
    statusEl.textContent = "Tayyor: loyiha=" + (p && p.name) + " · seq=" + (s && s.name);
  } catch (e) {
    statusEl.textContent = "Tayyorlash xatosi: " + (e.message || e);
    log("prepare FAIL: " + (e.message || e));
  }
}

/* ---------- hisobot ---------- */

function toMarkdown() {
  var lines = [];
  lines.push("# Premiere UXP spike natijasi");
  lines.push("");
  var t = "?";
  try { t = document.theme.getCurrent(); } catch (e) { /* ignore */ }
  lines.push("- Panel: " + window.innerWidth + "x" + window.innerHeight + " · tema: " + t);
  lines.push("");
  lines.push("| Guruh | Probe | Natija | ms | Tafsilot |");
  lines.push("|---|---|---|---|---|");
  results.forEach(function (r) {
    var d = String(r.detail || "").replace(/\n/g, "<br>").replace(/\|/g, "\\|");
    lines.push("| " + r.group + " | " + r.name + " | **" + r.status + "** | " + (r.ms || 0) + " | " + d + " |");
  });
  return lines.join("\n");
}

async function saveReport() {
  try {
    var lfs = uxp.storage.localFileSystem;
    var f = await lfs.createEntryWithUrl("plugin-data:/spike-report.md", { overwrite: true });
    await f.write(toMarkdown());
    statusEl.textContent = "Saqlandi: " + f.nativePath;
    log("hisobot: " + f.nativePath);
  } catch (e) {
    statusEl.textContent = "Saqlash xatosi: " + (e.message || e);
  }
}

async function runAll() {
  results = []; render();
  if (outEl) outEl.value = "";
  statusEl.textContent = "Ishlamoqda…";
  await probeEnvironment();
  await probeCss();
  await probeParity();
  await probeStorageAndNet();
  await probeVideo();
  await probeHostApi();
  var ok = results.filter(function (r) { return r.status === "OK"; }).length;
  var fail = results.filter(function (r) { return r.status === "FAIL"; }).length;
  var skip = results.filter(function (r) { return r.status === "SKIP"; }).length;
  statusEl.textContent = "Tugadi — OK " + ok + " · FAIL " + fail + " · SKIP " + skip;
  await saveReport();
}

/* ---------- boot ---------- */

function boot() {
  listEl = document.getElementById("list");
  outEl = document.getElementById("out");
  statusEl = document.getElementById("status");
  var envEl = document.getElementById("env");
  var v = "";
  try { v = "UXP " + (uxp.versions && uxp.versions.uxp) + " · plugin " + (uxp.versions && uxp.versions.plugin); } catch (e) { v = "versiya o'qilmadi"; }
  envEl.textContent = v + (ppro ? " · premierepro OK" : " · premierepro XATO: " + pproError);

  document.getElementById("runAll").addEventListener("click", function () { runAll(); });
  document.getElementById("prep").addEventListener("click", function () { prepareTestProject(); });
  document.getElementById("save").addEventListener("click", function () { saveReport(); });
  document.getElementById("copy").addEventListener("click", function () {
    outEl.value = toMarkdown();
    outEl.focus();
  });

  // Panel ochilishining o'zi hisobot beradi: foydalanuvchi hech narsa bosmasa ham
  // probe'lar avtomatik ishlaydi va natija plugin-data:/spike-report.md ga yoziladi.
  statusEl.textContent = "Avto-ishga tushirish 2 soniyadan keyin…";
  setTimeout(function () { runAll(); }, 2000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
