/* Admin — system logs (all sources) */
let LOG_FILTER = { source: "all", level: "all", q: "" };
let LOG_POLL = null;

VIEWS.logs = function () {
  return `<div id="logRoot">
    <div style="display:flex;align-items:center;gap:9px;padding:9px 12px;background:var(--limedim);border:1px solid rgba(194,240,74,.2);border-radius:10px;margin-bottom:14px"><span style="width:7px;height:7px;border-radius:50%;background:#C2F04A;flex:none"></span><span style="font-size:11.5px;color:#B7C0CE">Server: <b id="logServerStatus" style="color:#C2F04A">checking…</b> · Admin + Contributor + AE Plugin logs appear here</span></div>
    <div class="adx-tagrow" id="logSourceChips"></div>
    <div class="adx-card" style="overflow:hidden"><div id="logTableHost"><div class="adx-empty" style="border:0;padding:40px"><span class="ei"><i class="ph ph-scroll"></i></span><div style="font-size:12px;color:var(--muted2)">Loading…</div></div></div></div>
  </div>`;
};

window.afterRender.logs = function () {
  const tba = document.getElementById('tbActions');
  if(tba && CURRENT==='logs') tba.innerHTML =
    `<label class="adx-sel"><i class="ph ph-funnel" style="font-size:13px"></i><span>${LOG_FILTER.level==='all'?'All levels':LOG_FILTER.level}</span><i class="ph ph-caret-down" style="font-size:11px;color:#8A93A3"></i><select onchange="LOG_FILTER.level=this.value;refreshLogs()"><option value="all">All levels</option><option value="error" ${LOG_FILTER.level==='error'?'selected':''}>Error</option><option value="warn" ${LOG_FILTER.level==='warn'?'selected':''}>Warn</option><option value="info" ${LOG_FILTER.level==='info'?'selected':''}>Info</option><option value="debug" ${LOG_FILTER.level==='debug'?'selected':''}>Debug</option></select></label>`+
    `<button class="adx-btn2 sm" onclick="refreshLogs(true)"><i class="ph ph-arrow-clockwise"></i>Refresh</button>`+
    `<button class="adx-btn2 sm" onclick="exportLogs()"><i class="ph ph-export"></i>Export</button>`+
    `<button class="adx-btn2 sm adx-btn-dghost" onclick="clearLogs()"><i class="ph ph-trash"></i>Clear</button>`;
  renderLogSourceChips();
  refreshLogs();
  if (LOG_POLL) clearInterval(LOG_POLL);
  LOG_POLL = setInterval(() => { if (CURRENT === "logs") refreshLogs(false); }, 8000);
};

function renderLogSourceChips() {
  const host = document.getElementById("logSourceChips");
  if (!host) return;
  const counts = { all: 0, admin: 0, contributor: 0, ae_plugin: 0 };
  AssetFlowLog.readLocal().forEach((r) => { counts.all++; if (counts[r.source] != null) counts[r.source]++; });
  const chips = [["all","All"],["admin","Admin"],["contributor","Contributor"],["ae_plugin","AE Plugin"]];
  host.innerHTML = chips.map(([k,l])=>`<button class="adx-tag ${LOG_FILTER.source===k?'on':''}" onclick="setLogSource('${k}')">${l} <span class="n">${counts[k]||0}</span></button>`).join("");
}

function setLogSource(s) { LOG_FILTER.source = s; refreshLogs(); }

function axLogLevelBadge(level) {
  const map = { error:['adx-bdg-hard','Error'], warn:['adx-bdg-soft','Warn'], info:['adx-bdg-approved','Info'], debug:['adx-bdg-draft','Debug'] };
  const [cls,label]=map[level]||['adx-bdg-draft',level];
  return `<span class="adx-bdg ${cls}">${label}</span>`;
}

function axLogSourceBadge(src) {
  const label=(AssetFlowLog.sources&&AssetFlowLog.sources[src])||src;
  if(src==='admin') return `<span class="adx-bdg adx-bdg-info">${escapeHtml(label)}</span>`;
  if(src==='ae_plugin') return `<span class="adx-bdg" style="color:#7CC4FF;background:rgba(124,196,255,.13)">${escapeHtml(label)}</span>`;
  if(src==='contributor') return `<span class="adx-bdg" style="color:#b794f6;background:rgba(183,148,246,.14)">${escapeHtml(label)}</span>`;
  return `<span class="adx-bdg adx-bdg-draft">${escapeHtml(label)}</span>`;
}

async function refreshLogs(showToast) {
  const host = document.getElementById("logTableHost");
  const status = document.getElementById("logServerStatus");
  if (!host) return;
  try {
    const apiBase = (typeof StudioApi !== "undefined" ? StudioApi.baseUrl() : "");
    const h = await fetch(`${apiBase}/health`);
    if (status){ status.textContent = h.ok ? "online" : "not responding"; status.style.color = h.ok ? "#C2F04A" : "#FFB27C"; }
  } catch { if (status){ status.textContent="offline — browser logs only"; status.style.color="#FFB27C"; } }
  const rows = await AssetFlowLog.getAll({ source: LOG_FILTER.source, level: LOG_FILTER.level, q: LOG_FILTER.q, includeServer: true, limit: 250 });
  renderLogSourceChips();
  if (!rows.length) {
    host.innerHTML = `<div class="adx-empty" style="border:0;padding:48px"><span class="ei"><i class="ph ph-scroll"></i></span><div style="font-weight:600;font-size:13px">Log is empty</div><div style="font-size:11px;color:var(--muted2)">Entries appear here once Admin, Contributor, or the AE plugin take action.</div></div>`;
    return;
  }
  host.innerHTML = `<div style="overflow-x:auto"><table class="adx-tbl" style="min-width:960px">
    <thead><tr><th>Time</th><th>Source</th><th>Level</th><th>Message</th><th>Action</th><th>Note</th></tr></thead>
    <tbody>${rows.map((r)=>`<tr>
      <td class="adx-num" style="font-size:10.5px;color:#8A93A3;white-space:nowrap">${AssetFlowLog.formatTime(r.ts)}</td>
      <td>${axLogSourceBadge(r.source)}</td>
      <td>${axLogLevelBadge(r.level)}</td>
      <td style="color:var(--text);max-width:320px">${escapeHtml(r.message)}</td>
      <td class="adx-num" style="font-size:10px;color:#8A93A3">${escapeHtml(r.action||"—")}</td>
      <td style="font-size:10.5px;color:#5E6675;max-width:280px">${escapeHtml(r.detail||"")}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
  if (showToast) toast("Log refreshed", `${rows.length} entries`, "info");
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
      <div><h3>Clear logs</h3><p>Browser and server system logs will be deleted.</p></div></div>
    <div class="modal-body"><div class="info-banner danger">${ic("alert")}<span>This action cannot be undone.</span></div></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doClearLogs()">${ic("trash")} Clear</button></div>`);
}

async function doClearLogs() {
  AssetFlowLog.clear();
  try {
    const apiBase = (typeof StudioApi !== "undefined" ? StudioApi.baseUrl() : "https://api.getframeflow.app");
    await fetch(`${apiBase}/api/logs`, { method: "DELETE" });
  } catch {
    /* */
  }
  closeModal();
  refreshLogs();
  toast("Cleared", "Logs deleted", "success");
}

function exportLogs() {
  AssetFlowLog.getAll({ limit: 500 }).then((rows) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assetflow-logs-${Date.now()}.json`;
    a.click();
    toast("Export", "JSON downloaded", "success");
  });
}
