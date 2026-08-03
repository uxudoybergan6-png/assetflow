/*
 * `transform: translate(...)` markazlash kompensatsiyasi — FAQAT UXP.
 *
 * MUAMMO: veb-da markazlashning standart idiomasi
 *     left:50%; top:50%; transform:translate(-50%,-50%)
 * Agar UXP `transform`ni RENDERDA qo'llamasa, element yarim kengligiga o'ngga
 * va yarim balandligiga pastga surilgan bo'lib qoladi → qo'shni matn ustiga
 * chiqadi (mehmon Home'dagi "A PEEK AT THE CATALOG" ustma-ustligi shundan
 * gumon qilingan).
 *
 * TAXMIN QILMAYMIZ — O'LCHAYMIZ: boot'da zond element yasab, `translateX(-50%)`
 * uning `getBoundingClientRect().left` ini haqiqatan siljitadimi deb ko'ramiz.
 *   · siljitsa  → shim NO-OP (hech nimaga tegmaydi, natija brauzer bilan bir xil)
 *   · siljitmasa → `margin-left`/`margin-top` bilan AYNAN o'sha siljish beriladi
 *
 * Qamrov: `position:absolute|fixed` elementlar. Oqim ichidagi element uchun
 * margin LAYOUTni o'zgartiradi (qo'shnilarni suradi), transform esa yo'q —
 * ya'ni u yerda kompensatsiya davodan battar bo'lardi. Oqimdagi `translate`lar
 * AE'da faqat hover ko'tarilishi/animatsiya — UXP ularni baribir chizmaydi.
 *
 * Ro'yxatni `scripts/ae-port.mjs` yig'adi (`window.__AF_XFC`) — CSS matniga
 * tegilmagan, brauzerdagi 1:1 QA etaloni o'zgarmaydi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  // FFLog — OBYEKT, fabrika EMAS (chaqirilsa shim shu qatorda o'ladi).
  var log = window.FFLog || { warn: function () {}, error: function () {}, info: function () {} };

  var stat = { probe: "", runs: 0, set: 0, skip: 0, err: "" };
  window.__ffXfcStat = stat;

  /**
   * Jonli zond: `transform: translateX(-50%)` qutini siljitadimi?
   * @returns {boolean} true — UXP transform'ni qo'llaydi (shim kerak emas)
   */
  function transformWorks() {
    var el = null;
    try {
      el = document.createElement("div");
      // `position:fixed` — hujjat oqimiga umuman ta'sir qilmaydi; `visibility`
      // yashirin bo'lsa ham `getBoundingClientRect` o'lchanadi.
      el.style.setProperty("position", "fixed");
      el.style.setProperty("left", "0px");
      el.style.setProperty("top", "0px");
      el.style.setProperty("width", "100px");
      el.style.setProperty("height", "20px");
      el.style.setProperty("visibility", "hidden");
      // MUHIM: element daraxtga QO'SHILMAGUNCHA o'lchanmaydi (rect 0×0).
      document.body.appendChild(el);
      var before = el.getBoundingClientRect().left;
      el.style.setProperty("transform", "translateX(-50%)");
      var after = el.getBoundingClientRect().left;
      var d = after - before;
      stat.probe = "d=" + Math.round(d);
      // Kutilgan siljish −50px. Yarmidan ko'pi bajarilsa "ishlaydi" deymiz.
      return d <= -25;
    } catch (e) {
      stat.err = String((e && e.message) || e);
      // Zond yiqilsa — TEGMAYMIZ. Noto'g'ri kompensatsiya nuqsondan yomonroq.
      return true;
    } finally {
      try { if (el && el.parentNode) el.parentNode.removeChild(el); } catch (e2) { /* jim */ }
    }
  }

  /** Panel o'lchami — `window.innerWidth` UXP'da UNDEFINED. */
  function viewport() {
    var r = document.documentElement.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  /** `@media` sharti (uxp-mmc.js dagi bilan bir xil mantiq). */
  function mediaOk(m, vp) {
    if (!m) return true;
    try { if (window.matchMedia) return window.matchMedia(m).matches; } catch (e) { /* zaxira */ }
    var ok = true, re = /\(\s*(max|min)-width\s*:\s*([\d.]+)px\s*\)/gi, x;
    while ((x = re.exec(m))) {
      var n = parseFloat(x[2]);
      ok = ok && (x[1].toLowerCase() === "max" ? vp.w <= n : vp.w >= n);
    }
    return ok;
  }

  /**
   * Muallif margin'i — BIR MARTA yozib olinadi. Aks holda ikkinchi yurishda
   * o'zimiz qo'ygan qiymatni "muallifniki" deb o'qib, siljish qo'shilib
   * ketaverardi (pill-radius.js dagi bilan bir xil ehtiyot).
   */
  function baseMargin(el) {
    if (el.__ffXfcBase) return el.__ffXfcBase;
    var cs = getComputedStyle(el);
    var b = { l: parseFloat(cs.marginLeft) || 0, t: parseFloat(cs.marginTop) || 0 };
    el.__ffXfcBase = b;
    return b;
  }

  /** Foizli/px'li siljishni pikselga aylantiradi (foiz asosi — elementning O'ZI). */
  function offsetPx(term, size) {
    if (!term) return 0;
    if (term.u === "px") return term.v;
    return (term.v / 100) * size;
  }

  var applying = false;

  function apply() {
    var list = window.__AF_XFC;
    if (!list || !list.length || applying) return;
    applying = true;
    stat.runs++;
    try {
      var vp = viewport();
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var els;
        try { els = document.querySelectorAll(r.s); } catch (e) { continue; }
        if (!els.length) continue;
        var on = mediaOk(r.m, vp);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          var cs;
          try { cs = getComputedStyle(el); } catch (e2) { continue; }
          // Faqat oqimdan chiqqan elementlar — pastdagi izohga qara.
          if (!cs || (cs.position !== "absolute" && cs.position !== "fixed")) { stat.skip++; continue; }
          var b = baseMargin(el);
          if (!on) {
            el.style.setProperty("margin-left", b.l + "px");
            el.style.setProperty("margin-top", b.t + "px");
            continue;
          }
          var rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) { stat.skip++; continue; }   // hali chizilmagan
          el.style.setProperty("margin-left", (b.l + offsetPx(r.x, rect.width)) + "px");
          el.style.setProperty("margin-top", (b.t + offsetPx(r.y, rect.height)) + "px");
          stat.set++;
        }
      }
    } catch (e) {
      // Bayroq osilib qolmasin — bir xatodan keyin shim jim o'lmasin.
      stat.err = String((e && e.message) || e);
      log.error("xform-center apply:", stat.err);
    }
    applying = false;
  }
  window.__ffXfcApply = apply;

  function init() {
    if (transformWorks()) {
      stat.probe += " → transform ISHLAYDI, shim no-op";
      log.info("xform-center: transform qo'llanadi — kompensatsiya kerak emas (" + stat.probe + ")");
      return;
    }
    stat.probe += " → transform QO'LLANMAYDI, margin kompensatsiyasi";
    log.warn("xform-center: " + stat.probe);

    // Layout tinchigach (yangi tugun o'sha kadrda 0×0 o'lchanadi).
    setTimeout(apply, 0);
    setTimeout(apply, 250);
    setTimeout(apply, 1200);
    window.addEventListener("resize", function () { setTimeout(apply, 60); });
    // Modal/menyu/karta KEYIN yaratiladi. `MutationObserver` UXP'da otilmaydi
    // (spike §2) — bosish + sekin taymer yagona ishonchli yo'l. Ro'yxat kichik
    // (o'nlab selektor), shu bois arzon.
    document.addEventListener("click", function () { setTimeout(apply, 60); }, true);
    setInterval(apply, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
