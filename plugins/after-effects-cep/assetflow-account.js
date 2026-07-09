/**
 * AssetFlow — foydalanuvchi / tarif / admin (API)
 */
const AssetFlowAccount = (() => {
  const env = typeof ASSETFLOW_ENV !== "undefined" ? ASSETFLOW_ENV : null;
  const DEFAULT_API = env ? env.defaultApi() : "https://api.getframeflow.app";
  const DEFAULT_ADMIN = env ? env.defaultAdmin() : "https://admin.getframeflow.app/";

  let cachedUser = null;
  let adminUrl = DEFAULT_ADMIN;
  // Haqiqiy sessiya shu ishga tushishda kamida bir marta tasdiqlanganmi?
  // (fetchMe/login/device-confirm muvaffaqiyati). Faqat shundan KEYIN 401/403
  // "sessiya tugadi" deb ko'rsatiladi. Bootda qolib ketgan eskirgan token 401'i
  // mehmon uchun soxta ogohlantirish chiqarmasin — jimgina tozalanadi.
  let sessionEstablished = false;

  function apiBase() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) {
      return window.ASSETFLOW_STUDIO.apiUrl.replace(/\/$/, "");
    }
    const c =
      typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs().client || {} : {};
    return (c.apiBaseUrl || DEFAULT_API).replace(/\/$/, "");
  }

  function token() {
    const c =
      typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs().client || {} : {};
    return (c.token || "").trim();
  }

  function saveToken(t) {
    const prefs = typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs() : { client: {} };
    prefs.client = { ...(prefs.client || {}), apiBaseUrl: apiBase(), token: t };
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
  }

  function clearToken() {
    const prefs = typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs() : { client: {} };
    prefs.client = { ...(prefs.client || {}), apiBaseUrl: apiBase(), token: "" };
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
    cachedUser = null;
  }

  /**
   * Markaziy 401/403 ushlagich: token eskirgan bo'lsa tozalaydi va UI'ga
   * "sessiya tugadi" signalini yuboradi (bir marta). Faqat token YUBORILGAN
   * so'rovlarda ishlaydi — login (token'siz) 401'i hisobga olinmaydi.
   * catalog.js ham shu funksiyani chaqiradi (yagona xulq).
   */
  function handleAuthFailure(status, hadToken, code) {
    // P20: FAQAT haqiqiy auth-bekor qilinish sessiyani tugatadi — 401 (eskirgan/yaroqsiz
    // token) YOKI 403 ACCOUNT_BLOCKED/ACCOUNT_INACTIVE (admin bloklagan/o'chirilgan). 403 KOD'lari
    // OVERLOADED: LIMIT_REACHED / PRO_REQUIRED / unpublished / umumiy forbidden ham 403, lekin
    // ular AUTH emas — ularda token'ni TOZALAMAYMIZ (aks holda limitga yetgan user noto'g'ri
    // "sessiya tugadi" bilan chiqib ketardi — P20 bug). Kod berilmasa (eski chaqiruv) 403 xavfsiz
    // tomonga — sign-out QILINMAYDI (faqat 401 chiqaradi).
    const isAuthInvalidation =
      status === 401 ||
      (status === 403 && (code === "ACCOUNT_BLOCKED" || code === "ACCOUNT_INACTIVE"));
    if (isAuthInvalidation && hadToken) {
      clearToken();
      // Faqat HAQIQIY (bir marta tasdiqlangan) sessiya tugaganda UI signal beramiz.
      // Boot paytidagi eskirgan token 401'i — mehmon holati, ogohlantirish yo'q.
      if (
        sessionEstablished &&
        typeof window !== "undefined" &&
        typeof window.dispatchEvent === "function"
      ) {
        try {
          window.dispatchEvent(new CustomEvent("assetflow:session-expired"));
        } catch (e) {
          /* CustomEvent qo'llab-quvvatlanmasa — e'tiborsiz */
        }
      }
      sessionEstablished = false;
      return true;
    }
    return false;
  }

  /** 30s timeout bilan fetch — so'rov cheksiz osilib qolmasin (Render cold start) */
  function fetchWithTimeout(url, options, ms) {
    options = options || {};
    const timeout = ms || 30000;
    if (typeof AbortController === "undefined") {
      return fetch(url, options);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { ...options, signal: ctrl.signal })
      .catch((e) => {
        if (e && (e.name === "AbortError" || e.code === 20)) {
          const te = new Error("Server did not respond (timeout)");
          te.timeout = true;
          throw te;
        }
        throw e;
      })
      .finally(() => clearTimeout(timer));
  }

  /**
   * Login/qurilma-kodi kabi PRE-AUTH (public) so'rovlar uchun bazani hisoblaydi.
   * Foydalanuvchi hali kirmagan bo'lishi mumkin — shu sabab prefs'dagi eskirgan
   * localhost/onrender baza production login'ni to'sib qo'ymasligi kerak.
   */
  function publicApiBase() {
    let base = apiBase();
    if (env && typeof env.sanitizeApi === "function") {
      try {
        base = env.sanitizeApi(base) || base;
      } catch (_) {
        /* ignore */
      }
    }
    // CEP/file:// panelida saqlangan localhost baza productionга yetib bormaydi —
    // haqiqiy local dev (window.location.hostname localhost) bo'lmasa, prod'ga o'tamiz.
    try {
      const isLocalHost =
        typeof window !== "undefined" &&
        window.location &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");
      if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base) && !isLocalHost) {
        base = DEFAULT_API;
      }
    } catch (_) {
      /* ignore */
    }
    return String(base || DEFAULT_API).replace(/\/$/, "");
  }

  /**
   * PRE-AUTH so'rov: login va qurilma-kodi (device) endpointlari uchun.
   * MUHIM: (1) Authorization header YUBORMAYDI — bu endpointlar public;
   * eskirgan token bilan 401 kelib, endigina boshlangan login'ni "sessiya
   * tugadi" deb uzib qo'ymasligi kerak. (2) handleAuthFailure'ni CHAQIRMAYDI —
   * bu yerda tugaydigan sessiya yo'q. Global 401 ushlagichdan butunlay ajratilgan.
   */
  async function publicRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetchWithTimeout(
      `${publicApiBase()}${path}`,
      {
        ...options,
        headers,
        body:
          options.body instanceof FormData
            ? options.body
            : options.body
              ? JSON.stringify(options.body)
              : undefined,
      },
      30000
    );

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      // Ataylab handleAuthFailure CHAQIRILMAYDI — login/device 401'i sessiya emas.
      throw err;
    }
    return data;
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    // Fayl yuklash (FormData) uzoq davom etishi mumkin — timeout'ni uzaytiramiz
    const timeoutMs = options.body instanceof FormData ? 180000 : 30000;
    const res = await fetchWithTimeout(`${apiBase()}${path}`, {
      ...options,
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
    }, timeoutMs);

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.code = data?.code; // P20: caller'lar biznes-kodga qarab tarmoqlansin (LIMIT_REACHED va h.k.)
      // P20: FAQAT auth-bekor (401 / 403 ACCOUNT_BLOCKED|INACTIVE) sessiyani tozalaydi — kod uzatiladi.
      handleAuthFailure(res.status, !!t, data?.code);
      throw err;
    }
    return data;
  }

  function isLoggedIn() {
    return !!token();
  }

  function persistClient(partial) {
    const prefs =
      typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs() : { client: {} };
    prefs.client = {
      ...(prefs.client || {}),
      apiBaseUrl: partial.apiBaseUrl || apiBase(),
      token: partial.token !== undefined ? partial.token : token(),
    };
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
  }

  async function login(email, password) {
    // Pre-auth: token'siz + global 401 ushlagichdan ajratilgan (publicRequest).
    const data = await publicRequest("/api/plugin/login", {
      method: "POST",
      body: { email, password },
    });
    persistClient({
      apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
      token: data.token,
    });
    cachedUser = data.user;
    sessionEstablished = true;
    if (data.adminUrl) adminUrl = data.adminUrl;
    return data;
  }

  function logout() {
    clearToken();
    stopDevicePolling();
  }

  // ── Google bilan kirish (device-code oqimi) ───────────────────────────────
  // CEP paneli Google'ning GIS'ini to'g'ridan-to'g'ri ocha olmaydi (embedded
  // webview bloklanadi) — shu sabab bir martalik kod olib, tasdiqlashni tizim
  // brauzerida (device.html) o'tkazamiz, so'ng natijani pollik qilib olamiz.
  let devicePollTimer = null;

  async function startDeviceLogin() {
    // Public endpoint — token YUBORMAYMIZ (eskirgan token 401 → soxta "sessiya
    // tugadi" bo'lardi). publicRequest global ushlagichni ham chetlab o'tadi.
    return publicRequest("/api/plugin/device/start", { method: "POST" });
  }

  function stopDevicePolling() {
    if (devicePollTimer) {
      clearInterval(devicePollTimer);
      devicePollTimer = null;
    }
  }

  /** `code` bo'yicha holatni har `intervalMs`da so'raydi, terminal holatda to'xtaydi. */
  function pollDeviceLogin(code, { onConfirmed, onExpired, onDenied, onError, intervalMs = 3000 } = {}) {
    stopDevicePolling();
    devicePollTimer = setInterval(async () => {
      try {
        const data = await publicRequest(`/api/plugin/device/poll?code=${encodeURIComponent(code)}`);
        if (data.status === "confirmed") {
          stopDevicePolling();
          persistClient({
            apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
            token: data.token,
          });
          cachedUser = data.user;
          sessionEstablished = true;
          if (data.adminUrl) adminUrl = data.adminUrl;
          if (onConfirmed) onConfirmed(data);
        } else if (data.status === "expired") {
          stopDevicePolling();
          if (onExpired) onExpired();
        } else if (data.status === "denied") {
          stopDevicePolling();
          if (onDenied) onDenied();
        }
        // "pending" — kutishda davom etamiz
      } catch (e) {
        if (onError) onError(e);
      }
    }, intervalMs);
  }

  async function fetchMe() {
    if (!token()) return null;
    try {
      const data = await request("/api/plugin/me");
      cachedUser = data.user;
      sessionEstablished = true;
      if (data.apiBaseUrl || data.adminUrl) {
        persistClient({
          apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
          token: token(),
        });
      }
      if (data.adminUrl) adminUrl = data.adminUrl;
      return cachedUser;
    } catch (e) {
      if (e.status === 401 || e.status === 403) clearToken();
      throw e;
    }
  }

  async function setPlan(plan) {
    const data = await request("/api/plugin/plan", {
      method: "PATCH",
      body: { plan },
    });
    cachedUser = data.user;
    return cachedUser;
  }

  /** Stripe checkout sahifasi URL'ini oladi (plugin token bilan) */
  async function requestCheckout(billing = "monthly") {
    const data = await request("/api/auth/checkout", {
      method: "POST",
      body: { plan: billing === "yearly" ? "yearly" : "monthly" },
    });
    return data?.url || "";
  }

  /** Stripe billing portal URL'i (obunani boshqarish/bekor qilish) */
  async function requestBillingPortal() {
    const data = await request("/api/auth/portal", { method: "POST" });
    return data?.url || "";
  }

  /**
   * URL'ni tashqi (tizim) brauzerida ochadi va HAQIQIY muvaffaqiyatni QAYTARADI (true/false).
   * Zanjir tartibi:
   *   (a) window.cep.util.openURLInDefaultBrowser — AE CEP'ning kanonik API'si (err===0 = muvaffaqiyat)
   *   (b) Node child_process (manifest'da --enable-nodejs) — OS shell: open / start / xdg-open
   *   (c) CSInterface shim (invokeSync('openURLInDefaultBrowser')) — oxirgi CEP chorasi
   *   (d) window.open — brauzer/dev fallback (CEP webview'da bloklanishi mumkin)
   * Faqat biror metod xatosiz ishga tushsagina true qaytaradi.
   */
  function openExternal(url) {
    if (!url) return false;

    // (a) Kanonik CEP API — window.cep.util.openURLInDefaultBrowser. Natija: {err: <code>}.
    try {
      if (
        typeof window !== "undefined" &&
        window.cep &&
        window.cep.util &&
        typeof window.cep.util.openURLInDefaultBrowser === "function"
      ) {
        const res = window.cep.util.openURLInDefaultBrowser(url);
        const errCode = res && typeof res.err !== "undefined" ? res.err : 0;
        if (errCode === 0) {
          console.log("[openExternal] opened via cep.util.openURLInDefaultBrowser");
          return true;
        }
        console.log("[openExternal] cep.util.openURLInDefaultBrowser returned err=", errCode);
      }
    } catch (e) {
      console.log("[openExternal] cep.util threw:", e && e.message);
    }

    // (b) Node fallback — child_process (execSync => haqiqiy muvaffaqiyat aniqlash).
    try {
      if (typeof require === "function") {
        const cp = require("child_process");
        const plat = (typeof process !== "undefined" && process.platform) || "";
        // URL'ni qo'shtirnoq ichida uzatamiz; ichki qo'shtirnoqni zararsizlantiramiz.
        const safe = String(url).replace(/"/g, "%22");
        let cmd;
        if (plat === "darwin") cmd = 'open "' + safe + '"';
        else if (plat === "win32") cmd = 'start "" "' + safe + '"';
        else cmd = 'xdg-open "' + safe + '"';
        cp.execSync(cmd, { timeout: 5000 });
        console.log("[openExternal] opened via child_process (" + plat + ")");
        return true;
      }
    } catch (e2) {
      console.log("[openExternal] child_process threw:", e2 && e2.message);
    }

    // (c) CSInterface shim (invokeSync varianti) — CEP mavjud bo'lsa.
    try {
      if (typeof window !== "undefined" && window.__adobe_cep__ && window.CSInterface) {
        new CSInterface().openURLInDefaultBrowser(url);
        console.log("[openExternal] opened via CSInterface shim");
        return true;
      }
    } catch (e3) {
      console.log("[openExternal] CSInterface shim threw:", e3 && e3.message);
    }

    // (d) Oxirgi chora — brauzer/dev muhiti (CEP webview'da popup bloklanishi mumkin).
    try {
      if (typeof window !== "undefined" && window.open) {
        const w = window.open(url, "_blank");
        if (w) {
          console.log("[openExternal] opened via window.open");
          return true;
        }
      }
    } catch (e4) {
      console.log("[openExternal] window.open threw:", e4 && e4.message);
    }

    console.log("[openExternal] all methods failed for url");
    return false;
  }

  async function heartbeat(meta = {}) {
    if (!token()) return;
    try {
      await request("/api/plugin/heartbeat", { method: "POST", body: meta });
    } catch {
      /* ignore */
    }
  }

  async function recordDownload(templateId) {
    if (!token()) return null;
    const data = await request("/api/plugin/usage/download", {
      method: "POST",
      body: { templateId },
    });
    cachedUser = data.user;
    return cachedUser;
  }

  async function recordImport(templateId) {
    if (!token()) return null;
    const data = await request("/api/plugin/usage/import", {
      method: "POST",
      body: { templateId },
    });
    cachedUser = data.user;
    return cachedUser;
  }

  function getCachedUser() {
    return cachedUser;
  }

  function getAdminUrl() {
    return adminUrl || DEFAULT_ADMIN;
  }

  function openAdminPanel() {
    const url = getAdminUrl();
    if (typeof window.__adobe_cep__ !== "undefined" && window.CSInterface) {
      try {
        new CSInterface().openURLInDefaultBrowser(url);
        return;
      } catch {
        /* fallback */
      }
    }
    window.open(url, "_blank");
  }

  function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  return {
    apiBase,
    token,
    isLoggedIn,
    login,
    logout,
    startDeviceLogin,
    pollDeviceLogin,
    stopDevicePolling,
    fetchMe,
    setPlan,
    requestCheckout,
    requestBillingPortal,
    openExternal,
    heartbeat,
    recordDownload,
    recordImport,
    getCachedUser,
    getAdminUrl,
    openAdminPanel,
    authHeaders,
    saveToken,
    handleAuthFailure,
  };
})();

if (typeof window !== "undefined") window.AssetFlowAccount = AssetFlowAccount;
