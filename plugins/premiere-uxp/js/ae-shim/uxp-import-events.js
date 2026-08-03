/*
 * Asosiy detail Import CTA'sini UXP-native hodisaga bog'laydi.
 *
 * Premiere UXP inline `onclick` atributini ishonchli bajarmaydi. Katalog kartasi
 * delegatsiya bilan ochilishi mumkin, ammo uzoq async download/import oqimi uchun
 * native listener kerak: aks holda host bo'sh `Uncaught JS Exception` chiqarib,
 * amaliyotni boshlamay qolishi kuzatildi.
 */
(function () {
  "use strict";

  try { if (!require("uxp")) return; } catch (e) { return; }

  var btn = document.getElementById("importSceneBtn");
  if (!btn || btn.__ffUxpImportBound) return;
  btn.__ffUxpImportBound = true;
  btn.removeAttribute("onclick");
  function runImport(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var fn = window.pd3ImportAll;
    if (typeof fn !== "function") return;
    try {
      Promise.resolve(fn()).catch(function (err) {
        try { console.error("[pd3ImportAll] failed", err && err.stack ? err.stack : err); } catch (_) {}
        if (typeof window.showToast === "function") window.showToast("Import error: " + ((err && err.message) || err), "error");
      });
    } catch (err) {
      try { console.error("[pd3ImportAll] failed", err && err.stack ? err.stack : err); } catch (_) {}
      if (typeof window.showToast === "function") window.showToast("Import error: " + ((err && err.message) || err), "error");
    }
  }

  // Detail hero qatlamlari UXP'da vizual button ustini yopib qolishi mumkin.
  // Hodisa targetiga emas, jonli CTA rect'iga qarab capture qilamiz.
  document.addEventListener("click", function (ev) {
    var target = ev && ev.target;
    var importTarget = target && target.closest ? target.closest("#importSceneBtn") : null;
    if (importTarget) {
      runImport(ev);
      return;
    }
    var rect = btn.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0 &&
        ev.clientX >= rect.left && ev.clientX <= rect.right &&
        ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
      runImport(ev);
      return;
    }

    // Katalog kartasi ham inline atributsiz, UXP-native listener bilan ochiladi.
    var card = target && target.closest ? target.closest(".ff-uxp-card") : null;
    if (!card) return;
    var name = card.getAttribute("data-ff-pack");
    if (name && typeof window.openPack === "function") window.openPack(name);
  }, true);
})();
