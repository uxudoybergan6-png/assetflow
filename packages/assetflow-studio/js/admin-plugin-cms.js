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

/* ── Umumiy yordamchilar (admin-website.js naqshi) ─────────── */

function pcSetPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cur[k] == null) return;
    cur = cur[k];
  }
  const last = /^\d+$/.test(parts[parts.length - 1]) ? Number(parts[parts.length - 1]) : parts[parts.length - 1];
  cur[last] = value;
}

function pcCollect() {
  const c = JSON.parse(JSON.stringify(PC_CFG));
  document.querySelectorAll("[data-pc]").forEach((el) => {
    pcSetPath(c, el.dataset.pc, el.value);
  });
  // SC_52: Home rails template ID'lari — qator/vergul bilan ajratilgan matn → massiv (≤12, tozalangan).
  document.querySelectorAll("[data-pc-rail]").forEach((el) => {
    const key = el.dataset.pcRail;
    const ids = String(el.value || "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!c.home) c.home = {};
    if (!c.home.rails) c.home.rails = {};
    if (!c.home.rails[key]) c.home.rails[key] = {};
    c.home.rails[key].templateIds = ids;
  });
  return c;
}

function pcInput(field, value, opts) {
  opts = opts || {};
  return `<input class="adx-input${opts.mono ? " mono" : ""}" data-pc="${field}" maxlength="200" value="${pcEsc(value)}"${opts.ph ? ` placeholder="${pcEsc(opts.ph)}"` : ""}${opts.style ? ` style="${opts.style}"` : ""}>`;
}

function pcArea(field, value, rows, ph) {
  return `<textarea class="adx-input" data-pc="${field}" maxlength="200" rows="${rows || 3}"${ph ? ` placeholder="${pcEsc(ph)}"` : ""}>${pcEsc(value)}</textarea>`;
}

function pcCard(title, sub, body) {
  return `<div class="adx-card" style="padding:18px 20px">
    <div class="adx-h16" style="font-size:14px;margin-bottom:${sub ? 4 : 14}px">${title}</div>
    ${sub ? `<div style="font-size:11px;color:var(--muted);margin-bottom:14px">${sub}</div>` : ""}
    ${body}
  </div>`;
}

/* ── Media preview + tugmalar (hero va AI kartalar umumiy) ─── */

function pcMediaBlock(target, mediaUrl, mediaType, hint) {
  const hasMedia = !!mediaUrl;
  const isVideo = mediaType === "video";
  // onerror → pcMediaErr: URL ochilmasa (CDN 403 / o'chirilgan fayl) buzilgan
  // <img> piktogrammasi o'rniga aniq "MEDIA UNREACHABLE" holati ko'rsatiladi.
  const thumb = hasMedia
    ? (isVideo
        ? `<video src="${pcEsc(mediaUrl)}" muted loop autoplay playsinline onerror="pcMediaErr(this)" style="width:100%;height:100%;object-fit:cover"></video>`
        : `<img src="${pcEsc(mediaUrl)}" alt="" onerror="pcMediaErr(this)" style="width:100%;height:100%;object-fit:cover">`)
    : `<span style="font:600 9px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:rgba(255,255,255,.5)">NO MEDIA</span>`;
  return `<div style="display:flex;gap:12px;align-items:center">
    <div style="width:130px;height:72px;flex:none;border-radius:9px;overflow:hidden;background:linear-gradient(138deg,#151A22,#1E2733 62%,#0C1016);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08)">${thumb}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="adx-btn2 sm" onclick="pcPickMedia('${target}')"><i class="ph ph-upload-simple"></i>${hasMedia ? "Replace media" : "Upload media"}</button>
        ${hasMedia ? `<button class="adx-btn2 sm" onclick="pcClearMedia('${target}')"><i class="ph ph-x"></i>Remove</button>` : ""}
        <span class="pc-upstat" data-pc-upstat="${target}" style="font-size:10px;color:var(--muted)"></span>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">${hint}</div>
    </div>
  </div>`;
}

/* Media URL yuklanmadi (masalan CDN allow-list hali deploy qilinmagan → 403,
   yoki fayl o'chirilgan) — buzilgan rasm ikonkasi o'rniga fallback holat. */
function pcMediaErr(el) {
  const box = el && el.parentNode;
  if (!box) return;
  box.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;color:#C79A62;text-align:center;padding:0 6px"><i class="ph ph-warning" style="font-size:15px"></i><span style="font:600 8px 'IBM Plex Mono',monospace;letter-spacing:.05em">MEDIA UNREACHABLE</span></div>`;
  box.title = "The stored media URL did not load. If it was just uploaded, the CDN may not be serving this path yet (cdn-proxy worker deploy).";
}

/* ── Asosiy view ───────────────────────────────────────────── */

/* ── SC_60/61 — jonli mini-preview (plagin paneli ko'rinishi) ───────────────── */
const PC_CAT_BUILTIN = ["Video Templates", "Motion Graphics", "Graphics", "LUTs", "Music", "SFX"];

function pcPreviewHtml(c) {
  const h = c.home.hero;
  const a = c.announcement || {};
  const annTone = a.tone === "promo" ? "background:rgba(216,255,62,.10);color:#d8ff3e;border-bottom:1px solid rgba(216,255,62,.3)"
    : a.tone === "warn" ? "background:rgba(255,178,124,.12);color:#FFB27C;border-bottom:1px solid rgba(255,178,124,.28)"
    : "background:rgba(124,196,255,.10);color:#9CCBFF;border-bottom:1px solid rgba(124,196,255,.26)";
  const ann = a.enabled && a.text
    ? `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:9.5px;${annTone}"><span style="width:5px;height:5px;border-radius:50%;background:currentColor"></span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pcEsc(a.text)}</span>${a.ctaLabel ? `<b style="border:1px solid currentColor;border-radius:99px;padding:1px 7px;font-weight:600">${pcEsc(a.ctaLabel)}</b>` : ""}<span style="opacity:.6">×</span></div>`
    : "";
  const heroBg = h.mediaUrl
    ? (h.mediaType === "video"
        ? `<video src="${pcEsc(h.mediaUrl)}" muted loop autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5"></video>`
        : `<img src="${pcEsc(h.mediaUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5">`)
    : "";
  const aiCards = (c.aiLauncher.cards || []).map((cd, i) => {
    const nm = cd.title || ["Generate image", "Generate video", "Generate audio"][i];
    const med = cd.mediaUrl
      ? (cd.mediaType === "video"
          ? `<video src="${pcEsc(cd.mediaUrl)}" muted loop autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55"></video>`
          : `<img src="${pcEsc(cd.mediaUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55">`)
      : "";
    return `<div style="position:relative;overflow:hidden;flex:1;border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:10px 8px;background:rgba(255,255,255,.03)">${med}<div style="position:relative;font:650 9px/1.2 'Inter',sans-serif;color:#F2F5F8">${pcEsc(nm)}</div><div style="position:relative;font-size:7.5px;color:rgba(255,255,255,.55);margin-top:3px">${pcEsc(cd.desc || "live models")}</div></div>`;
  }).join("");
  const tiles = (c.home.categoryTiles || []).map((t, i) => {
    const label = t.label || PC_CAT_BUILTIN[i];
    const med = t.mediaUrl
      ? (t.mediaType === "video"
          ? `<video src="${pcEsc(t.mediaUrl)}" muted loop autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6"></video>`
          : `<img src="${pcEsc(t.mediaUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6">`)
      : "";
    return `<div style="position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:7px 8px;background:rgba(255,255,255,.02)">${med}<span style="position:relative;font:600 8px/1 'Inter',sans-serif;color:#E7ECF3;text-shadow:0 1px 4px rgba(0,0,0,.6)">${pcEsc(label)}</span></div>`;
  }).join("");
  return `<div style="background:#0B0E13;border:1px solid rgba(255,255,255,.09);border-radius:13px;overflow:hidden">
    ${ann}
    <div style="position:relative;overflow:hidden;padding:18px 16px;background:linear-gradient(120deg,#12161F,#1A1430 80%)">
      ${heroBg}
      <div style="position:relative">
        <div style="font:700 7.5px 'IBM Plex Mono',monospace;letter-spacing:.1em;color:rgba(255,255,255,.55)">${pcEsc((h.kicker || "").toUpperCase())}</div>
        <div style="font:800 15px/1.2 'Inter',sans-serif;color:#F4F6FA;margin-top:5px;max-width:300px">${pcEsc(h.title)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:5px;max-width:320px">${pcEsc(h.sub)}</div>
        <div style="display:flex;gap:6px;margin-top:9px">
          <span style="padding:4px 10px;border-radius:7px;background:#d8ff3e;color:#0a0d02;font:700 8.5px 'Inter',sans-serif">${pcEsc(h.ctaPrimary)}</span>
          <span style="padding:4px 10px;border-radius:7px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#EDF1F7;font:600 8.5px 'Inter',sans-serif">${pcEsc(h.ctaSecondary)}</span>
        </div>
        <div style="margin-top:8px;border:1px solid rgba(255,255,255,.14);border-radius:99px;padding:4px 10px;font-size:8px;color:rgba(255,255,255,.45);max-width:280px">${pcEsc(h.promptPlaceholder || "Describe your next shot…")}</div>
      </div>
    </div>
    <div style="padding:10px 12px">
      <div style="font:700 8px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:rgba(255,255,255,.5);margin-bottom:6px">${pcEsc(c.aiLauncher.title || "AI Tools").toUpperCase()}</div>
      <div style="display:flex;gap:6px">${aiCards}</div>
      <div style="font:700 8px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:rgba(255,255,255,.5);margin:10px 0 6px">${pcEsc(c.home.sections.categories || "Browse by category").toUpperCase()}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${tiles}</div>
    </div>
  </div>`;
}

function pcRefreshPreview() {
  const box = document.getElementById("pcPreview");
  if (box && PC_CFG) box.innerHTML = pcPreviewHtml(pcCollect());
}

VIEWS.plugincms = function () {
  if (PC_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${pcEsc(PC_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="PC_LOAD_ERR=null;PC_LOADED=false;route('plugincms')">Try again</button></div>`;
  }
  if (!PC_LOADED || !PC_CFG) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Fetching the plugin content configuration</div></div>`;
  }
  const c = PC_CFG;
  const h = c.home.hero;
  const CARD_NAMES = ["Image", "Video", "Audio"];
  const aiCards = c.aiLauncher.cards.map((cd, i) => `
    <div class="adx-card" style="padding:14px 16px;margin-bottom:10px">
      <div style="font:700 10px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:var(--muted);margin-bottom:10px">${CARD_NAMES[i].toUpperCase()} CARD</div>
      <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-bottom:10px">
        <div>${axFlab("TITLE")}${pcInput(`aiLauncher.cards.${i}.title`, cd.title, { ph: "empty = built-in" })}</div>
        <div>${axFlab("DESCRIPTION")}${pcInput(`aiLauncher.cards.${i}.desc`, cd.desc, { ph: "empty = built-in / live models" })}</div>
      </div>
      ${pcMediaBlock(`card.${i}`, cd.mediaUrl, cd.mediaType, "Optional background media for this launcher card (shown under the text with a scrim).")}
    </div>`).join("");
  const guestFeats = c.guest.features.map((f, i) => `
    <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-bottom:8px">
      <div>${i === 0 ? axFlab("FEATURE TITLE") : ""}${pcInput(`guest.features.${i}.title`, f.title)}</div>
      <div>${i === 0 ? axFlab("FEATURE SUBTITLE") : ""}${pcInput(`guest.features.${i}.sub`, f.sub)}</div>
    </div>`).join("");
  return `
    ${axInfo(`This edits the AFTER EFFECTS PLUGIN content (Home hero, section headings, guest screen, AI launcher). Changes reach every user's plugin within ~5 minutes — no reinstall needed. Empty fields fall back to the built-in copy. Live prices and model names are NOT editable here — they come from the model catalog.`, "amber")}
    <div class="adx-grid2" style="align-items:start">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${pcCard("Home hero", "The banner at the top of the logged-in Home.", `
          <div style="margin-bottom:12px">${axFlab("KICKER (SMALL LINE ABOVE THE TITLE)")}${pcInput("home.hero.kicker", h.kicker)}</div>
          <div style="margin-bottom:12px">${axFlab("TITLE")}${pcInput("home.hero.title", h.title)}</div>
          <div style="margin-bottom:12px">${axFlab("SUBTITLE")}${pcArea("home.hero.sub", h.sub, 2)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>${axFlab("PRIMARY CTA (AI STUDIO)")}${pcInput("home.hero.ctaPrimary", h.ctaPrimary)}</div>
            <div>${axFlab("SECONDARY CTA (STOCK CATALOG)")}${pcInput("home.hero.ctaSecondary", h.ctaSecondary)}</div>
          </div>
          <div style="margin-bottom:14px">${axFlab("PROMPT PLACEHOLDER (HERO INPUT)")}${pcInput("home.hero.promptPlaceholder", h.promptPlaceholder || "", { ph: "Describe your next shot…" })}</div>
          ${axFlab("BACKGROUND MEDIA")}
          ${pcMediaBlock("hero", h.mediaUrl, h.mediaType, "Image, GIF or short video behind the hero copy. Keep it dark/subtle — the copy renders on top.")}
          <div style="margin-top:12px">${axFlab("MEDIA MODE")}
            <select class="adx-input" data-pc="home.hero.mediaMode">
              <option value="auto" ${h.mediaMode !== "media-first" ? "selected" : ""}>auto (user's last generation wins)</option>
              <option value="media-first" ${h.mediaMode === "media-first" ? "selected" : ""}>media-first (this media always shows)</option>
            </select>
          </div>`)}
        ${pcCard("Announcement bar", "A thin server-driven strip at the top of every user's plugin. Turn it on for releases, promos or maintenance notes — no reinstall needed.", `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
            <button class="adx-tog ${c.announcement.enabled ? "on" : "off"}" onclick="pcToggleAnn('enabled')"><i></i></button>
            <span style="font-size:12px;font-weight:600">${c.announcement.enabled ? "Visible in the plugin" : "Hidden"}</span>
            <span style="flex:1"></span>
            <label style="display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)">
              <button class="adx-tog ${c.announcement.dismissable !== false ? "on" : "off"}" onclick="pcToggleAnn('dismissable')"><i></i></button>
              Users can dismiss
            </label>
          </div>
          <div style="margin-bottom:10px">${axFlab("TEXT")}${pcInput("announcement.text", c.announcement.text, { ph: "e.g. New: Seedance 2.0 video is live — try it in AI Tools" })}</div>
          <div style="display:grid;grid-template-columns:110px 1fr 130px 1fr;gap:10px">
            <div>${axFlab("TONE")}
              <select class="adx-input" data-pc="announcement.tone">
                <option value="info" ${c.announcement.tone !== "promo" && c.announcement.tone !== "warn" ? "selected" : ""}>info (blue)</option>
                <option value="promo" ${c.announcement.tone === "promo" ? "selected" : ""}>promo (lime)</option>
                <option value="warn" ${c.announcement.tone === "warn" ? "selected" : ""}>warn (amber)</option>
              </select>
            </div>
            <div>${axFlab("CTA LABEL (OPTIONAL)")}${pcInput("announcement.ctaLabel", c.announcement.ctaLabel, { ph: "Open AI Tools" })}</div>
            <div>${axFlab("CTA TARGET")}
              <select class="adx-input" data-pc="announcement.ctaAction">
                <option value="" ${!c.announcement.ctaAction ? "selected" : ""}>— none —</option>
                <option value="aistudio" ${c.announcement.ctaAction === "aistudio" ? "selected" : ""}>AI Tools</option>
                <option value="catalog" ${c.announcement.ctaAction === "catalog" ? "selected" : ""}>Stock Catalog</option>
                <option value="home" ${c.announcement.ctaAction === "home" ? "selected" : ""}>Home</option>
              </select>
            </div>
            <div>${axFlab("ANNOUNCEMENT ID")}${pcInput("announcement.id", c.announcement.id, { mono: true, ph: "release-1.2 (new id → re-shows)" })}</div>
          </div>`)}
        ${pcCard("Section headings", "Headings of the Home sections.", `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>${axFlab("RECENT WORKS")}${pcInput("home.sections.recent", c.home.sections.recent)}</div>
            <div>${axFlab("CONTINUE A SESSION")}${pcInput("home.sections.continueSessions", (c.home.sections.continueSessions) || "Continue a session")}</div>
            <div>${axFlab("EXPLORE")}${pcInput("home.sections.explore", (c.home.sections.explore) || "Explore")}</div>
            <div>${axFlab("BROWSE BY CATEGORY")}${pcInput("home.sections.categories", (c.home.sections.categories) || "Browse by category")}</div>
          </div>`)}
        ${pcCard("Category tiles (6)", "The “Browse by category” tiles on Home. Custom label + optional background media per tile (targets are fixed). Empty label keeps the built-in name.", (c.home.categoryTiles || []).map((t, i) => `
          <div class="adx-card" style="padding:12px;margin-bottom:8px">
            <div style="font:700 9px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:var(--muted);margin-bottom:8px">TILE ${i + 1} · ${pcEsc(PC_CAT_BUILTIN[i] || "")}</div>
            <div style="margin-bottom:8px">${pcInput(`home.categoryTiles.${i}.label`, t.label, { ph: "empty = " + (PC_CAT_BUILTIN[i] || "built-in") })}</div>
            ${pcMediaBlock(`cat.${i}`, t.mediaUrl, t.mediaType, "Optional tile background (image/GIF/short video) with a dark scrim.")}
          </div>`).join(""))}
        ${pcCard("Home rails", "Two admin-curated, auto-scrolling template rails on Home (plugin + web). Paste template IDs — one per line (or comma-separated), max 12 each, in the order they should appear. IDs that no longer exist or are unpublished are skipped; an empty rail is hidden.", `
          <div style="margin-bottom:14px">
            <div style="margin-bottom:8px">${axFlab("NEW RELEASES — RAIL TITLE")}${pcInput("home.rails.newReleases.title", (c.home.rails && c.home.rails.newReleases && c.home.rails.newReleases.title) || "New releases")}</div>
            ${axFlab("NEW RELEASES — TEMPLATE IDS (ONE PER LINE, MAX 12)")}
            <textarea class="adx-input mono" data-pc-rail="newReleases" rows="4" placeholder="cmxxxxxxx0001\ncmxxxxxxx0002">${pcEsc(((c.home.rails && c.home.rails.newReleases && c.home.rails.newReleases.templateIds) || []).join("\\n"))}</textarea>
          </div>
          <div>
            <div style="margin-bottom:8px">${axFlab("TOP TEMPLATES — RAIL TITLE")}${pcInput("home.rails.topTemplates.title", (c.home.rails && c.home.rails.topTemplates && c.home.rails.topTemplates.title) || "Top templates")}</div>
            ${axFlab("TOP TEMPLATES — TEMPLATE IDS (ONE PER LINE, MAX 12)")}
            <textarea class="adx-input mono" data-pc-rail="topTemplates" rows="4" placeholder="cmxxxxxxx0003\ncmxxxxxxx0004">${pcEsc(((c.home.rails && c.home.rails.topTemplates && c.home.rails.topTemplates.templateIds) || []).join("\\n"))}</textarea>
          </div>`)}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${pcCard("Live preview", "A compact mock of the plugin panel — updates as you type (announcement, hero, AI cards, category tiles).", `<div id="pcPreview">${pcPreviewHtml(c)}</div>`)}
        ${pcCard("Guest screen", "What signed-out users see. Line breaks in the title/subtitle are kept.", `
          <div style="margin-bottom:12px">${axFlab("TITLE (\\n = LINE BREAK)")}${pcArea("guest.title", c.guest.title, 2)}</div>
          <div style="margin-bottom:12px">${axFlab("SUBTITLE")}${pcArea("guest.sub", c.guest.sub, 2)}</div>
          <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:10px;margin-bottom:12px">
            <div>${axFlab("PEEK SECTION KICKER")}${pcInput("guest.peekKicker", c.guest.peekKicker || "", { ph: "A PEEK AT THE CATALOG" })}</div>
            <div>${axFlab("REGISTER NOTE")}${pcInput("guest.registerNote", c.guest.registerNote || "", { ph: "New here? Create a free account…" })}</div>
          </div>
          ${axFlab("FEATURES (3)")}
          ${guestFeats}`)}
        ${pcCard("AI Tools launcher", "The AI Tools landing screen. Empty card fields keep the plugin's built-in text / live model names.", `
          <div style="margin-bottom:12px">${axFlab("SCREEN TITLE")}${pcInput("aiLauncher.title", c.aiLauncher.title)}</div>
          ${aiCards}`)}
      </div>
    </div>
    <input type="file" id="pcMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

/* SC_61 — announcement bool kalitlari (enabled/dismissable) */
function pcToggleAnn(key) {
  PC_CFG = pcCollect();
  if (!PC_CFG.announcement) PC_CFG.announcement = { enabled: false, id: "", tone: "info", text: "", ctaLabel: "", ctaAction: "", dismissable: true };
  PC_CFG.announcement[key] = key === "dismissable" ? PC_CFG.announcement.dismissable === false : !PC_CFG.announcement[key];
  PC_DIRTY = true;
  route("plugincms");
  pcRenderActions();
}

/* ── Amallar ───────────────────────────────────────────────── */

let PC_PICK = null; // 'hero' | 'card.<i>'
function pcPickMedia(target) {
  PC_PICK = target;
  const inp = document.getElementById("pcMediaFile");
  if (inp) { inp.value = ""; inp.click(); }
}

function pcMediaRef(cfg, target) {
  if (target === "hero") return cfg.home.hero;
  const mc = /^card\.(\d)$/.exec(target);
  if (mc) return cfg.aiLauncher.cards[Number(mc[1])];
  // SC_60 — kategoriya tayli media slotlari
  const mt = /^cat\.(\d)$/.exec(target);
  if (mt) {
    if (!Array.isArray(cfg.home.categoryTiles)) cfg.home.categoryTiles = [];
    while (cfg.home.categoryTiles.length <= Number(mt[1])) cfg.home.categoryTiles.push({ label: "", mediaUrl: "", mediaType: "" });
    return cfg.home.categoryTiles[Number(mt[1])];
  }
  return null;
}

function pcClearMedia(target) {
  PC_CFG = pcCollect();
  const ref = pcMediaRef(PC_CFG, target);
  if (ref) { ref.mediaUrl = ""; ref.mediaType = ""; }
  PC_DIRTY = true;
  route("plugincms");
  pcRenderActions();
}

/* Media yuklash: presigned PUT (folder=site/plugin) → publicUrl konfigga yoziladi */
async function pcUploadMedia(file) {
  const target = PC_PICK;
  if (!target || !file) return;
  const stat = document.querySelector(`[data-pc-upstat="${target}"]`);
  const isVideo = /^video\//.test(file.type);
  const cap = isVideo ? 150 : 40; // server bilan mos: rasm/GIF 40MB, video 150MB
  if (file.size > cap * 1024 * 1024) {
    toast("Too large", `${isVideo ? "Video" : "Image/GIF"} media should be under ${cap} MB (short loops work best)`, "warn");
    return;
  }
  try {
    if (stat) stat.textContent = "Uploading…";
    const u = await StudioApi.adminUploadUrl(file.name, file.type || "application/octet-stream", "site/plugin", file.size);
    if (!u.uploadUrl) {
      toast("Storage not configured", u.message || "S3/R2 is not configured on the server", "warn");
      if (stat) stat.textContent = "";
      return;
    }
    const res = await fetch(u.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    PC_CFG = pcCollect();
    const ref = pcMediaRef(PC_CFG, target);
    if (ref) { ref.mediaUrl = u.publicUrl; ref.mediaType = isVideo ? "video" : "image"; }
    PC_DIRTY = true;
    toast("Media uploaded", "Don't forget to press Save to publish it to the plugin", "success");
    route("plugincms");
    pcRenderActions();
  } catch (e) {
    if (stat) stat.textContent = "";
    toast("Upload error", e.message || "Failed to upload", "warn");
  }
}

async function pcSave() {
  PC_CFG = pcCollect();
  try {
    // Bo'lim-darajada PUT — server section-level merge qiladi (Website naqshi)
    const d = await StudioApi.savePluginContentConfig({
      home: PC_CFG.home,
      guest: PC_CFG.guest,
      aiLauncher: PC_CFG.aiLauncher,
      announcement: PC_CFG.announcement,
    });
    PC_CFG = d.config;
    PC_DIRTY = false;
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
  const view = document.getElementById("view");
  if (view && !view.__pcBound) {
    view.__pcBound = 1;
    // input (matn) + change (select) — dirty holat + jonli preview
    const markDirty = (e) => {
      if (e.target && (e.target.matches("[data-pc]") || e.target.matches("[data-pc-rail]")) && CURRENT === "plugincms") {
        if (!PC_DIRTY) { PC_DIRTY = true; pcRenderActions(); }
        pcRefreshPreview();
      }
    };
    view.addEventListener("input", markDirty);
    view.addEventListener("change", markDirty);
  }
  const file = document.getElementById("pcMediaFile");
  if (file && !file.__pcBound) {
    file.__pcBound = 1;
    file.addEventListener("change", () => pcUploadMedia(file.files && file.files[0]));
  }
};
