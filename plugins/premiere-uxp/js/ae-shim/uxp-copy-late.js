/*
 * `afCopyText` ni UXP bufer yo'liga ulaydi — FAQAT UXP, KECH yuklanadi.
 *
 * NEGA KECH: qolgan shim'lar AE skriptlaridan OLDIN yuklanadi, `afCopyText`
 * esa AE manbasida (`AssetFlow_Plugin.html:11925`) `window.afCopyText=…` bilan
 * KEYIN e'lon qilinadi va oldingi har qanday ta'rifni bosib ketadi. Shu bois bu
 * fayl `ae-port.mjs` da AE skriptlaridan KEYIN qo'yiladi.
 *
 * NEGA UMUMAN KERAK (o'lchov bilan):
 *   1. AE yo'li: yashirin <textarea> → `ta.select()` → `execCommand('copy')`.
 *   2. Panelda bosish tugmaga YETADI — bosishlar izi `DIV#afGsigCopyCode
 *      «Copy code»` ni ko'rsatdi.
 *   3. Ammo `uxp-clipboard.js` dagi `execCommand` yamog'i HECH QACHON
 *      chaqirilmadi (`execCommand izi: (chaqirilmagan)`) va bufer o'zgarmadi
 *      (paste sinovi eski matnni qaytardi) — ya'ni AE zanjiri UXP'da `select()`
 *      /`execCommand` bosqichida jim uzilib qoladi.
 *   4. Ayni paytda `navigator.clipboard.setContent` ISHLAYDI — paste sinovi
 *      buni tasdiqladi (manifestga `clipboard: readAndWrite` qo'shilgach).
 * Xulosa: mexanizmni almashtiramiz, SHARTNOMANI saqlaymiz.
 *
 * Shartnoma 1:1 (AE:11925): bitta toast — muvaffaqiyatda "Prompt copied",
 * aks holda "Copy failed"; qaytish qiymati boolean. Yagona farq — toast
 * yozuvning HAQIQIY natijasidan keyin chiqadi (UXP yozuvi async), ya'ni
 * yolg'on "copied" bo'lishi mumkin emas.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  var orig = typeof window.afCopyText === "function" ? window.afCopyText : null;

  function dbg(msg) {
    if (!window.__ffClipDbg) return;
    window.__ffClipDbg.push(msg);
    if (window.__ffClipDbg.length > 6) window.__ffClipDbg.shift();
  }

  function toast(ok) {
    try {
      if (typeof window.showToast === "function") {
        window.showToast(ok ? "Prompt copied" : "Copy failed", ok ? "success" : "error");
      }
    } catch (e) { /* toast bo'lmasa — jim */ }
  }

  // Ikki marta yozishdan himoya: quyidagi delegat va AE'ning O'Z ishlovchisi
  // bir bosishda ikkalasi ham ishga tushsa — bitta yozuv, bitta toast bo'lsin.
  var lastText = null;
  var lastAt = 0;

  window.afCopyText = function (text) {
    var t = String(text == null ? "" : text);
    var w = window.__ffClipWrite;
    if (typeof w !== "function") {
      dbg("afCopyText: __ffClipWrite YO'Q → AE yo'li");
      return orig ? orig(t) : false;
    }
    var now = Date.now();
    if (t && t === lastText && now - lastAt < 800) {
      dbg("afCopyText: takror (o'tkazib yuborildi)");
      return true;
    }
    lastText = t; lastAt = now;
    dbg("afCopyText(" + t.length + " belgi)");
    w(t).then(
      function () { dbg("afCopyText: yozildi ✔"); toast(true); },
      function (e) {
        dbg("afCopyText: XATO " + ((e && e.message) || e));
        log.error("nusxa olinmadi:", e);
        toast(false);
      }
    );
    return true;    // AE zanjiri sinxron boolean kutadi
  };

  // AE'dagi eski nom ham shu yerga yo'naltirilgan (`afCopyFallback`).
  window.afCopyFallback = function (text) { return window.afCopyText(text); };

  /*
   * Google qurilma-kodi kartasi — DELEGAT ishlovchi.
   *
   * O'lchov (Premiere'da, bir necha qayta qurish/qayta ishga tushirishdan keyin):
   *   • bosish tugmaga YETADI — `bosishlar izi: DIV#afGsigCopyCode «Copy code»`;
   *   • ammo AE'ning `getElementById('afGsigCopyCode')?.addEventListener(...)`
   *     ishlovchisidan HECH QANDAY iz yo'q — na `afCopyText` izi, na `execCommand`.
   * Ya'ni `hint.innerHTML` ga yangi qo'yilgan tugmaga biriktirilgan bevosita
   * listener UXP'da ishga tushmayapti (tugun almashadimi yoki biriktirish
   * paytida element hali yo'qmi — farqi yo'q: ikkala holatda ham davosi bitta).
   *
   * Yechim: `document` darajasidagi CAPTURE delegat. U qayta chizishdan ham,
   * tugun almashuvidan ham omon qoladi va qiymatlarni KARTANING O'ZIDAN
   * (`#afGsigCode` / `#afGsigUrl` matni) oladi — closure'ga bog'liq emas.
   * Xulq 1:1 AE bilan bir xil; AE ishlovchisi baribir ishga tushsa,
   * yuqoridagi takror-himoyasi ikkinchi yozuvni to'xtatadi.
   */
  function cardText(id) {
    var el = document.getElementById(id);
    return el ? String(el.textContent || "").trim() : "";
  }

  function closestId(node, id) {
    for (var n = node; n; n = n.parentNode) {
      if (n.id === id) return n;
      if (n === document.body) break;
    }
    return null;
  }

  /** AE'ning o'z ishlovchisiga BIRINCHI navbat beriladi; u ishlamasa — zaxira. */
  function fallback(what, run) {
    var before = lastAt;
    setTimeout(function () {
      if (lastAt !== before) { dbg("zaxira: " + what + " — AE ishlovchisi ishladi"); return; }
      dbg("zaxira: " + what + " — AE jim, delegat bajardi");
      run();
    }, 0);
  }

  document.addEventListener("click", function (e) {
    var t = e && e.target;
    if (!t) return;

    if (closestId(t, "afGsigCopyCode")) {
      fallback("Copy code", function () { window.afCopyText(cardText("afGsigCode")); });
      return;
    }
    if (closestId(t, "afGsigCopyLink")) {
      fallback("Copy link", function () { window.afCopyText(cardText("afGsigUrl")); });
      return;
    }
    if (closestId(t, "afGsigOpen")) {
      fallback("Open again", function () {
        var url = cardText("afGsigUrl");
        if (!url) return;
        var ok = false;
        try {
          ok = window.AssetFlowAccount && window.AssetFlowAccount.openExternal
            ? window.AssetFlowAccount.openExternal(url) : false;
        } catch (x) { ok = false; }
        // openExternal UXP'da async — natija Promise bo'lishi mumkin.
        if (ok && typeof ok.then === "function") return;
        if (!ok) {
          try {
            if (typeof window.showToast === "function") {
              window.showToast("Still couldn’t open the browser — please copy the link", "warning");
            }
          } catch (x2) { /* jim */ }
        }
      });
    }
  }, true);
})();
