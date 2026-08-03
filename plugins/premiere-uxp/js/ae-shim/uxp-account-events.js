/*
 * Account kirish tugmalarini UXP-native hodisalarga bog'laydi.
 *
 * AE markupidagi login tugmalari faqat inline `onclick` ishlatadi. Premiere
 * UXP atributni parse qiladi, lekin foydalanuvchi bosganda bajarmaydi. Umumiy
 * inline shim keng UI uchun qoladi; auth darvozasi esa kritик bo'lgani uchun
 * bu yerda kech, aniq va dublikatsiyasiz native listener oladi.
 */
(function () {
  "use strict";

  try { if (!require("uxp")) return; } catch (e) { return; }

  function bind(id, selector, handlerName) {
    var root = document.getElementById(id);
    var el = root && root.querySelector(selector);
    if (!el || el.__ffUxpAccountBound) return;
    el.__ffUxpAccountBound = true;
    // Umumiy inline shim ham shu amalni ikkinchi marta bajarmasin.
    el.removeAttribute("onclick");
    el.addEventListener("click", function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      var fn = window[handlerName];
      if (typeof fn === "function") fn();
    });
  }

  bind("accountLoginBlock", ".lg-primary", "accountLogin");
  bind("accountLoginBlock", "#accGoogleBtn", "accountLoginWithGoogle");
})();
