/* ============================================================
   AssetFlow — Plugin CMS (admin "Plugin CMS" tab)
   AE plagin UI kontenti: Home hero (matn + fon media), bo'lim
   sarlavhalari, guest ekran, AI Tools launcher kartalari.
   Manba: /api/admin/plugin-content-config (SC_01 backend).
   Media upload: folder "site/plugin" (image/* yoki mp4/webm).
   Pul mantig'iga tegilmaydi — sxemada narx maydonlari YO'Q.
   ============================================================ */

let PC_CFG = null;      // joriy (merged) konfiguratsiya — forma shu ustida ishlaydi
let PC_DEFAULTS = null; // server defaultlari (hint ko'rsatish uchun)
let PC_LOADED = false;
let PC_LOAD_ERR = null;
let PC_DIRTY = false;   // saqlanmagan tahrir bor-yo'qligi

function pcEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function pcLoadConfig(force) {
  if (PC_LOADED && !force) return;
  try {
    const d = await StudioApi.getPluginContentConfig();
    PC_CFG = d.config;
    PC_DEFAULTS = d.defaults;
    PC_LOADED = true;
    PC_LOAD_ERR = null;
    PC_DIRTY = false;
  } catch (e) {
    PC_LOAD_ERR = e.message || "Failed to load";
  }
  if (CURRENT === "plugincms") route("plugincms");
}

/* Forma yordamchilari (pcSetPath / pcCollect / pcInput / pcCard / pcPreviewHtml…)
   OLIB TASHLANDI — plagin CMS endi admin-website.js dagi vizual muharrirni
   ishlatadi (wsCollect / wsAutoFields / wsDesignPanel), alohida forma yo'q. */

/* ══════════════════════════════════════════════════════════════════════════
   PLAGIN CMS — vizual muharrir (admin-website.js dagi bilan AYNI dvigatel).
   Chapda REAL plagin paneli iframe'da (/admin/plugin-preview/…?ffcms=1),
   o'ngda kontekst inspektor: Kontent / Dizayn / Sahifa. Forma-tablar yo'q.
   ══════════════════════════════════════════════════════════════════════════ */
VIEWS.plugincms = function () {
  if (PC_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${pcEsc(PC_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="PC_LOAD_ERR=null;PC_LOADED=false;route('plugincms')">Try again</button></div>`;
  }
  if (!PC_LOADED || !PC_CFG) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Fetching the plugin content configuration</div></div>`;
  }
  wsSurfaceEnter("plugin");
  return `${wsTabVisual()}
    <input type="file" id="wsMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

/* ── Amallar ───────────────────────────────────────────────── */


async function pcSave() {
  PC_CFG = wsCollect();
  try {
    // Bo'lim-darajada PUT — server section-level merge qiladi (Website naqshi)
    const d = await StudioApi.savePluginContentConfig({
      home: PC_CFG.home,
      guest: PC_CFG.guest,
      aiLauncher: PC_CFG.aiLauncher,
      announcement: PC_CFG.announcement,
      // v3 — vizual muharrir qatlami: uslub overridelari + bildirishnomalar
      uiStyles: PC_CFG.uiStyles || {}, notices: PC_CFG.notices || [],
    });
    PC_CFG = d.config;
    PC_DIRTY = false;
    WS_UNDO.length = 0; WS_REDO.length = 0;
    AssetFlowLog.info("Plugin CMS saved", { action: "plugin_content_save", detail: "Plugin CMS tab" });
    toast("Saved", "Plugins pick the change up within ~5 minutes", "success");
    if (CURRENT === "plugincms") { route("plugincms"); pcRenderActions(); }
  } catch (e) {
    toast("Save failed", e.message || "Server error", "warn");
  }
}

async function pcReset() {
  // D6 (#12) — xom confirm() o'rniga dizayn tizimidagi tasdiq modali (afConfirm, ui.js)
  if (!(await afConfirm({
    title: "Reset plugin content",
    sub: "Hero, headings, guest screen and AI launcher return to the built-in copy.",
    warn: "This cannot be undone — your edited plugin copy is replaced by the defaults.",
    body: "Uploaded media links are removed from the page (the files stay in storage).",
    okLabel: "Reset content",
  }))) return;
  try {
    const d = await StudioApi.resetPluginContentConfig();
    PC_CFG = d.config;
    PC_DIRTY = false;
    AssetFlowLog.info("Plugin CMS reset", { action: "plugin_content_reset", detail: "Plugin CMS tab" });
    toast("Reset", "Plugin content restored to defaults", "success");
    if (CURRENT === "plugincms") { route("plugincms"); pcRenderActions(); }
  } catch (e) {
    toast("Reset failed", e.message || "Server error", "warn");
  }
}

/* Dirty-state ko'rsatkichli header tugmalar */
function pcRenderActions() {
  const tba = document.getElementById("tbActions");
  if (!tba || CURRENT !== "plugincms") return;
  tba.innerHTML =
    (PC_DIRTY ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:10.5px;color:#FFB27C;margin-right:6px"><i class="ph ph-circle-fill" style="font-size:7px"></i>Unsaved changes</span>` : "") +
    `<button class="adx-btn2 sm" onclick="cmsHistoryOpen('plugin')"><i class="ph ph-clock-counter-clockwise"></i>History</button>` +
    `<button class="adx-btn2 sm" onclick="pcReset()"><i class="ph ph-arrow-counter-clockwise"></i>Reset to defaults</button>` +
    `<button class="adx-btn sm" onclick="pcSave()"><i class="ph ph-check"></i>Save & publish</button>`;
}

window.afterRender.plugincms = function () {
  pcRenderActions();
  if (!PC_LOADED) { pcLoadConfig(); return; }
  // Muharrir qobig'i Website bilan bir xil (wsEditorBoot): iframe handshake,
  // draft push, media input. Farqi — dirty ko'rsatkichi plagin toolbar'ida.
  wsEditorBoot();
  const view = document.getElementById("view");
  if (view && !view.__pcDirty) {
    view.__pcDirty = 1;
    const markDirty = (e) => {
      if (CURRENT !== "plugincms") return;
      if (e.target && e.target.matches && e.target.matches("[data-ws]") && !PC_DIRTY) {
        PC_DIRTY = true; pcRenderActions();
      }
    };
    view.addEventListener("input", markDirty);
    view.addEventListener("change", markDirty);
  }
};
