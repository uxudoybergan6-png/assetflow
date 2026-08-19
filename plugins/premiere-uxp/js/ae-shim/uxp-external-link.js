/*
 * "Brauzer ochildi" da'vosini HALOL qiladi — FAQAT UXP.
 *
 * AE (CEP) da tashqi havola sinxron ochiladi va `openExternal` haqiqiy
 * true/false beradi. UXP'da esa `uxp.shell.openExternal` — async va RUXSAT
 * modali chiqaradi ("… wants to open: https://getframeflow.app/device.html").
 * Foydalanuvchi "Block" bossa ham panel allaqachon "Browser opened — type this
 * code there, then sign in." kartasini chizib bo'lgan bo'ladi. Natijada Google
 * kirishi imkonsiz ko'rinadi: brauzer ochilmagan, panel esa ochilgan deydi.
 *
 * Bu yerda `csinterface-shim.js` e'lon qiladigan `ff-open-external` hodisasini
 * kutamiz va rad javobi kelsa kartaning BIRINCHI qatorini tuzatamiz. Kod va
 * havola blokiga TEGMAYMIZ — ular allaqachon o'rnida va nusxalash tugmalari
 * `uxp-clipboard.js` bilan ishlaydi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  var FAIL = "Couldn’t open the browser (permission denied) — copy the link below and open it manually.";

  window.addEventListener("ff-open-external", function (ev) {
    var d = (ev && ev.detail) || {};
    if (d.ok) return;

    var hint = document.getElementById("accGoogleHint");
    if (!hint || hint.style.display === "none") {
      // Checkout, billing, admin and password-reset actions also use the same
      // async UXP permission prompt. If the user blocks it, do not leave the
      // earlier optimistic "Opening…" toast as the final truth.
      if (typeof window.showToast === "function") {
        window.showToast("Couldn’t open the browser — allow external links or try again", "error");
      }
      return;
    }

    // Karta ikki ko'rinishda keladi (AE `accountLoginWithGoogle`): "opened" da
    // birinchi <span> — status matni; "couldn't open" da allaqachon to'g'ri.
    var first = hint.firstElementChild;
    if (!first || first.id) return;                 // kutilgan tuzilma emas — tegmaymiz
    if (first.tagName !== "SPAN") return;
    if (first.textContent === FAIL) return;         // ikki marta yozmaymiz

    first.textContent = FAIL;
    first.style.setProperty("color", "var(--warn, #f59e0b)");
    first.style.setProperty("font-weight", "600");

    // Havola bloki ko'zga tashlansin — endi u YAGONA yo'l.
    var urlEl = document.getElementById("afGsigUrl");
    if (urlEl) {
      urlEl.style.setProperty("padding", "8px");
      urlEl.style.setProperty("border-width", "1px");
      urlEl.style.setProperty("border-style", "solid");
      urlEl.style.setProperty("border-color", "var(--accent)");
      urlEl.style.setProperty("border-radius", "8px");
    }
  });
})();
