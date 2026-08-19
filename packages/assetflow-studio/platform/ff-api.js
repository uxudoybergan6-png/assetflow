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
  // Every authenticated request captures this value. A logout/account switch
  // invalidates the capture so a late response cannot mutate the next user.
  var authSessionEpoch = 0;

  function getToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function getUser() {
    try { return JSON.parse(window.localStorage.getItem(USER_KEY) || "null"); } catch (e) { return null; }
  }
  function setSession(token, user) {
    var nextToken = token || "";
    // /me/profile refresh can update user metadata under the same token; that
    // is still the same authenticated session and must not cancel parallel reads.
    if (getToken() !== nextToken) authSessionEpoch += 1;
    try {
      window.localStorage.setItem(TOKEN_KEY, nextToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user || null));
    } catch (e) {}
  }
  function clearSession() {
    if (getToken() || getUser()) authSessionEpoch += 1;
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch (e) {}
  }
  function sessionEpoch() { return authSessionEpoch; }
  function sessionChangedError() {
    var err = new Error("Account changed while the request was running");
    err.code = "SESSION_CHANGED";
    return err;
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
  // Deploy/config xatolari keyingi urinishda o'z-o'zidan tuzalmaydi. Ularni 4 marta yuborish
  // foydalanuvchini ~12 soniya kuttiradi va serverni bekorga band qiladi.
  function isPermanentResponseCode(code) {
    return (
      code === "MODERATION_NOT_CONFIGURED" ||
      code === "AI_NOT_CONFIGURED" ||
      code === "S3_NOT_CONFIGURED" ||
      code === "GEN_KILL_SWITCH" ||
      code === "SPEND_CEILING_REACHED" ||
      code === "GOOGLE_NOT_CONFIGURED" ||
      code === "BILLING_NOT_CONFIGURED" ||
      code === "BILLING_STORE_MISSING"
    );
  }
  // Cold-start uchun sabrli backoff (ms) — jami ~12s + har urinishda timeout.
  function backoffMs(a) { return [1500, 3500, 7000, 10000][a] || 10000; }

  function shouldClearSessionForResponse(status, code) {
    if (status !== 401 && status !== 403) return false;
    return (
      code === "TOKEN_EXPIRED" ||
      code === "TOKEN_INVALID" ||
      code === "TOKEN_REVOKED" ||
      code === "NO_TOKEN" ||
      code === "ACCOUNT_BLOCKED" ||
      code === "ACCOUNT_INACTIVE"
    );
  }

  /**
   * `/gen/health` va `/gen/models` javoblarini bitta UI haqiqatiga birlashtiradi.
   * Health aniq "false" desa model ro'yxati eski/keshdan kelgan bo'lsa ham Ready bo'lmaydi.
   * Health vaqtincha olinmasa, yangi models javobidagi readiness bitlari xavfsiz fallback.
   */
  function assessAiReadiness(health, modelResponses) {
    var rows = Array.isArray(modelResponses) ? modelResponses.filter(Boolean) : [];
    var unavailable = [];
    rows.forEach(function (r) {
      if (Array.isArray(r.unavailableModels)) unavailable = unavailable.concat(r.unavailableModels);
    });
    var modelCount = rows.reduce(function (n, r) {
      return n + (Array.isArray(r.models) ? r.models.length : 0);
    }, 0);
    var modelModerationReady = rows.some(function (r) { return r.moderationReady === true; });
    var modelModerationConfigured = rows.some(function (r) { return r.moderationConfigured === true; });
    var modelGenerationReady = rows.some(function (r) {
      return r.generationReady === true || (r.configured === true && Array.isArray(r.models) && r.models.length > 0);
    });
    var hasHealth = !!(health && typeof health === "object");
    var moderationReady = hasHealth ? health.moderationReady === true : modelModerationReady;
    var moderationConfigured = hasHealth ? health.moderationConfigured === true : modelModerationConfigured;
    var storageReady = hasHealth
      ? (health.storageReady !== false && health.s3 !== false)
      : !rows.some(function (r) { return r.storageReady === false; });
    var generationReady = hasHealth ? health.generationReady === true : modelGenerationReady;

    if (!moderationReady) {
      return moderationConfigured
        ? { ready: false, retryable: true, code: "MODERATION_UNAVAILABLE", message: "AI safety verification is temporarily unavailable — retrying shortly", modelCount: modelCount }
        : { ready: false, retryable: false, code: "MODERATION_NOT_CONFIGURED", message: "AI safety verification is unavailable — generation is disabled", modelCount: modelCount };
    }
    if (!storageReady) {
      return { ready: false, retryable: false, code: "S3_NOT_CONFIGURED", message: "AI result storage is unavailable — generation is disabled", modelCount: modelCount };
    }
    if (!generationReady) {
      var transient = unavailable.find(function (item) {
        return item && (item.retryable === true || item.unavailableCode === "PROVIDER_UNAVAILABLE" || item.unavailableCode === "MODERATION_UNAVAILABLE");
      });
      if (transient) {
        return { ready: false, retryable: true, code: transient.unavailableCode || "PROVIDER_UNAVAILABLE", message: transient.unavailableReason || "AI providers are temporarily unavailable — retrying shortly", modelCount: modelCount };
      }
      return { ready: false, retryable: false, code: "AI_NOT_CONFIGURED", message: "AI providers are unavailable — generation is disabled", modelCount: modelCount };
    }
    if (!modelCount) {
      return { ready: false, retryable: true, code: "MODELS_UNAVAILABLE", message: "No AI models are available — retry the service check", modelCount: 0 };
    }
    return { ready: true, retryable: false, code: "", message: "", modelCount: modelCount };
  }

  // Charge-only absolute balance response'lari teskari kelsa eski balandroq qiymat qaytmasin.
  function reconcileChargedBalance(current, next, loaded) {
    if (typeof next !== "number" || !isFinite(next)) return current;
    if (!loaded || typeof current !== "number" || !isFinite(current)) return next;
    return Math.min(current, next);
  }

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
    var requestEpoch = authSessionEpoch;
    var authScoped = opts.auth !== false;
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
      if (authScoped && (requestEpoch !== authSessionEpoch || getToken() !== t)) throw sessionChangedError();
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
      var retryData = null;
      if (idempotent && isRetryableStatus(res.status) && a < maxAttempts - 1) {
        try { retryData = await res.clone().json(); } catch (e) { retryData = null; }
      }
      if (
        idempotent &&
        isRetryableStatus(res.status) &&
        !isPermanentResponseCode(retryData && retryData.code) &&
        a < maxAttempts - 1
      ) {
        var ra = parseInt((res.headers && res.headers.get && res.headers.get("Retry-After")) || "", 10);
        var wait = (res.status === 429 && ra > 0) ? Math.min(ra * 1000, 15000) : backoffMs(a);
        await new Promise(function (r) { setTimeout(r, wait); });
        continue;
      }
      break;
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
  if (authScoped && (requestEpoch !== authSessionEpoch || getToken() !== t)) throw sessionChangedError();
  // P8 #4 + P29 (29b) — sessiyani FAQAT server token O'LGANINI AYTGANDA tozalaymiz.
  // requireAuth (yagona sessiya-o'lim manbai) HAR DOIM aniq `code` yuboradi
  // (TOKEN_EXPIRED/INVALID/REVOKED/NO_TOKEN), lekin WEB JWT sessiyasida ACCOUNT_BLOCKED/
  // ACCOUNT_INACTIVE uchun 403 ham tozalash kerak.
  var code = data && data.code;
  if (t && opts.auth !== false && shouldClearSessionForResponse(res.status, code)) {
    clearSession();
    try { window.dispatchEvent(new CustomEvent("ff-auth-expired")); } catch (e) {}
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
    sessionEpoch: sessionEpoch,
    req: req,
    uuid: uuid,
    assessAiReadiness: assessAiReadiness,
    reconcileChargedBalance: reconcileChargedBalance,

    // Auth
    // Faqat haqiqatan takror-xavfsiz auth POST'lar retry qilinadi. Register/forgot/resend
    // javobi yo'qolganidan keyin avtomatik takrorlansa hisob yaratilgan bo'lsa 409 ko'rinishi
    // yoki bir nechta email yuborilishi mumkin; ular foydalanuvchi nazoratidagi bitta urinish.
    login: function (email, password) { return req("/api/auth/login", { method: "POST", body: { email: email, password: password }, auth: false, idempotent: true, timeout: 30000 }); },
    register: function (email, password, name, turnstileToken) { return req("/api/auth/register", { method: "POST", body: { email: email, password: password, name: name || undefined, turnstileToken: turnstileToken || undefined }, auth: false, timeout: 30000 }); },
    forgot: function (email) { return req("/api/auth/forgot-password", { method: "POST", body: { email: email }, auth: false, timeout: 30000 }); },
    google: function (credential) { return req("/api/auth/google", { method: "POST", body: { credential: credential }, auth: false, idempotent: true, timeout: 30000 }); },
    resendVerification: function (email) { return req("/api/auth/resend-verification", { method: "POST", body: { email: email }, auth: false, timeout: 30000 }); },
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

    // Plugin sahifa — nashr etilgan reliz haqiqati (PluginRelease). Auth talab qilinmaydi —
    // Plugin sahifasi login'siz ham ko'rinadi. { latest: {version,releaseNotes,checksum}|null, downloadUrl }
    // opts.manual=true → `manual=1`: server legacy .zxp havolasini FAQAT shu aniq
    // opt-in bilan qaytaradi (brauzerdagi qo'lda yuklab olish). Opt-in'siz downloadUrl
    // null bo'ladi — eski o'z-o'zini-yozuvchi plagin klientlari uchun kill switch.
    pluginVersion: function (current, opts) {
      var p = [];
      if (current) p.push("current=" + encodeURIComponent(current));
      if (opts && opts.manual) p.push("manual=1");
      if (opts && opts.app) p.push("app=" + encodeURIComponent(opts.app));
      if (opts && opts.platform) p.push("platform=" + encodeURIComponent(opts.platform));
      var qs = p.length ? "?" + p.join("&") : "";
      return req("/api/plugin/version" + qs, { auth: false, idempotent: true });
    },

    // Katalog / plugin profil
    // P1 #15: server-side katalog — filtr/qidiruv/saralash/sahifalash. opts obyekti:
    // { cursor, take, app, templateType, cat, pro, orient, res, q, sort }. Eski
    // string argument (faqat cursor) ham qo'llab-quvvatlanadi (orqaga moslik).
    catalog: function (opts) {
      if (typeof opts === "string" || opts == null) opts = { cursor: opts || undefined };
      var p = new URLSearchParams();
      ["cursor", "take", "app", "templateType", "kind", "stockType", "cat", "pro", "orient", "res", "q", "sort"].forEach(function (k) {
        var v = opts[k];
        if (v != null && v !== "" && v !== "All") p.set(k, v);
      });
      var qs = p.toString();
      return req("/api/plugin/catalog" + (qs ? "?" + qs : ""), { auth: false });
    },
    // P1 #16 — bitta shablonning to'liq detali (enriched sahnalar + metaJson).
    catalogItem: function (id) {
      return req("/api/plugin/catalog/" + encodeURIComponent(id), { auth: false });
    },
    // P2 (step 31) — ochiq per-asset endpoint (deep-link/cold-load). id = to'liq cuid yoki
    //   oxirgi 8-belgi shortId. Faqat published — moderatsiya navbatini oshkor qilmaydi.
    publicAsset: function (id) {
      return req("/api/public/asset/" + encodeURIComponent(id), { auth: false });
    },
    pluginMe: function () { return req("/api/plugin/me"); },
    // §F (P33) — shablon sevimlilari SERVER-sinxron (qurilmalar aro; plagin ham shu endpoint).
    favorites: function () { return req("/api/plugin/favorites"); },
    favoriteToggle: function (templateId, on) { return req("/api/plugin/favorites", { method: "POST", body: { templateId: templateId, on: !!on } }); },
    // Quota yozadigan GET: bitta mantiqiy download uchun stable Idempotency-Key. req() ichki
    // retry'lari ham ayni headerni ishlatadi; caller NETWORK'dan keyingi qo'lda retryga kalitni saqlashi mumkin.
    packLink: function (templateId, requestId) {
      var key = requestId || uuid();
      return req("/api/plugin/assets/" + encodeURIComponent(templateId) + "/pack?json=1", { idempotencyKey: key });
    },

    // Billing (Lemon Squeezy — MoR). body: { plan: "pro"|"studio" } yoki { credits: 500 }
    checkout: function (body) { return req("/api/billing/checkout", { method: "POST", body: body }); },
    billingPortal: function () { return req("/api/billing/portal", { method: "POST" }); },

    // FAZA 1c — GDPR: o'z ma'lumotini eksport / hisobni o'chirish
    // #76 (W3) — server tomonda sessiyani bekor qilish (tokenVersion++). Klient
    // sessiyani tozalashdan OLDIN chaqiradi; xatosi chiqishni to'sib qo'ymasligi kerak.
    logoutServer: function () { return req("/api/auth/logout", { method: "POST" }); },
    exportData: function () { return req("/api/users/export", { method: "POST" }); },
    deleteAccount: function () { return req("/api/account", { method: "DELETE", body: { confirm: "DELETE" } }); },

    // Studio Gen
    credits: function () { return req("/api/studio/credits"); },
    genHealth: function () { return req("/api/studio/gen/health"); },
    models: function (mode) { return req("/api/studio/gen/models?mode=" + encodeURIComponent(mode)); },
    // QA-FIX #12 — sessiya modeli: yaratishda title (birinchi prompt) ham ketadi
    session: function (mode, title) { return req("/api/studio/gen/sessions", { method: "POST", body: { mode: mode, title: title || undefined } }); },
    sessions: function () { return req("/api/studio/gen/sessions"); },
    sessionRename: function (id, title) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id), { method: "PATCH", body: { title: title } }); },
    sessionGens: function (id) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id) + "/generations?perPage=50&status=done"); },
    sessionDelete: function (id) { return req("/api/studio/gen/sessions/" + encodeURIComponent(id), { method: "DELETE" }); }, // P6
    // P17 — quote SOF hisob+imzo (server DB yozmaydi / consume qilmaydi) → cold-start'da
    // xavfsiz qayta uriladi (idempotent:true). "Can't reach the server" ko'pincha shu edi.
    quote: function (modelId, mode, params) { return req("/api/studio/gen/cost-quote", { method: "POST", body: { modelId: modelId, mode: mode, params: params || {} }, idempotent: true }); },
    // R4_08 — YOQILGAN Topaz enhance/upscale operatsiyalari (composer'dan filtrlangan; kartada "Use ▾").
    ops: function () { return req("/api/studio/gen/ops"); },
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
    // P3 (step 34) — "Add to Explore": generatsiyani ommaviy AI Stock asetiga yuborish.
    genExplore: function (id, body) {
      return req("/api/studio/gen/" + encodeURIComponent(id) + "/explore", { method: "POST", body: body || {} });
    },
    genExploreSubmissions: function () { return req("/api/studio/gen/explore/submissions"); },
    genDelete: function (id) { return req("/api/studio/gen/" + encodeURIComponent(id), { method: "DELETE" }); },
    // D6 — natijani qadash/yechish. `pinned` aniq berilgani uchun so'rov idempotent (takror xavfsiz).
    genPin: function (id, pinned) {
      return req("/api/studio/gen/" + encodeURIComponent(id) + "/pin", { method: "PATCH", body: { pinned: !!pinned }, idempotent: true });
    },
    history: function (limit) { return req("/api/studio/gen/history?limit=" + (limit || 30)); },
    // P21 (29) — HAQIQIY kredit ledger (refunds ko'rinadi) + agregatlar. cursor=keyset, filter=all|spent|refunded|purchased
    creditLedger: function (cursor, filter) {
      var q = [];
      if (cursor) q.push("cursor=" + encodeURIComponent(cursor));
      if (filter && filter !== "all") q.push("filter=" + encodeURIComponent(filter));
      return req("/api/studio/credits/ledger" + (q.length ? "?" + q.join("&") : ""));
    },
    // P21.4 (29) — REAL yuklab olish/import tarixi (TemplateDownloadEvent)
    downloads: function (cursor) {
      return req("/api/studio/downloads" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""));
    },
    // P28 (29a) — enhance endi REFERENSlarni ko'radi (image/video/audio URL massivlari).
    // opts: { imageUrls, videoUrls, audioUrls, imageRoles, videoRoles, audioRoles, style }.
    // Orqaga moslik: opts berilmasa faqat matn + faithful uslub.
    enhance: function (prompt, mode, modelId, opts) {
      opts = opts || {};
      // P17 — har "click" uchun BITTA idempotency kaliti (gen() bilan bir xil): req() ichki qayta
      // urinishlari (cold-start, javob yo'qolgan) shu kalitni ishlatadi → server dedup, IKKINCHI
      // consume YO'Q. Har yangi enhance() chaqiruvi = yangi klik = yangi kalit.
      var key = opts.idempotencyKey || uuid();
      var body = { prompt: prompt, mode: mode || undefined, modelId: modelId || undefined, idempotencyKey: key };
      if (opts.imageUrls && opts.imageUrls.length) body.image_urls = opts.imageUrls;
      if (opts.imageRoles && opts.imageRoles.length) body.image_roles = opts.imageRoles;
      if (opts.videoUrls && opts.videoUrls.length) body.video_urls = opts.videoUrls;
      if (opts.videoRoles && opts.videoRoles.length) body.video_roles = opts.videoRoles;
      if (opts.audioUrls && opts.audioUrls.length) body.audio_urls = opts.audioUrls;
      if (opts.audioRoles && opts.audioRoles.length) body.audio_roles = opts.audioRoles;
      if (opts.style) body.enhance_style = opts.style;
      if (opts.settings) body.settings = opts.settings;
      return req("/api/studio/gen/prompt/enhance", { method: "POST", body: body, idempotencyKey: key });
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
