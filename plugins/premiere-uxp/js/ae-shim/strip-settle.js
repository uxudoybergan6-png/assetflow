/*
 * Scroll-strip "joylashuv" shim'i — pill lentalarining surilishini AE bilan
 * bir xil holatga qaytaradi.
 *
 * SABAB (o'lchangan, 440px, `#afTabs`):
 *   `.af-tabs{justify-content:center}` va `.af-tabs.overflowing{justify-content:flex-start}`.
 *   Lenta sig'masa AE `overflowing` klassini QO'YADI. Ammo brauzer bu ikki
 *   holat orasida `scrollLeft` ni SAQLAB qoladi: `center` holatida kontent
 *   ikki tomonga teng chiqadi va tabiiy boshlang'ich surilish
 *   `(scrollWidth − clientWidth) / 2 = (564 − 440) / 2 = 62px` bo'ladi.
 *   `flex-start` ga o'tgach layout chapga qaytadi, lekin 62px surilish QOLADI.
 *
 *   AE'da bu ko'rinmaydi, chunki `afRefreshStrip()` render bilan bir xil
 *   kadrda ishlaydi — `center` layout hech qachon materializatsiya bo'lmaydi.
 *   Portda esa layout kechroq tinchiydi (`autofill.js` ustun o'lchayapti,
 *   `media-fix.js` rasm qutilarini yozyapti, shriftlar almashyapti), shu sabab
 *   `center` holat real chiziladi va eskirgan surilish qolib ketadi.
 *   O'lchov: AE `scrollLeft:0`, port `scrollLeft:61.5` → oltita tab ham 62px
 *   chapga siljigan; navigatsiya takrorlansa 123.5px gacha yig'ilgan.
 *
 * YECHIM: AE'ning `afRefreshStrip()` ini o'rab, har chaqiruvdan keyin
 * surilishni nolga qaytaramiz va `afScrollActiveStripIntoView()` ni QAYTA
 * yurgizamiz — ya'ni AE'ning O'Z mantig'i toza bazadan hisoblaydi.
 * Foydalanuvchi lentani o'zi surgan bo'lsa TEGMAYMIZ (`__ffUserScrolled`).
 * AE kodiga tegilmaydi.
 */
(function () {
  "use strict";

  var SEL = ".af-tabs, .fsheet-catchips, #afCatChips";

  function strips() { return document.querySelectorAll(SEL); }

  /** Foydalanuvchi surishini belgilaymiz — undan keyin avtomatik tuzatish yo'q. */
  function markUser(e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (el) el.__ffUserScrolled = true;
  }
  ["wheel", "pointerdown", "touchstart", "keydown"].forEach(function (t) {
    document.addEventListener(t, markUser, true);
  });

  /**
   * Bitta lentani nol surilishga qaytaradi.
   *
   * `afScrollActiveStripIntoView()` bu yerda ATAYLAB chaqirilmaydi: AE uni
   * faqat init va `resize` da yurgizadi, navigatsiyada emas. Agar biz har
   * `afRefreshStrip` da chaqirsak, aktiv pill markazga surilib AE'dan
   * uzoqlashamiz (o'lchov: "Music" uchun u 197px beradi, AE esa 0 da turadi).
   * `resize` yo'lida AE uni baribir BIZDAN KEYIN chaqiradi — ya'ni haqiqiy
   * o'lcham o'zgarishida AE mantig'i ustun qoladi.
   */
  function reset(el) {
    if (!el || el.__ffUserScrolled || !el.scrollLeft) return;
    try {
      el.scrollLeft = 0;
      if (typeof window.__ffRefreshStrip === "function") window.__ffRefreshStrip(el);   // fade-l/fade-r ni to'g'rilash
    } catch (e) { /* strip DOM'dan chiqib ketgan */ }
  }

  function settle() {
    var s = strips();
    for (var i = 0; i < s.length; i++) reset(s[i]);
  }

  /**
   * AE `afRefreshStrip()` global funksiyasini o'raymiz. U inline skriptda
   * e'lon qilingan va shim'lardan KEYIN yuklanadi, shuning uchun paydo
   * bo'lguncha kutamiz (qisqa poll — 5s dan keyin voz kechamiz).
   */
  var tries = 0;
  var timer = setInterval(function () {
    if (typeof window.afRefreshStrip !== "function") {
      if (++tries > 50) clearInterval(timer);
      return;
    }
    clearInterval(timer);
    var orig = window.afRefreshStrip;
    window.__ffRefreshStrip = orig;
    window.afRefreshStrip = function (el) {
      var r = orig.apply(this, arguments);
      // Rekursiyani oldini olish: `reset` ORIGINAL funksiyani chaqiradi.
      reset(el);
      return r;
    };
    settle();
  }, 100);

  // Yuklanish egri chizig'i: shriftlar, katalog javobi va shim o'lchovlari
  // turli lahzalarda tugaydi — bir nechta nuqtada takrorlaymiz (narxi nolga
  // yaqin: `reset` faqat `scrollLeft` yozadi).
  [400, 1200, 2600].forEach(function (ms) { setTimeout(settle, ms); });

  try {
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { setTimeout(settle, 60); });
    }
  } catch (e) { /* UXP'da yo'q bo'lishi mumkin */ }

  window.FFStripSettle = settle;
})();
