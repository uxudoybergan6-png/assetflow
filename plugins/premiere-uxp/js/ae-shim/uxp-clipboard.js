/*
 * Clipboard — FAQAT UXP.
 *
 * AE ikkala nusxa yo'lini ham bir xil qurgan (`afCopyExec` va SC_30 dagi
 * `axCopy`): yashirin `<textarea>` + `document.execCommand('copy')`, u
 * ishlamasa `navigator.clipboard.writeText`. UXP'da IKKALASI HAM YO'Q, shu
 * sabab Google kirishidagi "Copy code" / "Copy link" tugmalari o'lik edi —
 * qurilmaga bir martalik kodni ko'chirib bo'lmasdi (foydalanuvchi hisoboti:
 * "google orqali kirishning iloji bo'lmayapti").
 *
 * UXP'ning o'z API'si — `navigator.clipboard.setContent({"text/plain": …})`,
 * web `writeText(str)` dan BOSHQACHA imzo. Versiyaga qarab `writeText` ham
 * bo'lishi mumkin, shu bois zanjir bilan aniqlaymiz va tanlangan yo'lni
 * `window.__ffClipPath` ga yozamiz (panel diagnostikasi ko'rsatadi).
 *
 * Sinxronlik: AE `execCommand` dan HAQIQIY boolean kutadi, UXP yozuvi esa
 * async. Optimistik `true` qaytaramiz; rad javobi kelsa toast'ni "Copy failed"
 * ga tuzatamiz — yolg'on "Copied" qolib ketmasin.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  // FFLog — OBYEKT (`.info/.warn/.error`), fabrika EMAS.
  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  window.__ffClipPath = "aniqlanmagan";

  /**
   * `navigator.clipboard` — XOSSANI O'QISHNING O'ZI xato tashlaydi, agar
   * manifestda ruxsat bo'lmasa (o'lchandi):
   *   "Clipboard access not supported for 3P plugins with manifest version
   *    upto 4. Valid manifest entry required from manifest version 5."
   * Stek `get clipboard [as clipboard]` ni ko'rsatdi — ya'ni oddiy
   * `navigator.clipboard && …` tekshiruvi ham halokatli. Shu sabab har o'qish
   * try/catch ichida. (Ruxsat manifestga qo'shildi: `clipboard: readAndWrite`.)
   */
  function navClipboard() {
    try {
      if (typeof navigator === "undefined") return null;
      return navigator.clipboard || null;
    } catch (e) {
      window.__ffClipPath = "RUXSAT YO'Q: " + ((e && e.message) || e);
      return null;
    }
  }

  /**
   * Matnni buferga yozadi. HECH QACHON sinxron `throw` qilmaydi — faqat Promise
   * qaytaradi (rad — haqiqiy nosozlik).
   *
   * Sinxron `throw` nega muhim: UXP `setContent` API'si BOR bo'lsa ham chaqiruv
   * paytida sinxron xato tashlashi mumkin (o'lchandi — diagnostika tugmasi shu
   * sababdan jim o'lgan). `document.execCommand` esa `writeText(t).catch(...)`
   * deb yozadi — sinxron xato `.catch` ga umuman yetmaydi va AE'ning nusxa
   * olish ishlovchisini butunlay sindiradi.
   */
  function writeText(text) {
    var t = String(text == null ? "" : text);
    var nc = navClipboard();
    var errs = [];

    /** Bitta urinish: sinxron xato ham rad javobga aylanadi. */
    function attempt(name, fn) {
      try {
        var r = fn();
        window.__ffClipPath = name;
        return Promise.resolve(r);
      } catch (e) {
        errs.push(name + ": " + ((e && e.message) || e));
        return null;                       // keyingi yo'lni sinaymiz
      }
    }

    var p = null;
    if (!p && nc && typeof nc.setContent === "function") {
      p = attempt("navigator.clipboard.setContent", function () {
        return nc.setContent({ "text/plain": t });
      });
    }
    if (!p && nc && typeof nc.writeText === "function") {
      p = attempt("navigator.clipboard.writeText", function () { return nc.writeText(t); });
    }
    if (!p) {
      var c = null;
      try { c = uxp.clipboard || (uxp.storage && uxp.storage.clipboard) || null; } catch (e) { c = null; }
      if (c && typeof c.setContent === "function") {
        p = attempt("uxp.clipboard.setContent", function () { return c.setContent({ "text/plain": t }); });
      }
    }
    if (p) return p;

    window.__ffClipPath = errs.length ? "XATO(" + errs.join(" | ") + ")" : "YO'Q";
    return Promise.reject(new Error(
      errs.length ? errs.join(" | ") : "UXP clipboard API topilmadi"
    ));
  }
  window.__ffClipWrite = writeText;

  // AE naqshi: yashirin <textarea> → `ta.focus()` → `ta.select()` →
  // `execCommand('copy')`. UXP'da `focus`/`select` yo'q yoki `activeElement` ni
  // o'zgartirmaydi — zanjir jim uziladi. Shu bois `select()` ni O'ZIMIZ ta'minlaymiz
  // va u tanlangan matnni aniq belgilab qo'yadi (taxminga o'rin qolmaydi).
  var origCreate = document.createElement.bind(document);
  document.createElement = function (tag, opts) {
    var el = origCreate(tag, opts);
    if (String(tag).toLowerCase() === "textarea") {
      var nativeSel = typeof el.select === "function" ? el.select.bind(el) : null;
      el.select = function () {
        window.__ffClipSel = String(this.value == null ? "" : this.value);
        if (nativeSel) { try { nativeSel(); } catch (e) { /* ixtiyoriy */ } }
      };
      if (typeof el.focus !== "function") el.focus = function () {};
    }
    return el;
  };

  /** Nusxa olinadigan matn: `select()` belgilagani → fokusdagi maydon → textarea. */
  function pendingText() {
    if (window.__ffClipSel) {
      var sel = window.__ffClipSel;
      window.__ffClipSel = "";        // bir martalik — eskisi qayta ishlatilmasin
      return sel;
    }
    var el = document.activeElement;
    if (el && typeof el.value === "string" && el.value) return el.value;
    // AE yashirin textarea'ni ekrandan tashqarida yasaydi — UXP uni fokuslay
    // olmasligi mumkin, shunda `activeElement` <body> bo'lib qoladi.
    var tas = document.querySelectorAll("textarea");
    for (var i = tas.length - 1; i >= 0; i--) {
      if (tas[i].value) return tas[i].value;
    }
    try {
      var s = window.getSelection && window.getSelection();
      if (s && String(s)) return String(s);
    } catch (e) { /* ixtiyoriy */ }
    return "";
  }

  // Oxirgi chaqiruvlar izi — "nusxa olinmadi" ni taxmin bilan emas, o'lchov bilan
  // hal qilish uchun (`uxp-diag.js` CLIP hisobotida ko'rinadi).
  window.__ffClipDbg = [];
  function dbg(msg) {
    window.__ffClipDbg.push(msg);
    if (window.__ffClipDbg.length > 6) window.__ffClipDbg.shift();
  }

  // `execCommand` — UXP'da yo'q. Faqat 'copy' ni qo'llab-quvvatlaymiz; boshqa
  // buyruqqa halol `false` (AE 'copy' dan boshqasini ishlatmaydi).
  function execCopy(cmd) {
    if (String(cmd || "").toLowerCase() !== "copy") return false;
    var t = pendingText();
    var ae = document.activeElement;
    dbg("exec: ta=" + document.querySelectorAll("textarea").length
      + " ae=" + ((ae && ae.tagName) || "?")
      + " aeVal=" + ((ae && typeof ae.value === "string") ? ae.value.length : "-")
      + " matn=" + (t ? t.length : 0));
    if (!t) return false;
    writeText(t).then(function () { dbg("exec: yozildi ✔"); }, function (e) {
      dbg("exec: XATO " + ((e && e.message) || e));
      log.error("clipboard yozib bo'lmadi:", e);
      // Optimistik "Copied" toast'ini tuzatamiz.
      try {
        if (typeof window.showToast === "function") window.showToast("Copy failed", "error");
      } catch (x) { /* jim */ }
    });
    return true;
  }

  // Oddiy `document.execCommand = fn` UXP'da JIM O'TMASLIGI mumkin (xossa
  // yozilmas bo'lsa) — o'lchovda yamoq umuman chaqirilmagandi. `__ff` bayrog'i
  // diagnostikada yamoq HAQIQATAN turganini ko'rsatadi (taxmin emas).
  execCopy.__ff = true;
  try {
    Object.defineProperty(document, "execCommand", {
      configurable: true, writable: true, value: execCopy,
    });
  } catch (e) {
    try { document.execCommand = execCopy; } catch (x) { log.error("execCommand yamab bo'lmadi:", x); }
  }

  // `navigator.clipboard.writeText` — AE zaxira yo'li shu nomni kutadi.
  // MUHIM: `navigator.clipboard` o'qilishining o'zi tashlashi mumkin → `navClipboard()`.
  try {
    var nc0 = navClipboard();
    if (nc0) {
      if (typeof nc0.writeText !== "function") nc0.writeText = function (t) { return writeText(t); };
    } else {
      navigator.clipboard = { writeText: writeText };
    }
  } catch (e) {
    // `navigator.clipboard` faqat-o'qish bo'lishi mumkin — `execCommand` yo'li yetarli.
    log.error("navigator.clipboard yamab bo'lmadi:", e);
  }
})();
