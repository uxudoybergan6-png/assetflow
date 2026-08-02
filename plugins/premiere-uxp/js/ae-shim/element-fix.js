/*
 * Element shim — UXP native widget'larining o'rnini bosish.
 *
 * O'lchov (SPIKE-NATIJA §9): UXP `<button>` ni NATIVE widget qilib chizadi —
 * `background-color`/`color`/`border` e'tiborga olinmaydi (garchi
 * `getComputedStyle` ularni qaytarsa ham: bu TUZOQ, dalil emas). Port markup va
 * JS shablonlaridagi `<button>` larni `<div role="button">` ga aylantirdi, biroq
 * `document.createElement('button')` (13 joy) ish vaqtida bo'ladi — shu sabab
 * fabrikani ham o'raymiz.
 *
 * Shuningdek `<template>` va `DOMParser` UXP'da YO'Q; AE kodi ularni ishlatsa
 * `innerHTML` ga asoslangan muqobil beramiz.
 */
(function () {
  "use strict";

  // ── createElement('button') → <div role="button"> ───────────────────────────
  var origCreate = document.createElement.bind(document);
  document.createElement = function (tag, opts) {
    if (String(tag).toLowerCase() === "button") {
      var d = origCreate("div", opts);
      d.setAttribute("role", "button");
      d.setAttribute("tabindex", "0");
      // AE kodi `btn.type='button'` va `btn.disabled=true` yozadi — div'da bular
      // oddiy xossa bo'lib qolardi va CSS ko'rmasdi. Atributga ko'chiramiz.
      Object.defineProperty(d, "disabled", {
        configurable: true,
        get: function () { return this.hasAttribute("disabled"); },
        set: function (v) {
          if (v) { this.setAttribute("disabled", ""); this.setAttribute("aria-disabled", "true"); }
          else { this.removeAttribute("disabled"); this.removeAttribute("aria-disabled"); }
        },
      });
      Object.defineProperty(d, "type", {
        configurable: true, writable: true, value: "button",
      });
      return d;
    }
    return origCreate(tag, opts);
  };

  // ── <template> o'rnini bosuvchi ─────────────────────────────────────────────
  // AE kodi `tpl.content.cloneNode(true)` naqshini ishlatsa — UXP'da `content`
  // yo'q. Parse qilishni oddiy `<div>` orqali bajaramiz.
  if (typeof window.DOMParser === "undefined") {
    window.DOMParser = function () {};
    window.DOMParser.prototype.parseFromString = function (str, type) {
      var host = origCreate("div");
      host.innerHTML = String(str || "");
      // Minimal `Document` yuzasi — AE faqat `body`/`querySelector` ishlatadi.
      return {
        body: host,
        documentElement: host,
        querySelector: host.querySelector.bind(host),
        querySelectorAll: host.querySelectorAll.bind(host),
        getElementById: function (id) { return host.querySelector("#" + id); },
        __contentType: type || "text/html",
      };
    };
  }

  // ── UXP'da yo'q global'lar ──────────────────────────────────────────────────
  if (typeof window.structuredClone !== "function") {
    window.structuredClone = function (v) { return JSON.parse(JSON.stringify(v)); };
  }
  if (typeof window.TextDecoder === "undefined" && window.FFBytes) {
    window.TextDecoder = function () {};
    window.TextDecoder.prototype.decode = function (buf) { return window.FFBytes.utf8Decode(buf); };
  }
  if (typeof window.TextEncoder === "undefined" && window.FFBytes) {
    window.TextEncoder = function () {};
    window.TextEncoder.prototype.encode = function (s) { return window.FFBytes.utf8Encode(s); };
  }

  /*
   * `Element.animate` (WAAPI) va CSS `transition` UXP'da ISHLAMAYDI (§11).
   * AE kodi `el.animate(...).finished.then(...)` naqshini ishlatsa, `undefined`
   * ustidan `.finished` o'qib yiqilardi — darhol tugagan stub qaytaramiz.
   */
  if (typeof Element.prototype.animate !== "function") {
    Element.prototype.animate = function () {
      var done = Promise.resolve();
      return {
        finished: done, ready: done,
        play: function () {}, pause: function () {}, cancel: function () {},
        finish: function () {}, reverse: function () {},
        addEventListener: function (t, fn) { if (t === "finish" && fn) setTimeout(fn, 0); },
        removeEventListener: function () {},
      };
    };
  }
})();
