/**
 * Flex konteynerdagi YALANG'OCH MATN bo'shlig'i.
 *
 * UXP `gap` ni e'tiborsiz qoldiradi, shu sabab port uni bola margin'iga
 * o'giradi: `.ck-app > *:nth-child(n+2){margin-left:4px}`. Ammo CSS bola
 * selektori faqat ELEMENTGA tegadi. AE markupida esa ikon + yorliq ko'pincha
 * shunday yoziladi:
 *
 *     <span class="ck-app"><i class="tile">Ae</i>After Effects</span>
 *
 * Bu yerda "After Effects" — matn tugun; flexda anonim element bo'lib qoladi
 * va CSS uni ko'ra olmaydi → ikkalasi orasidagi 4px yo'qoladi (o'lchovda:
 * `.ck-app` AE'dan aynan 4px tor edi). AE'ning joriy ekranida shunday
 * konteynerdan ~30 xil turi bor (tugmalar, chiplar, rozetkalar, qatorlar).
 *
 * Yechim: shunday konteynerlarda yalang'och matnni `<span>` ga o'raymiz — u
 * endi haqiqiy element bola bo'ladi va gap qoidasi unga ham tegadi. Konteyner
 * klasslari ro'yxatini (`window.__AF_GAPC`) port vaqtida CSS'dan
 * `scripts/ae-port.mjs` yig'adi.
 *
 * Ehtiyot choralari:
 *   · `contenteditable` ichiga TEGILMAYDI — prompt muharriri bola tugunlarni
 *     o'zi serializatsiya qiladi, o'rash uning qiymatini buzishi mumkin.
 *   · Faqat bo'sh bo'lmagan matn o'raladi; elementlar orasidagi bo'shliq
 *     tugunlari tegilmaydi (aks holda har joyga soxta flex element qo'shilardi).
 *   · `innerHTML` setter'i ilinadi — dinamik render (kartalar, ro'yxatlar) ham
 *     qamrab olinadi. Ilib bo'lmasa halol ogohlantirish yoziladi.
 *   · O'ram MATN TUGUNIDEK ko'rinadi (`nodeType`/`nodeValue`/`data` soxtalashtirilgan).
 *     AE kodi bir necha joyda yorliqni aynan shu naqsh bilan yangilaydi:
 *         `if(g.firstChild&&g.firstChild.nodeType===3)g.firstChild.textContent='…'`
 *     O'ram element bo'lib qolsa shart bajarilmaydi va yorliq eskiligicha qoladi
 *     (o'lchovda: `#igGen` "Generate image" o'rniga "Generate" — tugma 42px tor).
 *     Aksincha, `nodeType===1` bo'yicha element qidiradigan sikllar o'ramni
 *     ATLAB o'tadi — bu ham asl (matn tuguni) xatti-harakatiga mos keladi.
 */
(function () {
  var list = window.__AF_GAPC || [];
  // Oxirgi kompaundi klasssiz konteynerlar (`.set-ltot span`) — ularni faqat
  // to'liq selektor bilan tanib bo'ladi. Bittalab tekshirmaslik uchun hammasini
  // vergul bilan bitta selektorga yig'amiz.
  var SEL = (window.__AF_GAPSEL || []).join(",");
  if (!list.length && !SEL) return;

  var SET = Object.create(null);
  for (var i = 0; i < list.length; i++) SET[list[i]] = 1;

  function isEditable(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var v = n.getAttribute && n.getAttribute("contenteditable");
      if (v != null && v !== "false") return true;
    }
    return false;
  }

  function match(el) {
    var cls = el.classList;
    if (cls && cls.length) {
      for (var i = 0; i < cls.length; i++) if (SET[cls[i]]) return true;
    }
    if (SEL && el.matches) { try { return el.matches(SEL); } catch (e) { return false; } }
    return false;
  }

  var wrapped = 0;

  /**
   * O'ramni matn tuguniga o'xshatadi — AE kodi uni ALMASHTIRILGAN deb sezmasin.
   *
   * `nodeType` prototipdagi getter, shu sabab nusxa ustiga o'z xossasi bilan
   * soya tashlaymiz. Layout va DOM ichki mexanizmi bu qiymatni O'QIMAYDI
   * (u C++ tomonda), faqat JS ko'radi. Qo'llab bo'lmasa (muzlatilgan nusxa)
   * eski xatti-harakat qoladi — render to'xtamaydi.
   */
  function maskAsText(s) {
    try {
      Object.defineProperty(s, "nodeType", { value: 3, configurable: true });
      var acc = {
        configurable: true,
        get: function () { return this.textContent; },
        set: function (v) { this.textContent = v; },
      };
      Object.defineProperty(s, "nodeValue", acc);
      Object.defineProperty(s, "data", acc);
    } catch (e) { /* niqob majburiy emas */ }
  }

  function wrapOne(el) {
    var kids = el.childNodes;
    var todo = null;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      // O'z o'ramimiz ham `nodeType===3` deb ko'rinadi (niqob) — qayta o'ralsa
      // har yugurishda ichma-ich span o'sib ketardi.
      if (n.__afGT) continue;
      if (n.nodeType !== 3 || !n.nodeValue || !n.nodeValue.trim()) continue;
      (todo = todo || []).push(n);
    }
    if (!todo || isEditable(el)) return;
    for (var j = 0; j < todo.length; j++) {
      var t = todo[j];
      var s = document.createElement("span");
      s.__afGT = 1;
      s.textContent = t.nodeValue;
      if (t.parentNode === el) { el.replaceChild(s, t); maskAsText(s); wrapped++; }
    }
  }

  function wrap(root) {
    if (!root || root.nodeType !== 1) return;
    if (match(root)) wrapOne(root);
    if (!root.querySelectorAll) return;
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) if (match(all[i])) wrapOne(all[i]);
  }

  window.__afWrapGapText = wrap;

  // `innerHTML` — AE kodining asosiy render yo'li. Setter'ni o'rab, yangi
  // markup joylanishi bilan o'rashni yurgizamiz.
  var proto = window.Element && Element.prototype;
  var d = proto && Object.getOwnPropertyDescriptor(proto, "innerHTML");
  if (d && d.set && d.configurable !== false) {
    Object.defineProperty(proto, "innerHTML", {
      configurable: true,
      enumerable: d.enumerable,
      get: d.get,
      set: function (v) {
        d.set.call(this, v);
        try { wrap(this); } catch (e) { /* render to'xtamasin */ }
      },
    });
  } else if (window.FFLog) {
    FFLog.warn("gap-text", "innerHTML setter ilinmadi — dinamik markupda ikon/matn bo'shlig'i tushib qolishi mumkin");
  }

  function boot() { try { wrap(document.body); } catch (e) {} }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);

  window.__afGapTextCount = function () { return wrapped; };
})();
