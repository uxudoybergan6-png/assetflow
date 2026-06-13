/**
 * AssetFlow — markaziy log (Admin, Contributor, AE Plugin)
 * localStorage + ixtiyoriy lokal server (localhost:4000)
 */
const AssetFlowLog = (() => {
  const STORAGE_KEY = "af_system_logs";
  const MAX_LOCAL = 400;
  const SOURCES = {
    admin: "Admin Console",
    contributor: "Contributor Studio",
    ae_plugin: "AE Plugin (Browse)",
  };

  let source = "unknown";
  let apiBase =
    (typeof window !== "undefined" && window.ASSETFLOW_STUDIO?.apiUrl) ||
    "https://assetflow-rqbq.onrender.com";
  let syncEnabled = true;

  function nowIso() {
    return new Date().toISOString();
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLocal(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL)));
    } catch (e) {
      console.warn("AssetFlowLog storage full", e);
    }
  }

  function emit(entry) {
    window.dispatchEvent(new CustomEvent("assetflow:log", { detail: entry }));
  }

  function append(entry) {
    const rows = readLocal();
    rows.unshift(entry);
    writeLocal(rows);
    emit(entry);
    if (syncEnabled) pushServer(entry).catch(() => {});
    return entry;
  }

  /** Studio sessiya tokeni — /api/logs endi admin-only, shu sabab Authorization kerak */
  function authHeader() {
    try {
      const raw =
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem("af_session")) ||
        (typeof localStorage !== "undefined" && localStorage.getItem("af_session"));
      const s = raw ? JSON.parse(raw) : null;
      const tok = s && (s.apiToken || s.token);
      return tok ? { Authorization: "Bearer " + tok } : {};
    } catch {
      return {};
    }
  }

  async function pushServer(entry) {
    const auth = authHeader();
    if (!auth.Authorization) return; // token yo'q — server push'ni o'tkazib yubor
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error("log push failed");
  }

  async function pullServer() {
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/logs?limit=300`, {
        headers: authHeader(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  function mergeEntries(serverRows) {
    const map = new Map();
    [...serverRows, ...readLocal()].forEach((e) => {
      if (e && e.id) map.set(e.id, e);
    });
    return [...map.values()].sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  }

  async function getAll(opts = {}) {
    const limit = opts.limit || 200;
    let rows = readLocal();
    if (opts.includeServer !== false) {
      const remote = await pullServer();
      rows = mergeEntries(remote);
    }
    if (opts.source && opts.source !== "all") {
      rows = rows.filter((r) => r.source === opts.source);
    }
    if (opts.level && opts.level !== "all") {
      rows = rows.filter((r) => r.level === opts.level);
    }
    if (opts.q) {
      const q = opts.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.message || "").toLowerCase().includes(q) ||
          (r.detail || "").toLowerCase().includes(q) ||
          (r.action || "").toLowerCase().includes(q)
      );
    }
    return rows.slice(0, limit);
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
    source = opts.source || source;
    if (opts.apiBaseUrl) apiBase = opts.apiBaseUrl;
    if (opts.syncEnabled === false) syncEnabled = false;
    log("info", `${SOURCES[source] || source} ishga tushdi`, {
      action: "init",
      detail: typeof location !== "undefined" ? location.pathname : "",
    });
    return AssetFlowLog;
  }

  function clear() {
    writeLocal([]);
    emit({ cleared: true });
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("uz-UZ", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return {
    init,
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    getAll,
    mergeEntries,
    readLocal,
    clear,
    pullServer,
    formatTime,
    get sources() {
      return SOURCES;
    },
    setApiBase(url) {
      apiBase = url;
    },
  };
})();

if (typeof window !== "undefined") window.AssetFlowLog = AssetFlowLog;
