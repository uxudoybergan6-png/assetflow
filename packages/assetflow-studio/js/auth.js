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

  /**
   * #136 (C14) — SESSIYA IKKI QAVATDA. Ilgari sessiya faqat `sessionStorage`da edi:
   * havolani yangi tabda ochish (yoki brauzer qayta tiklagan tab) har safar login
   * so'rardi. Endi `localStorage`da ham nusxa saqlanadi va yangi tab uni bir marta
   * o'ziga ko'chirib oladi.
   *
   * Xavfsizlik: nusxa MUDDATLI (`at` + 12 soat) — XSS bilan o'g'irlangan token
   * cheksiz yashamasin; server tokeni ham o'z muddatiga ega va muddati tugagach
   * global 401 ishlovi ikkala qavatni ham tozalaydi (`clearSession`).
   */
  const PERSIST_MAX_AGE_MS = 12 * 3600 * 1000;

  function readStore(store) {
    try {
      const raw = store.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getSession() {
    const s = readStore(sessionStorage);
    if (s) return s;
    const p = readStore(localStorage);
    if (!p) return null;
    if (!p.at || Date.now() - p.at > PERSIST_MAX_AGE_MS) {
      clearSession();
      return null;
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* private rejim — shu tabda sessiya baribir ishlaydi */
    }
    return p;
  }

  function setSession(session) {
    sessionStorage.setItem(KEY, JSON.stringify(session));
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* kvota/private rejim — faqat shu tabda qoladi */
    }
  }

  function clearSession() {
    sessionStorage.removeItem(KEY);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  // Bir tabda chiqilsa boshqa tablar ham sessiyani tashlasin (localStorage `storage`
  // hodisasi FAQAT boshqa tablarda otiladi).
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === KEY && e.newValue === null) {
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
      }
    });
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
      // ADMIN 2FA: parol to'g'ri, endi kod bosqichi — sessiya HALI ochilmadi.
      if (data && data.twoFactorRequired) {
        return { ok: true, twoFactorRequired: true, pendingToken: data.pendingToken };
      }
      const session = sessionFromUser(data);
      if (data && data.twoFactorSetupRequired) {
        // ADMIN_REQUIRE_2FA yoqilgan, admin hali yozilmagan — konsol setup gate ko'rsatadi.
        try { sessionStorage.setItem("af_2fa_setup_required", "1"); } catch {}
      }
      setSession(session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message || "Sign in failed" };
    }
  }

  /** 2FA kod bosqichi (TOTP yoki backup kod) — muvaffaqiyatda to'liq sessiya ochiladi. */
  async function verify2fa(pendingToken, code) {
    if (typeof StudioApi === "undefined") {
      return { ok: false, error: "API connection unavailable" };
    }
    try {
      const data = await StudioApi.verify2fa(pendingToken, code);
      const session = sessionFromUser(data);
      setSession(session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message || "Code verification failed" };
    }
  }

  async function loginWithGoogle(credential) {
    if (typeof StudioApi === "undefined") {
      return { ok: false, error: "API connection unavailable" };
    }
    try {
      const data = await StudioApi.googleLogin(credential);
      if (data && data.twoFactorRequired) {
        return { ok: true, twoFactorRequired: true, pendingToken: data.pendingToken };
      }
      const session = sessionFromUser(data);
      if (data && data.twoFactorSetupRequired) {
        try { sessionStorage.setItem("af_2fa_setup_required", "1"); } catch {}
      }
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
    // #76 (W3) — server tomonda ham bekor qilamiz (tokenVersion++), aks holda nusxa
    // ko'chirilgan JWT chiqishdan keyin ham 30 kun ishlayverardi. Kutmaymiz.
    try {
      if (typeof StudioApi !== "undefined" && StudioApi.logoutServer) StudioApi.logoutServer().catch(() => {});
    } catch (e) { /* chiqish hech qachon to'silmasin */ }
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
      // Noto'g'ri rol: admin/contributor O'Z paneliga; USER (panelga ega emas)
      // sessiyasi tozalanib O'SHA portalning loginiga — redirect loop bo'lmaydi
      // (login sahifalari requireAuth ishlatmaydi).
      if (s.role === "admin" || s.role === "contributor") {
        location.href = dashboardUrl(s.role);
      } else {
        clearSession();
        location.href = loginUrl();
      }
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
    verify2fa,
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
