/**
 * AssetFlow — foydalanuvchi / tarif / admin (API)
 */
const AssetFlowAccount = (() => {
  const DEFAULT_API = "http://localhost:4000";
  const DEFAULT_ADMIN = "http://localhost:3001/";

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

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
    });

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
      throw err;
    }
    return data;
  }

  function isLoggedIn() {
    return !!token();
  }

  async function login(email, password) {
    const data = await request("/api/plugin/login", {
      method: "POST",
      body: { email, password },
    });
    saveToken(data.token);
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
    heartbeat,
    recordDownload,
    recordImport,
    getCachedUser,
    getAdminUrl,
    openAdminPanel,
    authHeaders,
    saveToken,
  };
})();

if (typeof window !== "undefined") window.AssetFlowAccount = AssetFlowAccount;
