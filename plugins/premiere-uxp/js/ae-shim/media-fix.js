/*
 * Media o'lchami shim — `<img>` va `<video>` uchun.
 *
 * O'lchov (SPIKE-NATIJA §10): UXP'da `<img>` INTRINSIC o'lchamga ega emas.
 * Agar `width` yoki `height` dan biri `auto`/berilmagan bo'lsa, quti 0×0 ga
 * yiqiladi va rasm umuman ko'rinmaydi. `object-fit` ham qo'llanmaydi.
 * AE CSS'i esa deyarli hamma joyda `width:100%; height:auto` (yoki teskarisi)
 * ishlatadi — shuning uchun ikkala o'lchamni ISH VAQTIDA piksel bilan beramiz.
 *
 * `MutationObserver` UXP'da yo'q, shuning uchun DOM o'zgarishini
 * `innerHTML`/`appendChild`/`insertBefore` ni o'rab kuzatamiz va keyingi
 * kadrda bir marta (debounce) supurgi yuritamiz.
 */
(function () {
  "use strict";

  var pending = false;

  function raf(fn) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(fn);
    else setTimeout(fn, 16);
  }

  function schedule() {
    if (pending) return;
    pending = true;
    raf(function () {
      raf(function () {                 // layout joylashishi uchun 2 kadr (§3)
        pending = false;
        try { sweep(document.body); } catch (e) {
          try { console.warn("[media-fix] sweep:", e); } catch (_) {}
        }
      });
    });
  }

  /** Ota-ona kengligini topadi: eng yaqin nolga teng bo'lmagan qutini oladi. */
  function parentWidth(el) {
    var p = el.parentNode, guard = 0;
    while (p && p.nodeType === 1 && guard++ < 8) {
      var r = p.getBoundingClientRect();
      if (r && r.width > 0) return Math.round(r.width);
      p = p.parentNode;
    }
    var b = document.body.getBoundingClientRect();
    return Math.round(b.width) || 320;
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Ota qutining imzosi — o'lchamni QAYTA hisoblash kerakligini bilish uchun.
   *
   * `size()` piksel qiymatni qotirib qo'yadi va `__ffSized` uni qayta
   * hisoblashdan saqlaydi. Ammo AE CSS'ida ko'p media `inset:0;width:100%` —
   * ya'ni o'lchami OTA qutiga bog'liq, ota esa keyinroq o'zgarishi mumkin
   * (`autofill.js` grid ustunini o'lchagach `flex-basis` yozadi). O'lchovda:
   * `.pd3-hero-poster` 491×271 bo'lib qotib qolgan, hero esa keyin 507×279.29
   * ga kengaygan. `resize` hodisasi bo'lmagani uchun eskisi shundoq qolgan.
   */
  function boxKey(el) {
    var p = el.parentNode;
    if (!p || p.nodeType !== 1 || !p.getBoundingClientRect) return "";
    var r = p.getBoundingClientRect();
    return Math.round(r.width) + "x" + Math.round(r.height);
  }

  /** Bitta media tugunini o'lchamlaydi. Ikkala o'lcham ham aniq px bo'ladi. */
  function size(el) {
    if (!el || el.__ffSized === el.src) return;

    var nw = num(el.naturalWidth || el.videoWidth);
    var nh = num(el.naturalHeight || el.videoHeight);

    // CSS/atributdan kelgan aniq o'lchamlar (masalan `sizeMedia()` bergan).
    var cw = num(el.style.width) || num(el.getAttribute("width"));
    var ch = num(el.style.height) || num(el.getAttribute("height"));

    var rect = el.getBoundingClientRect();
    var haveBox = rect.width > 1 && rect.height > 1;
    if (haveBox && cw && ch) { el.__ffSized = el.src; return; }   // allaqachon to'g'ri

    var w = cw, h = ch;
    if (haveBox) {
      // CSS quti BERGAN bo'lsa (masalan `position:absolute;inset:0`), intrinsic
      // nisbatga o'tmaymiz — quti allaqachon to'g'ri. Aks holda portret rasm
      // 16:10 oynadan chiqib ketardi (o'lchovda: `.thumb-poster` 93px o'rniga
      // 293px, 406×720 eskiz). Bu yerda faqat YETISHMAGAN o'lcham to'ldiriladi.
      if (!w) w = Math.round(rect.width);
      if (!h) h = Math.round(rect.height);
    }
    if (!w) w = parentWidth(el);
    if (!h) h = nw && nh ? Math.round((w * nh) / nw) : Math.round(w * 9 / 16);
    if (!w && nw && nh) w = Math.round((h * nw) / nh);

    if (!w || !h) return;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.__ffSized = el.src;
    el.__ffAuto = true;   // o'lchamni BIZ yozdik → resize'da tozalash mumkin
    el.__ffBox = boxKey(el);
  }

  /**
   * Shim yozgan inline o'lchamlarni olib tashlaydi.
   *
   * Panel eni o'zgarganda qayta o'lchash SHART, lekin inline `width/height`
   * turgan bo'lsa `size()` "allaqachon to'g'ri" deb qaytib ketadi va eski o'lcham
   * qotib qoladi. Shu sabab avval tozalaymiz, keyin qayta o'lchaymiz.
   */
  function unsize(el) {
    if (!el.__ffAuto) return;
    el.style.width = "";
    el.style.height = "";
    el.__ffSized = null;
    el.__ffBox = null;
  }

  function sweep(root) {
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll("img, video");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      // Ota quti o'zgargan bo'lsa qotirilgan o'lcham eskirgan — qayta o'lchaymiz.
      if (el.__ffAuto && el.__ffBox && el.__ffBox !== boxKey(el)) unsize(el);
      size(el);
    }
  }

  // Rasm yuklangach intrinsic nisbat ma'lum bo'ladi → qayta o'lchaymiz.
  document.addEventListener("load", function (ev) {
    var t = ev.target;
    if (t && (t.tagName === "IMG" || t.tagName === "VIDEO")) { t.__ffSized = null; size(t); }
  }, true);
  document.addEventListener("loadedmetadata", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "VIDEO") { t.__ffSized = null; size(t); }
  }, true);

  // ── DOM o'zgarishini kuzatish (MutationObserver o'rniga) ────────────────────
  try {
    var proto = Element.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
    if (desc && desc.set) {
      Object.defineProperty(proto, "innerHTML", {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) { desc.set.call(this, v); schedule(); },
      });
    }
    ["appendChild", "insertBefore", "replaceChild"].forEach(function (m) {
      var orig = proto[m] || Node.prototype[m];
      if (typeof orig !== "function") return;
      (proto[m] ? proto : Node.prototype)[m] = function () {
        var out = orig.apply(this, arguments);
        var a = arguments[0];
        if (a && a.nodeType === 1 && (a.tagName === "IMG" || a.tagName === "VIDEO" || (a.querySelector && a.querySelector("img,video")))) schedule();
        return out;
      };
    });
  } catch (e) {
    try { console.warn("[media-fix] DOM ilgagi o'rnatilmadi:", e); } catch (_) {}
  }

  // Panel kengligi o'zgarganda nisbatlar qayta hisoblansin.
  //
  // UXP'da ResizeObserver callback ichida media width/height'ini yozish yana
  // o'sha observerni uyg'otadi. Imzosiz callback klassik feedback loop hosil
  // qilib, Premiere hostida har kadrda `Uncaught JS Exception` va yuqori CPU
  // keltirib chiqargan. Faqat BODY qutisi HAQIQATAN o'zgarganda qayta o'lchaymiz.
  try {
    if (typeof ResizeObserver === "function") {
      var lastBodyBox = "";
      try {
        var initialBodyRect = document.body.getBoundingClientRect();
        lastBodyBox = Math.round(initialBodyRect.width) + "x" + Math.round(initialBodyRect.height);
      } catch (_) {}
      new ResizeObserver(function () {
        try {
          var bodyRect = document.body.getBoundingClientRect();
          var nextBodyBox = Math.round(bodyRect.width) + "x" + Math.round(bodyRect.height);
          if (nextBodyBox === lastBodyBox) return;
          lastBodyBox = nextBodyBox; // uslub yozishdan OLDIN — qayta kirishga qarshi
          var list = document.querySelectorAll("img, video");
          for (var i = 0; i < list.length; i++) unsize(list[i]);
          schedule();
        } catch (e) {
          try { console.warn("[media-fix] resize:", e); } catch (_) {}
        }
      }).observe(document.body);
    }
  } catch (e) { /* ixtiyoriy */ }

  schedule();
  window.FFMediaFix = { size: size, unsize: unsize, sweep: sweep, schedule: schedule };
})();
