/*
 * O'ralaydigan konteynerlarda QATOR OXIRIDAGI ortiqcha `margin-right`ni
 * neytrallaydi.
 *
 * SABAB: UXP'da `gap` yo'q, shu sabab port uni har bolaga `margin-right` qilib
 * beradi. Ammo `gap` bilan `margin` bir xil emas — `gap` FAQAT elementlar
 * ORASIDA turadi, `margin-right` esa qator OXIRIDA ham qoladi va o'ralish
 * hisobiga kiradi. Natijada AE bitta qatorga N ta element sig'dirsa, port
 * N−1 tasini sig'diradi.
 *
 * O'lchov (440px, filtr varag'i `.fsheet-cats`, W=370, gap=6):
 *   AE  → qator 1: All·Backgrounds·Overlays·Transitions·Logo (5 ta, 403px)
 *   port→ qator 1: 4 ta (403 + 6px yakuniy margin = 409 > sig'im) → "Logo"
 *         pastga tushib ketgan; keyingi chiplar 56px siljigan.
 *
 * Port avvalo buni `padding-right`ni `gap`ga kamaytirib qoplaydi — konteyner
 * QUTISI o'zgarmaydi, faqat tarkib qutisi kengayadi. Padding YETMASA (aynan bu
 * holat — `.fsheet-cats` padding 0) o'sha konteynerlar `__AF_NOPADC` ro'yxatiga
 * tushadi va shu yerda hal qilinadi.
 *
 * YECHIM: HAR QATORNING OXIRGI bolasidan `margin-right`ni olib tashlaymiz —
 * aynan `gap` semantikasi. Konteynerning o'z qutisi tegilmaydi (avvalgi
 * "konteynerga manfiy margin" yondashuvi uni `gap`cha kengaytirib yuborardi:
 * o'lchovda `fsheetCats [0,0,6,0]`, `pd3-metarow [0,0,7,0]`).
 *
 * Oxirgi-qatordagi elementning margin'ini olib tashlash JOY BO'SHATADI, ya'ni
 * keyingi element yuqori qatorga ko'tarilishi mumkin — shuning uchun qatorlar
 * qayta hisoblanadi va o'zgarmay qolguncha takrorlanadi (monoton, tez tinadi).
 * Har yurish AVVAL o'z override'larimizni tozalaydi, shuning uchun "o'ralganmi"
 * qarori doim TOZA holatda o'lchanadi — tebranish bo'lmaydi.
 */
(function () {
  "use strict";

  var list = window.__AF_NOPADC || [];
  if (!list.length) return;

  var SEL = list.map(function (c) { return "." + c; }).join(",");
  var busy = false;

  function num(v) { var n = parseFloat(v); return n === n ? n : 0; }

  /**
   * Bolalarni ko'rinadigan qatorlarga ajratadi (DOM tartibida).
   *
   * Qator chegarasi `top` bo'yicha EMAS, gorizontal qaytish bo'yicha aniqlanadi:
   * `align-items` markaz/baseline bo'lsa turli balandlikdagi elementlar bir
   * qatorda turib ham har xil `top` beradi va har biri alohida "qator" bo'lib
   * ko'rinadi — o'shanda HAMMA margin o'chib, oraliqlar butunlay yo'qoladi
   * (o'lchov: `.pd3-metarow` bolalari 7px'dan siljigan edi).
   */
  function rowsOf(el) {
    var out = [], kids = el.children, cur = null, prevRight = null;
    for (var i = 0; i < kids.length; i++) {
      var pos = getComputedStyle(kids[i]).position;
      if (pos === "absolute" || pos === "fixed") continue;   // oqimdan tashqarida
      var r = kids[i].getBoundingClientRect();
      if (!r.width && !r.height) continue;                   // yashirin bola
      if (prevRight === null || r.left + 1 < prevRight) { cur = []; out.push(cur); }
      cur.push(kids[i]);
      prevRight = r.right;
    }
    return out;
  }

  function sameRows(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i].length !== b[i].length) return false;
    return true;
  }

  /** Faqat O'ZIMIZ yozgan inline margin'larni olib tashlaymiz. */
  function clearAll(el) {
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].__afGapCleared) { kids[i].style.marginRight = ""; kids[i].__afGapCleared = 0; }
    }
  }

  /** Qatorlar tuzilishining barmoq izi — o'zgarganini arzon aniqlash uchun. */
  function sig(rows) {
    var s = [];
    for (var i = 0; i < rows.length; i++) s.push(rows[i].length);
    return s.join(",");
  }

  /** @returns {boolean} o'ralish tuzilishi O'ZGARDIMI (autofill qayta yurishi kerakmi). */
  function fix(el) {
    var kids = el.children;
    if (kids.length < 2) return false;
    clearAll(el);                                        // toza bazadan o'lchaymiz
    if (num(getComputedStyle(kids[0]).marginRight) <= 0) return false;

    var rows = rowsOf(el);
    if (rows.length < 2) return false;                   // o'ralish yo'q — tegmaymiz
    for (var pass = 0; pass < 8; pass++) {
      clearAll(el);
      for (var i = 0; i < rows.length; i++) {
        var last = rows[i][rows[i].length - 1];
        last.style.marginRight = "0px";
        last.__afGapCleared = 1;
      }
      var next = rowsOf(el);
      if (sameRows(rows, next)) break;                   // qat'iy nuqta
      rows = next;
    }
    var s = sig(rows);
    if (el.__afGapSig === s) return false;
    el.__afGapSig = s;
    return true;
  }

  function run() {
    if (busy) return;
    busy = true;
    var dirty = false;
    try {
      var all = document.querySelectorAll(SEL);
      for (var i = 0; i < all.length; i++) if (fix(all[i])) dirty = true;
    } catch (e) { /* selektor yoki layout muammosi — keyingi yurishda */ }
    // O'ralish qayta hisoblangan bo'lsa `autofill.js` ning OXIRGI QATOR passi
    // eskirgan bo'ladi: u qator chegarasini o'zi o'lchaydi va oxirgi qatordagi
    // bolalarning `margin-bottom`ini nolga tushiradi. Biz elementni boshqa
    // qatorga ko'chirsak, o'sha nol o'z qatorida "yolg'iz" qolib, flex chizig'i
    // cross o'lchamini buzadi (o'lchov: `fsheet-catchip[5]` +6px balandlik —
    // qator boshqa bolalarining 6px margin'i chiziqni 30.5px qilgan, nol
    // margin'li bola esa unga cho'zilgan). Shuning uchun qayta yurgizamiz.
    if (dirty && typeof window.__afAutoFill === "function") {
      try { window.__afAutoFill(document.body); } catch (e) { /* autofill yo'q */ }
    }
    // O'z yozuvlarimiz observer'ni qayta uyg'otmasin.
    setTimeout(function () { busy = false; }, 0);
  }

  // AE markupni varaq OCHILISHIDAN OLDIN joylaydi (o'sha paytda hamma
  // to'rtburchak 0×0) — shu sabab bir necha nuqtada va resize'da qayta yuramiz.
  [0, 300, 900, 2000, 3200].forEach(function (ms) { setTimeout(run, ms); });
  window.addEventListener("resize", function () { setTimeout(run, 60); });
  try {
    new MutationObserver(function () {
      if (busy) return;
      clearTimeout(run.__t);
      run.__t = setTimeout(run, 80);
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  } catch (e) { /* observer yo'q — taymerlar yetarli */ }

  window.FFWrapGap = run;
})();
