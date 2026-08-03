/*
 * FrameFlow UXP — muhit konstantalari.
 * API bazasi manifest network allowlist'i bilan chegaralangan: bu yerga yozilgan
 * domen manifest.json `requiredPermissions.network.domains` da ham bo'lishi SHART,
 * aks holda fetch "Permission denied to the url" bilan rad etiladi (spike §4).
 */
(function () {
  "use strict";

  var PROD_API = "https://api.getframeflow.app";
  var PROD_WEB = "https://getframeflow.app";

  window.FF_ENV = {
    /** Plagin kodi versiyasi — manifest.json bilan QO'LDA sinxron (UXP manifestni o'qiy olmaydi). */
    version: "0.1.4",
    /** Bu plagin qaysi host dastur uchun — katalog `?app=pr` filtri shundan. */
    app: "pr",
    appLabel: "Premiere Pro",
    apiBase: PROD_API,
    webBase: PROD_WEB,
    /** Server login javobida apiBaseUrl qaytaradi — uni shu yerga yozamiz. */
    setApiBase: function (url) {
      if (typeof url === "string" && url.indexOf("https://") === 0) {
        window.FF_ENV.apiBase = url.replace(/\/+$/, "");
      }
    },
  };
})();
