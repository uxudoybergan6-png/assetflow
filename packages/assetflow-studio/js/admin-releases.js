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
let REL_PKG = null; // {key, name, sizeBytes} — legacy .zxp (ixtiyoriy, faqat AE)
// Platformaga xos installerlar: {mac:{key,name,sizeBytes,sha256}, win:{...}}
const REL_INSTALLERS = { mac: null, win: null };

/* FAZA 5 — HOST kanali. AE (CEP) va Premiere Pro (UXP) panellari MUSTAQIL
   versiyalanadi: bir xil "1.4.0" ikkalasida ham bo'lishi mumkin, shu sabab
   server unikalligi `(host, version)` juftligida. Server tomoni: `host`
   berilmasa "ae" — bu UI uni HAR DOIM aniq yuboradi.

   Premiere `.ccx` — BITTA kross-platforma fayl. Kontrakt esa platforma bo'yicha
   qator talab qiladi, shuning uchun bitta yuklangan kalit mac va win uchun ham
   yoziladi (server ikkalasining SHA-256'sini storage'dan qayta hisoblaydi). */
const REL_HOSTS = {
  ae: {
    label: "After Effects",
    icon: "ph-shapes",
    platforms: {
      mac: { label: "macOS", exts: ["pkg"], accept: ".pkg", btn: "Upload macOS installer (.pkg)", icon: "ph-apple-logo", hint: "Signed + notarized .pkg — handed to the macOS Installer." },
      win: { label: "Windows", exts: ["exe", "msi"], accept: ".exe,.msi", btn: "Upload Windows installer (.exe / .msi)", icon: "ph-windows-logo", hint: "Code-signed .exe or .msi — handed to Windows/UAC." },
    },
    legacyZxp: true,
    verHint: "Version (semver — must also match CSXS/manifest.xml)",
  },
  pr: {
    label: "Premiere Pro",
    icon: "ph-film-strip",
    single: true, // bitta .ccx → ikkala platformaga
    platforms: {
      mac: { label: "macOS", exts: ["ccx"], accept: ".ccx", btn: "Upload .ccx package", icon: "ph-package", hint: "One cross-platform .ccx — registered for macOS and Windows." },
      win: { label: "Windows", exts: ["ccx"], accept: ".ccx" },
    },
    legacyZxp: false,
    verHint: "Version (semver — must also match plugins/premiere-uxp/manifest.json)",
  },
};
let REL_HOST = "ae";

/** Joriy host konfiguratsiyasi. */
function relHostCfg() {
  return REL_HOSTS[REL_HOST] || REL_HOSTS.ae;
}

/** Host almashganda yuklangan artefaktlar TOZALANADI — `.pkg` `pr` ostiga ketmasin. */
window.relSetHost = function (h) {
  if (!REL_HOSTS[h] || h === REL_HOST) return;
  REL_HOST = h;
  REL_PKG = null;
  REL_INSTALLERS.mac = null;
  REL_INSTALLERS.win = null;
  route("releases");
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
  const host = relHostCfg();
  const cfg = host.platforms[platform];
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
    // `single` hostda eski tanlov qolib ketmasin (bitta fayl ikkala platformaga).
    if (host.single) { REL_INSTALLERS.mac = null; REL_INSTALLERS.win = null; }
    if (st) st.textContent = "Hashing + uploading…";
    try {
      const sha256 = await relSha256(f);
      const pre = await StudioApi.adminUploadUrl(f.name, f.type || "application/octet-stream", "releases");
      if (!pre.uploadUrl) throw new Error(pre.message || "Storage not configured");
      const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
      if (!put.ok) throw new Error("Upload failed (HTTP " + put.status + ")");
      const rec = { key: pre.key, name: f.name, sizeBytes: f.size, sha256 };
      if (host.single) { REL_INSTALLERS.mac = rec; REL_INSTALLERS.win = rec; }
      else REL_INSTALLERS[platform] = rec;
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
  const host = relHostCfg();
  const extList = Array.from(new Set(Object.keys(host.platforms).flatMap((p) => host.platforms[p].exts)))
    .map((e) => "." + e).join(" / ");
  const installers = Object.keys(host.platforms)
    .filter((p) => REL_INSTALLERS[p])
    .map((p) => ({ platform: p, key: REL_INSTALLERS[p].key, sha256: REL_INSTALLERS[p].sha256 }));
  if (!installers.length && !REL_PKG) { alert("Upload at least one platform installer (" + extList + ")"); return; }
  // D6 (#12) — xom confirm() o'rniga dizayn tizimidagi tasdiq modali (afConfirm, ui.js)
  if (!installers.length && !(await afConfirm({
    title: "Publish without an installer?",
    sub: "Version " + v.trim() + " has no platform installer (" + extList + ").",
    tone: "warn",
    warn: "Plugins will NOT be able to update automatically — only the manual .zxp download will work.",
    okLabel: "Publish anyway",
  }))) return;
  REL_BUSY = true;
  try {
    await StudioApi.publishPluginRelease({
      host: REL_HOST,
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
    AssetFlowLog.info("Plugin release published: " + REL_HOST + " v" + v, { action: "plugin_release" });
  } catch (e) {
    alert(e.message || "Publish failed");
  }
  REL_BUSY = false;
};

window.relDelete = async function (id, version) {
  if (!(await afConfirm({
    title: "Delete release v" + version + "?",
    warn: "Plugins that already updated keep working; the version check falls back to the previous release.",
    okLabel: "Delete release",
    icon: "trash",
  }))) return;
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
  const host = relHostCfg();
  // Tarix joriy host bo'yicha filtrlanadi — aks holda "LATEST" nishoni ikki
  // kanal aralashib ketganda noto'g'ri qatorga tushardi. `host` yo'q eski
  // yozuvlar server sxemasi bo'yicha "ae".
  const list = REL_LIST.filter((r) => (r.host || "ae") === REL_HOST);
  const hostTabs = Object.keys(REL_HOSTS).map((h) => {
    const c = REL_HOSTS[h];
    const on = h === REL_HOST;
    const n = REL_LIST.filter((r) => (r.host || "ae") === h).length;
    return `<button class="adx-btn sm${on ? " primary" : " ghost"}" aria-pressed="${on}" onclick="relSetHost('${h}')"><i class="ph ${c.icon}"></i> ${relEsc(c.label)}${n ? ` <span style="opacity:.7">· ${n}</span>` : ""}</button>`;
  }).join("");
  const latest = list[0];
  const rows = list.map(r => `
    <tr>
      <td><b>v${relEsc(r.version)}</b>${latest && latest.id === r.id ? ' <span class="adx-chip lime" style="font-size:9px">LATEST</span>' : ""}</td>
      <td style="max-width:340px;white-space:normal;font-size:11px;color:var(--muted)">${relEsc((r.releaseNotes || "—").slice(0, 160))}</td>
      <td>${r.mandatory ? '<span class="adx-chip red" style="font-size:9px">MANDATORY</span>' : (r.minSupportedVersion ? "min " + relEsc(r.minSupportedVersion) : "optional")}</td>
      <td style="font-size:10px">${(r.installers || []).length
        ? (r.installers || []).map(i => `<span class="adx-chip" style="font-size:9px" title="sha256 ${relEsc(i.sha256)}">${relEsc((host.platforms[i.platform] || {}).label || i.platform)} .${relEsc(i.ext || "")}</span>`).join(" ")
        : '<span style="color:var(--muted2)">manual .zxp only</span>'}</td>
      <td class="mono" style="font-size:10px">${new Date(r.publishedAt).toLocaleString()}</td>
      <td><button class="adx-btn sm ghost" onclick="relDelete('${relEsc(r.id)}','${relEsc(r.version)}')"><i class="ph ph-trash"></i></button></td>
    </tr>`).join("");
  return `
  <div class="adx-grid" style="grid-template-columns:minmax(280px,380px) 1fr;align-items:start;gap:16px">
    <div class="adx-card">
      <div class="adx-cardh"><b>Publish a release</b></div>
      <div style="display:flex;flex-direction:column;gap:9px;padding:4px 2px">
        <label style="font-size:10.5px;color:var(--muted)">Host application (each one is versioned independently)</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${hostTabs}</div>
        <label style="font-size:10.5px;color:var(--muted)">${relEsc(host.verHint)}</label>
        <input class="adx-input mono" id="relVer" placeholder="1.2.0">
        <label style="font-size:10.5px;color:var(--muted)">Release notes (shown in the plugin)</label>
        <textarea class="adx-input" id="relNotes" rows="4" placeholder="What changed…"></textarea>
        <label style="font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:7px"><input type="checkbox" id="relMand"> Mandatory (blocks the plugin until updated)</label>
        <label style="font-size:10.5px;color:var(--muted)">Min supported version (optional — older clients are blocked)</label>
        <input class="adx-input mono" id="relMinV" placeholder="1.0.0">
        <div style="border-top:1px solid var(--line);margin:4px 0 2px"></div>
        <div style="font-size:10.5px;color:var(--muted);font-weight:600">${host.single ? "Installer package (used for in-plugin updates)" : "Platform installers (used for in-plugin updates)"}</div>
        ${Object.keys(host.platforms).filter((p) => host.platforms[p].btn).map((p) => {
          const c = host.platforms[p];
          return `<button class="adx-btn" onclick="relPickInstaller('${p}')"><i class="ph ${c.icon}"></i> ${relEsc(c.btn)}</button>
        <div id="relInst_${p}" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_INSTALLERS[p] ? "✓ " + relEsc(REL_INSTALLERS[p].name) : relEsc(c.hint)}</div>`;
        }).join("\n        ")}
        ${host.legacyZxp ? `<div style="border-top:1px solid var(--line);margin:4px 0 2px"></div>
        <button class="adx-btn ghost" onclick="relPickPackage()"><i class="ph ph-upload-simple"></i> Upload manual .zxp (optional)</button>
        <div id="relPkgStatus" style="font-size:10.5px;color:var(--muted2);min-height:14px">${REL_PKG ? "✓ " + relEsc(REL_PKG.name) + " uploaded" : "Manual download only — the plugin never auto-installs a .zxp."}</div>` : ""}
        <button class="adx-btn primary" onclick="relPublish()"><i class="ph ph-rocket-launch"></i> Publish release</button>
        <div style="font-size:10px;color:var(--muted2);line-height:1.5">SHA-256 is computed here <b>and re-computed on the server</b> from storage — a mismatch is rejected. Models, tools and pricing are <b>server-driven</b> — no release needed for those. See docs/PLUGIN-UPDATE-CHAIN.md.</div>
      </div>
    </div>
    <div class="adx-card">
      <div class="adx-cardh"><b>Release history</b><span class="adx-chip" style="font-size:9px"><i class="ph ${host.icon}"></i> ${relEsc(host.label)}</span><span style="margin-left:auto;font-size:10px;color:var(--muted2)">${list.length} release${list.length === 1 ? "" : "s"}</span></div>
      ${list.length ? `<table class="adx-table"><thead><tr><th>Version</th><th>Notes</th><th>Policy</th><th>Installers</th><th>Published</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="adx-empty" style="margin:30px auto"><span class="ei"><i class="ph ph-package"></i></span><div style="font-size:11.5px;color:var(--muted2)">No ${relEsc(host.label)} releases yet — publish the first one.</div></div>`}
    </div>
  </div>`;
};
