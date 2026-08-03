/*
 * UXP qayta chizish ("repaint") turtkisi — modal yopilgach panel QORA qolmasin.
 *
 * SABAB (Premiere'da o'lchangan): hisob oynasi (`#accountSheet`, butun panelni
 * qoplaydigan `position:fixed` qatlam) fondan yopilganda panel tanasi qop-qora
 * qolardi. DOM esa SOG'LOM edi — o'lchov: `homeGuest: display=block 650×697
 * bolalar=7`, `accountSheet: display=none`, yangi xato 0. Ya'ni layout to'g'ri,
 * UXP shunchaki ostidagi sohani QAYTA CHIZMAYDI: qoplama qatlami yo'qolganда
 * uning ortidagi piksellar bekor qilinmaydi.
 *
 * DAVO: qoplama yashirinishi bilan ildiz konteynerga chizishga ta'sir qiladigan
 * xossani bir lahzaga o'zgartirib qaytaramiz — bu paint invalidatsiyasini
 * majburlaydi. Flip SINXRON: orada hech qanday kadr chizilmaydi, shu sabab
 * miltillash yo'q (`visibility` tanlangani ham shu — `display:none` bo'lsa
 * ichkaridagi barcha scroll holati nolga tushardi).
 *
 * ANIQLASH: qaysi element "qoplama" ekanini QO'LDA ro'yxatlamaymiz (AE'da
 * o'nlab sheet/overlay bor va ro'yxat eskiradi) — O'LCHAYMIZ: port CSS'dan
 * yig'ilgan `position:fixed` nomzodlari (`__AF_FIXSEL`) ichidan "ko'rinadi +
 * panelning katta qismini qoplaydi" shartiga tushgani qoplama deb belgilanadi,
 * keyin YASHIRINGANDA turtki beriladi. Kuzatuv `MutationObserver`siz — u UXP'da
 * otilmaydi (spike §2) — bosish hodisasi + 1.2s davriy tekshiruv orqali.
 *
 * FAQAT UXP: brauzerdagi 1:1 QA etaloni tegilmasin (u yerda nuqson yo'q).
 */
(function () {
  "use strict";

  try { if (!require("uxp")) return; } catch (e) { return; }   // brauzer QA — tegmaymiz

  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window)
    : function (f) { return setTimeout(f, 16); };

  /** Turtki usuli. Jonli o'lchov uchun diag oynasidan almashtirsa bo'ladi. */
  var MODE = "vis";                 // vis | opacity | size | display
  var STAT = { kicks: 0, mode: MODE, last: "" };

  function rootEl() {
    // Qoplama butun panelni yopadi → ostidagi HAMMASI eskirgan bo'lishi mumkin.
    return document.getElementById("container") || document.body;
  }

  /**
   * Majburiy reflow. MUHIM: UXP'da `offsetWidth/offsetHeight` DOIM 0 qaytaradi
   * (spike §2) — ya'ni `void el.offsetHeight` layout'ni umuman qo'zg'atmaydi.
   * `getBoundingClientRect()` esa haqiqiy o'lchov, demak sinxron layout talab
   * qiladi. Natija ishlatilmasa ham chaqiruvning O'ZI kerak.
   */
  function reflow(el) {
    try { return el.getBoundingClientRect().height; } catch (e) { return 0; }
  }

  /** Sinxron flip: xossani qo'yamiz, reflow o'qiymiz, qaytaramiz. */
  function flip(el, prop, tmp) {
    var had = el.style.getPropertyValue(prop);
    el.style.setProperty(prop, tmp);
    reflow(el);                                  // majburiy reflow
    if (had) el.style.setProperty(prop, had); else el.style.removeProperty(prop);
    reflow(el);
  }

  /**
   * Panelni qayta chizishga majburlaydi.
   * @param {Element=} el turtki beriladigan tugun (sukut — ildiz konteyner)
   */
  function kick(el) {
    var t = (el && el.nodeType === 1) ? el : rootEl();
    if (!t) return;
    STAT.kicks++;
    STAT.mode = MODE;
    try {
      if (MODE === "opacity") {
        flip(t, "opacity", "0.996");
      } else if (MODE === "display") {
        // Eng kuchli, lekin eng qimmat: ichkaridagi scroll holati nolga tushadi.
        flip(t, "display", "none");
      } else if (MODE === "size") {
        // 1px tebranish — layout ham, paint ham bekor qilinadi.
        var h = reflow(t);
        if (h) flip(t, "min-height", (h + 1) + "px");
      } else {
        flip(t, "visibility", "hidden");
      }
      // Ikkinchi to'lqin: ba'zi qatlamlar faqat keyingi kadrда tiklanadi
      // (qoplamaning O'ZI hali daraxtda, `display:none` bilan turgan holat).
      raf(function () { reflow(document.body); });
      STAT.last = "ok";
    } catch (e) {
      STAT.last = String((e && e.message) || e);
    }
  }

  // ── Qoplamani aniqlash ───────────────────────────────────────────────────
  var PENDING = [];      // shu to'plamda tekshiriladigan tugunlar
  var scheduled = false;

  function visible(el) {
    if (!el.isConnected && el.isConnected !== undefined) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (!cs || cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  /**
   * Panel ko'rinish o'lchami. UXP'da `window.innerWidth/innerHeight` UNDEFINED
   * (spike §2) — `document.body.clientWidth/clientHeight` yagona ishonchli manba.
   */
  function viewport() {
    // `uxp-mmc.js` da o'lchangan ishonchli yo'l — ildiz qutisining rect'i.
    try {
      var r = document.documentElement.getBoundingClientRect();
      if (r.width && r.height) return { w: r.width, h: r.height };
    } catch (e) { /* pastdagi zaxira */ }
    var b = document.body;
    return { w: (b && b.clientWidth) || 0, h: (b && b.clientHeight) || 0 };
  }

  /** "Panelning katta qismini qoplaydigan fixed qatlam"mi? */
  function isBigOverlay(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (!cs || cs.position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    var v = viewport();
    if (!v.w || !v.h) return false;
    return r.width >= v.w * 0.6 && r.height >= v.h * 0.5;
  }

  // Belgilangan qoplamalar ro'yxati — `click` zaxirasi va sweep shundan yuradi
  // (panelda bir vaqtda 1–2 ta, ro'yxat kichik qoladi).
  var SEEN = [];

  function mark(el) {
    el.__ffOvl = 1;
    if (SEEN.indexOf(el) < 0) SEEN.push(el);
  }

  function process() {
    scheduled = false;
    var list = PENDING;
    PENDING = [];
    var needKick = false;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el || el.nodeType !== 1) continue;
      if (visible(el)) {
        if (isBigOverlay(el)) mark(el);            // ochilganda belgilanadi
      } else if (el.__ffOvl) {
        needKick = true;                            // yopildi → turtki
      }
    }
    if (needKick) kick();
  }

  function schedule(el) {
    if (el) PENDING.push(el);
    if (scheduled) return;
    scheduled = true;
    // Ikki `raf`: birinchisi mutatsiya to'plamini kutadi, ikkinchisi layout
    // tinchishini (aks holda `getBoundingClientRect` eski qiymatni beradi).
    raf(function () { raf(process); });
  }

  // MUHIM: `MutationObserver` bu yerda ISHLATILMAYDI. UXP'da konstruktor xato
  // bermaydi (ya'ni `try/catch` "bor" deb yolg'on aytadi), lekin kuzatuvchi
  // HECH QACHON otilmaydi — spike §2 da o'lchangan. Shunga tayansak, turtki
  // umuman kelmaydi. Shu sabab yagona yo'l — bosish + davriy tekshiruv.

  // Qoplama nomzodlari: port CSS'dan yiqqan `position:fixed` selektorlari
  // (`__AF_FIXSEL`). Bu `querySelectorAll("[class],[style]")` dan o'nlab marta
  // arzon — panelda mingdan ortiq tugun bor, fixed qoidalar esa o'nlab.
  var FIXSEL = (window.__AF_FIXSEL && window.__AF_FIXSEL.length)
    ? window.__AF_FIXSEL.join(",")
    : "";

  /** Yangi ochilgan qoplamalarni topib belgilaydi (MO o'rniga). */
  function sweep() {
    if (!FIXSEL) return;
    var n;
    try { n = document.querySelectorAll(FIXSEL); } catch (e) { return; }
    for (var i = 0; i < n.length; i++) {
      var el = n[i];
      if (el.__ffOvl) continue;
      if (visible(el) && isBigOverlay(el)) mark(el);
    }
  }

  // Premiere 26.2 ishlab chiqarish hostida global click → overlay sweep →
  // visibility flip ketma-ketligi rendererni doimiy paint/exception sikliga
  // tushirdi (birinchi katalog click'idan keyin ~80% CPU). Shu sabab avtomatik
  // observer yo'li yo'q: `kick()` diagnostika orqali yoki aniq nuqson uchun
  // maqsadli chaqiriladi. MutationObserver/taymerga qaytmaymiz.

  window.FFRepaint = {
    kick: kick,
    stat: STAT,
    /** Jonli o'lchov: diag oynasidan usulni almashtirish. */
    setMode: function (m) { MODE = m; STAT.mode = m; return m; },
    getMode: function () { return MODE; },
    /** Diagnostika: hozir nechta qoplama belgilangan. */
    seen: function () { return SEEN.length; },
  };
})();
