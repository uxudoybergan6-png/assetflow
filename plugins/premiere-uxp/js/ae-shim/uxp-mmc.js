/*
 * `min()` / `max()` / `clamp()` — FAQAT UXP.
 *
 * Jonli o'lchov (panel ichidagi CSS zondi, 200px'lik host):
 *     width:min(50px,100%)        → 200px   (funksiya butunlay tashlangan)
 *     width:clamp(20px,50%,40px)  → 200px
 *     width:calc(50% + 10px)      → 110px   ✔
 *     height:50vh                 → 371px   ✔ (742px panel)
 * Ya'ni UXP bu uch funksiyani qo'llamaydi, lekin `calc`/`%`/`vw`/`vh` ishlaydi
 * → qiymatni O'ZIMIZ hisoblab, inline uslub qilib qo'yamiz.
 *
 * Ro'yxatni `scripts/ae-port.mjs` yig'adi (`window.__AF_MMC`) — CSS matniga
 * tegilmagan, shu bois brauzerdagi 1:1 QA etaloni o'zgarmaydi.
 *
 * Ta'sir doirasi: toast/dropdown `max-width`, `.account-panel` balandligi,
 * `.ai-menu` `max-width`/`max-height`, progress va popover kengliklari — ular
 * usiz cheklovsiz bo'lib panelning butun enini egallardi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  // FFLog — OBYEKT (`.info/.warn/.error`), fabrika EMAS. Funksiya deb chaqirilsa
  // shim shu qatorda o'lib qoladi va JIM inert bo'ladi (aynan shunday bo'ldi:
  // `__ffMmcStat` umuman yaratilmagan, panelda "YUKLANMAGAN" chiqdi).
  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  /** Panel o'lchami — UXP'da `window.innerWidth` UNDEFINED. */
  function viewport() {
    var r = document.documentElement.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  /** Vergul bo'yicha YUZA darajada bo'lish (qavs ichidagilarga tegmaydi). */
  function splitTop(s) {
    var out = [], depth = 0, cur = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /**
   * Termni pikselga aylantiradi. `base` — foiz uchun asos (px).
   * Qaytish: son yoki `null` (tushunmadik → qoidani butunlay tashlab ketamiz,
   * taxminiy qiymat qo'yishdan ko'ra tegmagan yaxshi).
   */
  function toPx(term, base, vp, fontPx) {
    term = String(term).trim();

    var fn = /^(min|max|clamp)\(([\s\S]*)\)$/i.exec(term);
    if (fn) {
      var parts = splitTop(fn[2]).map(function (t) { return toPx(t, base, vp, fontPx); });
      if (parts.some(function (x) { return x === null; })) return null;
      var name = fn[1].toLowerCase();
      if (name === "min") return Math.min.apply(Math, parts);
      if (name === "max") return Math.max.apply(Math, parts);
      if (parts.length !== 3) return null;
      return Math.min(Math.max(parts[0], parts[1]), parts[2]);   // clamp(lo, val, hi)
    }

    var cc = /^calc\(([\s\S]*)\)$/i.exec(term);
    if (cc) return calcPx(cc[1], base, vp, fontPx);

    var m = /^(-?[\d.]+)(px|%|vw|vh|em|rem)?$/i.exec(term);
    if (!m) return null;
    var n = parseFloat(m[1]);
    switch ((m[2] || "px").toLowerCase()) {
      case "px": return n;
      case "%": return base === null ? null : (n / 100) * base;
      case "vw": return (n / 100) * vp.w;
      case "vh": return (n / 100) * vp.h;
      case "em": case "rem": return n * fontPx;
    }
    return null;
  }

  /** Oddiy `calc()`: faqat `+`/`-` bilan ajratilgan hadlar (AE'da shundan boshqasi yo'q). */
  function calcPx(expr, base, vp, fontPx) {
    var toks = String(expr).trim().split(/\s+([+-])\s+/);   // probel SHART (CSS qoidasi)
    if (!toks.length) return null;
    var acc = toPx(toks[0], base, vp, fontPx);
    if (acc === null) return null;
    for (var i = 1; i < toks.length; i += 2) {
      var v = toPx(toks[i + 1], base, vp, fontPx);
      if (v === null) return null;
      acc = toks[i] === "-" ? acc - v : acc + v;
    }
    return acc;
  }

  /** Foiz asosi: kenglik xossalari uchun ota-onaning KONTENT eni, balandlik uchun bo'yi. */
  function percentBase(el, prop) {
    var p = el.parentElement;
    if (!p) return null;
    var r = p.getBoundingClientRect();
    var cs = getComputedStyle(p);
    var f = function (x) { return parseFloat(x) || 0; };
    if (/width/.test(prop)) return r.width - f(cs.paddingLeft) - f(cs.paddingRight);
    var h = r.height - f(cs.paddingTop) - f(cs.paddingBottom);
    // Balandlikda foiz ota-onaning ANIQ balandligini talab qiladi; auto bo'lsa
    // CSS uni e'tiborsiz qoldiradi — biz ham qoldiramiz.
    return cs.height === "auto" ? null : h;
  }

  /** `@media` sharti: `matchMedia` bo'lsa unga, bo'lmasa oddiy en tekshiruviga. */
  function mediaOk(m, vp) {
    if (!m) return true;
    try {
      if (window.matchMedia) return window.matchMedia(m).matches;
    } catch (e) { /* pastdagi zaxira */ }
    var ok = true, re = /\(\s*(max|min)-width\s*:\s*([\d.]+)px\s*\)/gi, x;
    while ((x = re.exec(m))) {
      var n = parseFloat(x[2]);
      ok = ok && (x[1].toLowerCase() === "max" ? vp.w <= n : vp.w >= n);
    }
    return ok;
  }

  var applying = false;
  // Diagnostika (`uxp-diag.js` CSS hisobotida ko'rinadi) — "qo'yilmagan" holatni
  // taxmin bilan emas, sanoq bilan tushuntirish uchun.
  var stat = { runs: 0, set: 0, skip: 0, err: "" };
  window.__ffMmcStat = stat;

  function apply() {
    var list = window.__AF_MMC;
    if (!list || !list.length || applying) return;
    applying = true;
    stat.runs++;
    try {
      var vp = viewport();
      var fontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var els;
        try { els = document.querySelectorAll(r.s); } catch (e) { continue; }
        if (!els.length) continue;
        var on = mediaOk(r.m, vp);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          if (!on) { el.style.removeProperty(r.p); continue; }
          var base = /%/.test(r.v) ? percentBase(el, r.p) : 0;
          var px = toPx(r.v, base, vp, fontPx);
          if (px === null || !isFinite(px)) { stat.skip++; continue; }
          el.style.setProperty(r.p, Math.round(px) + "px");
          stat.set++;
        }
      }
    } catch (e) {
      // `applying` bayrog'i osilib qolmasin — aks holda shim BIR MAROTABA
      // xatodan keyin butunlay jim bo'lib qoladi.
      stat.err = String((e && e.message) || e);
      log.error("apply xatosi:", stat.err);
    }
    applying = false;
  }
  window.__ffMmcApply = apply;

  function schedule() {
    // Layout tinchigach: yangi qo'shilgan tugun o'sha kadrda 0×0 o'lchanadi.
    setTimeout(apply, 0);
    setTimeout(apply, 250);
  }

  function init() {
    schedule();
    setTimeout(apply, 1200);
    window.addEventListener("resize", schedule);

    // Modal/menyu/toast va butun bosh sahifa KEYIN yaratiladi — boshlang'ich
    // hisob yetmaydi. Afzal yo'l — `MutationObserver`, ammo UXP'da u YO'Q
    // (o'lchovda: shim faqat boot'da ishlab, `.fhome-hero` ga umuman
    // yetmagandi). Shu bois zaxira — sekin taymer + har bosishdan keyin.
    var mo = null;
    try {
      var t = null;
      mo = new MutationObserver(function () {
        if (applying) return;               // o'z inline yozuvimiz qayta chaqirmasin
        clearTimeout(t);
        t = setTimeout(apply, 60);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      mo = null;
      // Premiere UXP'da bu KUTILGAN imkoniyat chegarasi; taymer zaxirasi
      // ishlayotgani uchun error hisoblagichini va production logni ifloslamasin.
      log.warn("MutationObserver yo'q — taymer zaxirasi:", e && e.message);
    }
    if (!mo) {
      setInterval(apply, 1500);             // 11 ta selektor — arzon
      document.addEventListener("click", function () { setTimeout(apply, 60); }, true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
