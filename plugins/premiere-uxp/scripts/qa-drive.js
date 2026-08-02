/**
 * Brauzer-QA yordamchisi — portlangan sahifani AE bilan solishtirishga tayyorlaydi.
 *
 * Nega kerak: `#grid` katalogi `?app=pr` bilan so'raladi va Premiere shablonlari
 * hali yo'q → bo'sh holat chiqadi, AE bilan taqqoslash mumkin emas. QA uchun
 * so'rovni `app=ae` ga va javobdagi `templateApp`ni `pr` ga o'giramiz (mijozdagi
 * zaxira filtr ham shuni tekshiradi). MAHSULOT KODIGA tegilmaydi — faqat shu tab.
 *
 * FAQAT lokal QA. `.ccx` paketiga kirmaydi.
 */
(function () {
  /**
   * Bu sahifa PORTLANGANmi (AE originali emas)?
   *
   * `templateApp` ni QAYTA yozish faqat portga kerak. AE sahifasida ham
   * yozsak, uning mijoz filtri `pr` shablonlarini RAD etadi va katalog bo'sh
   * chiqadi — o'lchovda: 440px'da AE `motion` gridi bo'sh (5 element), portda
   * 4 karta (39 element), "farq" sof QA artefakti edi.
   */
  var IS_PORT = location.pathname.indexOf("/ported/") >= 0;

  var of = window.__origFetch || window.fetch;
  window.__origFetch = of;
  window.fetch = async function (u, o) {
    var s = typeof u === "string" ? u : (u && u.url) || "";
    if (s.indexOf("app=pr") >= 0) { s = s.split("app=pr").join("app=ae"); u = s; }
    var res = await of.call(this, u, o);
    if (IS_PORT && s.indexOf("/api/plugin/catalog") >= 0) {
      var txt = await res.text();
      var j;
      try { j = JSON.parse(txt); } catch (e) {
        return new Response(txt, { status: res.status, headers: { "content-type": "application/json" } });
      }
      if (Array.isArray(j.items)) j.items.forEach(function (it) { it.templateApp = "pr"; });
      return new Response(JSON.stringify(j), { status: res.status, headers: { "content-type": "application/json" } });
    }
    return res;
  };

  /**
   * Yon paneldagi `data-nav` havolasiga o'tadi.
   *
   * TOR panelda (440px) yon panel YASHIRIN va `dispatchEvent(click)` inline
   * `onclick` ni ishga tushirmaydi (o'lchovda: `home-mode` klassi qolib ketdi,
   * 7 ta katalog ekrani bir xil imzo bergan). Shuning uchun avval funksiyani
   * TO'G'RIDAN chaqiramiz — ikkala tomonda ham bir xil yo'l, taqqoslash halol.
   * Klik faqat zaxira (funksiya bo'lmasa).
   */
  window.QAGo = function (nav) {
    var el = [].slice.call(document.querySelectorAll(".sb-child,.env-side-link"))
      .filter(function (e) { return e.getAttribute("data-nav") === nav; })[0];
    if (!el) return "topilmadi: " + nav;
    if (typeof window.switchNavFromSidebar === "function") {
      window.switchNavFromSidebar(el, nav);
      return "ok";
    }
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return "ok";
  };

  /**
   * Dastur yorlig'ini AE'nikiga tenglashtiradi.
   *
   * `templateApp` ni `pr` qilganimiz uchun rozetka "Premiere Pro" deb yozadi,
   * AE'da esa "After Effects" — matn uzunligi farqi `.ck-app` enini o'zgartiradi
   * va bu LAYOUT farqi emas, MA'LUMOT farqi. Taqqoslashdan oldin tenglashtiramiz.
   *
   * `txt` — AE tomonidagi haqiqiy yorliq. Katalog tabiga qarab farq qiladi
   * (Motion tabida AE kartalarida "Motion" yozilgan, "After Effects" emas —
   * o'lchovda `.ck-app` 33px keng chiqqandi).
   */
  window.QANorm = function (txt) {
    var n = 0;
    document.querySelectorAll(".ck-app,.hm-app").forEach(function (e) {
      var kids = e.children;
      var last = kids.length ? kids[kids.length - 1] : null;
      if (last && last.tagName === "SPAN") { last.textContent = txt || "After Effects"; n++; }
    });
    return n;
  };

  /** Imzo skriptini yuklaydi (keshdan qochish uchun har safar yangi URL). */
  window.QASig = function () {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "/scripts/qa-layout-sig.js?v=" + Date.now();
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  };
  QASig();

  /**
   * Dastur yorlig'ini IKKALA tomonda bir xil matnga keltiradi.
   *
   * Yorliq matni ma'lumotdan keladi ("After Effects" / "Motion" / "Premiere
   * Pro") va uzunligi rozetka enini o'zgartiradi — bu LAYOUT farqi emas.
   * Yalang'och matn tugun ham, `<span>` ham qamrab olinadi (gap-text shim'i
   * portda matnni `<span>` ga o'raydi, AE'da esa xom matn qoladi).
   */
  window.QANormAll = function (txt) {
    var n = 0;
    document.querySelectorAll(".ck-app,.hm-app").forEach(function (e) {
      var kids = e.childNodes;
      for (var i = kids.length - 1; i >= 0; i--) {
        var k = kids[i];
        if (k.nodeType === 3 && k.nodeValue.trim()) { k.nodeValue = txt; n++; break; }
        if (k.nodeType === 1 && k.tagName === "SPAN") { k.textContent = txt; n++; break; }
      }
    });
    return n;
  };

  /**
   * Kirish animatsiyalarini oxirigacha yugurtiradi.
   *
   * Modal `afModalIn` bilan `scale(.97)` dan boshlanadi. Fon tabida hujjat
   * vaqt o'qi MUZLAYDI (`getAnimations()[0].currentTime === 0`) va animatsiya
   * hech qachon tugamaydi → har bir o'lchov 3% xato beradi (o'lchovda:
   * `.account-panel` 392×711, AE'da 404×733 — port xatosi EMAS edi).
   * Shuning uchun o'lchashdan oldin hammasini majburan tugatamiz.
   */
  window.QASettle = function () {
    try {
      var list = document.getAnimations ? document.getAnimations() : [];
      for (var i = 0; i < list.length; i++) { try { list[i].finish(); } catch (e) {} }
      return list.length;
    } catch (e) { return -1; }
  };

  /**
   * `:hover` qoidalarini butunlay o'chiradi (bir marta).
   *
   * Sichqoncha ko'rsatkichi Browser panelida QAYERDA turgani QA natijasiga
   * kirib keladi: `.fhome-hero:hover .fhome-hero-art{transform:scale(1.025)}`
   * (`css/styles.css:285`) portda faol, AE tomonida esa yo'q edi →
   * `homeBArt [-11,-3,22,5]` beshta ekranda "farq" bo'lib chiqardi. Bu port
   * nuqsoni EMAS, o'lchov muhitining artefakti.
   *
   * Ko'rsatkichni qo'lda chetga surish yordam bermaydi: sahifa qayta
   * yuklangach yoki ko'rinish JS bilan almashgach hover zanjiri ESKI joyda
   * qolib ketadi (brauzer hit-test'ni faqat sichqoncha harakatida qaytadan
   * hisoblaydi), `pointer-events:none` ham uni tozalamaydi.
   *
   * Shuning uchun qoidaning O'ZINI olib tashlaymiz: selektorning `:hover`li
   * qismlari tashlab yuboriladi, qolgani (masalan `.a, .b:hover` dagi `.a`)
   * saqlanadi. Ikkala tomonda ham bajariladi, shu sabab solishtirish halol
   * qoladi — statik ko'rinish o'lchanadi.
   */
  var noHoverDone = false;
  window.QANoHover = function () {
    if (noHoverDone) return 0;
    var n = 0;
    function walk(rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        // CSS ichma-ichligi sabab HAR bir style rule'da `cssRules` bor (bo'sh) —
        // shuning uchun avval `selectorText` ni tekshiramiz, keyin ichkariga.
        if (typeof r.selectorText === "string" && r.selectorText.indexOf(":hover") >= 0) {
          var keep = [];
          var parts = r.selectorText.split(",");
          for (var j = 0; j < parts.length; j++) {
            var p = parts[j].trim();
            if (p && p.indexOf(":hover") < 0) keep.push(p);
          }
          try { r.selectorText = keep.length ? keep.join(", ") : ".__qa_never_match__"; n++; } catch (e) {}
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
      }
    }
    var sh = document.styleSheets;
    for (var i = 0; i < sh.length; i++) { try { walk(sh[i].cssRules); } catch (e) {} }
    noHoverDone = true;
    return n;
  };

  /** Imzoni saqlaydi (AE tomonida chaqiriladi). */
  window.QACap = function (key, deep) {
    QANoHover();
    QASettle();
    QANormAll("APP");
    return FFQA.capture(key, deep !== false);
  };

  /** Imzoni solishtiradi va qisqa xulosa qaytaradi (port tomonida). */
  window.QACmp = function (key, tol, deep) {
    return new Promise(function (res) {
      setTimeout(function () {
        QANoHover();
        QASettle();
        QANormAll("APP");
        FFQA.compare(key, tol == null ? 1 : tol, deep).then(function (r) {
          res({ k: key, d: r.diffCount, miss: r.missingCount, ex: r.extraCount,
            top: (r.diffs || []).slice(0, 8).map(function (x) { return x.id + " " + JSON.stringify(x.d); }) });
        });
      }, 900);
    });
  };

  /**
   * Ekran ro'yxati — AE va port tomonida AYNAN bir xil ketma-ketlik.
   *
   * Har element: `[kalit, ochish, yopish]`. Yopish qadami keyingi ekranni toza
   * holatdan boshlash uchun kerak (varaq ochiq qolsa keyingi o'lchov buziladi).
   */
  var W = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var MOGRT_DEMO = [
    { name: "Lower Third.mogrt", size: 2097152 },
    { name: "Title Pack.mogrt", size: 5242880 },
    { name: "Callout.mogrt", size: 1048576 },
  ];
  function ptab(p) { return document.querySelector('.ptab[data-page="' + p + '"]'); }

  window.QASCREENS = [
    ["home", async function () { goHome(); await W(900); }, null],
    ["ai", async function () { QAGo("ai"); await W(1800); }, null],
    ["motion2", async function () { QAGo("motion"); await W(2200); }, null],
    ["graphics", async function () { QAGo("graphics"); await W(2200); }, null],
    ["luts", async function () { QAGo("luts"); await W(2200); }, null],
    ["music", async function () { QAGo("music"); await W(2200); }, null],
    ["sfx", async function () { QAGo("sfx"); await W(2200); }, null],
    ["acct", async function () { goHome(); await W(800); openAccountSheet(); await W(800); },
      async function () { closeAccountSheet(); await W(400); }],
    ["pro", async function () { openProSheet(); await W(700); }, async function () { closeProSheet(); await W(400); }],
    ["limit", async function () { openLimitSheet("download"); await W(700); }, async function () { closeLimitSheet(); await W(400); }],
    ["publish", async function () { openPublish(); await W(800); }, async function () { closePublish(); await W(400); }],
    ["filter", async function () { QAGo("motion"); await W(2200); openFilterSheet(); await W(900); },
      async function () { closeFilterSheet(); await W(400); }],
    ["mogrt", async function () { openMogrtSheet("demo", MOGRT_DEMO); await W(800); },
      async function () { closeMogrtSheet(); await W(500); }],
    // `afOpenAiSub()` ATAYLAB ishlatilmaydi: u `afNavTab('ai')` ga tayanadi, u
    // esa top-bar tab'ini qidiradi — top-bar'da 'ai' tab YO'Q (faqat katalog
    // tablari). O'lchovda AE tomonida `ai-mode` qo'shilmay, `.axroot` 0×0 qolgan
    // va butun AI sahifasi "yo'q" deb yozilgan — sof harness artefakti.
    // Yon paneldan kirish (`QAGo('ai')`) — real foydalanuvchi yo'li.
    ["imggen", async function () { QAGo("ai"); await W(1400); if (window.axGo) window.axGo("imggen"); await W(1800); }, null],
    ["vidgen", async function () { QAGo("ai"); await W(1000); if (window.axGo) window.axGo("vidgen"); await W(1800); }, null],
    ["audgen", async function () { QAGo("ai"); await W(1000); if (window.axGo) window.axGo("audgen"); await W(1800); }, null],
    ["dl", async function () { QAGo("motion"); await W(2200); switchPage(ptab("downloaded"), "downloaded"); await W(1400); },
      async function () { switchPage(ptab("assets"), "assets"); await W(600); }],
    ["lib", async function () { afLibOpen(); await W(2000); }, async function () { goHome(); await W(800); }],
    ["pack", async function () {
      QAGo("motion"); await W(2200);
      // Kalitlar ikkala tomonda bir xil katalogdan keladi (proksi `app=pr` ni
      // `app=ae` ga aylantiradi) — saralangan birinchisi determinlashgan tanlov.
      window.__packKey = Object.keys(window.packs || {}).sort()[0];
      await openPack(window.__packKey); await W(2000);
    }, async function () { closePack(); await W(700); }],
  ];

  /**
   * Butun ro'yxatni yurgizadi. `mode`: "cap" (AE — imzo yozadi) yoki "cmp"
   * (port — solishtiradi). `only` — kalitlar ro'yxati (ixtiyoriy).
   * `window.__QAPFX` — kalit prefiksi (tor panel o'lchovi uchun alohida to'plam).
   */
  /**
   * Kalit prefiksini o'rnatadi va SAQLAYDI.
   *
   * `__QAPFX` oddiy global edi va iframe QAYTA YUKLANGANDA yo'qolardi — shunda
   * tor (440px) o'lchov keng (980px) imzolar bilan solishtirilib, o'nlab soxta
   * "farq" chiqardi (o'lchovda: `fhome-rplay[3] [375,-14,6,0]` — sof harness
   * xatosi). `sessionStorage` reload'dan omon qoladi.
   */
  window.QAPfx = function (p) {
    if (p != null) { window.__QAPFX = p; try { sessionStorage.setItem("ffQaPfx", p); } catch (e) {} }
    else if (window.__QAPFX == null) {
      try { window.__QAPFX = sessionStorage.getItem("ffQaPfx") || ""; } catch (e) { window.__QAPFX = ""; }
    }
    return window.__QAPFX;
  };
  QAPfx();

  window.QASweep = function (mode, only) {
    var pfx = QAPfx();
    var list = only ? QASCREENS.filter(function (s) { return only.indexOf(s[0]) >= 0; }) : QASCREENS;
    window.__sweep = null;
    return (async function () {
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        try {
          await s[1]();
          var r = mode === "cap" ? await QACap(pfx + s[0], true) : await QACmp(pfx + s[0], 1, true);
          out.push(mode === "cap" ? [s[0], r.count] : [s[0], r.d, r.miss, r.ex, r.top.slice(0, 5)]);
          if (s[2]) await s[2]();
        } catch (e) { out.push([s[0], "ERR " + e]); }
        window.__sweep = out;
      }
      return out;
    })();
  };

  /** Qisqa xulosa — faqat farqi bor ekranlar. */
  window.QABad = function () {
    return (window.__sweep || []).filter(function (x) { return x[1] !== 0; })
      .map(function (x) { return x[0] + ":" + x[1] + (x[4] && x[4].length ? " " + x[4].join(" | ") : ""); });
  };
})();
