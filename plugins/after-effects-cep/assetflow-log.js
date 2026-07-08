/**
 * AssetFlow — markaziy log (AE Plugin + server)
 * Admin Dashboard bilan bir xil API
 */
const AssetFlowLog = (() => {
  const STORAGE_KEY = "af_system_logs";
  const MAX_LOCAL = 200;
  const SOURCES = {
    admin: "Admin Console",
    contributor: "Contributor Studio",
    ae_plugin: "AE Plugin (Browse)",
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

  async function pushServer(entry) {
    const base = readPrefsApi();
    const res = await fetch(`${base}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error("log push failed");
  }

  function append(entry) {
    const rows = readLocal();
    rows.unshift(entry);
    writeLocal(rows);
    emit(entry);
    if (syncEnabled) pushServer(entry).catch(() => {});
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
    };
    return append(entry);
  }

  function init(opts = {}) {
    source = opts.source || "ae_plugin";
    if (opts.apiBaseUrl) apiBase = opts.apiBaseUrl;
    if (opts.syncEnabled === false) syncEnabled = false;
    log("info", "AE Browse panel loaded", {
      action: "init",
      detail: typeof IS_CEP !== "undefined" && IS_CEP ? "CEP" : "browser",
    });
    return AssetFlowLog;
  }

  return {
    init,
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    sources: SOURCES,
  };
})();

if (typeof window !== "undefined") window.AssetFlowLog = AssetFlowLog;
