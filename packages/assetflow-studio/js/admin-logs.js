/* Admin — tizim loglari (barcha manbalar) */
let LOG_FILTER = { source: "all", level: "all", q: "" };
let LOG_POLL = null;

VIEWS.logs = function () {
  return `<div class="col gap-16" id="logRoot">
    <div class="toolbar between wrap gap-10">
      <div class="chips" id="logSourceChips"></div>
      <div class="toolbar wrap gap-8">
        <div class="search" style="width:240px;height:34px">
          ${ic("search")}
          <input placeholder="Qidirish…" id="logSearch" value="${LOG_FILTER.q.replace(/"/g, "&quot;")}">
        </div>
        <select class="select" id="logLevel" style="height:34px">
          <option value="all">Barcha daraja</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <button type="button" class="btn btn-ghost btn-sm" onclick="refreshLogs()">${ic("refresh")} Yangilash</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="exportLogs()">${ic("download")} Eksport</button>
        <button type="button" class="btn btn-danger-ghost btn-sm" onclick="clearLogs()">${ic("trash")} Tozalash</button>
      </div>
    </div>
    <div class="info-banner" id="logServerBanner">${ic("globe")}<span>Server: <b id="logServerStatus">tekshirilmoqda…</b> · Admin + Contributor + AE Plugin loglari shu yerda</span></div>
    <div class="card"><div id="logTableHost"><div class="empty" style="padding:40px"><p>Yuklanmoqda…</p></div></div></div>
  </div>`;
};

window.afterRender.logs = function () {
  renderLogSourceChips();
  const lv = document.getElementById("logLevel");
  if (lv) {
    lv.value = LOG_FILTER.level;
    lv.onchange = () => {
      LOG_FILTER.level = lv.value;
      refreshLogs();
    };
  }
  const si = document.getElementById("logSearch");
  if (si) {
    si.oninput = () => {
      LOG_FILTER.q = si.value;
      refreshLogs(false);
    };
  }
  refreshLogs();
  if (LOG_POLL) clearInterval(LOG_POLL);
  LOG_POLL = setInterval(() => {
    if (CURRENT === "logs") refreshLogs(false);
  }, 8000);
};

function renderLogSourceChips() {
  const host = document.getElementById("logSourceChips");
  if (!host) return;
  const counts = { all: 0, admin: 0, contributor: 0, ae_plugin: 0 };
  AssetFlowLog.readLocal().forEach((r) => {
    counts.all++;
    if (counts[r.source] != null) counts[r.source]++;
  });
  const chips = [
    ["all", "Barchasi"],
    ["admin", "Admin"],
    ["contributor", "Contributor"],
    ["ae_plugin", "AE Plugin"],
  ];
  host.innerHTML = chips
    .map(
      ([k, l]) =>
        `<button type="button" class="chip ${LOG_FILTER.source === k ? "active" : ""}" onclick="setLogSource('${k}')">${l}<span class="cnt">${counts[k] || 0}</span></button>`
    )
    .join("");
}

function setLogSource(s) {
  LOG_FILTER.source = s;
  refreshLogs();
}

function levelBadge(level) {
  const map = {
    error: ["badge-hard", "Error"],
    warn: ["badge-soft", "Warn"],
    info: ["badge-approved", "Info"],
    debug: ["badge-draft", "Debug"],
  };
  const [cls, label] = map[level] || ["badge-draft", level];
  return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
}

function sourceBadge(src) {
  const map = {
    admin: "violet",
    contributor: "blue",
    ae_plugin: "green",
  };
  const c = map[src] || "gray";
  const label = (AssetFlowLog.sources && AssetFlowLog.sources[src]) || src;
  return `<span class="badge badge-plan" style="background:var(--${c}-dim);color:var(--${c});border-color:var(--${c}-line,var(--line))">${escapeHtml(label)}</span>`;
}

async function refreshLogs(showToast) {
  const host = document.getElementById("logTableHost");
  const status = document.getElementById("logServerStatus");
  if (!host) return;

  let serverOk = false;
  try {
    const apiBase = (typeof StudioApi !== "undefined" ? StudioApi.baseUrl() : "https://assetflow-api-331762958776.europe-west1.run.app");
    const h = await fetch(`${apiBase}/health`);
    serverOk = h.ok;
    if (status) status.textContent = serverOk ? `${apiBase} ulangan` : "server javob bermadi";
  } catch {
    if (status) status.textContent = "server o‘chiq — faqat brauzer loglari";
  }

  const rows = await AssetFlowLog.getAll({
    source: LOG_FILTER.source,
    level: LOG_FILTER.level,
    q: LOG_FILTER.q,
    includeServer: true,
    limit: 250,
  });

  renderLogSourceChips();

  if (!rows.length) {
    host.innerHTML = `<div class="empty" style="padding:48px"><div class="ico">${ic("scroll")}</div><h3>Log bo‘sh</h3><p>Admin, Contributor yoki AE plugin harakat qilganda yozuvlar paydo bo‘ladi.</p></div>`;
    return;
  }

  host.innerHTML = `<div class="table-wrap"><table class="data log-table" style="min-width:920px">
    <thead><tr><th>Vaqt</th><th>Manba</th><th>Daraja</th><th>Xabar</th><th>Amal</th><th>Izoh</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr class="log-row log-${r.level}">
        <td class="cell-muted mono" style="white-space:nowrap">${AssetFlowLog.formatTime(r.ts)}</td>
        <td>${sourceBadge(r.source)}</td>
        <td>${levelBadge(r.level)}</td>
        <td class="cell-strong" style="max-width:320px">${escapeHtml(r.message)}</td>
        <td class="cell-muted mono">${escapeHtml(r.action || "—")}</td>
        <td class="small" style="color:var(--tx-2);max-width:280px">${escapeHtml(r.detail || "")}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`;

  if (showToast) toast("Log yangilandi", `${rows.length} ta yozuv`, "info");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clearLogs() {
  openModal(`
    <div class="modal-head"><div class="modal-ico" style="background:var(--red-dim);color:var(--red)">${ic("trash")}</div>
      <div><h3>Loglarni tozalash</h3><p>Brauzer va serverdagi tizim loglari o‘chadi.</p></div></div>
    <div class="modal-body"><div class="info-banner danger">${ic("alert")}<span>Bu amalni qaytarib bo‘lmaydi.</span></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Bekor</button>
      <button class="btn btn-danger" onclick="doClearLogs()">${ic("trash")} Tozalash</button></div>`);
}

async function doClearLogs() {
  AssetFlowLog.clear();
  try {
    const apiBase = (typeof StudioApi !== "undefined" ? StudioApi.baseUrl() : "https://assetflow-api-331762958776.europe-west1.run.app");
    await fetch(`${apiBase}/api/logs`, { method: "DELETE" });
  } catch {
    /* */
  }
  closeModal();
  refreshLogs();
  toast("Tozalandi", "Loglar o‘chirildi", "success");
}

function exportLogs() {
  AssetFlowLog.getAll({ limit: 500 }).then((rows) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assetflow-logs-${Date.now()}.json`;
    a.click();
    toast("Eksport", "JSON yuklab olindi", "success");
  });
}
