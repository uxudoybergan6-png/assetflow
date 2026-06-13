/**
 * AssetFlow — foydalanuvchi / tarif / admin (API)
 */
const AssetFlowAccount = (() => {
  const env = typeof ASSETFLOW_ENV !== "undefined" ? ASSETFLOW_ENV : null;
  const DEFAULT_API = env ? env.defaultApi() : "https://assetflow-rqbq.onrender.com";
  const DEFAULT_ADMIN = env ? env.defaultAdmin() : "https://assetflow-studio-one.vercel.app/admin/";

  let cachedUser = null;
  let adminUrl = DEFAULT_ADMIN;

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
  function handleAuthFailure(status, hadToken) {
    if ((status === 401 || status === 403) && hadToken) {
      clearToken();
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        try {
          window.dispatchEvent(new CustomEvent("assetflow:session-expired"));
        } catch (e) {
          /* CustomEvent qo'llab-quvvatlanmasa — e'tiborsiz */
        }
      }
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
          const te = new Error("Server javob bermadi (vaqt tugadi)");
          te.timeout = true;
          throw te;
        }
        throw e;
      })
      .finally(() => clearTimeout(timer));
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
      // Token yuborilgan bo'lsa va 401/403 — sessiyani tozalab signal beramiz
      handleAuthFailure(res.status, !!t);
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
    const data = await request("/api/plugin/login", {
      method: "POST",
      body: { email, password },
    });
    persistClient({
      apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
      token: data.token,
    });
    cachedUser = data.user;
    if (data.adminUrl) adminUrl = data.adminUrl;
    return data;
  }

  function logout() {
    clearToken();
  }

  async function fetchMe() {
    if (!token()) return null;
    try {
      const data = await request("/api/plugin/me");
      cachedUser = data.user;
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

  /** URL'ni tashqi brauzerda ochadi (CEP yoki oddiy) */
  function openExternal(url) {
    if (!url) return;
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
