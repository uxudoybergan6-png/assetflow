/*
 * UXP `<input>` / `<textarea>` chizmasini AE bilan tenglashtirish — FAQAT UXP.
 *
 * IKKI ALOHIDA NUQSON, ikkalasi ham Premiere'da o'lchandi:
 *
 * 1) NATIVE CHIZMA. Maydon ichida o'tkir burchakli ochroq to'rtburchak
 *    ko'rinardi — muallif qutisi emas, UXP widget'ining o'z bezagi. Pastdagi
 *    CSS bloki uni o'chiradi (`.lg-passinput` — fon `transparent` — shundan
 *    keyin AE bilan bir xil bo'ldi).
 *
 * 2) YARIM SHAFFOF FON IKKI MARTA CHIZILADI. UXP `background-color` ni ham
 *    element qutisiga, ham ichki "matn tahriri" sohasiga (matn qatori balandligi,
 *    padding'dan ichkarida, O'TKIR burchakli) chizadi. Alfa < 1 bo'lsa ikkinchi
 *    qatlam birinchisining USTIGA tushadi → matn atrofida ochroq lenta
 *    (`.lg-input`: `rgba(255,255,255,.05)` → lenta joyida ~10%).
 *
 *    JONLI O'LCHOV (qizil zond): noshaffof rang berilganda butun quti bir tekis
 *    va radius bo'yicha to'g'ri qirqilib chiziladi — ya'ni nuqson FAQAT alfa < 1
 *    da. Tekislab noshaffof qilish yordam bermadi: ustki qatlam MUALLIF rangini
 *    ishlatadi, bizning inline qiymatimizni emas. Shu sabab yagona ishonchli
 *    yo'l — bunday maydonlar fonini `transparent` qilish: ustki qatlam ham
 *    hech nima chizmaydi, chegara va radius o'z joyida qoladi.
 *
 *    Chetlanish (halol yozib qo'yamiz): AE'da maydon ichida 5% oq to'ldirish
 *    bor, UXP'da esa u yo'q — lekin bir tekis, "buzuq" ko'rinmaydi. Rangni
 *    port vaqtida tekislab bo'lmaydi: natija ORTIDAGI fonga, u esa mavzuga
 *    (A·Noir / B·Neon / C·Cold) bog'liq.
 *
 * Nega faqat UXP: brauzerdagi 1:1 QA etaloni bayt-bir xil qolishi kerak.
 * Geometriya O'ZGARMAYDI — faqat rang.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { /* brauzer QA — tegmaymiz */ }
  if (!uxp) return;

  /* ── 1) Native chizma ──────────────────────────────────────────────────── */
  try {
    var st = document.createElement("style");
    st.setAttribute("data-ff", "uxp-input-chrome");
    st.textContent = "input,textarea{appearance:none;-webkit-appearance:none;"
      + "background-image:none;background-clip:padding-box;box-shadow:none;outline-width:0}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {
    if (window.console) console.warn("[uxp-input-chrome] uslub qo'shilmadi:", e);
  }

  /* ── 2) Yarim shaffof fon ikki marta chiziladi ─────────────────────────── */

  /** `rgb(a)` matnini [r,g,b,a] ga o'giradi; tanilmasa `null`. */
  function parse(c) {
    if (!c) return null;
    var m = String(c).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i);
    if (!m) return null;
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  }

  function fix(el) {
    // O'zimiz `transparent` qilib qo'ygan maydonni qayta o'qimaylik.
    if (el.__ffInFixed) return;
    var c = parse(getComputedStyle(el).backgroundColor);
    if (!c) return;
    if (c[3] <= 0 || c[3] >= 1) return;            // shaffof yoki noshaffof — to'g'ri chiziladi
    el.__ffInFixed = 1;
    el.style.setProperty("background-color", "transparent");
  }

  var pending = false;
  function scan() {
    pending = false;
    var n = document.querySelectorAll("input,textarea");
    for (var i = 0; i < n.length; i++) fix(n[i]);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(scan);
  }

  var hasMO = false;
  try {
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, attributeFilter: ["class", "data-theme"],
    });
    hasMO = true;
  } catch (e) { /* zaxira pastda */ }
  document.addEventListener("click", schedule, true);
  if (!hasMO) setInterval(schedule, 1500);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  [0, 300, 900, 2000].forEach(function (ms) { setTimeout(schedule, ms); });

  window.FFInputChrome = scan;
})();
