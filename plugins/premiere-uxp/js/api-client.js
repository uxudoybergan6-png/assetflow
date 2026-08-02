/*
 * FrameFlow UXP — API klient.
 *
 * Qoidalar:
 *  - Auth header tokendan avtomatik qo'yiladi (chaqiruvchi token bilan ishlamaydi).
 *  - Xato HAR DOIM {status, code, message} obyekti — xom stack UI'ga chiqmaydi.
 *  - 401 → token o'chiriladi va `onUnauthorized` chaqiriladi (login ekran),
 *    lekin joriy ko'rinish konteksti yo'qolmaydi (main.js qaytadi).
 *  - Narx/limit HECH QACHON klientda hisoblanmaydi — server javobi yagona haqiqat.
 */
(function () {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 20000;

  function ApiError(status, code, message) {
    this.name = "ApiError";
    this.status = status;
    this.code = code || "";
    this.message = message || "Noma'lum xato";
  }
  ApiError.prototype = Object.create(Error.prototype);

  /** Tarmoq/HTTP xatosini foydalanuvchi o'qiy oladigan o'zbekcha matnga aylantiradi. */
  function humanize(err) {
    if (err instanceof ApiError) {
      if (err.status === 0) return "Serverga ulanib bo'lmadi. Internetni tekshiring.";
      if (err.status === 401) return "Sessiya tugadi — qaytadan kiring.";
      if (err.status === 403) return err.message || "Ruxsat yo'q.";
      if (err.status === 404) return "Topilmadi.";
      if (err.status === 429) return "Juda ko'p so'rov. Bir oz kuting.";
      if (err.status >= 500) return "Server xatosi. Birozdan keyin urinib ko'ring.";
      return err.message;
    }
    return String((err && err.message) || err);
  }

  var handlers = { onUnauthorized: null };

  function url(path, query) {
    var base = window.FF_ENV.apiBase.replace(/\/+$/, "");
    var u = base + (path.charAt(0) === "/" ? path : "/" + path);
    if (query) {
      var parts = [];
      Object.keys(query).forEach(function (k) {
        var v = query[k];
        if (v === undefined || v === null || v === "") return;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
      });
      if (parts.length) u += (u.indexOf("?") >= 0 ? "&" : "?") + parts.join("&");
    }
    return u;
  }

  async function request(method, path, opts) {
    var o = opts || {};
    var headers = { Accept: "application/json" };
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    if (o.auth !== false) {
      var token = await window.FFStore.getToken();
      if (token) headers.Authorization = "Bearer " + token;
    }
    Object.keys(o.headers || {}).forEach(function (k) { headers[k] = o.headers[k]; });

    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, o.timeoutMs || DEFAULT_TIMEOUT_MS);

    var res;
    try {
      res = await fetch(url(path, o.query), {
        method: method,
        headers: headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      clearTimeout(timer);
      window.FFLog.error(method + " " + path + " — tarmoq xatosi:", e);
      throw new ApiError(0, "NETWORK", String((e && e.message) || e));
    }
    clearTimeout(timer);

    var text = "";
    try { text = await res.text(); } catch (e) { text = ""; }
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }

    if (res.status === 401 && o.auth !== false) {
      await window.FFStore.clearToken();
      if (handlers.onUnauthorized) {
        try { handlers.onUnauthorized(); } catch (e) { /* UI xatosi oqimni to'xtatmasin */ }
      }
    }

    if (!res.ok) {
      var msg = (data && (data.error || data.message)) || ("HTTP " + res.status);
      throw new ApiError(res.status, (data && data.code) || "", msg);
    }
    return data;
  }

  window.FFApi = {
    ApiError: ApiError,
    humanize: humanize,
    url: url,
    get: function (p, o) { return request("GET", p, o); },
    post: function (p, body, o) {
      var opt = o || {};
      opt.body = body === undefined ? {} : body;
      return request("POST", p, opt);
    },
    patch: function (p, body, o) {
      var opt = o || {};
      opt.body = body === undefined ? {} : body;
      return request("PATCH", p, opt);
    },
    onUnauthorized: function (fn) { handlers.onUnauthorized = fn; },
  };
})();
