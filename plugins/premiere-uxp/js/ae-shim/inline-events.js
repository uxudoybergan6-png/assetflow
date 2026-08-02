/*
 * Inline hodisa shim — `onclick="…"` atributlari uchun.
 *
 * O'lchov (SPIKE-NATIJA §11, probe 9): UXP inline `on*` atributini PARSE qiladi,
 * lekin HECH QACHON chaqirmaydi. AE markupida 131 ta shunday atribut bor.
 * `new Function` va `eval` esa UXP'da ISHLAYDI — shuning uchun hodisani
 * `document` darajasida ushlab, atribut matnini o'zimiz bajaramiz.
 *
 * Nega delegatsiya: AE UI tugunlarni doim qayta chizadi (`innerHTML`), shuning
 * uchun har tugunni alohida bog'lash yaroqsiz — `MutationObserver` ham UXP'da
 * yo'q. Ko'pchilik hodisa (click/change/input/keydown/submit) ko'tariladi;
 * ko'tarilmaydigan `mouseenter`/`mouseleave` esa `mouseover`/`mouseout` orqali
 * qayta yasaladi.
 */
(function () {
  "use strict";

  var BUBBLING = ["click", "change", "input", "keydown", "keyup", "submit", "focus", "blur", "dblclick", "contextmenu"];
  var cache = new WeakMap();   // el → { attrName: compiledFn }

  function compiled(el, attr) {
    var src = el.getAttribute(attr);
    if (!src) return null;
    var byAttr = cache.get(el);
    if (byAttr && byAttr[attr] && byAttr[attr].src === src) return byAttr[attr].fn;
    var fn;
    try {
      // AE atributlari `this` ni element deb, `event` ni hodisa deb kutadi.
      fn = new Function("event", src);
    } catch (e) {
      try { console.warn("[inline-shim] `" + attr + '="' + src.slice(0, 60) + '"` kompilyatsiya xatosi:', e); } catch (_) {}
      fn = function () {};
    }
    if (!byAttr) { byAttr = {}; cache.set(el, byAttr); }
    byAttr[attr] = { src: src, fn: fn };
    return fn;
  }

  /** Hodisa yo'lidagi HAR tugunni tekshiradi (haqiqiy bubbling semantikasi):
   *  eng ichkidan tashqariga, `stopPropagation` chaqirilsa to'xtaydi. */
  function runFor(type, ev) {
    var attr = "on" + type;
    var node = ev.target;
    var stopped = false;
    var origStop = ev.stopPropagation;
    ev.stopPropagation = function () { stopped = true; if (origStop) origStop.call(ev); };
    while (node && node.nodeType === 1) {
      if (node.hasAttribute && node.hasAttribute(attr)) {
        var fn = compiled(node, attr);
        if (fn) {
          try {
            if (fn.call(node, ev) === false) { if (ev.preventDefault) ev.preventDefault(); stopped = true; }
          } catch (e) {
            try { console.error("[inline-shim] " + attr + " xatosi:", e); } catch (_) {}
          }
        }
      }
      if (stopped) break;
      node = node.parentNode;
    }
    ev.stopPropagation = origStop;
  }

  BUBBLING.forEach(function (type) {
    document.addEventListener(type, function (ev) { runFor(type, ev); }, true);
  });

  // mouseenter/leave ko'tarilmaydi → over/out dan qayta yasaymiz.
  function hoverBridge(nativeType, synthType) {
    document.addEventListener(nativeType, function (ev) {
      var attr = "on" + synthType;
      var node = ev.target;
      while (node && node.nodeType === 1) {
        if (node.hasAttribute && node.hasAttribute(attr)) {
          // Faqat chegara kesib o'tilganda: related target shu tugun ichida bo'lsa — bu ichki harakat.
          var rel = ev.relatedTarget;
          if (!(rel && node.contains && node.contains(rel))) {
            var fn = compiled(node, attr);
            if (fn) { try { fn.call(node, ev); } catch (e) { /* jim */ } }
          }
          break;
        }
        node = node.parentNode;
      }
    }, true);
  }
  hoverBridge("mouseover", "mouseenter");
  hoverBridge("mouseout", "mouseleave");

  /*
   * `<div role="button">` klaviatura bilan ishlashi shart (port `<button>` ni
   * div'ga aylantirdi — native tugmaning Space/Enter xatti-harakati yo'qoldi).
   */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
    var el = ev.target;
    if (!el || el.nodeType !== 1 || el.getAttribute("role") !== "button") return;
    if (el.hasAttribute("disabled")) return;
    ev.preventDefault();
    if (typeof el.click === "function") el.click();
  });
})();
