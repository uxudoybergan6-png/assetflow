/*
 * FrameFlow UXP — saqlash adapteri.
 *
 * Token → `uxp.storage.secureStorage` (OS keychain). localStorage FAQAT nozik
 * bo'lmagan UI holati uchun (spike §5: secureStorage `Uint8Array` qaytaradi).
 */
(function () {
  "use strict";

  var uxp = require("uxp");
  var secure = uxp.storage && uxp.storage.secureStorage;
  var TOKEN_KEY = "ff.plugin.token";
  var PREFS_KEY = "ff.plugin.prefs";

  /** secureStorage ishlamasa (eski build / OS keychain yo'q) — sessiya xotirasi.
   *  Diskka YOZILMAYDI: token localStorage'ga tushib qolmasligi kerak. */
  var memoryToken = null;
  var secureBroken = false;

  async function getToken() {
    if (secureBroken) return memoryToken;
    try {
      var raw = await secure.getItem(TOKEN_KEY);
      if (!raw) return null;
      return window.FFBytes.utf8Decode(raw);
    } catch (e) {
      // "not found" — normal holat, xato emas.
      if (String(e && e.message).toLowerCase().indexOf("not") >= 0) return null;
      window.FFLog.warn("secureStorage o'qish xatosi:", e);
      secureBroken = true;
      return memoryToken;
    }
  }

  async function setToken(token) {
    memoryToken = token || null;
    if (secureBroken) return;
    try {
      if (token) await secure.setItem(TOKEN_KEY, String(token));
      else await secure.removeItem(TOKEN_KEY);
    } catch (e) {
      window.FFLog.warn("secureStorage yozish xatosi — sessiya xotirasiga o'tildi:", e);
      secureBroken = true;
    }
  }

  async function clearToken() {
    await setToken(null);
  }

  /** Nozik bo'lmagan prefs (oxirgi tab, filtr holati, ko'rilgan xabar id'lari). */
  function getPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function setPref(key, value) {
    var p = getPrefs();
    p[key] = value;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* kvota */ }
  }

  function getPref(key, fallback) {
    var p = getPrefs();
    return Object.prototype.hasOwnProperty.call(p, key) ? p[key] : fallback;
  }

  window.FFStore = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    getPref: getPref,
    setPref: setPref,
    /** Diagnostika uchun: token qayerda saqlanmoqda. */
    tokenBackend: function () { return secureBroken ? "memory" : "secureStorage"; },
  };
})();
