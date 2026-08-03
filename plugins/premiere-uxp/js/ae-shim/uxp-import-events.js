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
    var now = Date.now();
    if (runImport.__ffLast && now - runImport.__ffLast < 350) return;
    runImport.__ffLast = now;
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

  // Document capture Premiere 26.2 da hover hodisasini ko'radi-yu, click'ni
  // har doim bermaydi. Kritik CTA elementning o'zida native listener oladi.
  btn.addEventListener("mousedown", runImport);
  btn.addEventListener("click", runImport);

  function bindCards(root) {
    root = root && root.querySelectorAll ? root : document;
    var cards = root.querySelectorAll(".ff-uxp-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.__ffUxpCardBound) continue;
      card.__ffUxpCardBound = true;
      function openCard(ev) {
        var now = Date.now();
        if (this.__ffCardLast && now - this.__ffCardLast < 350) return;
        this.__ffCardLast = now;
        if (ev && ev.preventDefault) ev.preventDefault();
        var name = this.getAttribute("data-ff-pack");
        if (name && typeof window.openPack === "function") {
          Promise.resolve(window.openPack(name)).then(function () {
            if (typeof window.__ffBindNativeEvents === "function") window.__ffBindNativeEvents(document);
          });
        }
      }
      card.addEventListener("mousedown", openCard);
      card.addEventListener("click", openCard);
    }
  }
  window.__ffBindUxpCards = bindCards;
  bindCards(document);

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
    // Kartalar elementning o'zida native listener oladi (`bindCards`). Capture
    // fallback bu yerda takror import/detail ochmasin.
  }, true);
})();
