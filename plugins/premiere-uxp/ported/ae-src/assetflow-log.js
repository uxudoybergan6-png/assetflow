/**
 * AssetFlow — markaziy log (Premiere Plugin + server)
 * Admin Dashboard bilan bir xil API
 */
const AssetFlowLog = (() => {
  const STORAGE_KEY = "af_system_logs";
  const MAX_LOCAL = 200;
  const SOURCES = {
    admin: "Admin Console",
    contributor: "Contributor Studio",
    ae_plugin: "Premiere Plugin (Browse)",
    pr_plugin: "Premiere Plugin (Browse)",
  };

  let source = "ae_plugin";
  let apiBase =
    (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) ||
    (typeof ASSETFLOW_ENV !== "undefined"
      ? ASSETFLOW_ENV.defaultApi()
      : "https://api.getframeflow.app");
  let syncEnabled = true;

  function readPrefsApi() {
    try {
      if (typeof AssetFlow !== "undefined" && AssetFlow.loadPrefs) {
        const c = AssetFlow.loadPrefs().client || {};
        if (c.apiBaseUrl) return c.apiBaseUrl.replace(/\/$/, "");
      }
    } catch {
      /* */
    }
    return apiBase;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function readLocal() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch {
      /* */
    }
    return [];
  }

  function writeLocal(entries) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
      }
    } catch {
      /* */
    }
  }

  function emit(entry) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("assetflow:log", { detail: entry }));
    }
  }

  /**
   * #98 (PL-f) — server logi JIMGINA o'lik edi.
   *
   * `/api/logs` `requireAuth` ostida, biz esa `Authorization` header'ini
   * yubormasdik → har POST 401 qaytarardi va `catch(() => {})` uni yutardi.
   * Natijada admin panelidagi "Premiere Plugin (Browse)" manbasi HECH QACHON
   * to'lmasdi, hech kim buni sezmasdi.
   *
   * Tuzatish: (1) token header'i qo'shildi, (2) login qilinmagan/tarmoq yo'q
   * paytdagi yozuvlar navbatda saqlanadi va keyingi log yozuvida yuboriladi,
   * (3) 401 da flood qilmaymiz — o'sha token o'zgarmaguncha to'xtaymiz.
   */
  const MAX_QUEUE = 50;
  let queue = [];
  let flushing = false;
  let authBlockedToken = null; // 401 bergan token — almashguncha urinmaymiz

  function currentToken() {
    try {
      if (typeof AssetFlowAccount !== "undefined" && AssetFlowAccount.token)
        return AssetFlowAccount.token() || "";
    } catch {
      /* */
    }
    return "";
  }

  async function pushServer(entry, tok) {
    const base = readPrefsApi();
    const appId = source === "pr_plugin" ? "pr" : "ae";
    const res = await fetch(`${base}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}`, "X-FF-App": appId },
      body: JSON.stringify(entry),
    });
    if (res.status === 401 || res.status === 403) {
      const err = new Error("log push unauthorized");
      err.authFail = true;
      throw err;
    }
    if (!res.ok) throw new Error("log push failed");
  }

  async function flush() {
    if (flushing || !syncEnabled || !queue.length) return;
    const tok = currentToken();
    // Login qilinmagan yoki shu token allaqachon rad etilgan — navbat saqlanadi
    if (!tok || tok === authBlockedToken) return;
    flushing = true;
    try {
      while (queue.length) {
        try {
          await pushServer(queue[0], tok);
          queue.shift();
        } catch (e) {
          if (e && e.authFail) authBlockedToken = tok;
          break; // tarmoq/auth — keyingi yozuvda qayta urinamiz
        }
      }
    } finally {
      flushing = false;
    }
  }

  function append(entry) {
    const rows = readLocal();
    rows.unshift(entry);
    writeLocal(rows);
    emit(entry);
    if (syncEnabled) {
      queue.push(entry);
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
      flush();
    }
    return entry;
  }

  function log(level, message, meta = {}) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: nowIso(),
      level,
      source,
      sourceLabel: SOURCES[source] || source,
      message: String(message),
      action: meta.action || "",
      detail: meta.detail || "",
      meta: meta.data || null,
      hostApp: source === "pr_plugin" ? "pr" : "ae",
    };
    return append(entry);
  }

  function init(opts = {}) {
    source = opts.source || "ae_plugin";
    if (opts.apiBaseUrl) apiBase = opts.apiBaseUrl;
    if (opts.syncEnabled === false) syncEnabled = false;
    log("info", (source === "pr_plugin" ? "Premiere" : "Premiere") + " Browse panel loaded", {
      action: "init",
      detail: typeof IS_CEP !== "undefined" && IS_CEP ? "CEP" : "browser",
    });
    return AssetFlowLog;
  }

  return {
    init,
    /** #98 (PL-f): login'dan keyin kutayotgan yozuvlarni darhol yuborish */
    flush: () => {
      authBlockedToken = null;
      return flush();
    },
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    sources: SOURCES,
  };
})();

if (typeof window !== "undefined") window.AssetFlowLog = AssetFlowLog;
