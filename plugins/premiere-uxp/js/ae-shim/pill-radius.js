/*
 * `border-radius` klamp shim'i — UXP "pill" tugmalarni linzaga aylantirmasin.
 *
 * SABAB (Premiere'da o'lchangan): CSS spetsifikatsiyasi radius quti yarmidan
 * oshsa uni QISQARTIRISHNI talab qiladi (CSS Backgrounds §5.5 — `f` koeffitsienti).
 * Brauzer shuni qiladi, UXP esa QILMAYDI: `border-radius:999px` bergan har bir
 * element (AE CSS'ida 160 dan ortiq qoida — `var(--r-full)` ham shu) 999px'lik
 * yoyi bilan chiziladi va tugma "linza" shaklida qo'shni kartalarga chiqib
 * ketadi. Kirish ekranidagi "Sign in" / "Continue with Google" tugmalari aynan
 * shu sababdan butun panel bo'ylab oq yoy bo'lib ko'rinardi.
 *
 * NIMA UCHUN CSS'da emas: to'g'ri qiymat = `min(width, height) / 2`, ya'ni
 * QUTI O'LCHAMIga bog'liq. Port vaqtida u noma'lum (bir xil `.ff-btn` 44px
 * ham, 28px ham bo'lishi mumkin), shu sabab klamp ish vaqtida bo'ladi.
 * `scripts/ae-port.mjs` faqat QAYSI klasslarga tegishini yig'adi → `__AF_PILLC`.
 *
 * ESLATMA (o'lchov tuzog'i): muallif radiusi elementda BIR MARTA o'qiladi va
 * keshlanadi. Aks holda o'zimiz yozgan inline qiymat keyingi o'tishda "muallif
 * qiymati" bo'lib o'qilardi va radius har o'lchovda kichrayib ketardi.
 */
(function () {
  "use strict";

  var CLS = window.__AF_PILLC || [];
  if (!CLS.length) return;

  // `[style]` HAM kerak: AE'ning bir qancha bloki radiusni JS shabloni ichida
  // inline beradi (`border-radius:999px` — Google device-code kartasidagi
  // "Copy code"/"Copy link"/"Open again" tugmalari aynan shunday). Port vaqtida
  // yig'ilgan klass ro'yxati ularni ko'rmaydi, natijada Premiere'da tugmalar
  // 999px yoyi bilan "linza" bo'lib chiqardi.
  // Narxi past: radiusi yo'q element birinchi o'tishda `[0,0,0,0]` deb keshlanadi.
  var SEL = CLS.map(function (c) { return "." + c; }).join(",") + ",[style]";
  var CAMEL = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"];
  var KEBAB = ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"];
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window)
    : function (f) { return setTimeout(f, 16); };

  function clampOne(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;

    if (!el.__ffPillR) {
      var cs = getComputedStyle(el), r = [], any = 0;
      for (var i = 0; i < 4; i++) {
        var v = parseFloat(cs[CAMEL[i]]);
        r[i] = isFinite(v) ? v : 0;
        if (r[i]) any = 1;
      }
      if (!any) { el.__ffPillR = [0, 0, 0, 0]; return; }
      el.__ffPillR = r;
    }
    var dec = el.__ffPillR;
    if (!dec[0] && !dec[1] && !dec[2] && !dec[3]) return;

    var max = (w < h ? w : h) / 2;
    var out = "";
    for (var j = 0; j < 4; j++) out += (dec[j] > max ? max : dec[j]) + "px ";
    if (el.__ffPillV === out) return;
    el.__ffPillV = out;
    for (var k = 0; k < 4; k++) {
      el.style.setProperty(KEBAB[k], (dec[k] > max ? max : dec[k]) + "px");
    }
  }

  var pending = false;
  function scan() {
    pending = false;
    var n = document.querySelectorAll(SEL);
    for (var i = 0; i < n.length; i++) clampOne(n[i]);
  }
  // Ikki `raf`: birinchisi joriy mutatsiya to'plamini kutadi, ikkinchisi
  // layout tinchigach o'lchaydi (aks holda `offsetWidth` hali 0 bo'lishi mumkin).
  function schedule() {
    if (pending) return;
    pending = true;
    raf(function () { raf(scan); });
  }

  var hasMO = false;
  try {
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, attributeFilter: ["class"],
    });
    hasMO = true;
  } catch (e) { /* UXP'da MutationObserver yo'q bo'lsa — pastdagi zaxira qoladi */ }

  // Zaxira: DOM o'zgarishlarining aksariyati foydalanuvchi amalidan keyin
  // bo'ladi (modal ochish, kirish tugmasi, tab almashish). MutationObserver
  // bo'lsa ham arzon — `schedule()` o'zi dedupe qiladi.
  document.addEventListener("click", schedule, true);
  document.addEventListener("keyup", schedule, true);
  // MutationObserver umuman bo'lmasa — sekin, lekin uzilmaydigan tekshiruv.
  if (!hasMO) setInterval(schedule, 1500);

  window.addEventListener("resize", schedule);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  // Yuklanish egri chizig'i: shriftlar, katalog javobi va boshqa shim'lar
  // (autofill, media-fix) qutilarni turli lahzalarda yakunlaydi.
  [0, 300, 900, 2000].forEach(function (ms) { setTimeout(schedule, ms); });
  try {
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { setTimeout(schedule, 60); });
    }
  } catch (e) { /* UXP'da bo'lmasligi mumkin */ }

  window.FFPillRadius = scan;
})();
