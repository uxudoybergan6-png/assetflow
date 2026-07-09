/* ============================================================
   FrameFlow — Plugin releases (admin "Releases" tab, P11)
   Reliz zanjiri: paket (.zip) → presigned PUT (folder=releases) →
   POST /api/admin/plugin-releases → plagin GET /api/plugin/version
   orqali in-panel bildirishnoma oladi. Model/tool/narx o'zgarishi
   RELIZ TALAB QILMAYDI (server-driven) — docs/PLUGIN-UPDATE-CHAIN.md.
   ============================================================ */

let REL_LIST = null;
let REL_ERR = null;
let REL_BUSY = false;
let REL_PKG = null; // {key, name, sizeBytes} — yuklangan paket

function relEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function relLoad(force) {
  if (REL_LIST && !force) return;
  try {
    const d = await StudioApi.getPluginReleases();
    REL_LIST = d.items || [];
    REL_ERR = null;
  } catch (e) {
    REL_ERR = e.message || "Failed to load";
  }
  if (CURRENT === "releases") route("releases");
}

window.relPickPackage = async function () {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".zip,application/zip";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const st = document.getElementById("relPkgStatus");
    if (st) st.textContent = "Uploading package…";
    try {
      const pre = await StudioApi.adminUploadUrl(f.name, f.type || "application/zip", "releases");
      if (!pre.uploadUrl) throw new Error(pre.message || "Storage not configured");
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type || "application/zip" }, body: f });
      if (!put.ok) throw new Error("Upload failed (HTTP " + put.status + ")");
      REL_PKG = { key: pre.key, name: f.name, sizeBytes: f.size };
      if (st) st.textContent = "✓ " + f.name + " (" + (f.size / 1048576).toFixed(1) + " MB) uploaded";
    } catch (e) {
      REL_PKG = null;
      if (st) st.textContent = "✗ " + (e.message || "Upload failed");
    }
  };
  inp.click();
};

window.relPublish = async function () {
  if (REL_BUSY) return;
  const v = (document.getElementById("relVer") || {}).value || "";
  const notes = (document.getElementById("relNotes") || {}).value || "";
  const mandatory = !!(document.getElementById("relMand") || {}).checked;
  const minV = (document.getElementById("relMinV") || {}).value || "";
  if (!/^\d+\.\d+\.\d+$/.test(v.trim())) { alert("Version must be semver, e.g. 1.2.0"); return; }
  if (!REL_PKG) { alert("Upload the extension package (.zip) first"); return; }
  REL_BUSY = true;
  try {
    await StudioApi.publishPluginRelease({
      version: v.trim(),
      key: REL_PKG.key,
      releaseNotes: notes.trim() || undefined,
      mandatory,
      minSupportedVersion: minV.trim() || undefined,
    });
    REL_PKG = null;
    await relLoad(true);
    AssetFlowLog.info("Plugin release published: v" + v, { action: "plugin_release" });
  } catch (e) {
    alert(e.message || "Publish failed");
  }
  REL_BUSY = false;
};

window.relDelete = async function (id, version) {
  if (!confirm("Delete release v" + version + "? Plugins that already updated keep working; the version check will fall back to the previous release.")) return;
  try {
    await StudioApi.deletePluginRelease(id);
    await relLoad(true);
  } catch (e) {
    alert(e.message || "Delete failed");
  }
};

VIEWS.releases = function () {
  if (REL_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${relEsc(REL_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="REL_ERR=null;REL_LIST=null;route('releases')">Try again</button></div>`;
  }
  if (!REL_LIST) {
    relLoad();
    return `<div class="adx-empty" style="margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-size:12px;color:var(--muted2)">Loading…</div></div>`;
  }
  const latest = REL_LIST[0];
  const rows = REL_LIST.map(r => `
    <tr>
      <td><b>v${relEsc(r.version)}</b>${latest && latest.id === r.id ? ' <span class="adx-chip lime" style="font-size:9px">LATEST</span>' : ""}</td>
      <td style="max-width:340px;white-space:normal;font-size:11px;color:var(--muted)">${relEsc((r.releaseNotes || "—").slice(0, 160))}</td>
      <td>${r.mandatory ? '<span class="adx-chip red" style="font-size:9px">MANDATORY</span>' : (r.minSupportedVersion ? "min " + relEsc(r.minSupportedVersion) : "optional")}</td>
      <td class="mono" style="font-size:10px">${new Date(r.publishedAt).toLocaleString()}</td>
      <td><button class="adx-btn sm ghost" onclick="relDelete('${relEsc(r.id)}','${relEsc(r.version)}')"><i class="ph ph-trash"></i></button></td>
    </tr>`).join("");
  return `
  <div class="adx-grid" style="grid-template-columns:minmax(280px,380px) 1fr;align-items:start;gap:16px">
    <div class="adx-card">
      <div class="adx-cardh"><b>Publish a release</b></div>
      <div style="display:flex;flex-direction:column;gap:9px;padding:4px 2px">
        <label style="font-size:10.5px;color:var(--muted)">Version (semver — must also match CSXS/manifest.xml)</label>
        <input class="adx-input mono" id="relVer" placeholder="1.2.0">
        <label style="font-size:10.5px;color:var(--muted)">Release notes (shown in the plugin)</label>
        <textarea class="adx-input" id="relNotes" rows="4" placeholder="What changed…"></textarea>
        <label style="font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:7px"><input type="checkbox" id="relMand"> Mandatory (blocks the plugin until updated)</label>
        <label style="font-size:10.5px;color:var(--muted)">Min supported version (optional — older clients are blocked)</label>
        <input class="adx-input mono" id="relMinV" placeholder="1.0.0">
        <button class="adx-btn" onclick="relPickPackage()"><i class="ph ph-upload-simple"></i> Upload package (.zip)</button>
        <div id="relPkgStatus" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_PKG ? "✓ " + relEsc(REL_PKG.name) + " uploaded" : "Package: the built extension folder zipped (CSXS/manifest.xml at the root)."}</div>
        <button class="adx-btn primary" onclick="relPublish()"><i class="ph ph-rocket-launch"></i> Publish release</button>
        <div style="font-size:10px;color:var(--muted2);line-height:1.5">Models, tools and pricing are <b>server-driven</b> — no release needed for those. Publish a release only for plugin <b>code</b> changes. See docs/PLUGIN-UPDATE-CHAIN.md.</div>
      </div>
    </div>
    <div class="adx-card">
      <div class="adx-cardh"><b>Release history</b><span style="margin-left:auto;font-size:10px;color:var(--muted2)">${REL_LIST.length} release${REL_LIST.length === 1 ? "" : "s"}</span></div>
      ${REL_LIST.length ? `<table class="adx-table"><thead><tr><th>Version</th><th>Notes</th><th>Policy</th><th>Published</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="adx-empty" style="margin:30px auto"><span class="ei"><i class="ph ph-package"></i></span><div style="font-size:11.5px;color:var(--muted2)">No releases yet — publish the first one.</div></div>'}
    </div>
  </div>`;
};
