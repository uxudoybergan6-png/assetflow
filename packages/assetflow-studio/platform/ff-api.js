/**
 * FrameFlow platforma API klienti (window.FFAPI).
 * Studio/Admin'dagi studio-api.js naqshi: markazlashgan baseUrl + Bearer +
 * tarmoq xatosida qayta urinish + global 401 (sessiya tugadi) hodisasi.
 * Token: localStorage.ff_token (reja: Faza E).
 */
(function () {
  "use strict";

  var DEFAULT_API = "https://api.getframeflow.app";
  var meta = document.querySelector('meta[name="frameflow-api"]');
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var base = ((meta && meta.getAttribute("content")) || (isLocal ? "http://localhost:4000" : DEFAULT_API)).replace(/\/+$/, "");

  var TOKEN_KEY = "ff_token";
  var USER_KEY = "ff_user";

  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function getUser() {
    try { return JSON.parse(window.localStorage.getItem(USER_KEY) || "null"); } catch (e) { return null; }
  }
  function setSession(token, user) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token || "");
      window.localStorage.setItem(USER_KEY, JSON.stringify(user || null));
    } catch (e) {}
  }
  function clearSession() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }

  /**
   * So'rov. opts: { method, body(obyekt), auth:false — token yubormaslik }.
   * Muvaffaqiyatsiz HTTP → Error{status, code, data}. Tarmoq uzilishi → Error('NETWORK')
   * (3 urinish, Cloud Run cold-start uchun kutish bilan).
   */
  async function req(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var t = getToken();
    if (t && opts.auth !== false) headers.Authorization = "Bearer " + t;
    var body = opts.body;
    if (body !== undefined && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    var res = null;
    for (var a = 0; a < 3; a++) {
      try {
        res = await fetch(base + path, { method: opts.method || "GET", headers: headers, body: body });
        break;
      } catch (e) {
        if (a === 2) { var ne = new Error("NETWORK"); ne.cause = e; throw ne; }
        await new Promise(function (r) { setTimeout(r, 1200 * (a + 1)); });
      }
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && t && opts.auth !== false) {
      clearSession();
      try { window.dispatchEvent(new CustomEvent("ff-auth-expired")); } catch (e) {}
    }
    if (!res.ok) {
      var err = new Error((data && data.error) || "Server xatosi (HTTP " + res.status + ")");
      err.status = res.status;
      err.code = data && data.code;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.FFAPI = {
    base: base,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    req: req,

    // Auth
    login: function (email, password) { return req("/api/auth/login", { method: "POST", body: { email: email, password: password }, auth: false }); },
    register: function (email, password, name) { return req("/api/auth/register", { method: "POST", body: { email: email, password: password, name: name || undefined }, auth: false }); },
    forgot: function (email) { return req("/api/auth/forgot-password", { method: "POST", body: { email: email }, auth: false }); },
    me: function () { return req("/api/auth/me"); },
    saveName: function (name) { return req("/api/auth/me", { method: "PATCH", body: { name: name } }); },

    // Katalog / plugin profil
    catalog: function () { return req("/api/plugin/catalog", { auth: false }); },
    pluginMe: function () { return req("/api/plugin/me"); },
    packLink: function (templateId) { return req("/api/plugin/assets/" + encodeURIComponent(templateId) + "/pack?json=1"); },

    // Studio Gen
    credits: function () { return req("/api/studio/credits"); },
    models: function (mode) { return req("/api/studio/gen/models?mode=" + encodeURIComponent(mode)); },
    session: function (mode) { return req("/api/studio/gen/sessions", { method: "POST", body: { mode: mode } }); },
    quote: function (modelId, mode, params) { return req("/api/studio/gen/cost-quote", { method: "POST", body: { modelId: modelId, mode: mode, params: params || {} } }); },
    gen: function (payload) { return req("/api/studio/gen", { method: "POST", body: payload }); },
    genGet: function (id) { return req("/api/studio/gen/" + encodeURIComponent(id)); },
    genDelete: function (id) { return req("/api/studio/gen/" + encodeURIComponent(id), { method: "DELETE" }); },
    history: function (limit) { return req("/api/studio/gen/history?limit=" + (limit || 30)); },
    enhance: function (prompt, mode, modelId) {
      return req("/api/studio/gen/prompt/enhance", { method: "POST", body: { prompt: prompt, mode: mode || undefined, modelId: modelId || undefined } });
    },
  };
})();
