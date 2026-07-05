/**
 * AssetFlow Studio — API auth (JWT)
 */
const AssetFlowAuth = (() => {
  const KEY = "af_session";

  function studioBase() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.base) {
      return window.ASSETFLOW_STUDIO.base;
    }
    const m = window.location.pathname.match(/^(.*\/studio)\//);
    return m ? `${m[1]}/` : "/studio/";
  }

  function loginUrl() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.loginUrl) {
      return window.ASSETFLOW_STUDIO.loginUrl;
    }
    return `${studioBase()}login.html`;
  }

  function dashboardUrl(role) {
    if (role === "admin" && window.ASSETFLOW_STUDIO?.adminUrl) {
      return window.ASSETFLOW_STUDIO.adminUrl;
    }
    if (window.ASSETFLOW_STUDIO?.contributorUrl) {
      return window.ASSETFLOW_STUDIO.contributorUrl;
    }
    return role === "admin"
      ? `${studioBase()}admin/`
      : `${studioBase()}contributor/`;
  }

  function mapApiRole(apiRole) {
    const r = String(apiRole || "").toUpperCase();
    if (r === "ADMIN") return "admin";
    if (r === "CONTRIBUTOR") return "contributor";
    return "user";
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(KEY);
  }

  function sessionFromUser(data) {
    const role = mapApiRole(data.user?.role);
    return {
      role,
      email: data.user.email,
      name: data.user.name || data.user.email,
      userId: data.user.id,
      apiToken: data.token,
      blocked: !!data.user.contributorBlocked,
      blockReason: data.user.contributorBlocked
        ? "Blocked by admin"
        : "",
      at: Date.now(),
    };
  }

  async function login(email, password) {
    if (typeof StudioApi === "undefined") {
      return { ok: false, error: "API connection unavailable" };
    }
    try {
      const data = await StudioApi.login((email || "").trim(), password);
      const session = sessionFromUser(data);
      setSession(session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message || "Sign in failed" };
    }
  }

  async function loginWithGoogle(credential) {
    if (typeof StudioApi === "undefined") {
      return { ok: false, error: "API connection unavailable" };
    }
    try {
      const data = await StudioApi.googleLogin(credential);
      const session = sessionFromUser(data);
      setSession(session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message || "Sign in with Google failed" };
    }
  }

  async function register(payload) {
    if (typeof StudioApi === "undefined") {
      return { ok: false, error: "API connection unavailable" };
    }
    try {
      const data = await StudioApi.register(payload);
      const session = sessionFromUser(data);
      setSession(session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message || "Registration failed" };
    }
  }

  function logout(redirect = true) {
    clearSession();
    localStorage.removeItem("af_remember_email");
    localStorage.removeItem("af_remember_session");
    if (redirect) location.href = loginUrl();
  }

  function requireAuth(allowedRoles) {
    const s = getSession();
    if (!s) {
      location.href = loginUrl();
      return null;
    }
    if (!s.apiToken) {
      clearSession();
      location.href = loginUrl();
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(s.role)) {
      location.href = dashboardUrl(s.role === "admin" ? "admin" : "contributor");
      return null;
    }
    return s;
  }

  function renderBlockedBanner() {
    const s = getSession();
    if (!s?.blocked) return "";
    return `<div class="blocked-banner">
      <div class="blocked-banner-ico">${typeof ic === "function" ? ic("ban") : "!"}</div>
      <div class="col grow" style="gap:4px">
        <b style="color:var(--tx-0)">Your account is blocked</b>
        <span class="small">${s.blockReason || "New uploads and submissions to moderation are disabled. Please contact admin."}</span>
      </div>
    </div>`;
  }

  function mountBlockedBanner(hostId) {
    const el = document.getElementById(hostId);
    if (!el) return;
    el.innerHTML = renderBlockedBanner();
    document.body.classList.toggle("user-blocked", !!getSession()?.blocked);
  }

  function applyBlockedRestrictions() {
    document.body.classList.toggle("user-blocked", !!getSession()?.blocked);
  }

  return {
    getSession,
    setSession,
    clearSession,
    login,
    register,
    loginWithGoogle,
    logout,
    requireAuth,
    renderBlockedBanner,
    mountBlockedBanner,
    applyBlockedRestrictions,
    mapApiRole,
  };
})();

if (typeof window !== "undefined") window.AssetFlowAuth = AssetFlowAuth;
