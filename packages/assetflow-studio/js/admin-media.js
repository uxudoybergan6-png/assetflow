/* ============================================================
   AssetFlow — Site media library (admin "Media library" tab)
   CMS'ga yuklangan barcha fayllar (landing/ + site/plugin/):
   preview, hajm, sana, QAYERDA ishlatilayotgani (usedBy), URL
   nusxalash, xavfsiz o'chirish (ishlatilayotganda ogohlantiradi),
   to'g'ridan yuklash. Manba: /api/admin/site-media (SC_63).
   ============================================================ */

let SM_ITEMS = null;
let SM_LOAD_ERR = null;
let SM_CONFIGURED = true;
let SM_FILTER = "all"; // all | website | plugin | used | unused

function smEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function smFmtSize(b) {
  if (!b && b !== 0) return "—";
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

async function smLoad(force) {
  if (SM_ITEMS && !force) return;
  try {
    const d = await StudioApi.listSiteMedia();
    SM_ITEMS = (d && d.items) || [];
    SM_CONFIGURED = !d || d.configured !== false;
    SM_LOAD_ERR = null;
  } catch (e) {
    SM_LOAD_ERR = e.message || "Failed to load";
  }
  if (CURRENT === "sitemedia") route("sitemedia");
}

function smFiltered() {
  const list = SM_ITEMS || [];
  if (SM_FILTER === "website") return list.filter((i) => i.folder === "landing");
  if (SM_FILTER === "plugin") return list.filter((i) => i.folder === "site/plugin");
  if (SM_FILTER === "used") return list.filter((i) => (i.usedBy || []).length);
  if (SM_FILTER === "unused") return list.filter((i) => !(i.usedBy || []).length);
  return list;
}

function smCard(it) {
  const name = it.key.split("/").pop();
  const isVideo = it.kind === "video";
  const thumb = isVideo
    ? `<video src="${smEsc(it.publicUrl)}" muted loop playsinline preload="metadata" onmouseover="try{this.play()}catch(e){}" onmouseout="try{this.pause()}catch(e){}" style="width:100%;height:100%;object-fit:cover"></video>`
    : `<img src="${smEsc(it.publicUrl)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">`;
  const usedBy = it.usedBy || [];
  const usage = usedBy.length
    ? `<span class="adx-bdg" style="background:rgba(120,220,150,.12);color:#7EDC96;border-color:rgba(120,220,150,.3)" title="${smEsc(usedBy.join("\n"))}">IN USE · ${usedBy.length}</span>`
    : `<span class="adx-bdg" style="color:var(--muted)">UNUSED</span>`;
  const kindBdg = `<span class="adx-bdg" style="text-transform:uppercase">${smEsc(it.kind)}</span>`;
  const folderBdg = `<span class="adx-bdg">${it.folder === "landing" ? "WEBSITE" : "PLUGIN"}</span>`;
  return `<div class="adx-card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
    <div style="height:120px;background:linear-gradient(138deg,#12161E,#1A222E 62%,#0B0F15);position:relative">${thumb}</div>
    <div style="padding:11px 13px;display:flex;flex-direction:column;gap:8px;flex:1">
      <div style="font:600 11px/1.3 'IBM Plex Mono',monospace;word-break:break-all" title="${smEsc(it.key)}">${smEsc(name)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${folderBdg}${kindBdg}${usage}</div>
      <div style="font-size:10px;color:var(--muted)">${smFmtSize(it.sizeBytes)}${it.lastModified ? " · " + (typeof fmtLocalDate === "function" ? fmtLocalDate(it.lastModified) : it.lastModified.slice(0, 10)) : ""}</div>
      ${usedBy.length ? `<div style="font-size:9.5px;color:var(--muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${smEsc(usedBy.join(", "))}">${smEsc(usedBy.slice(0, 2).join(", "))}${usedBy.length > 2 ? " +" + (usedBy.length - 2) : ""}</div>` : ""}
      <div style="display:flex;gap:6px;margin-top:auto">
        <button class="adx-btn2 sm" onclick="smCopyUrl('${smEsc(it.publicUrl)}')"><i class="ph ph-copy"></i>Copy URL</button>
        <button class="adx-btn2 sm" style="color:#FF8C7A" onclick="smDelete('${smEsc(it.key)}')"><i class="ph ph-trash"></i>Delete</button>
      </div>
    </div>
  </div>`;
}

VIEWS.sitemedia = function () {
  if (SM_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${smEsc(SM_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="SM_LOAD_ERR=null;SM_ITEMS=null;route('sitemedia')">Try again</button></div>`;
  }
  if (!SM_ITEMS) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Listing uploaded CMS media</div></div>`;
  }
  if (!SM_CONFIGURED) {
    return `<div class="adx-empty" style="max-width:460px;margin:60px auto"><span class="ei"><i class="ph ph-cloud-slash"></i></span><div style="font-weight:600;font-size:13px">Storage not configured</div><div style="font-size:11px;color:var(--muted2)">Set the AWS_*/S3 environment variables on the API to enable CMS media.</div></div>`;
  }
  const list = smFiltered();
  const tabs = [
    ["all", "All"], ["website", "Website"], ["plugin", "Plugin"], ["used", "In use"], ["unused", "Unused"],
  ].map(([k, l]) => `<button class="${SM_FILTER === k ? "on" : ""}" onclick="SM_FILTER='${k}';route('sitemedia')" style="padding:7px 14px">${l}${k === "all" ? ` · ${(SM_ITEMS || []).length}` : ""}</button>`).join("");
  const grid = list.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px">${list.map(smCard).join("")}</div>`
    : `<div class="adx-empty" style="max-width:420px;margin:50px auto"><span class="ei"><i class="ph ph-image"></i></span><div style="font-weight:600;font-size:13px">No media here</div><div style="font-size:11px;color:var(--muted2)">Upload media with the button above, or from the Website / Plugin CMS editors.</div></div>`;
  return `
    ${axInfo(`Every image, GIF and video uploaded to the Website and Plugin CMS lives here. "IN USE" shows where a file is referenced right now — deleting an in-use file breaks that card until you replace it (the editor will show MEDIA UNREACHABLE).`, "amber")}
    <div class="adx-seg" style="margin-bottom:16px;display:inline-flex">${tabs}</div>
    ${grid}
    <input type="file" id="smMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

function smCopyUrl(url) {
  const done = () => toast("Copied", "Public URL is on your clipboard", "success");
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, () => smCopyFallback(url, done));
      return;
    }
  } catch (e) {}
  smCopyFallback(url, done);
}
function smCopyFallback(url, done) {
  let ta = null;
  try {
    ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    if (!(document.execCommand && document.execCommand("copy") === true)) throw new Error("Copy rejected");
    done();
  } catch (e) {
    toast("Copy failed", url, "warn");
  } finally {
    if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
  }
}

async function smDelete(key) {
  const it = (SM_ITEMS || []).find((x) => x.key === key);
  const usedBy = (it && it.usedBy) || [];
  if (!(await afConfirm({
    title: "Delete this media file",
    sub: key.split("/").pop(),
    warn: usedBy.length
      ? `This file is IN USE (${usedBy.join(", ")}). The card(s) will show "MEDIA UNREACHABLE" until you upload a replacement.`
      : "The file is not referenced by any CMS card right now.",
    body: "Deletion removes the file from storage permanently. Published pages cache media for a while, so it may linger briefly on the CDN.",
    okLabel: "Delete file",
  }))) return;
  try {
    await StudioApi.deleteSiteMedia(key, usedBy.length > 0);
    AssetFlowLog.info("Site media deleted", { action: "site_media_delete", detail: key });
    toast("Deleted", "Media removed from storage", "success");
    smLoad(true);
  } catch (e) {
    toast("Delete failed", e.message || "Server error", "warn");
  }
}

let SM_UP_FOLDER = "landing";
function smPickUpload(folder) {
  SM_UP_FOLDER = folder === "site/plugin" ? "site/plugin" : "landing";
  const inp = document.getElementById("smMediaFile");
  if (inp) { inp.value = ""; inp.click(); }
}

async function smUpload(file) {
  if (!file) return;
  const isVideo = /^video\//.test(file.type);
  const cap = isVideo ? 150 : 40;
  if (file.size > cap * 1024 * 1024) {
    toast("Too large", `${isVideo ? "Video" : "Image/GIF"} must be under ${cap} MB`, "warn");
    return;
  }
  try {
    toast("Uploading…", file.name, "info");
    const u = await StudioApi.adminUploadUrl(file.name, file.type || "application/octet-stream", SM_UP_FOLDER, file.size);
    if (!u.uploadUrl) {
      toast("Storage not configured", u.message || "S3 is not configured on the server", "warn");
      return;
    }
    const res = await fetch(u.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    AssetFlowLog.info("Site media uploaded", { action: "site_media_upload", detail: u.key });
    toast("Uploaded", "File is live — attach it to a card from the Website / Plugin CMS editors", "success");
    smLoad(true);
  } catch (e) {
    toast("Upload error", e.message || "Failed to upload", "warn");
  }
}

window.afterRender.sitemedia = function () {
  const tba = document.getElementById("tbActions");
  if (tba && CURRENT === "sitemedia") {
    tba.innerHTML =
      `<button class="adx-btn2 sm" onclick="smLoad(true)"><i class="ph ph-arrows-clockwise"></i>Refresh</button>` +
      `<button class="adx-btn2 sm" onclick="smPickUpload('landing')"><i class="ph ph-upload-simple"></i>Upload — Website</button>` +
      `<button class="adx-btn sm" onclick="smPickUpload('site/plugin')"><i class="ph ph-upload-simple"></i>Upload — Plugin</button>`;
  }
  if (!SM_ITEMS && !SM_LOAD_ERR) { smLoad(); return; }
  const file = document.getElementById("smMediaFile");
  if (file && !file.__smBound) {
    file.__smBound = 1;
    file.addEventListener("change", () => smUpload(file.files && file.files[0]));
  }
};
