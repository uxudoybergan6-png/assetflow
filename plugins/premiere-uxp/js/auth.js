/*
 * FrameFlow UXP — autentifikatsiya (server tayyor, bu faqat klient; system prompt §6).
 *
 *  1) Email+parol   → POST /api/plugin/login
 *  2) Google        → POST /api/plugin/device/start → shell.openExternal → GET /device/poll
 *  3) 401           → api-client tokenni o'chiradi va login ekranga qaytaradi
 *  4) Logout        → tokenni secureStorage'dan o'chirish
 *
 * "Abandoned login" (Adobe review talabi): polling muddati tugasa oqim JIM
 * to'xtamaydi — "Qayta urinish" holati qaytariladi.
 */
(function () {
  "use strict";

  var POLL_INTERVAL_MS = 3000;

  var state = {
    user: null,
    /** joriy device-code oqimi (bekor qilish uchun) */
    device: null,
  };

  function applyLoginPayload(payload) {
    if (!payload) return null;
    if (payload.apiBaseUrl) window.FF_ENV.setApiBase(payload.apiBaseUrl);
    state.user = payload.user || null;
    return state.user;
  }

  /** Saqlangan token bilan sessiyani tiklash. Token yo'q/eskirgan bo'lsa null. */
  async function restore() {
    var token = await window.FFStore.getToken();
    if (!token) return null;
    try {
      var me = await window.FFApi.get("/api/plugin/me");
      return applyLoginPayload(me);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        await window.FFStore.clearToken();
        return null;
      }
      // Tarmoq xatosi — tokenni O'CHIRMAYMIZ (oflayn holat sessiyani buzmasin).
      window.FFLog.warn("restore:", e);
      throw e;
    }
  }

  async function loginWithPassword(email, password, totpCode) {
    var body = { email: String(email || "").trim(), password: String(password || "") };
    if (totpCode) body.totpCode = String(totpCode).trim();
    var res = await window.FFApi.post("/api/plugin/login", body, { auth: false });
    await window.FFStore.setToken(res.token);
    return applyLoginPayload(res);
  }

  /**
   * Google device-code oqimini boshlaydi.
   * @param {(evt:{type:string,code?:string,url?:string,user?:object,message?:string})=>void} onEvent
   * @returns {{cancel:Function}}
   */
  function startGoogleLogin(onEvent) {
    var cancelled = false;
    var handle = {
      cancel: function () {
        cancelled = true;
        state.device = null;
      },
    };
    state.device = handle;

    (async function run() {
      var started;
      try {
        started = await window.FFApi.post("/api/plugin/device/start", {}, { auth: false });
      } catch (e) {
        onEvent({ type: "error", message: window.FFApi.humanize(e) });
        return;
      }
      if (cancelled) return;

      var deadline = Date.now() + (Number(started.expiresIn) || 300) * 1000;
      onEvent({
        type: "code",
        code: started.code,
        url: started.verificationUrl,
        expiresAt: deadline,
      });

      var opened = await window.FFHost.openExternal(started.verificationUrl);
      if (!opened) {
        // Brauzer ochilmadi — jim qolmaymiz, foydalanuvchi havolani qo'lda ochadi.
        onEvent({ type: "browser_failed", url: started.verificationUrl });
      }

      while (!cancelled && Date.now() < deadline) {
        await new Promise(function (r) { setTimeout(r, POLL_INTERVAL_MS); });
        if (cancelled) return;
        var poll;
        try {
          poll = await window.FFApi.get("/api/plugin/device/poll", {
            auth: false,
            query: { code: started.code },
          });
        } catch (e) {
          // Vaqtinchalik tarmoq xatosi pollingni to'xtatmaydi.
          window.FFLog.warn("device/poll:", e);
          continue;
        }
        if (poll.status === "confirmed") {
          await window.FFStore.setToken(poll.token);
          onEvent({ type: "success", user: applyLoginPayload(poll) });
          return;
        }
        if (poll.status === "denied") {
          onEvent({ type: "denied", message: "Kirish rad etildi." });
          return;
        }
        if (poll.status === "expired") break;
      }
      if (!cancelled) onEvent({ type: "expired", message: "Kod muddati tugadi." });
    })();

    return handle;
  }

  async function logout() {
    if (state.device) state.device.cancel();
    state.user = null;
    await window.FFStore.clearToken();
  }

  /** Panel ochilganini serverga bildiradi (jim — xato UI'ni buzmaydi). */
  async function heartbeat() {
    try {
      await window.FFApi.post("/api/plugin/heartbeat", {
        deviceLabel: "Premiere Pro UXP " + window.FF_ENV.version,
        aeVersion: window.FFHost.hostVersion(),
      });
    } catch (e) {
      window.FFLog.warn("heartbeat:", e);
    }
  }

  window.FFAuth = {
    state: state,
    restore: restore,
    loginWithPassword: loginWithPassword,
    startGoogleLogin: startGoogleLogin,
    logout: logout,
    heartbeat: heartbeat,
    user: function () { return state.user; },
  };
})();
