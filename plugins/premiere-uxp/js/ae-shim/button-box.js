/**
 * Tugma tarkibining VERTIKAL markazlanishi.
 *
 * Chrome'da `<button>` tarkibi qutining o'rtasida turadi — bu UA uslubi emas,
 * tugma layout'ining o'ziga xosligi (anonim tarkib qutisi markazlanadi).
 * `<div role="button">` esa oddiy blok: tarkib TEPAGA yopishadi.
 *
 *     .axws-tab{min-height:28px;padding:5px 10px}   ← 18px joyda 12px tarkib
 *     → AE'da 3px pastroqda (o'lchovda: `igTabVisCt [0,-3,0,0]`).
 *
 * Nega flex EMAS: `display:flex` (yoki `inline-flex`) bolalarni BLOKLASHTIRADI —
 * inline `<span>` alohida flex element bo'lib qoladi va o'lchami o'zgaradi
 * (birinchi urinishda `.ff-seg__item` ichidagi `.lf` 3px pasaygan, 6 ekranda
 * regressiya bergan). `flex-direction:column` ham qutqarmaydi: bolalar baribin
 * bloklashadi.
 *
 * Shu sabab markazlash PADDING bilan bajariladi: bo'sh joy o'lchanadi va yarmi
 * `padding-top` ga qo'shiladi. `box-sizing:border-box` (AE global qoidasi) va
 * `min-height` sharoitida bu qutini o'stirmaydi — faqat tarkibni suradi.
 *
 * Xatti-harakati o'zini CHEKLAYDI: tarkib allaqachon joyida bo'lsa (delta ≈ 0)
 * hech narsa yozilmaydi, ya'ni to'g'ri chiqqan tugmalarga TEGMAYDI. Muallif
 * `display:flex` qo'ygan tugmalar ham chetda qoladi — ular allaqachon
 * `align-items` bilan markazlangan.
 *
 * Absolyut joylashgan bolalar (rozetka, nuqta) hisobga OLINMAYDI — ular oqimdan
 * tashqarida va Chrome ham ularni markazlashda sanamaydi.
 */
(function () {
  var SEL = '[role="button"]';

  function num(v) { var n = parseFloat(v); return n === n ? n : 0; }

  /** Oqimdagi tarkibning vertikal chegarasi (yo'q bo'lsa `null`). */
  function contentSpan(el) {
    var top = null, bottom = null, kids = el.childNodes, i, r, n;
    for (i = 0; i < kids.length; i++) {
      n = kids[i];
      if (n.nodeType === 1) {
        var p = getComputedStyle(n).position;
        if (p === "absolute" || p === "fixed") continue;
        r = n.getBoundingClientRect();
      } else if (n.nodeType === 3) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        var rg = document.createRange();
        rg.selectNode(n);
        r = rg.getBoundingClientRect();
      } else continue;
      if (!r || (!r.height && !r.width)) continue;
      if (top === null || r.top < top) top = r.top;
      if (bottom === null || r.bottom > bottom) bottom = r.bottom;
    }
    return top === null ? null : { top: top, height: bottom - top };
  }

  function apply(el) {
    // Avvalgi yurishdagi inline qiymat o'lchovni buzmasin — asl holatga qaytaramiz.
    if (el.__afBBp !== undefined) el.style.paddingTop = el.__afBBp;

    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    // Muallif `display` bergan tugma (flex/grid/inline-flex) — o'zi markazlaydi.
    if (cs.display !== "block" && cs.display !== "inline-block") return;

    var rect = el.getBoundingClientRect();
    if (!(rect.height > 0)) return;                       // yashirin — keyin

    var top = rect.top + num(cs.borderTopWidth) + num(cs.paddingTop);
    var bottom = rect.bottom - num(cs.borderBottomWidth) - num(cs.paddingBottom);
    var span = contentSpan(el);
    if (!span || !(span.height > 0)) return;

    var delta = (bottom - top - span.height) / 2 - (span.top - top);
    if (!(Math.abs(delta) >= 0.5)) return;                // allaqachon joyida

    var pt = num(cs.paddingTop) + delta;
    if (pt < 0) pt = 0;                                   // manfiy padding yo'q
    if (el.__afBBp === undefined) el.__afBBp = el.style.paddingTop;
    el.style.paddingTop = Math.round(pt * 1000) / 1000 + "px";
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SEL)) apply(root);
    if (!root.querySelectorAll) return;
    var all = root.querySelectorAll(SEL);
    for (var i = 0; i < all.length; i++) apply(all[i]);
  }

  window.__afButtonBox = scan;

  // Dinamik markup `innerHTML` orqali keladi. Setter boshqa shim tomonidan
  // o'ralgan bo'lishi mumkin; biz uning ustidan o'raymiz.
  var proto = window.Element && Element.prototype;
  var d = proto && Object.getOwnPropertyDescriptor(proto, "innerHTML");
  if (d && d.set && d.configurable !== false) {
    Object.defineProperty(proto, "innerHTML", {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set: function (v) {
        d.set.call(this, v);
        // Yangi markup shu kadrda o'lchanmaydi (layout hali yangilanmagan) —
        // keyingi kadrga qoldiramiz.
        var self = this;
        later(function () { try { scan(self); } catch (e) {} });
      },
    });
  } else if (window.FFLog) {
    FFLog.warn("button-box", "innerHTML setter ilinmadi — dinamik tugmalarda tarkib tepaga yopishishi mumkin");
  }

  var q = [], t = null;
  function later(fn) {
    q.push(fn);
    if (t) return;
    t = setTimeout(function () {
      t = null;
      var list = q; q = [];
      for (var i = 0; i < list.length; i++) list[i]();
    }, 0);
  }

  // Klass/uslub o'zgarishi yashirin tugmani ko'rsatishi yoki `padding`ni
  // almashtirishi mumkin — o'lchov eskirmasin.
  var pend = [], pt2 = null;
  function flush() {
    pt2 = null;
    var list = pend; pend = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].isConnected === false) continue;
      try { apply(list[i]); } catch (e) {}
    }
  }
  if (window.MutationObserver) {
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var el = recs[i].target;
          if (el.nodeType !== 1 || !el.matches) continue;
          // Ota-onaning klassi o'zgarsa (varaq ochilishi) ichidagi tugmalar
          // ko'rinib qoladi — shuning uchun butun shoxni qayta ko'ramiz.
          if (el.matches(SEL)) { if (pend.indexOf(el) < 0) pend.push(el); continue; }
          var inner = el.querySelectorAll ? el.querySelectorAll(SEL) : [];
          for (var j = 0; j < inner.length; j++) if (pend.indexOf(inner[j]) < 0) pend.push(inner[j]);
        }
        if (pend.length && !pt2) pt2 = setTimeout(flush, 0);
      }).observe(document.documentElement, {
        attributes: true, subtree: true, attributeFilter: ["class", "style"],
      });
    } catch (e) { /* observer yo'q — boshlang'ich yurish qoladi */ }
  }

  // Panel eni o'zgarsa matn boshqacha o'raladi → tarkib balandligi o'zgaradi.
  var rt = null;
  window.addEventListener("resize", function () {
    if (rt) clearTimeout(rt);
    rt = setTimeout(function () { rt = null; try { scan(document.body); } catch (e) {} }, 60);
  });

  function boot() { try { scan(document.body); } catch (e) {} }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
