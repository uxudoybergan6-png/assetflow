/* ============================================================
   FrameFlow — Plugin releases (admin "Releases" tab, P11 / Task 2)
   Reliz zanjiri: PLATFORMAGA XOS installer (mac .pkg / win .exe|.msi) →
   presigned PUT (folder=releases) → SHA-256 brauzerda hisoblanadi →
   POST /api/admin/plugin-releases (server SHA-256'ni storage'dan QAYTA
   hisoblab solishtiradi) → plagin GET /api/plugin/version orqali
   bildirishnoma oladi va faylni OS installeriga topshiradi.
   Legacy .zxp — IXTIYORIY, faqat qo'lda yuklab olish sahifasi uchun
   (panel uni hech qachon avtomatik o'rnatmaydi).
   Model/tool/narx o'zgarishi RELIZ TALAB QILMAYDI (server-driven).
   Batafsil: docs/PLUGIN-UPDATE-CHAIN.md.
   ============================================================ */

let REL_LIST = null;
let REL_ERR = null;
let REL_BUSY = false;
let REL_PKG = null; // {key, name, sizeBytes} — legacy .zxp (ixtiyoriy)
// Platformaga xos installerlar: {mac:{key,name,sizeBytes,sha256}, win:{...}}
const REL_INSTALLERS = { mac: null, win: null };
const REL_PLATFORMS = {
  mac: { label: "macOS", exts: ["pkg"], accept: ".pkg" },
  win: { label: "Windows", exts: ["exe", "msi"], accept: ".exe,.msi" },
};

function relFileExt(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

/** SHA-256 brauzerda (WebCrypto) — server buni storage'dan qayta hisoblab tekshiradi. */
async function relSha256(file) {
  if (!(window.crypto && window.crypto.subtle)) throw new Error("SHA-256 needs a secure (HTTPS) admin page");
  const buf = await file.arrayBuffer();
  const digest = await window.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

/** Platformaga xos installer yuklash — kengaytma allowlist'i + majburiy SHA-256. */
window.relPickInstaller = async function (platform) {
  const cfg = REL_PLATFORMS[platform];
  if (!cfg) return;
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = cfg.accept;
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const st = document.getElementById("relInst_" + platform);
    const ext = relFileExt(f.name);
    if (cfg.exts.indexOf(ext) < 0) {
      REL_INSTALLERS[platform] = null;
      if (st) st.textContent = "✗ " + cfg.label + " installer must be " + cfg.exts.map((e) => "." + e).join(" or ");
      return;
    }
    if (st) st.textContent = "Hashing + uploading…";
    try {
      const sha256 = await relSha256(f);
      const pre = await StudioApi.adminUploadUrl(f.name, f.type || "application/octet-stream", "releases");
      if (!pre.uploadUrl) throw new Error(pre.message || "Storage not configured");
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
      if (!put.ok) throw new Error("Upload failed (HTTP " + put.status + ")");
      REL_INSTALLERS[platform] = { key: pre.key, name: f.name, sizeBytes: f.size, sha256 };
      if (st) st.textContent = "✓ " + f.name + " (" + (f.size / 1048576).toFixed(1) + " MB) · sha256 " + sha256.slice(0, 12) + "…";
    } catch (e) {
      REL_INSTALLERS[platform] = null;
      if (st) st.textContent = "✗ " + (e.message || "Upload failed");
    }
  };
  inp.click();
};

window.relPickPackage = async function () {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".zxp";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const st = document.getElementById("relPkgStatus");
    if (relFileExt(f.name) !== "zxp") {
      REL_PKG = null;
      if (st) st.textContent = "✗ The manual-download package must be a signed .zxp";
      return;
    }
    if (st) st.textContent = "Uploading package…";
    try {
      const pre = await StudioApi.adminUploadUrl(f.name, f.type || "application/octet-stream", "releases");
      if (!pre.uploadUrl) throw new Error(pre.message || "Storage not configured");
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
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
  const installers = Object.keys(REL_PLATFORMS)
    .filter((p) => REL_INSTALLERS[p])
    .map((p) => ({ platform: p, key: REL_INSTALLERS[p].key, sha256: REL_INSTALLERS[p].sha256 }));
  if (!installers.length && !REL_PKG) { alert("Upload at least one platform installer (.pkg / .exe / .msi)"); return; }
  if (!installers.length && !confirm("No platform installer uploaded. Plugins will NOT be able to update automatically — only the manual .zxp download will work. Publish anyway?")) return;
  REL_BUSY = true;
  try {
    await StudioApi.publishPluginRelease({
      version: v.trim(),
      key: REL_PKG ? REL_PKG.key : undefined,
      releaseNotes: notes.trim() || undefined,
      mandatory,
      minSupportedVersion: minV.trim() || undefined,
      installers: installers.length ? installers : undefined,
    });
    REL_PKG = null;
    REL_INSTALLERS.mac = null;
    REL_INSTALLERS.win = null;
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
      <td style="font-size:10px">${(r.installers || []).length
        ? (r.installers || []).map(i => `<span class="adx-chip" style="font-size:9px" title="sha256 ${relEsc(i.sha256)}">${relEsc((REL_PLATFORMS[i.platform] || {}).label || i.platform)} .${relEsc(i.ext || "")}</span>`).join(" ")
        : '<span style="color:var(--muted2)">manual .zxp only</span>'}</td>
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
        <div style="border-top:1px solid var(--line);margin:4px 0 2px"></div>
        <div style="font-size:10.5px;color:var(--muted);font-weight:600">Platform installers (used for in-plugin updates)</div>
        <button class="adx-btn" onclick="relPickInstaller('mac')"><i class="ph ph-apple-logo"></i> Upload macOS installer (.pkg)</button>
        <div id="relInst_mac" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_INSTALLERS.mac ? "✓ " + relEsc(REL_INSTALLERS.mac.name) : "Signed + notarized .pkg — handed to the macOS Installer."}</div>
        <button class="adx-btn" onclick="relPickInstaller('win')"><i class="ph ph-windows-logo"></i> Upload Windows installer (.exe / .msi)</button>
        <div id="relInst_win" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_INSTALLERS.win ? "✓ " + relEsc(REL_INSTALLERS.win.name) : "Code-signed .exe or .msi — handed to Windows/UAC."}</div>
        <div style="border-top:1px solid var(--line);margin:4px 0 2px"></div>
        <button class="adx-btn ghost" onclick="relPickPackage()"><i class="ph ph-upload-simple"></i> Upload manual .zxp (optional)</button>
        <div id="relPkgStatus" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_PKG ? "✓ " + relEsc(REL_PKG.name) + " uploaded" : "Manual download only — the plugin never auto-installs a .zxp."}</div>
        <button class="adx-btn primary" onclick="relPublish()"><i class="ph ph-rocket-launch"></i> Publish release</button>
        <div style="font-size:10px;color:var(--muted2);line-height:1.5">SHA-256 is computed here <b>and re-computed on the server</b> from storage — a mismatch is rejected. Models, tools and pricing are <b>server-driven</b> — no release needed for those. See docs/PLUGIN-UPDATE-CHAIN.md.</div>
      </div>
    </div>
    <div class="adx-card">
      <div class="adx-cardh"><b>Release history</b><span style="margin-left:auto;font-size:10px;color:var(--muted2)">${REL_LIST.length} release${REL_LIST.length === 1 ? "" : "s"}</span></div>
      ${REL_LIST.length ? `<table class="adx-table"><thead><tr><th>Version</th><th>Notes</th><th>Policy</th><th>Installers</th><th>Published</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="adx-empty" style="margin:30px auto"><span class="ei"><i class="ph ph-package"></i></span><div style="font-size:11.5px;color:var(--muted2)">No releases yet — publish the first one.</div></div>'}
    </div>
  </div>`;
};
