/* ============================================================
   AssetFlow — Website / Landing CMS (admin "Website" tab)
   Ommaviy landing (getframeflow.app) kontenti + teması: hero matnlari,
   nav/CTA yorliqlari, preview-mockup kartalari (media), stats qatori,
   accent rang va font. Manba: /api/admin/landing-config (server DB).
   ============================================================ */

let WS_CFG = null;      // joriy (merged) konfiguratsiya — forma shu ustida ishlaydi
let WS_DEFAULTS = null; // server defaultlari (reset ko'rsatkichi uchun)
let WS_LOADED = false;
let WS_LOAD_ERR = null;

function wsEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Landing'dagi 6 preview-karta o'rni (tartib platformadagi resgrid bilan AYNI) */
const WS_CARD_SLOTS = [
  { hint: "Square card 1 — top row, left", grad: "linear-gradient(138deg,#20153A,#8F4FD1 62%,#0F0A1C)" },
  { hint: "Square card 2 — top row", grad: "linear-gradient(138deg,#3A2A12,#BE8428 62%,#171006)" },
  { hint: "Square card 3 — after the generating slot", grad: "linear-gradient(138deg,#0F312C,#1F7A5F 62%,#08150F)" },
  { hint: "Wide video card — bottom row", grad: "linear-gradient(138deg,#2A1E49,#6C3FA8 62%,#130E24)", wide: true },
  { hint: "Template card A — bottom row", grad: "linear-gradient(138deg,#1A2A4E,#33549E 62%,#0C1220)" },
  { hint: "Template card B — bottom row", grad: "linear-gradient(138deg,#0E2A3A,#2596A8 62%,#06141B)" },
];

const WS_ACCENT_PRESETS = [
  { hex: "#C2F04A", name: "Lime (default)" },
  { hex: "#5BE8E0", name: "Cyan" },
  { hex: "#F5B54A", name: "Amber" },
  { hex: "#B794F6", name: "Violet" },
  { hex: "#FF7A6B", name: "Coral" },
];

/* Kuratsiyalangan, o'z-serverda turadigan fontlar (landing'dagi ro'yxat bilan AYNI) */
const WS_FONTS = [
  { key: "hanken", label: "Hanken Grotesk (default)", stack: "'Hanken Grotesk',system-ui,sans-serif" },
  { key: "system", label: "System UI", stack: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" },
  { key: "plex-mono", label: "IBM Plex Mono", stack: "'IBM Plex Mono',ui-monospace,monospace" },
  { key: "georgia", label: "Georgia (serif)", stack: "Georgia,'Times New Roman',serif" },
];

async function wsLoadConfig(force) {
  if (WS_LOADED && !force) return;
  try {
    const d = await StudioApi.getLandingConfig();
    WS_CFG = d.config;
    WS_DEFAULTS = d.defaults;
    WS_LOADED = true;
    WS_LOAD_ERR = null;
  } catch (e) {
    WS_LOAD_ERR = e.message || "Failed to load";
  }
  if (CURRENT === "website") route("website");
}

function wsInput(field, value, opts) {
  opts = opts || {};
  return `<input class="adx-input ws-inp${opts.mono ? " mono" : ""}" data-ws="${field}" value="${wsEsc(value)}"${opts.type ? ` type="${opts.type}"` : ""}${opts.min != null ? ` min="${opts.min}"` : ""}${opts.ph ? ` placeholder="${wsEsc(opts.ph)}"` : ""}>`;
}

function wsCardEditor(c, i) {
  const slot = WS_CARD_SLOTS[i];
  const hasMedia = !!c.mediaUrl;
  const isVideo = c.mediaType === "video";
  const thumb = hasMedia
    ? (isVideo
        ? `<video src="${wsEsc(c.mediaUrl)}" muted loop autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>`
        : `<img src="${wsEsc(c.mediaUrl)}" alt="" style="width:100%;height:100%;object-fit:cover">`)
    : `<span style="font:600 9px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:rgba(255,255,255,.65)">GRADIENT</span>`;
  return `<div class="adx-card" style="padding:14px" data-ws-card="${i}">
    <div style="font-size:10px;color:#8A93A3;margin-bottom:8px">${wsEsc(slot.hint)}</div>
    <div style="display:flex;gap:12px">
      <div style="width:${slot.wide ? 150 : 92}px;height:64px;flex:none;border-radius:9px;overflow:hidden;background:${slot.grad};display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08)">${thumb}</div>
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 76px;gap:8px">
        <div>${axFlab("LABEL")}${wsInput(`card.${i}.label`, c.label, { mono: true })}</div>
        <div>${axFlab("DURATION")}${wsInput(`card.${i}.dur`, c.dur, { mono: true, ph: "—" })}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
      <button class="adx-btn2 sm" onclick="wsPickMedia(${i})"><i class="ph ph-upload-simple"></i>${hasMedia ? "Replace media" : "Upload media"}</button>
      ${hasMedia ? `<button class="adx-btn2 sm" onclick="wsClearMedia(${i})"><i class="ph ph-x"></i>Remove (use gradient)</button>` : `<span style="font-size:10px;color:#8A93A3">No media — the landing shows the gradient placeholder</span>`}
      <span class="ws-upstat" data-ws-upstat="${i}" style="font-size:10px;color:#8A93A3"></span>
    </div>
  </div>`;
}

function wsThemeSection() {
  const t = WS_CFG.theme;
  const swatches = WS_ACCENT_PRESETS.map((p) =>
    `<button class="ws-swatch" title="${wsEsc(p.name)}" onclick="wsSetAccent('${p.hex}')" style="width:30px;height:30px;border-radius:8px;background:${p.hex};border:2px solid ${t.accent.toUpperCase() === p.hex.toUpperCase() ? "#fff" : "transparent"};cursor:pointer"></button>`
  ).join("");
  const fontOpts = WS_FONTS.map((f) => `<option value="${f.key}" ${t.font === f.key ? "selected" : ""}>${f.label}</option>`).join("");
  const stack = (WS_FONTS.find((f) => f.key === t.font) || WS_FONTS[0]).stack;
  return `<div class="adx-card" style="padding:18px 20px">
    <div class="adx-h16" style="font-size:14px;margin-bottom:4px">Theme</div>
    <div style="font-size:11px;color:#8A93A3;margin-bottom:14px">Accent color and font apply to the marketing pages (landing, pricing, plugin). The app UI keeps the default theme.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        ${axFlab("ACCENT COLOR")}
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${swatches}
          <input type="color" data-ws-accent-pick value="${wsEsc(t.accent)}" onchange="wsSetAccent(this.value)" style="width:34px;height:34px;padding:0;border:1px solid var(--line,#2A3140);border-radius:8px;background:transparent;cursor:pointer">
          <input class="adx-input mono" data-ws="theme.accent" value="${wsEsc(t.accent)}" style="width:96px" oninput="wsAccentTyped(this.value)">
        </div>
      </div>
      <div>
        ${axFlab("FONT (SELF-HOSTED SET)")}
        <select class="adx-input" data-ws="theme.font" onchange="wsRefreshPreview()">${fontOpts}</select>
        <div style="font-family:${stack};font-size:13px;color:#8A93A3;margin-top:8px" data-ws-fontdemo>Aa Bb Cc — Templates, AI video and audio</div>
      </div>
    </div>
  </div>`;
}

/* Jonli mini-preview — forma qiymatlaridan hero + stats ko'rinishi (saqlashsiz) */
function wsPreviewHtml(c) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(c.theme.accent) ? c.theme.accent : "#C2F04A";
  const stack = (WS_FONTS.find((f) => f.key === c.theme.font) || WS_FONTS[0]).stack;
  const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
  const onAcc = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.55 ? "#0E1400" : "#fff";
  const stats = c.stats.map((s) => {
    const isWord = /[a-zA-Z]/.test(s.suffix || "");
    const n = Number(s.value) || 0;
    return `<div style="text-align:center"><div style="font:700 17px 'IBM Plex Mono',monospace;color:#F2F5F8">${n >= 1000 ? n.toLocaleString("en-US") : n}${isWord ? `<span style="font-size:12px"> ${wsEsc(s.suffix)}</span>` : `<span style="color:${accent}">${wsEsc(s.suffix)}</span>`}</div><div style="font-size:9.5px;color:#8A93A3;margin-top:2px">${wsEsc(s.label)}</div></div>`;
  }).join("");
  return `<div style="background:radial-gradient(120% 160% at 50% -20%,#12161d,#07090c 70%);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:26px 22px;text-align:center;font-family:${stack}">
    <span style="display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:10.5px;color:#B7C0CE"><b style="font:700 7.5px 'IBM Plex Mono',monospace;letter-spacing:.1em;padding:2px 6px;border-radius:4px;background:${accent};color:${onAcc}">${wsEsc(c.hero.badgeTag)}</b>${wsEsc(c.hero.badgeText)}</span>
    <div style="font-weight:700;font-size:25px;letter-spacing:-.03em;color:#F2F5F8;margin-top:12px;line-height:1.15">${wsEsc(c.hero.title)} <span style="background:linear-gradient(92deg,${accent} 10%,#7CC4FF 90%);-webkit-background-clip:text;background-clip:text;color:transparent">${wsEsc(c.hero.titleAccent)}</span></div>
    <div style="font-size:11.5px;color:#8A93A3;max-width:430px;margin:9px auto 0;line-height:1.55">${wsEsc(c.hero.sub)}</div>
    <div style="display:flex;gap:9px;justify-content:center;margin-top:14px">
      <span style="display:inline-flex;align-items:center;height:32px;padding:0 16px;border-radius:99px;background:${accent};color:${onAcc};font-weight:700;font-size:11px">${wsEsc(c.hero.ctaPrimary)}</span>
      <span style="display:inline-flex;align-items:center;height:32px;padding:0 15px;border-radius:99px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#F2F5F8;font-weight:600;font-size:11px">${wsEsc(c.hero.ctaSecondary)}</span>
    </div>
    <div style="font-size:9.5px;color:#8A93A3;margin-top:10px">${wsEsc(c.hero.credline)}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;border-top:1px solid rgba(255,255,255,.06);margin-top:18px;padding-top:14px">${stats}</div>
  </div>`;
}

VIEWS.website = function () {
  if (WS_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${wsEsc(WS_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="WS_LOAD_ERR=null;WS_LOADED=false;route('website')">Try again</button></div>`;
  }
  if (!WS_LOADED || !WS_CFG) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Fetching the landing configuration</div></div>`;
  }
  const c = WS_CFG;
  const navFields = [
    ["nav.templates", "TEMPLATES LINK", c.nav.templates], ["nav.aiStudio", "AI STUDIO LINK", c.nav.aiStudio],
    ["nav.pricing", "PRICING LINK", c.nav.pricing], ["nav.plugin", "PLUGIN LINK", c.nav.plugin],
    ["nav.signIn", "SIGN-IN BUTTON", c.nav.signIn], ["nav.cta", "NAV CTA BUTTON", c.nav.cta],
  ].map(([f, l, v]) => `<div>${axFlab(l)}${wsInput(f, v)}</div>`).join("");
  const statRows = c.stats.map((s, i) => `
    <div style="display:grid;grid-template-columns:110px 90px 1fr;gap:10px;margin-bottom:10px">
      <div>${i === 0 ? axFlab("VALUE") : ""}${wsInput(`stat.${i}.value`, s.value, { mono: true, type: "number", min: 0 })}</div>
      <div>${i === 0 ? axFlab("SUFFIX") : ""}${wsInput(`stat.${i}.suffix`, s.suffix, { mono: true, ph: "+ / days" })}</div>
      <div>${i === 0 ? axFlab("CAPTION") : ""}${wsInput(`stat.${i}.label`, s.label)}</div>
    </div>`).join("");
  return `
    ${axInfo(`This edits the PUBLIC landing page. Changes go live within ~1 minute of saving (the landing caches the config briefly). "Reset to defaults" restores the original built-in content.`, "amber")}
    <div class="adx-grid2" style="align-items:start">
      <div style="display:flex;flex-direction:column;gap:16px">
        ${wsThemeSection()}
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:14px">Hero</div>
          <div style="display:grid;grid-template-columns:90px 1fr;gap:12px;margin-bottom:12px">
            <div>${axFlab("BADGE TAG")}${wsInput("hero.badgeTag", c.hero.badgeTag, { mono: true })}</div>
            <div>${axFlab("BADGE TEXT")}${wsInput("hero.badgeText", c.hero.badgeText)}</div>
          </div>
          <div style="margin-bottom:12px">${axFlab("HEADLINE")}${wsInput("hero.title", c.hero.title)}</div>
          <div style="margin-bottom:12px">${axFlab("HEADLINE ACCENT (GRADIENT PART)")}${wsInput("hero.titleAccent", c.hero.titleAccent)}</div>
          <div style="margin-bottom:12px">${axFlab("SUBHEADLINE")}<textarea class="adx-input ws-inp" data-ws="hero.sub" rows="3">${wsEsc(c.hero.sub)}</textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>${axFlab("PRIMARY CTA")}${wsInput("hero.ctaPrimary", c.hero.ctaPrimary)}</div>
            <div>${axFlab("SECONDARY CTA")}${wsInput("hero.ctaSecondary", c.hero.ctaSecondary)}</div>
          </div>
          <div>${axFlab("CREDIT LINE (UNDER CTAS)")}${wsInput("hero.credline", c.hero.credline)}</div>
        </div>
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:14px">Navigation labels</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${navFields}</div>
        </div>
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:4px">Stats row</div>
          <div style="font-size:11px;color:#8A93A3;margin-bottom:14px">Four counters under the hero. Suffix: a symbol ("+") renders in the accent color, a word ("days") renders as a unit.</div>
          ${statRows}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:4px">Live preview</div>
          <div style="font-size:11px;color:#8A93A3;margin-bottom:12px">Updates as you type — this is how the hero and stats will look.</div>
          <div id="wsPreview">${wsPreviewHtml(c)}</div>
        </div>
        <div class="adx-card" style="padding:18px 20px">
          <div class="adx-h16" style="font-size:14px;margin-bottom:4px">Preview mockup cards</div>
          <div style="font-size:11px;color:#8A93A3;margin-bottom:12px">The "AI Studio" window in the hero. Upload real media (image or short video) into each card — empty cards keep their gradient.</div>
          <div style="display:grid;grid-template-columns:60px 1fr;gap:12px;margin-bottom:12px">
            <div>${axFlab("BADGE")}${wsInput("mockup.badge", c.mockup.badge, { mono: true })}</div>
            <div>${axFlab("WINDOW TITLE")}${wsInput("mockup.title", c.mockup.title, { mono: true })}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">${c.mockup.cards.map(wsCardEditor).join("")}</div>
        </div>
      </div>
    </div>
    <input type="file" id="wsMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

/* Formadan to'liq konfiguratsiya yig'ish (data-ws atributlari bo'yicha) */
function wsCollect() {
  const c = JSON.parse(JSON.stringify(WS_CFG));
  document.querySelectorAll("[data-ws]").forEach((el) => {
    const path = el.dataset.ws.split(".");
    const v = el.value;
    if (path[0] === "card") {
      c.mockup.cards[Number(path[1])][path[2]] = path[2] === "label" ? v.slice(0, 24) : v.slice(0, 12);
    } else if (path[0] === "stat") {
      const st = c.stats[Number(path[1])];
      if (path[2] === "value") st.value = Math.max(0, Math.floor(Number(v) || 0));
      else st[path[2]] = v.slice(0, path[2] === "suffix" ? 12 : 120);
    } else if (path.length === 2) {
      c[path[0]][path[1]] = v;
    }
  });
  return c;
}

function wsRefreshPreview() {
  const box = document.getElementById("wsPreview");
  if (box) {
    WS_CFG = wsCollect();
    box.innerHTML = wsPreviewHtml(WS_CFG);
    const demo = document.querySelector("[data-ws-fontdemo]");
    if (demo) demo.style.fontFamily = (WS_FONTS.find((f) => f.key === WS_CFG.theme.font) || WS_FONTS[0]).stack;
  }
}

function wsSetAccent(hex) {
  WS_CFG = wsCollect();
  WS_CFG.theme.accent = hex;
  route("website");
}

function wsAccentTyped(v) {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    const pick = document.querySelector("[data-ws-accent-pick]");
    if (pick) pick.value = v;
    wsRefreshPreview();
  }
}

let WS_PICK_IDX = null;
function wsPickMedia(i) {
  WS_PICK_IDX = i;
  const inp = document.getElementById("wsMediaFile");
  if (inp) { inp.value = ""; inp.click(); }
}

function wsClearMedia(i) {
  WS_CFG = wsCollect();
  WS_CFG.mockup.cards[i].mediaUrl = "";
  WS_CFG.mockup.cards[i].mediaType = "";
  route("website");
}

/* Media yuklash: presigned PUT (folder=landing) → publicUrl kartaga yoziladi */
async function wsUploadMedia(file) {
  const i = WS_PICK_IDX;
  if (i == null || !file) return;
  const stat = document.querySelector(`[data-ws-upstat="${i}"]`);
  const isVideo = /^video\//.test(file.type);
  if (file.size > 25 * 1024 * 1024) {
    toast("Too large", "Landing media should be under 25 MB (short loops work best)", "warn");
    return;
  }
  try {
    if (stat) stat.textContent = "Uploading…";
    const u = await StudioApi.adminUploadUrl(file.name, file.type || "application/octet-stream", "landing");
    if (!u.uploadUrl) {
      toast("Storage not configured", u.message || "S3/R2 is not configured on the server", "warn");
      if (stat) stat.textContent = "";
      return;
    }
    const res = await fetch(u.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    WS_CFG = wsCollect();
    WS_CFG.mockup.cards[i].mediaUrl = u.publicUrl;
    WS_CFG.mockup.cards[i].mediaType = isVideo ? "video" : "image";
    toast("Media uploaded", "Don't forget to press Save to publish it to the landing", "success");
    route("website");
  } catch (e) {
    if (stat) stat.textContent = "";
    toast("Upload error", e.message || "Failed to upload", "warn");
  }
}

async function wsSave() {
  WS_CFG = wsCollect();
  const accent = String(WS_CFG.theme.accent || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) {
    toast("Invalid color", "Accent must be a #RRGGBB hex value", "warn");
    return;
  }
  try {
    const d = await StudioApi.saveLandingConfig({
      theme: { accent, font: WS_CFG.theme.font },
      nav: WS_CFG.nav,
      hero: WS_CFG.hero,
      mockup: WS_CFG.mockup,
      stats: WS_CFG.stats,
    });
    WS_CFG = d.config;
    AssetFlowLog.info("Landing saved", { action: "landing_save", detail: "Website tab" });
    toast("Saved", "The public landing will reflect the changes within ~1 minute", "success");
    if (CURRENT === "website") route("website");
  } catch (e) {
    toast("Save failed", e.message || "Server error", "warn");
  }
}

async function wsReset() {
  if (!confirm("Reset the landing to the original built-in content? Uploaded card media links will be removed from the page (files stay in storage).")) return;
  try {
    const d = await StudioApi.resetLandingConfig();
    WS_CFG = d.config;
    AssetFlowLog.info("Landing reset", { action: "landing_reset", detail: "Website tab" });
    toast("Reset", "Landing restored to defaults", "success");
    if (CURRENT === "website") route("website");
  } catch (e) {
    toast("Reset failed", e.message || "Server error", "warn");
  }
}

window.afterRender.website = function () {
  const tba = document.getElementById("tbActions");
  if (tba && CURRENT === "website") {
    tba.innerHTML =
      `<button class="adx-btn2 sm" onclick="wsReset()"><i class="ph ph-arrow-counter-clockwise"></i>Reset to defaults</button>` +
      `<button class="adx-btn sm" onclick="wsSave()"><i class="ph ph-check"></i>Save & publish</button>`;
  }
  if (!WS_LOADED) { wsLoadConfig(); return; }
  const view = document.getElementById("view");
  if (view && !view.__wsBound) {
    view.__wsBound = 1;
    view.addEventListener("input", (e) => { if (e.target && e.target.matches("[data-ws]")) wsRefreshPreview(); });
  }
  const file = document.getElementById("wsMediaFile");
  if (file) file.addEventListener("change", () => wsUploadMedia(file.files && file.files[0]));
};
