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

  // UUID (idempotency kaliti) — crypto.randomUUID bo'lsa o'sha, aks holda zaxira generator.
  function uuid() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Qayta-uriniladigan server holatlari — Cloud Run cold-start / instance rotation / deploy.
  function isRetryableStatus(s) { return s === 502 || s === 503 || s === 504 || s === 429; }
  // Cold-start uchun sabrli backoff (ms) — jami ~12s + har urinishda timeout.
  function backoffMs(a) { return [1500, 3500, 7000, 10000][a] || 10000; }

  /**
   * So'rov. opts: { method, body(obyekt), auth:false, idempotencyKey, idempotent, timeout }.
   * Muvaffaqiyatsiz HTTP → Error{status, code, data}. Tarmoq uzilishi/timeout → Error('NETWORK').
   *
   * QAYTA-URINISH FAQAT idempotent so'rovlarda (GET/HEAD, yoki opts.idempotencyKey/opts.idempotent):
   * himoyasiz POST'ni ko'r-ko'rona qayta yuborish DOUBLE-CHARGE'ga olib keladi (P18). Server
   * idempotencyKey bo'yicha dedup qiladi, shu sabab kalitli POST xavfsiz qayta uriniladi.
   * Har urinishda AbortController timeout (~20s) — Cloud Run osilib qolsa cheksiz spin bo'lmaydi.
   */
  async function req(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var t = getToken();
    if (t && opts.auth !== false) headers.Authorization = "Bearer " + t;
    var method = (opts.method || "GET").toUpperCase();
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    var body = opts.body;
    if (body !== undefined && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    var idempotent = method === "GET" || method === "HEAD" || opts.idempotent === true || !!opts.idempotencyKey;
    var maxAttempts = idempotent ? 4 : 1;
    var timeoutMs = opts.timeout || 20000;
    var res = null;
    for (var a = 0; a < maxAttempts; a++) {
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = ctrl ? setTimeout((function (c) { return function () { try { c.abort(); } catch (e) {} }; })(ctrl), timeoutMs) : null;
      try {
        res = await fetch(base + path, { method: method, headers: headers, body: body, signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
      } catch (e) {
        if (timer) clearTimeout(timer);
        // tarmoq uzilishi yoki timeout(abort). Idempotent bo'lmasa YOKI oxirgi urinish → NETWORK.
        if (!idempotent || a === maxAttempts - 1) { var ne = new Error("NETWORK"); ne.cause = e; throw ne; }
        await new Promise(function (r) { setTimeout(r, backoffMs(a)); });
        continue;
      }
      // 502/503/504/429 → idempotent bo'lsa sabr bilan qayta uramiz (429 Retry-After'ga rioya).
      if (idempotent && isRetryableStatus(res.status) && a < maxAttempts - 1) {
        var ra = parseInt((res.headers && res.headers.get && res.headers.get("Retry-After")) || "", 10);
        var wait = (res.status === 429 && ra > 0) ? Math.min(ra * 1000, 15000) : backoffMs(a);
        await new Promise(function (r) { setTimeout(r, wait); });
        continue;
      }
      break;
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    // P8 #4 — sessiyani FAQAT token o'lganda tozalaymiz. Avval HAR 401 clearSession qilardi →
    // masalan noto'g'ri 2FA kodi (TWO_FA_INVALID, 401) ish o'rtasida logout qilardi. Endi faqat
    // SESSIYA O'LGAN kodlar (yoki kodsiz eski 401) sessiyani tugatadi; boshqa 401'lar oddiy xato.
    if (res.status === 401 && t && opts.auth !== false) {
      var code401 = data && data.code;
      var sessionDead = !code401 || code401 === "TOKEN_EXPIRED" || code401 === "TOKEN_INVALID" || code401 === "TOKEN_REVOKED" || code401 === "NO_TOKEN";
      if (sessionDead) {
        clearSession();
        try { window.dispatchEvent(new CustomEvent("ff-auth-expired")); } catch (e) {}
      }
    }
    if (!res.ok) {
      var err = new Error((data && data.error) || "Server error (HTTP " + res.status + ")");
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
    register: function (email, password, name, turnstileToken) { return req("/api/auth/register", { method: "POST", body: { email: email, password: password, name: name || undefined, turnstileToken: turnstileToken || undefined }, auth: false }); },
    forgot: function (email) { return req("/api/auth/forgot-password", { method: "POST", body: { email: email }, auth: false }); },
    google: function (credential) { return req("/api/auth/google", { method: "POST", body: { credential: credential }, auth: false }); },
    resendVerification: function (email) { return req("/api/auth/resend-verification", { method: "POST", body: { email: email }, auth: false }); },
    me: function () { return req("/api/auth/me"); },
    saveName: function (name) { return req("/api/auth/me", { method: "PATCH", body: { name: name } }); },
    // Avatar — FormData (req() JSON'lashtiradi, shu sabab to'g'ridan fetch)
    uploadAvatar: function (file) {
      var fd = new FormData();
      fd.append("avatar", file);
      var t = getToken();
      return fetch(base + "/api/auth/avatar", {
        method: "POST",
        headers: t ? { Authorization: "Bearer " + t } : {},
        body: fd,
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok) {
            var err = new Error((data && data.error) || "Upload failed (HTTP " + res.status + ")");
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
    },

    // Landing CMS — ommaviy konfiguratsiya (admin "Website" tab'da tahrirlanadi)
    landingConfig: function () { return req("/api/landing/config", { auth: false }); },

    // Katalog / plugin profil
    // FAZA 5 (A1): katalog sahifalangan (take+cursor) — cursor ixtiyoriy, javobda nextCursor.
    catalog: function (cursor) {
      var q = cursor ? "?cursor=" + encodeURIComponent(cursor) : "";
      return req("/api/plugin/catalog" + q, { auth: false });
    },
    pluginMe: function () { return req("/api/plugin/me"); },
    packLink: function (templateId) { return req("/api/plugin/assets/" + encodeURIComponent(templateId) + "/pack?json=1"); },

    // Billing (Lemon Squeezy — MoR). body: { plan: "pro"|"studio" } yoki { credits: 500 }
    checkout: function (body) { return req("/api/billing/checkout", { method: "POST", body: body }); },

    // FAZA 1c — GDPR: o'z ma'lumotini eksport / hisobni o'chirish
    exportData: function () { return req("/api/users/export", { method: "POST" }); },
    deleteAccount: function () { return req("/api/account", { method: "DELETE", body: { confirm: "DELETE" } }); },

    // Studio Gen
    credits: function () { return req("/api/studio/credits"); },
    models: function (mode) { return req("/api/studio/gen/models?mode=" + encodeURIComponent(mode)); },
    // QA-FIX #12 — sessiya modeli: yaratishda title (birinchi prompt) ham ketadi
    session: function (mode, title) { return req("/api/studio/gen/sessions", { method: "POST", body: { mode: mode, title: title || undefined } }); },
    sessions: function () { return req("/api/studio/gen/sessions"); },
    sessionRename: function (id, title) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id), { method: "PATCH", body: { title: title } }); },
    sessionGens: function (id) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id) + "/generations?perPage=50&status=done"); },
    sessionDelete: function (id) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id), { method: "DELETE" }); }, // P6
    quote: function (modelId, mode, params) { return req("/api/studio/gen/cost-quote", { method: "POST", body: { modelId: modelId, mode: mode, params: params || {} } }); },
    // P18 — har job-yaratish urinishi uchun BITTA idempotency kaliti: req() ichki qayta
    // urinishlari (cold-start) shu kalitni qayta ishlatadi → server dedup qiladi, IKKINCHI
    // charge YO'Q. 404-session qayta urinishi FFAPI.gen'ni qaytadan chaqiradi → yangi kalit
    // (u haqiqatan boshqa job). caller idempotencyKey bersa — o'sha ishlatiladi.
    gen: function (payload) {
      var key = (payload && payload.idempotencyKey) || uuid();
      var body = Object.assign({}, payload, { idempotencyKey: key });
      return req("/api/studio/gen", { method: "POST", body: body, idempotencyKey: key });
    },
    genGet: function (id) { return req("/api/studio/gen/" + encodeURIComponent(id)); },
    genDelete: function (id) { return req("/api/studio/gen/" + encodeURIComponent(id), { method: "DELETE" }); },
    history: function (limit) { return req("/api/studio/gen/history?limit=" + (limit || 30)); },
    enhance: function (prompt, mode, modelId) {
      return req("/api/studio/gen/prompt/enhance", { method: "POST", body: { prompt: prompt, mode: mode || undefined, modelId: modelId || undefined } });
    },
    // P8 — referens yuklash: kichik fayl dataUrl bilan (JSON), katta video/audio presigned PUT + srcKey
    refUpload: function (body) { return req("/api/studio/gen/ref-upload", { method: "POST", body: body }); },
    refUploadUrl: function (contentType, sizeBytes, name) {
      return req("/api/studio/gen/ref-upload-url", { method: "POST", body: { contentType: contentType, sizeBytes: sizeBytes, name: name || undefined } });
    },

    // Projects (QA-FIX #13) — gen + shablonlarni loyihaga yig'ish
    projects: function () { return req("/api/studio/projects"); },
    projectCreate: function (name) { return req("/api/studio/projects", { method: "POST", body: { name: name } }); },
    projectGet: function (id) { return req("/api/studio/projects/" + encodeURIComponent(id)); },
    projectRename: function (id, name) { return req("/api/studio/projects/" + encodeURIComponent(id), { method: "PATCH", body: { name: name } }); },
    projectDelete: function (id) { return req("/api/studio/projects/" + encodeURIComponent(id), { method: "DELETE" }); },
    projectAddItem: function (id, kind, refId) { return req("/api/studio/projects/" + encodeURIComponent(id) + "/items", { method: "POST", body: { kind: kind, refId: refId } }); },
    projectRemoveItem: function (id, itemId) { return req("/api/studio/projects/" + encodeURIComponent(id) + "/items/" + encodeURIComponent(itemId), { method: "DELETE" }); },
  };
})();
