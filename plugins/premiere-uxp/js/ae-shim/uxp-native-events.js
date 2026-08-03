/*
 * Premiere UXP uchun inline hodisalarni haqiqiy element listenerlariga bog'laydi.
 *
 * UXP `onclick="..."` atributini parse qiladi, ammo foydalanuvchi bosganda uni
 * bajarmaydi. Document-capture delegatsiyasi ham Premiere 26.2 da panelga kelgan
 * pointer hodisalarida ishonchli emas: tugma hover bo'ladi, lekin Home/AI/Stock
 * navigatsiyasi o'zgarmaydi. Shu qatlam atribut kodini aynan elementning o'ziga
 * `addEventListener` bilan bog'laydi. Dinamik renderdan keyin chaqirish uchun
 * `window.__ffBindNativeEvents()` ochiq yordamchisi beriladi.
 */
(function () {
  "use strict";

  try { if (!require("uxp")) return; } catch (e) { return; }

  var EVENTS = ["click", "change", "input", "keydown", "keyup", "submit", "dblclick", "contextmenu"];
  var bound = new WeakMap();

  function repaintSoon() {
    if (!window.FFRepaint || typeof window.FFRepaint.kick !== "function") return;
    setTimeout(function () { window.FFRepaint.kick(); }, 0);
    setTimeout(function () { window.FFRepaint.kick(); }, 180);
  }

  function bindPrimary(id, action) {
    var el = document.getElementById(id);
    if (!el || el.__ffPrimaryBound) return;
    el.__ffPrimaryBound = true;
    el.removeAttribute("onclick");
    var lastRun = 0;
    function run(ev) {
      var now = Date.now();
      if (now - lastRun < 350) return;
      lastRun = now;
      if (ev && ev.preventDefault) ev.preventDefault();
      try { action(); repaintSoon(); }
      catch (e) {
        try { console.error("[uxp-native-events] #" + id + " failed", e); } catch (_) {}
      }
    }
    // Premiere 26.2 ayrim Drover/UXP joylashuvlarida hover va mouse-down
    // keladi, ammo yakuniy `click` yutiladi. Mousedown shu host nuqsonining
    // deterministic fallback'i; vaqt qo'riqchisi oddiy brauzer click'ida
    // amalni ikki marta yuritmaydi.
    el.addEventListener("mousedown", run);
    el.addEventListener("click", run);
  }

  function bindPrimaryNav() {
    // Eng muhim uchta yo'l alohida bog'lanadi: UXP'da programmatik `.click()`
    // hamda document capture ikkalasi ham host versiyasiga qarab yutilishi mumkin.
    bindPrimary("afSegHome", function () { if (typeof window.goHome === "function") window.goHome(); });
    bindPrimary("afSegAi", function () { if (typeof window.afNavTab === "function") window.afNavTab("ai"); });
    bindPrimary("afSegKatalog", function () { if (typeof window.afNavTab === "function") window.afNavTab("catalog"); });
  }

  function compile(el, attr) {
    var src = el.getAttribute(attr);
    if (!src) return null;
    try { return new Function("event", src); }
    catch (e) {
      try { console.error("[uxp-native-events] " + attr + " compile failed", e); } catch (_) {}
      return null;
    }
  }

  function bindOne(el, type) {
    var attr = "on" + type;
    if (!el || !el.hasAttribute || !el.hasAttribute(attr)) return;
    var mark = bound.get(el) || {};
    if (mark[type]) return;
    var fn = compile(el, attr);
    if (!fn) return;
    mark[type] = true;
    bound.set(el, mark);
    // Document-level legacy shim shu amalni ikkinchi marta bajarmasin.
    el.removeAttribute(attr);
    var lastRun = 0;
    function run(ev) {
      var now = Date.now();
      if (now - lastRun < 350) return;
      lastRun = now;
      var result;
      try { result = fn.call(el, ev); }
      catch (e) {
        try { console.error("[uxp-native-events] " + type + " failed", e); } catch (_) {}
        if (typeof window.showToast === "function") window.showToast("This action could not be completed", "error");
      }
      if (result === false && ev && ev.preventDefault) ev.preventDefault();
      // Ko'p handler `innerHTML` bilan nav/karta/sheet chizadi. MutationObserver
      // UXP'da yo'q; uchta arzon, aniq kechikish yangi tugunlarni bog'laydi.
      setTimeout(bindAll, 0);
      setTimeout(bindAll, 250);
      setTimeout(bindAll, 1200);
      repaintSoon();
    }
    if (type === "click") el.addEventListener("mousedown", run);
    el.addEventListener(type, run);
  }

  function bindAll(root) {
    bindPrimaryNav();
    root = root && root.querySelectorAll ? root : document;
    for (var i = 0; i < EVENTS.length; i++) {
      var type = EVENTS[i], attr = "on" + type;
      var list = root.querySelectorAll("[" + attr + "]");
      for (var j = 0; j < list.length; j++) bindOne(list[j], type);
      if (root !== document && root.hasAttribute && root.hasAttribute(attr)) bindOne(root, type);
    }
    if (typeof window.__ffBindUxpCards === "function") window.__ffBindUxpCards(root);
  }

  // Ba'zi Premiere/Drover panel joylashuvlarida UXP `mousedown` va `mouseup`
  // yuboradi, lekin ularning ortidan DOM `click` yasamaydi. Bu ayniqsa JS bilan
  // dinamik yaratilgan AI kartalarini (ular closure ichidagi native listenerga
  // ega) butunlay o'lik qoldirardi. Oddiy click 40 ms ichida kelmasa, aynan
  // bosilgan tugunda programmatik click dispatch qilamiz. Brauzer/AE inert,
  // normal UXP click esa `lastClickAt` qo'riqchisi bilan takrorlanmaydi. 180 ms
  // kechikish hostning biroz kech keladigan haqiqiy click'iga ustuvorlik beradi
  // va pul sarflaydigan dinamik tugmalarni ikki marta yuritmaydi.
  var lastClickTarget = null;
  var lastClickAt = 0;
  document.addEventListener("click", function (ev) {
    lastClickTarget = ev && ev.target;
    lastClickAt = Date.now();
  }, true);
  document.addEventListener("mousedown", function (ev) {
    var target = ev && ev.target;
    if (!target || target.nodeType !== 1 || typeof target.click !== "function") return;
    var tag = String(target.tagName || "").toLowerCase();
    var editor = target;
    if (target.closest) editor = target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]') || target;
    var editorTag = String(editor.tagName || tag).toLowerCase();
    if ((editorTag === "input" || editorTag === "textarea" || editorTag === "select" ||
         editor.getAttribute("contenteditable") === "true" || editor.getAttribute("role") === "textbox") &&
        typeof editor.focus === "function") {
      try { editor.focus(); } catch (_) {}
    }
    var stamp = Date.now();
    setTimeout(function () {
      var matched = lastClickAt >= stamp &&
        (lastClickTarget === target ||
         (target.contains && target.contains(lastClickTarget)) ||
         (lastClickTarget && lastClickTarget.contains && lastClickTarget.contains(target)));
      if (matched || !target.isConnected) return;
      // Dinamik tugma (ayniqsa Generate) faqat o'z handlerini yuritsin.
      // Umumiy root repaint bu yerda pul sarflaydigan async oqim boshlangan payt
      // kompozitorni qora kadrda qoldirishi mumkin; navigatsiya repaint'i yuqoridagi
      // primary/inline handlerlarda maqsadli ravishda allaqachon bajariladi.
      try { target.click(); }
      catch (e) { try { console.error("[uxp-native-events] click fallback failed", e); } catch (_) {} }
    }, 180);
  }, true);

  window.__ffBindNativeEvents = bindAll;
  bindAll(document);
  setTimeout(bindAll, 250);
  setTimeout(bindAll, 1200);
})();
