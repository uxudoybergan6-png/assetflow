/**
 * `repeat(auto-fill, minmax(Xpx, 1fr))` — flexda takrorlash.
 *
 * Grid ustunlar sonini konteyner enidan hisoblaydi va bolalarni O'SHA songa
 * bo'ladi. Flexda `flex:1 0 148px` esa bolalarni bo'sh joyni to'ldirguncha
 * cho'zadi: 5 ta ustun sig'adigan panelda 4 ta karta bo'lsa AE 167px'lik 4 ta
 * karta chizadi, port esa 211px'lik 4 ta karta (o'lchovda Motion tabida 40 farq
 * chiqdi; Video tabida 0 edi — u yerda karta soni tasodifan ustun soniga teng).
 *
 * Shu sabab ustun enini runtime'da hisoblaymiz. CSS'ni O'QIYMIZ, takrorlamaymiz:
 *   · `min-width`     — port `minmax()` dan chiqargan minimal ustun eni;
 *   · `margin-right`  — port `column-gap` dan chiqargan ustunlararo bo'shliq.
 * Shu ikkisi zichlik (`dens-sm/md/lg`) va media-so'rov variantlarini ham o'zi
 * qamrab oladi — bu yerda hech qanday o'lcham qattiq yozilmaydi.
 *
 * Konteyner tarkib qutisi odatda `gap` ga kengaytirilgan (port konteyner
 * `padding-right`ini gap'ga kamaytiradi va har bolaga `margin-right` beradi),
 * shuning uchun hisob soddalashadi:
 *     N    = floor(W / (min + gap)),  eng kamida 1
 *     colW = W / N − gap
 *
 * Ammo konteynerda qoplashga padding YETMASA (`__AF_NOPADC` ro'yxati) quti
 * AE'nikiga teng qoladi va o'sha hisob bitta ustunni yo'qotadi (o'lchovda:
 * `.pd3-simrow` 868px — AE 280px'lik 3 kartani bitta qatorga sig'diradi,
 * port 275.33px'lik 2+1 kartani ikki qatorga). Bunday konteynerda grid'ning
 * o'z formulasini ishlatamiz va qator OXIRIDAGI ortiqcha `margin-right`ni
 * nolga tushiramiz (aks holda u keyingi kartani pastga uloqtiradi):
 *     N    = floor((W + gap) / (min + gap)),  eng kamida 1
 *     colW = (W − (N − 1)·gap) / N
 *
 * Ikkinchi vazifa — BUTUN QATOR bolalari (`__AF_PADC` ro'yxatidagi, padding
 * kompensatsiyasi qo'llangan konteynerlarda). Ularning `100%` i kengaytirilgan
 * tarkib qutisidan olinadi va AE'dan `gap` ga keng chiqadi (o'lchovda:
 * `.af7-state` +10px) — shuning uchun `100% − gap` beramiz.
 *
 * Uchinchi vazifa — OXIRGI QATOR bo'shlig'i (`__AF_ROWLEAK`): qator gap'i
 * `margin-bottom` ga o'girilgan va padding bilan qoplanmagan konteynerlarda
 * oxirgi qatordan keyin ortiqcha `rowGap` qoladi (o'lchovda: `.set-ltot` +14px).
 *
 * To'rtinchi vazifa — ANIQ `fr` ustunlar ro'yxati (`__AF_TRACKC`): grid ustun
 * eni bolaning margin'ini ham o'z ichiga oladi, flexda esa margin `flex-basis`
 * dan tashqarida qoladi (o'lchovda: `.pd3-hero{margin-left:16px}` hero'ni
 * 6.67px keng, `.pd3-body`ni shuncha tor qilgan). Ulush (`--af-fr`) va qat'iy
 * qism (`--af-fx`) CSS'da, margin esa faqat o'lchovda ma'lum.
 *
 * Har to'rtala vazifa O'LCHOVGA tayanadi, ya'ni konteyner ko'rinmas bo'lsa
 * (`display:none` ostidagi varaq) hech narsa hisoblab bo'lmaydi. AE kodi esa
 * ko'p joyda markupni varaq OCHILISHIDAN OLDIN joylaydi (`openFilterSheet()`
 * `#fsheetCats` ni yashirin holatda `innerHTML` bilan to'ldiradi) — o'sha
 * paytdagi barcha to'rtburchaklar 0×0. Shu sabab o'lchab bo'lmagan konteyner
 * KEYINGA qoldiriladi va ko'rinishi bilan qayta hisoblanadi (o'lchovda:
 * `.fsheet-cats` filtr varag'ida +6px baland qolgandi).
 */
(function () {
  var fill = window.__AF_FILLC || [];
  var padc = window.__AF_PADC || [];
  var leak = window.__AF_ROWLEAK || [];
  var nopad = window.__AF_NOPADC || [];
  var track = window.__AF_TRACKC || [];
  if (!fill.length && !padc.length && !leak.length && !track.length) return;

  function setOf(list) {
    var s = Object.create(null);
    for (var i = 0; i < list.length; i++) s[list[i]] = 1;
    return s;
  }
  var FILL = setOf(fill);
  var PADC = setOf(padc);
  var LEAK = setOf(leak);
  var NOPAD = setOf(nopad);
  var TRACK = setOf(track);

  function has(set, el) {
    var cls = el.classList;
    if (!cls || !cls.length) return false;
    for (var i = 0; i < cls.length; i++) if (set[cls[i]]) return true;
    return false;
  }
  // `NOPAD` bu yerda ATAYLAB yo'q: u faqat hisob usulini tanlaydi va tanlov
  // `FILL` tekshiruvidan KEYIN o'qiladi. Ro'yxatda o'ralaydigan har qanday
  // konteyner bor (43 klass), ularning ko'pi ustunli grid emas — skanerni
  // ular bilan kengaytirish bekorga.
  function match(el) { return has(FILL, el) || has(PADC, el) || has(LEAK, el) || has(TRACK, el); }

  function num(v) { var n = parseFloat(v); return n === n ? n : 0; }

  /**
   * Butun qatorni egallaydigan bola (AE'da `grid-column:1/-1` → `flex:0 0 100%`).
   *
   * Bo'sh holat bloki, sarlavha va skeleton shu turkumga kiradi — ularga ustun
   * enini bersak blok qisqarib ketadi (o'lchovda: `.af7-state` AE'dan 709px tor,
   * bolalari −355px chapga siljigan). Qaror BIR MARTA, inline `flex-basis`
   * yozilishidan OLDIN o'qiladi: keyin hisoblangan qiymat piksel bo'lib qoladi
   * va `100%` belgisi yo'qoladi.
   */
  function isFullRow(k) {
    if (k.__afFull === undefined) k.__afFull = getComputedStyle(k).flexBasis === "100%";
    return k.__afFull;
  }

  /**
   * Inline o'lcham. `!important` SHART: butun qator qoidasi
   * (`.af7-state.af7-state{flex:0 0 100%!important}`) muallif !important'i
   * bo'lgani uchun oddiy inline uslubdan ustun turadi — o'lchovda bo'sh holat
   * bloki shim yozganidan keyin ham +10px keng qolgandi.
   */
  function apply(k, basis) {
    if (k.__afBasis === basis) return;
    k.__afBasis = basis;
    // Konteyner enini o'zgartirdik → ichidagi `inset:0;width:100%` media
    // `media-fix.js` qotirgan eski pikselda qolib ketmasin (o'lchovda:
    // `.pd3-hero-poster` 491×271, hero esa 507×279.29).
    if (window.FFMediaFix) FFMediaFix.schedule();
    var s = k.style;
    if (s.setProperty) {
      // `flex-grow:0` SHART — aks holda oxirgi qatordagi kam sonli karta cho'ziladi.
      s.setProperty("flex-grow", "0", "important");
      s.setProperty("flex-shrink", "0", "important");
      s.setProperty("flex-basis", basis, "important");
    } else {
      s.flexGrow = "0";
      s.flexShrink = "0";
      s.flexBasis = basis;
    }
  }

  /**
   * Oxirgi qatordagi bolalarning `margin-bottom`ini nolga tushiradi.
   *
   * Port o'raladigan konteynerda qator bo'shlig'ini HAR bolaga `margin-bottom`
   * qilib beradi (ustunlar soni noma'lum → `nth-child` bilan oxirgi qatorni
   * ajratib bo'lmaydi). Natijada oxirgi qatordan keyin ham bo'shliq qoladi va
   * konteyner AE'dagidan aynan `rowGap` ga baland chiqadi (o'lchovda:
   * `.set-ltot` +14px). Qator chegarasi faqat o'lchovdan ma'lum bo'ladi.
   *
   * Qatorni `top` bo'yicha ajratib BO'LMAYDI: `align-items:center` bo'lganda bir
   * qatordagi turli bo'yli bolalarning `top`i har xil (o'lchovda `.pd3-metarow`
   * — 3px'lik `.pd3-mdot` 101.9, 17px'lik `.pd3-appchip` 91.4; faqat nuqta
   * "oxirgi qator" deb topilib, qolganlarida 7px qolib ketgandi). Shu sabab
   * o'ralishni X bo'yicha aniqlaymiz: bir qator ichida `left` doim o'sadi,
   * yangi qator esa chapdan boshlanadi. Ustunli (`flex-direction:column`)
   * konteynerda har bola o'z qatoriga tushadi — bu ham to'g'ri natija.
   *
   * Qaytaradi: o'lchov muvaffaqiyatli bo'ldimi (yolg'on → konteyner yashirin,
   * keyinga qoldiriladi).
   */
  function trimLastRow(el) {
    var kids = el.children, i, k, r;
    var rows = [], row = -1, prevLeft = null, seen = false;
    for (i = 0; i < kids.length; i++) {
      r = kids[i].getBoundingClientRect();
      if (!r || (!r.width && !r.height)) { rows.push(null); continue; }   // yashirin
      if (prevLeft === null || r.left <= prevLeft + 0.5) row++;
      prevLeft = r.left;
      rows.push(row);
      seen = true;
    }
    if (!seen) return false;
    for (i = 0; i < kids.length; i++) {
      if (rows[i] === null) continue;
      k = kids[i];
      var last = rows[i] === row;
      if (k.__afTrim === last) continue;
      k.__afTrim = last;
      // Oxirgi qator bo'lmasa CSS qiymati tiklanadi (inline'ni olib tashlaymiz).
      if (last) k.style.setProperty("margin-bottom", "0px", "important");
      else if (k.style.removeProperty) k.style.removeProperty("margin-bottom");
      else k.style.marginBottom = "";
    }
    return true;
  }

  /**
   * Yashirin holatda o'lchab bo'lmagan konteynerlar — ko'ringanda qaytadan
   * hisoblanadi. `layout()` ning o'zi qayta qoldiradi, shuning uchun ro'yxat
   * o'z-o'zini tozalaydi.
   */
  var deferred = [];
  function defer(el) { if (deferred.indexOf(el) < 0) deferred.push(el); }

  function flush() {
    if (!deferred.length) return;
    var list = deferred;
    deferred = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.isConnected === false) continue;
      try { layout(el); } catch (e) { /* render to'xtamasin */ }
    }
  }

  function layout(el) {
    var kids = el.children;
    if (!kids || !kids.length) return;
    var measured = has(LEAK, el) ? trimLastRow(el) : true;
    var cs = getComputedStyle(el);
    // Tarkib qutisi eni — padding va border hisobga olinadi (border-box bo'lishi mumkin).
    var W = el.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight);
    if (!(W > 0)) { defer(el); return; }
    if (!measured) defer(el);
    var i, k;

    // ── Butun qator bolalari (`flex:0 0 100%`) ────────────────────────────
    // Padding kompensatsiyasi tarkib qutisini `gap` ga kengaytirgan, shu sabab
    // 100% AE'dagidan `gap` ga keng chiqadi. Bolaning O'Z margin'ini ayiramiz.
    if (has(PADC, el)) {
      for (i = 0; i < kids.length; i++) {
        k = kids[i];
        if (!isFullRow(k)) continue;
        var g = num(getComputedStyle(k).marginRight);
        if (!(g > 0)) continue;
        apply(k, Math.round((W - g) * 1000) / 1000 + "px");
      }
    }

    // ── Aniq `fr` ustunlar ro'yxati ───────────────────────────────────────
    // Grid ustun eni bolaning MARGIN'ini ham o'z ichiga oladi, flexda esa
    // margin `flex-basis` dan tashqarida. `--af-fr` (ulush) va `--af-fx`
    // (qat'iy px + gap) port tomonidan yozilgan; margin faqat shu yerda
    // ma'lum, shuning uchun aniq enni shim hisoblaydi.
    if (has(TRACK, el)) {
      var free = W - num(getComputedStyle(kids[0]).getPropertyValue("--af-fx"));
      for (i = 0; i < kids.length; i++) {
        k = kids[i];
        var kcs = getComputedStyle(k);
        var fr = parseFloat(kcs.getPropertyValue("--af-fr"));
        if (!(fr > 0)) continue;   // qat'iy px ustun — CSS o'zi hal qiladi
        var own = num(kcs.marginLeft) + num(kcs.marginRight);
        var wpx = free * fr - own;
        if (!(wpx > 0)) continue;
        apply(k, Math.round(wpx * 1000) / 1000 + "px");
      }
    }

    if (!has(FILL, el)) return;

    // O'lchov namunasi — birinchi HAQIQIY ustun bolasi (butun qatorlilar emas).
    var first = null;
    for (var f = 0; f < kids.length; f++) if (!isFullRow(kids[f])) { first = kids[f]; break; }
    if (!first) return;

    var ks = getComputedStyle(first);
    var min = num(ks.minWidth);
    if (!(min > 0)) return;

    // Gap namunasi — `margin-right`i O'CHIRILMAGAN bola. Quyida qator oxiridagi
    // bolaga inline `margin-right:0` yozamiz; agar gap'ni o'shandan o'qisak,
    // keyingi hisobda gap 0 chiqib butun layout yopishib qolardi.
    var probe = null;
    for (var q = 0; q < kids.length; q++) {
      if (isFullRow(kids[q]) || kids[q].__afEndCol) continue;
      probe = kids[q]; break;
    }
    var gap = probe ? num(getComputedStyle(probe).marginRight) : num(el.__afGap);
    if (probe) el.__afGap = gap;

    // Quti kengaytirilmagan bo'lsa grid'ning o'z formulasi — oxirgi ustundan
    // keyin bo'shliq yo'q, shu sabab `gap` bir marta kam hisoblanadi.
    var raw = has(NOPAD, el);
    var n = Math.floor((raw ? W + gap : W) / (min + gap));
    if (n < 1) n = 1;
    var colW = raw ? (W - (n - 1) * gap) / n : W / n - gap;
    if (!(colW > 0)) return;
    var basis = Math.round(colW * 1000) / 1000 + "px";

    // Qator oxiridagi bolaning `margin-right`i qatorni kengaytirib, keyingi
    // kartani pastga uloqtiradi — nolga tushiramiz. Butun qator bolasi o'z
    // qatorini yopadi, shu sabab hisoblagich nolga qaytariladi (grid ham
    // `grid-column:1/-1` dan keyin yangi qatordan boshlaydi).
    var col = 0;
    for (i = 0; i < kids.length; i++) {
      k = kids[i];
      if (isFullRow(k)) { col = 0; continue; }
      apply(k, basis);
      if (!raw || !(gap > 0)) continue;
      col++;
      var end = col === n;
      if (end) col = 0;
      if (k.__afEndCol === end) continue;
      k.__afEndCol = end;
      if (end) k.style.setProperty("margin-right", "0px", "important");
      else if (k.style.removeProperty) k.style.removeProperty("margin-right");
      else k.style.marginRight = "";
    }
  }

  function run(root) {
    var host = root && root.nodeType === 1 ? root : document.body;
    if (!host) return;
    if (host.nodeType === 1 && match(host)) layout(host);
    if (!host.querySelectorAll) return;
    var all = host.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) if (match(all[i])) layout(all[i]);
  }

  window.__afAutoFill = run;

  // Dinamik render — `innerHTML` orqali keladi. Setter allaqachon boshqa shim
  // tomonidan o'ralgan bo'lishi mumkin; biz uning ustidan o'raymiz.
  var proto = window.Element && Element.prototype;
  var d = proto && Object.getOwnPropertyDescriptor(proto, "innerHTML");
  if (d && d.set && d.configurable !== false) {
    Object.defineProperty(proto, "innerHTML", {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set: function (v) {
        d.set.call(this, v);
        try { run(this); } catch (e) { /* render to'xtamasin */ }
      },
    });
  } else if (window.FFLog) {
    FFLog.warn("autofill", "innerHTML setter ilinmadi — grid ustun eni faqat resize'da yangilanadi");
  }

  // Panel eni o'zgarsa ustunlar soni ham o'zgaradi.
  var t = null;
  window.addEventListener("resize", function () {
    if (t) clearTimeout(t);
    t = setTimeout(function () { t = null; try { run(document.body); } catch (e) {} }, 60);
  });

  // ── Ko'rinish o'zgarishi ────────────────────────────────────────────────
  // Varaq/modal ochilishi `class` yoki `style` o'zgarishi bilan bo'ladi. Ikkita
  // manba ilinadi: MutationObserver (bo'lsa) va qamrab oluvchi `click` (UXP'da
  // observer'ga tayanmaslik uchun). Kutayotgan konteyner bo'lmasa `flush()`
  // darhol qaytadi, shuning uchun narxi nolga yaqin.
  var ft = null;
  function scheduleFlush() {
    if (!deferred.length || ft) return;
    ft = setTimeout(function () { ft = null; flush(); }, 0);
  }
  document.addEventListener("click", function () {
    // Bosish ishlovchisi markupni SINXRON joylaydi → keyingi kadrda o'lchaymiz.
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(scheduleFlush); });
    else setTimeout(scheduleFlush, 32);
  }, true);
  if (window.MutationObserver) {
    try {
      new MutationObserver(scheduleFlush).observe(document.documentElement, {
        attributes: true, subtree: true, attributeFilter: ["class", "style"],
      });
    } catch (e) { /* observer yo'q — `click` yetarli */ }
  }

  function boot() { try { run(document.body); } catch (e) {} }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
