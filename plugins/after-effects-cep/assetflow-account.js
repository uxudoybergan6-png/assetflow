/**
 * AssetFlow — foydalanuvchi / tarif / admin (API)
 */
const AssetFlowAccount = (() => {
  const env = typeof ASSETFLOW_ENV !== "undefined" ? ASSETFLOW_ENV : null;
  const DEFAULT_API = env ? env.defaultApi() : "https://api.getframeflow.app";
  const DEFAULT_ADMIN = env ? env.defaultAdmin() : "https://admin.getframeflow.app/";

  let cachedUser = null;
  let adminUrl = DEFAULT_ADMIN;
  let activeToken = "";
  let activeTokenMeta = null;
  let sessionBootstrapPromise = null;
  let refreshInProgress = null;
  // Haqiqiy sessiya shu ishga tushishda kamida bir marta tasdiqlanganmi?
  // (fetchMe/login/device-confirm muvaffaqiyati). Faqat shundan KEYIN 401/403
  // "sessiya tugadi" deb ko'rsatiladi. Bootda qolib ketgan eskirgan token 401'i
  // mehmon uchun soxta ogohlantirish chiqarmasin — jimgina tozalanadi.
  let sessionEstablished = false;

  const CREDENTIAL_ACCOUNT_SHARED = "session-token";
  const CREDENTIAL_LEGACY_ACCOUNT_AE = "session-token-ae";
  const CREDENTIAL_LEGACY_ACCOUNT_PR = "session-token-pr";
  const CREDENTIAL_LEGACY_SECRET_KEYS = [CREDENTIAL_LEGACY_ACCOUNT_AE, CREDENTIAL_LEGACY_ACCOUNT_PR, "ae", "pr"];
  const CREDENTIAL_META_KEY = "pluginToken";
  const CREDENTIAL_META_BY_HOST_KEY = "pluginTokenByHost";
  const CREDENTIAL_SOURCE_RANK = {
    "secret-shared": 1,
    "secret-ae": 2,
    "secret-pr": 2,
    "secret-ae-legacy": 3,
    "secret-pr-legacy": 3,
    "prefs-token": 6,
    "prefs-ae": 7,
    "prefs-pr": 8,
  };

  function apiBase() {
    if (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) {
      return window.ASSETFLOW_STUDIO.apiUrl.replace(/\/$/, "");
    }
    const c =
      typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs().client || {} : {};
    return (c.apiBaseUrl || DEFAULT_API).replace(/\/$/, "");
  }

  function hostApp() {
    try {
      const fromPanel = String((typeof window !== "undefined" && window.AF_TEMPLATE_APP) || "").toLowerCase();
      if (fromPanel === "pr" || fromPanel === "ae") return fromPanel;
      const host = typeof CSInterface !== "undefined" ? new CSInterface().getHostEnvironment() : null;
      const id = String((host && (host.appName || host.appId)) || "AEFT").toUpperCase();
      return id === "PPRO" || id.indexOf("PREMIERE") >= 0 ? "pr" : "ae";
    } catch {
      return "ae";
    }
  }

  function tokenHost() {
    try {
      return hostApp();
    } catch {
      return "ae";
    }
  }

  function readStoredTokens(rawClient) {
    const raw = rawClient && typeof rawClient === "object" && !Array.isArray(rawClient) ? rawClient : {};
    const tokens = raw && typeof raw.tokens === "object" && !Array.isArray(raw.tokens) ? raw.tokens : {};
    const out = {};
    for (const [k, v] of Object.entries(tokens)) {
      const value = String(v || "").trim();
      if (value) out[k] = value;
    }
    return out;
  }

  function parseTimestamp(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    const at = Date.parse(value);
    return Number.isFinite(at) ? new Date(at) : null;
  }

  function normalizePluginTokenMeta(raw) {
    if (!raw || typeof raw !== "object") return null;
    const issuedAt = parseTimestamp(raw.issuedAt);
    const expiresAt = parseTimestamp(raw.expiresAt);
    const refreshAt = parseTimestamp(raw.refreshAt);
    if (!issuedAt && !expiresAt && !refreshAt) return null;
    return {
      issuedAt: issuedAt ? issuedAt.toISOString() : "",
      expiresAt: expiresAt ? expiresAt.toISOString() : "",
      refreshAt: refreshAt ? refreshAt.toISOString() : "",
    };
  }

  function parseTokenMetaFromClient(client = null) {
    const prefs = client || (typeof AssetFlowStore === "undefined" ? {} : AssetFlowStore.loadPrefs());
    const tokenState = (prefs && (prefs.client || prefs)) || {};
    return normalizePluginTokenMeta(tokenState[CREDENTIAL_META_KEY]);
  }

  function isRetryableNetworkFailure(error) {
    if (!error) return false;
    if (error.timeout || error.name === "AbortError") return true;
    const status = error.status || 0;
    return status === 429 || status >= 500;
  }

  function isAuthoritativeCode(code, status) {
    const clearCode = code === "TOKEN_EXPIRED" ||
      code === "TOKEN_INVALID" ||
      code === "TOKEN_REVOKED" ||
      code === "NO_TOKEN" ||
      code === "ACCOUNT_BLOCKED" ||
      code === "ACCOUNT_INACTIVE";
    return (status === 401 && clearCode) || (status === 403 && (code === "ACCOUNT_BLOCKED" || code === "ACCOUNT_INACTIVE"));
  }

  function getClientPrefs() {
    if (typeof AssetFlowStore === "undefined") return { client: {} };
    return AssetFlowStore.loadPrefs();
  }

  function readStoredMetaByHost() {
    const prefs = getClientPrefs();
    const client = (prefs && prefs.client) || {};
    const raw = client[CREDENTIAL_META_BY_HOST_KEY];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  }

  /**
   * #138 (PL-h) — sessiya tokeni endi OS sirlar omborida (macOS Keychain /
   * Windows DPAPI / 0600 fayl), `prefs.json` da OCHIQ matnda EMAS.
   * `AssetFlowSecret` mavjud bo'lmasa yoki backend ishlamasa — eski xulq
   * (prefs.json) saqlanadi, aks holda foydalanuvchi umuman kira olmay qolardi.
   */
  function secretStore() {
    try {
      if (typeof AssetFlowSecret !== "undefined" && AssetFlowSecret.available())
        return AssetFlowSecret;
    } catch {
      /* */
    }
    return null;
  }

  function tokenMetaFromResponse(data) {
    return normalizePluginTokenMeta(data && data.pluginToken ? data.pluginToken : null);
  }

  function candidateSources() {
    const store = secretStore();
    const prefs = getClientPrefs();
    const client = prefs && prefs.client ? prefs.client : {};
    const candidateMetaByHost = readStoredMetaByHost();
    const items = [];
    const seen = new Set();
    const add = (token, source, preferredHost) => {
      const value = String(token || "").trim();
      if (!value) return;
      if (seen.has(value)) return;
      seen.add(value);
      const meta = normalizePluginTokenMeta(
        candidateMetaByHost[preferredHost] || candidateMetaByHost[source]
      ) || parseTokenMetaFromClient(client);
      items.push({ token: value, source, preferredHost, meta });
    };

    if (store) {
      add(store.get(CREDENTIAL_ACCOUNT_SHARED), "secret-shared", "shared");
      add(store.get(CREDENTIAL_LEGACY_ACCOUNT_AE), "secret-ae", "ae");
      add(store.get(CREDENTIAL_LEGACY_ACCOUNT_PR), "secret-pr", "pr");
      add(store.get("ae"), "secret-ae-legacy", "ae");
      add(store.get("pr"), "secret-pr-legacy", "pr");
    }
    add((client && client.token) || "", "prefs-token");
    const tokens = readStoredTokens(client);
    for (const [host, token] of Object.entries(tokens)) {
      add(token, `prefs-${host}`, host);
    }
    return items;
  }

  function shouldClearLegacyTokens(candidates) {
    return candidates.some((item) => item.source !== CREDENTIAL_ACCOUNT_SHARED);
  }

  function pickPreferredCandidate(items) {
    if (!items.length) return null;
    return items.reduce((best, current) =>
      tokenCandidateIsBetter(current, best) ? current : best
    );
  }

  function tokenCandidateIsBetter(a, b) {
    if (!a) return false;
    if (!b) return true;
    const rankA = CREDENTIAL_SOURCE_RANK[a.source] || 900;
    const rankB = CREDENTIAL_SOURCE_RANK[b.source] || 900;
    const aIssued = a.meta?.issuedAt ? Date.parse(a.meta.issuedAt) : -1;
    const bIssued = b.meta?.issuedAt ? Date.parse(b.meta.issuedAt) : -1;
    const aExpires = a.meta?.expiresAt ? Date.parse(a.meta.expiresAt) : -1;
    const bExpires = b.meta?.expiresAt ? Date.parse(b.meta.expiresAt) : -1;
    if (rankA !== rankB) return rankA < rankB;
    if (aIssued !== bIssued) return aIssued > bIssued;
    if (aExpires !== bExpires) return aExpires > bExpires;
    return (a.token || "") < (b.token || "");
  }

  function clearLegacyTokenArtifacts() {
    const store = secretStore();
    if (store) {
      CREDENTIAL_LEGACY_SECRET_KEYS.forEach((acc) => {
        store.clear(acc);
      });
    }
    const prefs = getClientPrefs();
    const client = prefs.client || {};
    delete client.tokens;
    delete client[CREDENTIAL_META_BY_HOST_KEY];
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
  }

  function setActiveToken(tokenValue, meta = null) {
    activeToken = String(tokenValue || "").trim();
    activeTokenMeta = normalizePluginTokenMeta(meta);
  }

  function clearLocalTokenState(reason) {
    const store = secretStore();
    if (store) {
      store.clear(CREDENTIAL_ACCOUNT_SHARED);
      CREDENTIAL_LEGACY_SECRET_KEYS.forEach((acc) => store.clear(acc));
    }
    const prefs = getClientPrefs();
    const client = prefs.client || {};
    delete client.token;
    delete client.tokens;
    delete client[CREDENTIAL_META_KEY];
    delete client[CREDENTIAL_META_BY_HOST_KEY];
    prefs.client = client;
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
    activeToken = "";
    activeTokenMeta = null;
    cachedUser = null;
  }

  function writeTokenToPrefs(tokenValue, meta, keepLegacyTokens = true) {
    const prefs = getClientPrefs();
    const client = prefs.client || {};
    client.apiBaseUrl = apiBase();
    if (tokenValue) {
      client.token = tokenValue;
      if (meta) client[CREDENTIAL_META_KEY] = meta;
      else delete client[CREDENTIAL_META_KEY];
      if (!keepLegacyTokens) {
        delete client.tokens;
        delete client[CREDENTIAL_META_BY_HOST_KEY];
      }
    } else {
      delete client.token;
      delete client.tokens;
      delete client[CREDENTIAL_META_KEY];
      delete client[CREDENTIAL_META_BY_HOST_KEY];
    }
    if (client.tokens && !Object.keys(client.tokens).length) {
      delete client.tokens;
    }
    prefs.client = client;
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
  }

  function persistSharedToken(nextToken, nextMeta, clearLegacy) {
    const tokenValue = String(nextToken || "").trim();
    const tokenMeta = normalizePluginTokenMeta(nextMeta);
    if (!tokenValue) {
      return false;
    }
    const store = secretStore();
    let sharedPersisted = true;
    if (store) {
      if (tokenValue) {
        sharedPersisted = !!store.set(tokenValue, CREDENTIAL_ACCOUNT_SHARED);
        if (sharedPersisted) {
          try {
            const persisted = String(store.get(CREDENTIAL_ACCOUNT_SHARED) || "").trim();
            sharedPersisted = persisted === tokenValue;
          } catch {
            sharedPersisted = false;
          }
        }
      }
    }

    const keepLegacyTokens = !store || !clearLegacy || !sharedPersisted;
    writeTokenToPrefs(tokenValue, tokenMeta, keepLegacyTokens);

    if (tokenMeta) activeTokenMeta = tokenMeta;
    if (sharedPersisted || !store) setActiveToken(tokenValue, tokenMeta);

    if (clearLegacy && sharedPersisted && store) {
      clearLegacyTokenArtifacts();
    }
    return sharedPersisted;
  }

  async function validateCandidates(items, preferred) {
    if (!items || !items.length) return { token: "", meta: null, keepExisting: false };
    const fallback = preferred || pickPreferredCandidate(items);
    let best = null;
    let sawNetworkFailure = false;
    let sawNonAuthoritativeFailure = false;
    for (const item of items) {
      try {
        const data = await requestWithToken("/api/plugin/validate", { method: "GET" }, item.token, {
          handleAuthFailure: false,
        });
        const nextMeta = tokenMetaFromResponse(data);
        const candidate = { token: item.token, meta: nextMeta || item.meta || null };
        if (tokenCandidateIsBetter(candidate, best)) best = candidate;
      } catch (e) {
        const status = e.status || 0;
        const code = e.code || (e.data && e.data.code);
        if (isRetryableNetworkFailure(e)) {
          sawNetworkFailure = true;
          continue;
        }
        if (!isAuthoritativeCode(code, status)) {
          sawNonAuthoritativeFailure = true;
        }
      }
    }
    if (best) return { token: best.token, meta: best.meta, keepExisting: true, validated: true };
    if ((sawNetworkFailure || sawNonAuthoritativeFailure) && fallback) {
      return {
        token: fallback.token,
        meta: fallback.meta || parseTokenMetaFromClient(),
        keepExisting: true,
        validated: false,
      };
    }
    return { token: "", meta: null, keepExisting: false, validated: false };
  }

  async function ensureSessionLoaded() {
    if (sessionBootstrapPromise) return sessionBootstrapPromise;
    sessionBootstrapPromise = (async () => {
      const candidates = candidateSources();
      if (candidates.length === 0) {
        clearLocalTokenState("empty");
        return;
      }
      const candidateByScore = pickPreferredCandidate(candidates);
      const shouldValidate = candidates.some((item) => item.source !== CREDENTIAL_ACCOUNT_SHARED) || !candidateByScore?.meta;
      const selected = shouldValidate
        ? await validateCandidates(candidates, candidateByScore)
        : {
            token: candidateByScore ? candidateByScore.token : "",
            meta: candidateByScore ? (candidateByScore.meta || parseTokenMetaFromClient()) : null,
            keepExisting: true,
            validated: false,
          };
      const tokenValue = String(selected.token || "").trim();
      if (!tokenValue) {
        clearLocalTokenState("invalid");
        return;
      }
      const shouldClearLegacy = shouldClearLegacyTokens(candidates);
      const persistResult = persistSharedToken(
        tokenValue,
        selected.meta,
        shouldClearLegacy && selected.validated
      );
      if (!persistResult) {
        setActiveToken(tokenValue, selected.meta || parseTokenMetaFromClient());
        return;
      }
    })().finally(() => {
      sessionBootstrapPromise = null;
    });
    return sessionBootstrapPromise;
  }

  function token() {
    if (!activeToken && !sessionBootstrapPromise) {
      const candidates = candidateSources();
      const selected = pickPreferredCandidate(candidates);
      if (selected && selected.token) {
        persistSharedToken(selected.token, selected.meta || parseTokenMetaFromClient(), false);
      }
    }
    if (activeToken) return activeToken;
    const host = tokenHost();
    const store = secretStore();
    const direct = store ? store.get(CREDENTIAL_ACCOUNT_SHARED) : "";
    if (direct) {
      setActiveToken(direct);
      return activeToken;
    }
    const prefs = getClientPrefs();
    const legacy = (prefs && prefs.client && (prefs.client.token || "")).trim();
    setActiveToken(legacy);
    if (!activeToken) return "";
    if (store && legacy) {
      const wrote = store.set(activeToken, CREDENTIAL_ACCOUNT_SHARED);
      if (wrote) {
        const prefsToSave = getClientPrefs();
        const client = prefsToSave.client || {};
        client.token = activeToken;
        delete client.tokens;
        delete client[CREDENTIAL_META_BY_HOST_KEY];
        if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefsToSave);
      }
    }
    return activeToken;
  }

  function clearToken() {
    clearLocalTokenState("explicit");
  }

  function saveToken(t, meta = null) {
    const value = String(t || "").trim();
    const normalizedMeta = normalizePluginTokenMeta(meta);
    persistSharedToken(value, normalizedMeta, true);
    // #98 (PL-f): login'gacha yig'ilgan loglar endi yuborilishi mumkin
    try {
      if (typeof AssetFlowLog !== "undefined" && AssetFlowLog.flush) AssetFlowLog.flush();
    } catch {
      /* log hech qachon login'ni buzmasin */
    }
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
    // P8 #4 — 401 ham endi kod bilan: FAQAT sessiya o'lgan kodlar (yoki kodsiz eski 401) tozalaydi.
    // TWO_FA_INVALID / PENDING_EXPIRED kabi 401'lar ish o'rtasida logout QILMAYDI.
    const clearCode =
      code === "TOKEN_EXPIRED" ||
      code === "TOKEN_INVALID" ||
      code === "TOKEN_REVOKED" ||
      code === "NO_TOKEN" ||
      code === "ACCOUNT_BLOCKED" ||
      code === "ACCOUNT_INACTIVE";
    const isAuthInvalidation =
      (status === 401 && clearCode) ||
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
    headers["X-FF-App"] = hostApp();
    const bodyIsFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body && !bodyIsFormData) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetchWithTimeout(
      `${publicApiBase()}${path}`,
      {
        ...options,
        headers,
        body: bodyIsFormData
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

  function tokenNeedsRefresh(meta = null) {
    const now = Date.now();
    if (!meta) return false;
    const refreshAt = Date.parse(meta.refreshAt || "") || 0;
    const expiresAt = Date.parse(meta.expiresAt || "") || 0;
    if (!refreshAt) return false;
    return refreshAt <= now && now < expiresAt;
  }

  async function requestWithToken(path, options = {}, tokenValue, runtime = {}) {
    const headers = { ...(options.headers || {}) };
    headers["X-FF-App"] = hostApp();
    const bodyIsFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    if (options.body && !bodyIsFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (tokenValue) headers.Authorization = `Bearer ${tokenValue}`;

    const timeoutMs = bodyIsFormData ? 180000 : 30000;
    const res = await fetchWithTimeout(`${apiBase()}${path}`, {
      ...options,
      headers,
      body: bodyIsFormData
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
      err.code = data?.code;
      if (runtime.handleAuthFailure !== false) {
        handleAuthFailure(res.status, !!tokenValue, err.code);
      }
      throw err;
    }
    return data;
  }

  async function ensureFreshToken() {
    if (refreshInProgress) return refreshInProgress;
    if (!activeToken || !tokenNeedsRefresh(activeTokenMeta)) return false;

    const currentToken = activeToken;
    refreshInProgress = (async () => {
      try {
        const data = await requestWithToken(
          "/api/plugin/token",
          { method: "POST" },
          currentToken,
          { handleAuthFailure: false }
        );
        const nextToken = String(data?.token || "").trim();
        if (!nextToken) return false;
        const nextMeta = tokenMetaFromResponse(data);
        const sharedPersisted = persistSharedToken(nextToken, nextMeta, true);
        if (!sharedPersisted) return false;
        return true;
      } catch (e) {
        const status = e.status || 0;
        const code = e.code || (e.data && e.data.code);
        if (isRetryableNetworkFailure(e)) {
          return false;
        }
        if (!handleAuthFailure(status, true, code)) {
          return false;
        }
        return false;
      }
    })().finally(() => {
      refreshInProgress = null;
    });

    return refreshInProgress;
  }

  async function request(path, options = {}) {
    await ensureSessionLoaded();
    await ensureFreshToken();

    const headers = { ...(options.headers || {}) };
    const bodyIsFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const t = token();
    const timeoutMs = bodyIsFormData ? 180000 : 30000;

    const data = await requestWithToken(
      path,
      {
        ...options,
        body:
          bodyIsFormData
            ? options.body
            : options.body
              ? JSON.stringify(options.body)
              : undefined,
      },
      t,
      { handleAuthFailure: true }
    );

    return data;
  }

  function isLoggedIn() {
    return !!token();
  }

  function persistClient(partial) {
    const prefs =
      typeof AssetFlowStore !== "undefined" ? AssetFlowStore.loadPrefs() : { client: {} };
    const nextToken = partial.token !== undefined ? String(partial.token || "") : token();
    const client = prefs.client || {};
    client.apiBaseUrl = partial.apiBaseUrl || apiBase();
    if (nextToken) {
      client.token = nextToken;
      if (partial.meta) client[CREDENTIAL_META_KEY] = partial.meta;
      delete client.tokens;
      delete client[CREDENTIAL_META_BY_HOST_KEY];
    } else {
      delete client.token;
      delete client.tokens;
      delete client[CREDENTIAL_META_KEY];
      delete client[CREDENTIAL_META_BY_HOST_KEY];
    }
    prefs.client = client;
    if (typeof AssetFlowStore !== "undefined") AssetFlowStore.savePrefs(prefs);
  }

  async function login(email, password) {
    // Pre-auth: token'siz + global 401 ushlagichdan ajratilgan (publicRequest).
    const data = await publicRequest("/api/plugin/login", {
      method: "POST",
      body: { email, password },
    });
    saveToken(data.token, tokenMetaFromResponse(data));
    cachedUser = data.user;
    sessionEstablished = true;
    if (data.adminUrl) adminUrl = data.adminUrl;
    persistClient({
      apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
    });
    return data;
  }

  async function logout() {
    if (token()) {
      try {
        await request("/api/plugin/logout", { method: "POST" });
      } catch {
        /* local fallback */
      }
    }
    clearToken();
    stopDevicePolling();
  }

  // ── Google bilan kirish (device-code oqimi) ───────────────────────────────
  // CEP paneli Google'ning GIS'ini to'g'ridan-to'g'ri ocha olmaydi (embedded
  // webview bloklanadi) — shu sabab bir martalik kod olib, tasdiqlashni tizim
  // brauzerida (device.html) o'tkazamiz, so'ng natijani pollik qilib olamiz.
  let devicePollTimer = null;
  let activeDeviceRequest = null;

  async function startDeviceLogin() {
    // Public endpoint — token YUBORMAYMIZ (eskirgan token 401 → soxta "sessiya
    // tugadi" bo'lardi). publicRequest global ushlagichni ham chetlab o'tadi.
    const data = await publicRequest("/api/plugin/device/start", { method: "POST" });
    activeDeviceRequest = {
      requestId: data.requestId || data.code,
      pollToken: data.pollToken,
    };
    return data;
  }

  function finishDevicePolling() {
    if (devicePollTimer) {
      clearInterval(devicePollTimer);
      devicePollTimer = null;
    }
    activeDeviceRequest = null;
  }

  function stopDevicePolling(cancelRequest = true) {
    if (devicePollTimer) {
      clearInterval(devicePollTimer);
      devicePollTimer = null;
    }
    const request = activeDeviceRequest;
    activeDeviceRequest = null;
    if (cancelRequest && request?.requestId && request?.pollToken) {
      publicRequest("/api/plugin/device/cancel", {
        method: "POST",
        body: request,
      }).catch(() => {});
    }
  }

  /** Alohida pollToken bilan holatni so'raydi; browser URL bu sirni bilmaydi. */
  function pollDeviceLogin(request, { onConfirmed, onExpired, onDenied, onError, intervalMs = 2500 } = {}) {
    stopDevicePolling(false);
    const requestId = request?.requestId || request?.code || request;
    const pollToken = request?.pollToken;
    activeDeviceRequest = { requestId, pollToken };
    devicePollTimer = setInterval(async () => {
      try {
        const data = await publicRequest("/api/plugin/device/poll", {
          method: "POST",
          body: { requestId, pollToken },
        });
        if (data.status === "confirmed") {
          finishDevicePolling();
          persistClient({
            apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
          });
          saveToken(data.token, tokenMetaFromResponse(data));
          cachedUser = data.user;
          sessionEstablished = true;
          if (data.adminUrl) adminUrl = data.adminUrl;
          if (onConfirmed) onConfirmed(data);
        } else if (data.status === "expired") {
          finishDevicePolling();
          if (onExpired) onExpired();
        } else if (data.status === "denied") {
          finishDevicePolling();
          if (onDenied) onDenied();
        }
        // "pending" — kutishda davom etamiz
      } catch (e) {
        if (onError) onError(e);
      }
    }, intervalMs);
  }

  async function fetchMe() {
    const hadToken = !!token();
    if (!hadToken) return null;
    try {
      const data = await request("/api/plugin/me");
      cachedUser = data.user;
      sessionEstablished = true;
      if (data.apiBaseUrl || data.adminUrl) {
        persistClient({
          apiBaseUrl: (data.apiBaseUrl || apiBase()).replace(/\/$/, ""),
        });
        saveToken(token(), tokenMetaFromResponse(data));
      }
      if (data.adminUrl) adminUrl = data.adminUrl;
      return cachedUser;
    } catch (e) {
      if (handleAuthFailure(e.status, hadToken, e.code || e.data?.code)) {
        return null;
      }
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
      await request("/api/plugin/heartbeat", { method: "POST", body: { ...meta, app: hostApp(), host: hostApp() } });
    } catch {
      /* ignore */
    }
  }

  async function recordDownload(templateId) {
    if (!token()) return null;
    const data = await request("/api/plugin/usage/download", {
      method: "POST",
      body: { templateId, app: hostApp() },
    });
    cachedUser = data.user;
    return cachedUser;
  }

  async function recordImport(templateId) {
    if (!token()) return null;
    const data = await request("/api/plugin/usage/import", {
      method: "POST",
      body: { templateId, app: hostApp() },
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
    const h = { "X-FF-App": hostApp() };
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  }

  return {
    apiBase,
    hostApp,
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
