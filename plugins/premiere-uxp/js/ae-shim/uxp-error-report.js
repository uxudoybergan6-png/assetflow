/*
 * Premiere UXP global xato qo'riqchisi.
 *
 * AE kodidagi `AssetFlowLog` allaqachon autentifikatsiyalangan `/api/logs`
 * navbati, lokal saqlash va 401 flood himoyasiga ega. Bu kech shim faqat UXP
 * runtime'dagi ushlanmagan error/rejection'larni shu mavjud yo'lga ulaydi.
 */
(function () {
  "use strict";

  var uxp = null;
  try { uxp = require("uxp"); } catch (e) { return; }
  if (!uxp || !window.addEventListener || !window.AssetFlowLog) return;

  var seen = Object.create(null);
  var sent = 0;
  var MAX_PER_BOOT = 12;

  function clean(value) {
    var s = String(value == null ? "" : value);
    s = s.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
      .replace(/([?&](?:token|code|key|secret)=)[^&#\s]+/gi, "$1[redacted]")
      .replace(/\b(?:eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\b/g, "[jwt]");
    return s.slice(0, 700);
  }

  function report(kind, value) {
    if (sent >= MAX_PER_BOOT) return;
    var msg = clean(value && (value.stack || value.message) || value || "Unknown error");
    if (!msg) return;
    var key = kind + ":" + msg;
    var now = Date.now();
    if (seen[key] && now - seen[key] < 30000) return;
    seen[key] = now;
    sent++;
    try {
      window.AssetFlowLog.error("Premiere panel runtime error", {
        action: kind,
        detail: msg,
        data: { host: "premiere", version: String((uxp.host && uxp.host.version) || "") },
      });
    } catch (e) { /* reporter hech qachon panelni yiqitmasin */ }
  }

  window.addEventListener("error", function (event) {
    report("uxp_runtime_error", event && (event.error || event.message));
  });
  window.addEventListener("unhandledrejection", function (event) {
    report("uxp_unhandled_rejection", event && event.reason);
  });
})();
