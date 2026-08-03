/*
 * Panel ichidagi diagnostika oynasi — FAQAT UXP + FAQAT dev o'rnatmasi.
 *
 * SABAB: Premiere'da konsol yo'q (UXP Developer Tool o'rnatilmagan bo'lishi
 * mumkin), shu sabab "panel bo'sh chiqdi" kabi nuqsonni taxmin bilan emas,
 * O'LCHOV bilan hal qilish uchun xatolarni panelning o'zida ko'rsatamiz.
 *
 * Ko'rinish sharti: `#afBuild` shtampi `dev-` bilan boshlanishi kerak
 * (`scripts/install-uxp-dev.mjs` shunday uradi). `.ccx` relizida shtamp
 * `<versiya>-<flavor>` bo'ladi → oyna umuman qurilmaydi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }   // brauzer QA — tegmaymiz
  if (!uxp) return;

  function isDev() {
    var el = document.getElementById("afBuild");
    return !!el && /(^|[:\s])dev-/.test(el.textContent || "");
  }

  var LOG = [];
  // Boot xatolari ALOHIDA saqlanadi: hisobot tugmalari `LOG` ni tozalaydi,
  // panel yuklanishidagi xatolar esa aynan eng qimmatlisi.
  var BOOT = [];
  var box = null, pre = null, badge = null;

  function push(kind, msg) {
    LOG.push(kind + ": " + msg);
    if (/^(ERR|REJ|LOG)$/.test(kind) && BOOT.length < 30) BOOT.push(kind + ": " + msg);
    if (LOG.length > 60) LOG.shift();
    if (badge) badge.textContent = "⚠ " + LOG.length;
    if (pre) pre.textContent = LOG.join("\n");
  }

  window.addEventListener("error", function (e) {
    push("ERR", (e.message || "?") + "  @" + (e.filename || "?") + ":" + (e.lineno || 0));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    push("REJ", (r && (r.stack || r.message)) || String(r));
  });
  if (window.console && console.error) {
    var orig = console.error;
    console.error = function () {
      try { push("LOG", Array.prototype.join.call(arguments, " ")); } catch (x) { /* jim */ }
      return orig.apply(console, arguments);
    };
  }

  // Bosishlar izi: "tugma ishlamadi" da birinchi savol — bosish TUGMAGA
  // yetdimi yoki ustidagi qatlam ushlab qoldimi (diag oynasi ham qatlam!).
  var CLICKS = [];
  document.addEventListener("click", function (e) {
    var t = e && e.target;
    if (!t) return;
    CLICKS.push((t.tagName || "?")
      + (t.id ? "#" + t.id : "")
      + (t.className ? "." + String(t.className).split(/\s+/)[0] : "")
      + " «" + String(t.textContent || "").trim().slice(0, 18) + "»");
    if (CLICKS.length > 6) CLICKS.shift();
  }, true);

  /** Bo'sh ekran diagnostikasi: asosiy konteynerlarning o'lchami va ko'rinishi. */
  function probe() {
    var ids = ["homeMain", "homeGuest", "accountSheet", "pgHome", "afPages", "app"];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) { out.push(ids[i] + ": YO'Q"); continue; }
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      out.push(ids[i] + ": display=" + cs.display + " vis=" + cs.visibility
        + " " + Math.round(r.left) + "," + Math.round(r.top)
        + " " + Math.round(r.width) + "×" + Math.round(r.height)
        + " bolalar=" + el.children.length);
    }
    // Ajdodlar zanjiri — "panel ichkariga surildi / bo'sh qoldi" ni kim
    // qilayotganini topish uchun: har bosqichda rect + padding + transform.
    var seed = document.getElementById("homeGuest") || document.getElementById("homeMain");
    var chain = [], n = seed, guard = 0;
    while (n && n.nodeType === 1 && guard++ < 12) {
      var c = getComputedStyle(n), rr = n.getBoundingClientRect();
      chain.push((n.id ? "#" + n.id : n.tagName.toLowerCase())
        + "." + String(n.className || "-").split(" ").slice(0, 2).join(".")
        + " " + Math.round(rr.left) + "," + Math.round(rr.top)
        + " " + Math.round(rr.width) + "×" + Math.round(rr.height)
        + " pad=" + c.paddingLeft + "/" + c.paddingRight
        + " mar=" + c.marginLeft + "/" + c.marginRight
        + " tr=" + (c.transform === "none" ? "-" : c.transform)
        + " ov=" + c.overflowY);
      n = n.parentElement;
    }
    push("ZANJIR", "\n  " + chain.join("\n  ") + "\n  " + out.join("\n  "));
  }

  /** Clipboard: qaysi API bor va `uxp-clipboard.js` qaysi yo'lni tanladi. */
  function clipProbe() {
    // `navigator.clipboard` XOSSASINI O'QISH tashlaydi (manifestda ruxsat yo'q
    // bo'lsa) — shu bois oddiy tekshiruv ham try ichida.
    var nc = null, ncErr = "";
    try { nc = (typeof navigator !== "undefined" && navigator.clipboard) || null; }
    catch (e) { ncErr = String((e && e.message) || e); }
    var c = null;
    try { c = require("uxp").clipboard || null; } catch (e) { /* ixtiyoriy */ }
    var res = [
      "navigator.clipboard=" + (nc ? "bor" : (ncErr ? "XATO: " + ncErr : "yo'q")),
      "  .setContent=" + (nc && typeof nc.setContent),
      "  .writeText=" + (nc && typeof nc.writeText),
      "uxp.clipboard=" + (c ? "bor" : "yo'q"),
      "document.execCommand=" + typeof document.execCommand
        + (document.execCommand && document.execCommand.__ff ? " (yamoq ✔)" : " (YAMOQ YO'Q)"),
      "tanlangan yo'l=" + window.__ffClipPath,
      "openExternal oxirgi natija=" + String(window.__ffOpenExternalOk),
      "execCommand izi:",
    ].concat(
      (window.__ffClipDbg && window.__ffClipDbg.length)
        ? window.__ffClipDbg.map(function (x) { return "  " + x; })
        : ["  (chaqirilmagan)"],
      ["bosishlar izi:"],
      CLICKS.length ? CLICKS.map(function (x) { return "  " + x; }) : ["  (yo'q)"]
    );
    // Haqiqiy yozuv sinovi — API bor deyish yetarli emas.
    // Sinxron `throw` ni ham ushlaymiz: aks holda hisobot chizilmasdan o'ladi va
    // ekranda ESKI hisobot qolib, "tugma ishlamadi" degan xato xulosa chiqadi.
    if (typeof window.__ffClipWrite === "function") {
      try {
        window.__ffClipWrite("FrameFlow clipboard test").then(
          function () { push("CLIP", "yozuv OK → " + window.__ffClipPath); },
          function (e) { push("CLIP", "yozuv XATO: " + ((e && e.message) || e)); }
        );
      } catch (e) {
        res.push("yozuv SINXRON XATO: " + ((e && e.message) || e));
      }
    } else {
      res.push("__ffClipWrite: YO'Q (shim yuklanmagan)");
    }
    push("CLIP", "\n  " + res.join("\n  "));
  }

  /**
   * UXP CSS qo'llab-quvvatlash matritsasi: qisqartma/funksiya HAQIQATAN
   * qo'llanadimi? Taxmin qilmaymiz — o'lchaymiz.
   */
  function cssProbe() {
    var host = document.createElement("div");
    host.style.setProperty("position", "fixed");
    host.style.setProperty("left", "-9999px");
    host.style.setProperty("top", "0");
    host.style.setProperty("width", "200px");
    host.style.setProperty("height", "100px");
    document.body.appendChild(host);

    var CASES = [
      ["inset:0", "position:absolute;inset:0", "top"],
      ["top:0 (nazorat)", "position:absolute;top:0;left:0", "top"],
      ["padding:2px 8px", "padding:2px 8px", "padding-left"],
      ["margin:0 auto", "width:50px;margin:0 auto", "margin-left"],
      ["overflow:hidden", "overflow:hidden", "overflow-x"],
      ["flex:1", "flex:1", "flex-grow"],
      ["max-width:min()", "max-width:min(50px,100%)", "max-width"],
      ["max-width:calc()", "max-width:calc(50px + 5px)", "max-width"],
      ["max-height:88vh", "max-height:88vh", "max-height"],
      ["border-radius:50%", "border-radius:50%", "border-top-left-radius"],
      ["place-items:center", "display:flex;place-items:center", "align-items"],
    ];
    var out = [];
    for (var i = 0; i < CASES.length; i++) {
      var el = document.createElement("div");
      el.setAttribute("style", CASES[i][1]);
      host.appendChild(el);
      var v = "?";
      try { v = getComputedStyle(el).getPropertyValue(CASES[i][2]); } catch (e) { v = "XATO"; }
      out.push(CASES[i][0] + " → " + CASES[i][2] + "=" + (v || "(bo'sh)"));
    }
    /* O'lchangan (hisoblangan satr emas — HAQIQIY piksel) */
    var MEAS = [
      ["height:50vh", "height:50vh"],
      ["width:50vw", "width:50vw"],
      ["width:calc(50% + 10px)", "width:calc(50% + 10px)"],
      ["width:min(50px,100%)", "width:min(50px,100%)"],
      ["width:clamp(20px,50%,40px)", "width:clamp(20px,50%,40px)"],
    ];
    var els = [];
    for (var j = 0; j < MEAS.length; j++) {
      var m = document.createElement("div");
      m.setAttribute("style", MEAS[j][1]);
      m.textContent = ".";
      host.appendChild(m);
      els.push(m);
    }
    // `uxp-mmc.js` haqiqatan qiymat qo'ydimi (min()/max()/clamp() o'rniga)?
    var mm = window.__AF_MMC || [];
    var st = window.__ffMmcStat;
    var mmOut = ["__AF_MMC=" + mm.length
      + " shim=" + (st ? "runs=" + st.runs + " set=" + st.set + " skip=" + st.skip
        + (st.err ? " XATO=" + st.err : "") : "YUKLANMAGAN")];
    for (var q = 0; q < mm.length; q++) {
      var t = null;
      try { t = document.querySelector(mm[q].s); } catch (e) { /* noto'g'ri selektor */ }
      mmOut.push(mm[q].s + " {" + mm[q].p + ":" + mm[q].v + "} → "
        + (t ? (t.style.getPropertyValue(mm[q].p) || "(qo'yilmagan)") : "DOM'da yo'q"));
    }
    out.push("── MMC ──");
    out = out.concat(mmOut);

    // `xform-center.js` zondi: UXP `translate(-50%)` ni RENDERDA qo'lladimi?
    // Bu savolga hujjat emas, faqat jonli o'lchov javob beradi.
    var xs = window.__ffXfcStat;
    out.push("── XFORM ──");
    out.push("__AF_XFC=" + ((window.__AF_XFC || []).length)
      + " zond=" + (xs ? (xs.probe || "(hali yurmagan)") : "YUKLANMAGAN")
      + (xs ? " runs=" + xs.runs + " set=" + xs.set + " skip=" + xs.skip
        + (xs.err ? " XATO=" + xs.err : "") : ""));
    var lock = document.querySelector(".axhome .gu-lockchip");
    if (lock) {
      var lr = lock.getBoundingClientRect();
      out.push(".gu-lockchip → " + Math.round(lr.left) + "," + Math.round(lr.top)
        + " " + Math.round(lr.width) + "×" + Math.round(lr.height)
        + " ml=" + (lock.style.getPropertyValue("margin-left") || "-"));
    }

    push("CSS", "\n  " + out.join("\n  "));

    // O'lchov ALOHIDA kadrda: yangi qo'shilgan tugun darhol o'lchanса
    // layout hali yugurmagan bo'ladi va hammasi 0×0 chiqadi (birinchi
    // urinishda aynan shunday bo'ldi — harness'ning o'zi yolg'on gapirdi).
    setTimeout(function () {
      var res = [];
      for (var k = 0; k < els.length; k++) {
        var r = els[k].getBoundingClientRect();
        res.push(MEAS[k][0] + " → " + Math.round(r.width) + "×" + Math.round(r.height) + "px");
      }
      var hr = host.getBoundingClientRect();
      var dr = document.documentElement.getBoundingClientRect();
      res.push("host(200×100 talab) → " + Math.round(hr.width) + "×" + Math.round(hr.height));
      res.push("innerW=" + window.innerWidth + " docEl=" + Math.round(dr.width) + "×" + Math.round(dr.height));
      document.body.removeChild(host);
      push("O'LCHOV", "\n  " + res.join("\n  "));
    }, 250);
  }

  /**
   * Qayta chizish turtkisi (`uxp-repaint.js`): usulni ALMASHTIRIB darhol
   * qo'llaydi. Maqsad — "qora tana"ni qaytaradigan ENG ARZON usulni taxmin
   * bilan emas, jonli bosib tanlash. Har bosishda navbatdagi usulga o'tadi.
   */
  var RPT_MODES = ["vis", "opacity", "size", "display"];
  function repaintProbe() {
    var R = window.FFRepaint;
    if (!R) { push("RPT", "FFRepaint YO'Q (shim yuklanmagan)"); return; }
    var i = RPT_MODES.indexOf(R.getMode());
    var next = RPT_MODES[(i + 1) % RPT_MODES.length];
    R.setMode(next);
    R.kick();
    push("RPT", "usul=" + next + " turtki=" + R.stat.kicks
      + " belgilangan qoplama=" + R.seen() + " oxirgi=" + R.stat.last);
  }

  function build() {
    box = document.createElement("div");
    box.style.setProperty("position", "fixed");
    box.style.setProperty("left", "0");
    box.style.setProperty("right", "0");
    box.style.setProperty("bottom", "0");
    box.style.setProperty("z-index", "99999");
    box.style.setProperty("font-family", "monospace");
    box.style.setProperty("font-size", "9px");

    badge = document.createElement("div");
    badge.textContent = "⚠ 0";
    badge.style.setProperty("background-color", "#b91c1c");
    badge.style.setProperty("color", "#fff");
    badge.style.setProperty("padding", "2px 8px");
    badge.style.setProperty("cursor", "pointer");
    badge.style.setProperty("display", "inline-block");

    // Har hisobot ALOHIDA tugma: oyna 220px, sichqoncha g'ildiragi UXP'da
    // ishlamaydi → bitta uzun dump'ning oxirini o'qib bo'lmaydi. Har bosishda
    // jurnal tozalanadi, faqat so'ralgan hisobot qoladi.
    function mkBtn(label, fn) {
      var b = document.createElement("div");
      b.textContent = label;
      b.style.setProperty("background-color", "#334155");
      b.style.setProperty("color", "#fff");
      b.style.setProperty("padding", "2px 8px");
      b.style.setProperty("cursor", "pointer");
      b.style.setProperty("display", "inline-block");
      b.addEventListener("click", function () {
        LOG.length = 0;
        pre.style.setProperty("display", "block");
        // Zond xato tashlasa `push` chaqirilmaydi → ekranda ESKI hisobot qolib,
        // "tugma bosilmadi" degan noto'g'ri xulosaga olib keladi. Xatoni
        // hisobotning O'ZIGA aylantiramiz.
        try { fn(); } catch (e) { push(label, "ZOND XATOSI: " + ((e && e.stack) || e)); }
      });
      return b;
    }

    pre = document.createElement("div");
    pre.style.setProperty("display", "none");
    pre.style.setProperty("white-space", "pre-wrap");
    pre.style.setProperty("max-height", "220px");
    pre.style.setProperty("overflow-y", "auto");
    pre.style.setProperty("background-color", "#0a0a0a");
    pre.style.setProperty("color", "#e2e8f0");
    pre.style.setProperty("padding", "6px");
    pre.style.setProperty("border-top-width", "1px");
    pre.style.setProperty("border-top-style", "solid");
    pre.style.setProperty("border-top-color", "#b91c1c");

    badge.addEventListener("click", function () {
      pre.style.setProperty("display", pre.style.display === "none" ? "block" : "none");
      pre.textContent = LOG.join("\n") || "(bo'sh)";
    });

    box.appendChild(pre);
    box.appendChild(badge);
    box.appendChild(mkBtn("ERR", function () {
      push("BOOT", "\n  " + (BOOT.join("\n  ") || "(xato yo'q)"));
    }));
    box.appendChild(mkBtn("DOM", probe));
    box.appendChild(mkBtn("CLIP", clipProbe));
    box.appendChild(mkBtn("CSS", cssProbe));
    box.appendChild(mkBtn("RPT", repaintProbe));

    /*
     * EVT zondi — `addEventListener` UXP'da QAYSI holatda ishlaydi?
     *
     * O'lchangan ziddiyat: diagnostika tugmalari (`mkBtn`) `addEventListener`
     * bilan ishlaydi, AE'ning Google kartasidagi tugmalari esa ISHLAMAYDI
     * (delegat qo'yilgach ishladi). Farq nimada — tugun `innerHTML` dan
     * kelganidami yoki havola `getElementById` bilan QAYTA olinganidami?
     * Uchta chip aynan shu uch holatni ajratadi; javob `addEventListener`
     * yamog'ining ko'lamini belgilaydi (~20 joy AE'da shu naqshda).
     */
    var EVT = [];
    function evtHit(name) {
      EVT.push(name);
      push("EVT", "ishlagan: " + EVT.join(" | "));
    }
    function chip(el, label) {
      el.textContent = label;
      el.style.setProperty("background-color", "#4c1d95");
      el.style.setProperty("color", "#fff");
      el.style.setProperty("padding", "2px 8px");
      el.style.setProperty("cursor", "pointer");
      el.style.setProperty("display", "inline-block");
      return el;
    }

    // T1: tugun `innerHTML` dan → havola `getElementById` bilan
    var t1host = document.createElement("div");
    t1host.style.setProperty("display", "inline-block");
    t1host.innerHTML = '<div id="__ffT1">T1</div>';
    box.appendChild(t1host);

    // T2: tugun `createElement` dan → havola SAQLANGAN (mkBtn bilan bir xil)
    var t2 = chip(document.createElement("div"), "T2");
    t2.addEventListener("click", function () { evtHit("T2 createElement+havola"); });
    box.appendChild(t2);

    // T3: tugun `createElement` dan → havola `getElementById` bilan QAYTA olingan
    var t3 = chip(document.createElement("div"), "T3");
    t3.id = "__ffT3";
    box.appendChild(t3);

    document.body.appendChild(box);

    // Qidiruvlar box HUJJATGA qo'shilgandan KEYIN — `getElementById` faqat
    // hujjat daraxtidan qidiradi (birinchi urinishda shu sabab null qaytardi).
    var t1 = document.getElementById("__ffT1");
    if (t1) {
      chip(t1, "T1");
      t1.addEventListener("click", function () { evtHit("T1 innerHTML+byId"); });
    }
    var t3b = document.getElementById("__ffT3");
    if (t3b) t3b.addEventListener("click", function () { evtHit("T3 createElement+byId"); });
    push("EVT", "topildi: T1=" + (t1 ? "ha" : "YO'Q") + " T3=" + (t3b ? "ha" : "YO'Q")
      + " · ayni tugunmi: T3=" + (t3b === t3));
    badge.textContent = "⚠ " + LOG.length;
  }

  function init() {
    if (!isDev()) return;
    try { build(); } catch (e) { /* diagnostika o'zi panelni buzmasin */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
