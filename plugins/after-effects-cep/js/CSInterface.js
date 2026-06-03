/**
 * Minimal CSInterface shim.
 *
 * In CEP panels After Effects provides `window.__adobe_cep__` which exposes:
 * - evalScript(script, callback)
 * - addEventListener(name, fn)
 * - removeEventListener(name, fn)
 *
 * We provide a small wrapper so our panel can run both:
 * - inside CEP (real import via evalScript)
 * - in browser/dev (no-op + helpful errors)
 */
function CSInterface() {}

CSInterface.prototype.evalScript = function (script, callback) {
  try {
    if (typeof window !== "undefined" && window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === "function") {
      return window.__adobe_cep__.evalScript(script, callback || function () {});
    }
  } catch (e) {
    /* fallthrough */
  }
  if (typeof callback === "function") callback("error: CEP evalScript unavailable");
  throw new Error("CEP evalScript unavailable");
};

CSInterface.prototype.addEventListener = function (name, fn) {
  try {
    if (typeof window !== "undefined" && window.__adobe_cep__ && typeof window.__adobe_cep__.addEventListener === "function") {
      return window.__adobe_cep__.addEventListener(name, fn);
    }
  } catch (e) {
    /* */
  }
};

CSInterface.prototype.removeEventListener = function (name, fn) {
  try {
    if (typeof window !== "undefined" && window.__adobe_cep__ && typeof window.__adobe_cep__.removeEventListener === "function") {
      return window.__adobe_cep__.removeEventListener(name, fn);
    }
  } catch (e) {
    /* */
  }
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  // CEP: shell open via cep api when possible
  try {
    if (typeof window !== "undefined" && window.__adobe_cep__ && typeof window.__adobe_cep__.openURLInDefaultBrowser === "function") {
      return window.__adobe_cep__.openURLInDefaultBrowser(url);
    }
  } catch (e) {
    /* */
  }
  // Fallbacks
  try {
    if (typeof require !== "undefined") {
      try {
        var shell = require("uxp").shell;
        shell.openExternal(url);
        return;
      } catch (e2) {}
    }
  } catch (e3) {}
  if (typeof window !== "undefined") window.open(url, "_blank");
};
