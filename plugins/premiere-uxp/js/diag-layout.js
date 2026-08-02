/*
 * FrameFlow UXP — layout/DOM diagnostikasi.
 *
 * Nega kerak: UXP'da UDT'siz DevTools yo'q, va UXP layout dvigateli (Yoga)
 * brauzerdan jiddiy farq qiladi. "Brauzerda ishladi" hech narsani isbotlamaydi.
 * Bu modul JONLI panel ichida o'lchaydi: nima chiziladi, nima yo'q.
 *
 * AE CEP panelini (18k qator HTML · 3.8k qator CSS · 285 inline SVG · 64 `display:grid`
 * · 406 `gap:` · butunlay inline `onclick`) Premiere'ga ko'chirishdan OLDIN shu
 * o'lchovlar kerak — aks holda port taxminga qurilgan bo'ladi.
 *
 * Diagnostika ekranidagi "UXP tekshiruvi" tugmasi ishga tushiradi.
 */
(function () {
  "use strict";

  function nextFrame() {
    return new Promise(function (res) {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { res(); });
      else setTimeout(res, 32);
    });
  }

  /** UXP `appendChild` dan keyin darhol layout qilmaydi — 2×rAF kutamiz. */
  async function mounted(html, fn) {
    var host = document.createElement("div");
    host.setAttribute("style", "position:relative;width:300px;height:200px;");
    host.innerHTML = html;
    document.body.appendChild(host);
    await nextFrame();
    await nextFrame();
    var out;
    try { out = await fn(host); } finally { document.body.removeChild(host); }
    return out;
  }

  function rect(el) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) };
  }

  function wh(el) {
    var r = rect(el);
    return r ? r.w + "x" + r.h : "rect yo'q";
  }

  function css(text) {
    var st = document.createElement("style");
    st.textContent = text;
    document.head.appendChild(st);
    return function () { document.head.removeChild(st); };
  }

  var checks = [];
  function check(name, fn) { checks.push({ name: name, fn: fn }); }

  // ── 1. Inline SVG — AE ikonalarining 100% i shunday yozilgan ───────────
  check("Inline <svg> (innerHTML)", async function () {
    return await mounted(
      '<div><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#c8f24c" stroke-width="2">' +
      '<rect x="4" y="5" width="16" height="14" rx="2"></rect><line x1="10" y1="5" x2="10" y2="19"></line></svg></div>',
      function (host) {
        var s = host.querySelector("svg");
        var r = s ? rect(s) : null;
        return (s ? "topildi · bolalar=" + s.children.length + " · " + wh(s) : "SVG TOPILMADI") +
          " → " + (r && r.w > 0 ? "o'lchamli" : "0 o'lchamli (ikonalar ko'rinmaydi)");
      }
    );
  });

  check("createElementNS SVG", async function () {
    var ns = "http://www.w3.org/2000/svg";
    var el = null, err = "";
    try {
      el = document.createElementNS(ns, "svg");
      el.setAttribute("width", "24");
      el.setAttribute("height", "24");
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", "M4 4 L20 20");
      p.setAttribute("stroke", "#fff");
      el.appendChild(p);
      document.body.appendChild(el);
      await nextFrame(); await nextFrame();
    } catch (e) { err = String((e && e.message) || e); }
    var out = err ? "XATO: " + err : wh(el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    return out;
  });

  // ── 2. Inline onclick — AE'da barcha tugmalar shunday ulangan ──────────
  check("Inline onclick atributi", async function () {
    window.__ffDiagClick = 0;
    return await mounted('<div id="dc" onclick="window.__ffDiagClick=1">x</div>', function (host) {
      var el = host.querySelector("#dc");
      var attr = el ? el.getAttribute("onclick") : null;
      try { if (el && el.click) el.click(); } catch (e) { /* qo'llab-quvvatlanmasligi mumkin */ }
      var fired = window.__ffDiagClick === 1;
      return "atribut=" + (attr === null ? "yo'q" : "bor") + " · onclick turi=" + (el ? typeof el.onclick : "-") +
        " · bajarildi=" + fired + " → " + (fired ? "ISHLAYDI" : "SHIM KERAK");
    });
  });

  check("new Function / eval (onclick shim)", async function () {
    var nf, ev;
    try { nf = new Function("return 1+1")() === 2 ? "ishlaydi" : "g'alati"; }
    catch (e) { nf = "XATO: " + ((e && e.message) || e); }
    try { ev = eval("1+1") === 2 ? "ishlaydi" : "g'alati"; }
    catch (e) { ev = "XATO: " + ((e && e.message) || e); }
    return "new Function=" + nf + " · eval=" + ev;
  });

  // ── 3. innerHTML murakkab markup ───────────────────────────────────────
  check("innerHTML murakkab markup", async function () {
    return await mounted(
      '<div class="a" data-x="1"><span class="b">t</span><button type="button" class="c">B</button>' +
      '<input type="text" value="v"/><select><option>1</option></select><input type="checkbox"/>' +
      '<input type="range"/><a href="#">l</a></div>',
      function (host) {
        var out = [];
        ["span.b", "button.c", "input[type=text]", "select", "input[type=checkbox]", "input[type=range]", "a"]
          .forEach(function (sel) {
            var e = null;
            try { e = host.querySelector(sel); } catch (er) { out.push(sel + "=SELEKTOR XATO"); return; }
            out.push(sel + (e ? "✓" : "✗"));
          });
        var a = host.querySelector(".a");
        return out.join(" ") + " · data-x=" + (a ? a.getAttribute("data-x") : "?");
      }
    );
  });

  // ── 4. Murakkab CSS selektorlar (AE varag'i ularga tayanadi) ───────────
  check("Selektorlar > + [attr] :not() :first-child", async function () {
    var off = css(
      ".dz > .k{width:11px}" +
      ".dz .k + .k{width:22px}" +
      '.dz [data-q="1"]{height:33px}' +
      ".dz .k:not(.skip){border-left-width:4px}" +
      ".dz .k:first-child{border-top-width:5px}"
    );
    try {
      return await mounted(
        '<div class="dz"><div class="k">1</div><div class="k" data-q="1">2</div><div class="k skip">3</div></div>',
        function (host) {
          var ks = host.querySelectorAll(".k"), out = [];
          for (var i = 0; i < ks.length; i++) {
            var cs = window.getComputedStyle(ks[i]);
            out.push("#" + (i + 1) + " w=" + cs.width + " h=" + cs.height + " bl=" + cs.borderLeftWidth + " bt=" + cs.borderTopWidth);
          }
          return out.join(" | ");
        }
      );
    } finally { off(); }
  });

  // ── 5. Matn kesish ─────────────────────────────────────────────────────
  check("ellipsis / -webkit-line-clamp", async function () {
    var long = "Juda uzun sarlavha matni bu yerda davom etadi va albatta sig'maydi";
    return await mounted(
      '<div id="e1" style="width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + long + "</div>" +
      '<div id="e2" style="width:120px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + long + "</div>",
      function (host) {
        return "ellipsis " + wh(host.querySelector("#e1")) + " (1 qator≈h16) · clamp2 " + wh(host.querySelector("#e2"));
      }
    );
  });

  // ── 6. Joylashuv ───────────────────────────────────────────────────────
  check("position absolute / relative / fixed", async function () {
    return await mounted(
      '<div id="pa" style="position:absolute;left:40px;top:24px;width:20px;height:20px;"></div>' +
      '<div id="pr" style="position:relative;left:12px;width:20px;height:20px;"></div>' +
      '<div id="pf" style="position:fixed;left:8px;top:8px;width:20px;height:20px;"></div>',
      function (host) {
        var b = host.getBoundingClientRect();
        function rel(id) {
          var r = rect(host.querySelector(id));
          return r ? (r.l - Math.round(b.left)) + "," + (r.t - Math.round(b.top)) : "?";
        }
        var f = rect(host.querySelector("#pf"));
        return "abs(40,24)→" + rel("#pa") + " · rel(12,0)→" + rel("#pr") + " · fixed(8,8)→" + (f ? f.l + "," + f.t : "?");
      }
    );
  });

  // ── 7. Scroll ──────────────────────────────────────────────────────────
  check("overflow-y:auto scroll", async function () {
    var kids = "";
    for (var i = 0; i < 30; i++) kids += '<div style="height:20px;">' + i + "</div>";
    return await mounted('<div id="sc" style="height:100px;overflow-y:auto;">' + kids + "</div>", async function (host) {
      var sc = host.querySelector("#sc");
      var sh = sc.scrollHeight;
      sc.scrollTop = 200;
      await nextFrame();
      return "clientH=" + sc.clientHeight + " scrollH=" + sh + " scrollTop→" + sc.scrollTop +
        (sc.scrollTop > 0 ? " ISHLAYDI" : " QO'LLANMADI");
    });
  });

  // ── 8. ::before quti ───────────────────────────────────────────────────
  check("::before content quti", async function () {
    var off = css('.dpb::before{content:"";display:block;width:30px;height:12px;}');
    try {
      return await mounted('<div class="dpb" style="width:100px;"></div>', function (host) {
        return "ota " + wh(host.querySelector(".dpb")) + " (h≈12 → quti bor)";
      });
    } finally { off(); }
  });

  // ── 9. flex taqsimoti ──────────────────────────────────────────────────
  check("flex:1 / flex:2 / qotirilgan", async function () {
    return await mounted(
      '<div style="display:flex;flex-direction:row;width:300px;">' +
      '<div id="f1" style="flex:1;height:10px;"></div><div id="f2" style="flex:2;height:10px;"></div>' +
      '<div id="f3" style="width:60px;height:10px;flex-shrink:0;"></div></div>',
      function (host) {
        return "kutilgan 80/160/60 → " + wh(host.querySelector("#f1")) + " " +
          wh(host.querySelector("#f2")) + " " + wh(host.querySelector("#f3"));
      }
    );
  });

  // ── 10. Tema: ish vaqtida CSS o'zgaruvchi almashtirish ─────────────────
  check("runtime CSS var (tema almashtirish)", async function () {
    var off = css(":root{--ff-diag:#111111}.dpt{color:var(--ff-diag)}");
    try {
      return await mounted('<div class="dpt"></div>', async function (host) {
        var e = host.querySelector(".dpt");
        var a = window.getComputedStyle(e).color;
        document.documentElement.style.setProperty("--ff-diag", "#c8f24c");
        await nextFrame();
        var b = window.getComputedStyle(e).color;
        document.documentElement.style.removeProperty("--ff-diag");
        return a + " → " + b + (a !== b ? " ALMASHDI" : " o'zgarmadi");
      });
    } finally { off(); }
  });

  // ── 11. @media ─────────────────────────────────────────────────────────
  check("@media (max-width)", async function () {
    var off = css(".dpm{height:10px}@media (max-width:5000px){.dpm{height:44px}}");
    try {
      return await mounted('<div class="dpm" style="width:50px;"></div>', function (host) {
        var h = window.getComputedStyle(host.querySelector(".dpm")).height;
        return "height=" + h + (String(h).indexOf("44") === 0 ? " ISHLAYDI" : " QO'LLANMADI");
      });
    } finally { off(); }
  });

  // ── 12. Native widget'lar stillanadimi ─────────────────────────────────
  check("Native widget stillari", async function () {
    var off = css(".dpw button,.dpw input,.dpw select{background-color:#c8f24c;color:#101010;border-radius:9px}");
    try {
      return await mounted(
        '<div class="dpw"><button type="button">b</button><input type="text" value="i"/>' +
        "<select><option>o</option></select><input type=\"range\"/></div>",
        function (host) {
          var out = [];
          ["button", "input[type=text]", "select", "input[type=range]"].forEach(function (sel) {
            var e = host.querySelector(sel);
            if (!e) { out.push(sel + "=yo'q"); return; }
            var cs = window.getComputedStyle(e);
            out.push(sel + " bg=" + cs.backgroundColor + " r=" + cs.borderRadius + " " + wh(e));
          });
          return out.join("\n");
        }
      );
    } finally { off(); }
  });

  // ── 13. Animatsiya ─────────────────────────────────────────────────────
  check("transition / Element.animate", async function () {
    var waapi = typeof document.createElement("div").animate === "function";
    return await mounted('<div id="tr" style="opacity:1;transition:opacity 300ms linear;width:10px;height:10px;"></div>',
      async function (host) {
        var e = host.querySelector("#tr");
        e.style.opacity = "0";
        await new Promise(function (r) { setTimeout(r, 120); });
        var mid = window.getComputedStyle(e).opacity;
        await new Promise(function (r) { setTimeout(r, 320); });
        var end = window.getComputedStyle(e).opacity;
        return "o'rtada=" + mid + " oxirida=" + end + " · animate()=" + waapi +
          (mid !== end ? " ANIMATSIYA BOR" : " sakrab o'tdi");
      });
  });

  // ── 14. Gradient / soya / filter ───────────────────────────────────────
  check("gradient / box-shadow / filter", async function () {
    var off = css(".dpg{background-image:linear-gradient(135deg,#fff,#a6a6ae);box-shadow:0 28px 80px rgba(0,0,0,.45);" +
      "filter:blur(1px);backdrop-filter:blur(8px)}");
    try {
      return await mounted('<div class="dpg" style="width:40px;height:40px;"></div>', function (host) {
        var cs = window.getComputedStyle(host.querySelector(".dpg"));
        return "bg-image=" + String(cs.backgroundImage).slice(0, 60) +
          "\nshadow=" + String(cs.boxShadow).slice(0, 50) +
          "\nfilter=" + cs.filter + " backdrop=" + (cs.backdropFilter || "-");
      });
    } finally { off(); }
  });

  // ── 15. DOM API yuzasi ─────────────────────────────────────────────────
  check("DOM API yuzasi", async function () {
    var d = document.createElement("div");
    var has = [], no = [];
    [["closest", d.closest], ["matches", d.matches], ["cloneNode", d.cloneNode],
    ["insertAdjacentHTML", d.insertAdjacentHTML], ["scrollIntoView", d.scrollIntoView],
    ["animate", d.animate], ["append", d.append], ["replaceChildren", d.replaceChildren]]
      .forEach(function (p) { (typeof p[1] === "function" ? has : no).push(p[0]); });
    var extra = [];
    [["dataset", !!d.dataset], ["classList", !!d.classList],
    ["template", !!(document.createElement("template") || {}).content],
    ["DOMParser", typeof DOMParser !== "undefined"], ["CustomEvent", typeof CustomEvent !== "undefined"],
    ["ResizeObserver", typeof ResizeObserver !== "undefined"]]
      .forEach(function (p) { extra.push(p[0] + "=" + p[1]); });
    return "BOR: " + has.join(",") + "\nYO'Q: " + (no.join(",") || "—") + "\n" + extra.join(" ");
  });

  // ── 16. Katta DOM yuki (AE sahifasi mingdan ortiq tugun) ───────────────
  check("Katta DOM: 400 karta (1200 tugun)", async function () {
    var host = document.createElement("div");
    host.setAttribute("style", "display:flex;flex-direction:row;flex-wrap:wrap;width:320px;");
    var html = "";
    for (var i = 0; i < 400; i++) {
      html += '<div style="width:100px;height:60px;margin:0 4px 4px 0;"><span>a</span><span>b</span></div>';
    }
    var t0 = Date.now();
    host.innerHTML = html;
    document.body.appendChild(host);
    var tParse = Date.now() - t0;
    await nextFrame(); await nextFrame();
    var t1 = Date.now();
    var last = rect(host.children[host.children.length - 1]);
    var tMeasure = Date.now() - t1;
    document.body.removeChild(host);
    return "innerHTML " + tParse + "ms · layout " + tMeasure + "ms · oxirgi karta " + (last ? last.l + "," + last.t : "?");
  });

  /** Barcha tekshiruvlarni ketma-ket bajaradi (parallel emas — o'lchov aniqligi uchun). */
  async function run(onProgress) {
    var out = [];
    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      var detail;
      try { detail = await c.fn(); }
      catch (e) { detail = "XATO: " + String((e && e.message) || e); }
      var rec = { name: c.name, detail: String(detail) };
      out.push(rec);
      if (onProgress) onProgress(rec, i + 1, checks.length);
    }
    return out;
  }

  window.FFDiag = { run: run, count: checks.length };
})();
