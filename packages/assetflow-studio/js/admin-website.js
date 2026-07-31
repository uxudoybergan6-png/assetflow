/* ============================================================
   AssetFlow — Website / Site CMS (admin "Website" tab)
   Butun marketing sayt kontenti + teması: LANDING (barcha bo'limlar,
   tartib + ko'rinish), PRICING sahifa, PLUGIN sahifa, FOOTER, theme
   (accent/font), hero mockup media. Manba: /api/admin/landing-config.
   Pul mantig'iga tegilmaydi — tarif qiymatlari faqat DISPLAY nusxasi.
   ============================================================ */

let WS_CFG = null;      // joriy (merged) konfiguratsiya — forma shu ustida ishlaydi
let WS_DEFAULTS = null; // server defaultlari (reset ko'rsatkichi uchun)
let WS_LOADED = false;
let WS_LOAD_ERR = null;
let WS_TAB = "hero";    // hero | landing | pricing | plugin | footer

function wsEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* v2 — feed slotlari uchun ko'rsatma gradientlar (platformadagi masonry bilan uyg'un) */
const WS_FEED_GRADS = [
  "linear-gradient(138deg,#20153A,#8F4FD1 62%,#0F0A1C)",
  "linear-gradient(138deg,#3A2A12,#BE8428 62%,#171006)",
  "linear-gradient(138deg,#0F312C,#1F7A5F 62%,#08150F)",
  "linear-gradient(138deg,#2A1E49,#6C3FA8 62%,#130E24)",
  "linear-gradient(138deg,#1A2A4E,#33549E 62%,#0C1220)",
  "linear-gradient(138deg,#0E2A3A,#2596A8 62%,#06141B)",
];
const WS_FEED_SHAPES = ["tall", "square", "wide", "portrait", "tall", "square", "portrait", "wide", "square", "tall", "portrait"];

const WS_ACCENT_PRESETS = [
  { hex: "#d8ff3e", name: "Lime (default)" },
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

/* Landing bo'limlari — admin ro'yxatidagi nomlar (kalitlar platforma bilan AYNI) */
const WS_SECTION_LABELS = {
  ticker: "Ticker strip",
  stats: "Stats row",
  cinema: "Cinema billboard",
  showcase: "Templates showcase",
  presets: "Presets rail",
  aiPromo: "AI Studio promo",
  pluginPromo: "Plugin promo",
  pricingTeaser: "Pricing teaser",
  faq: "FAQ",
  finalCta: "Final CTA band",
};

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

/* ── Umumiy yordamchilar ───────────────────────────────────── */

/** data-ws yo'li bo'yicha qiymatni WS_CFG ichiga yozadi (raqam segment = massiv indeksi). */
function wsSetPath(obj, path, value) {
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

/** DOM'dagi barcha data-ws maydonlarini WS_CFG ga yig'adi (faqat joriy tabda mavjudlari). */
function wsCollect() {
  const c = JSON.parse(JSON.stringify(WS_CFG));
  document.querySelectorAll("[data-ws]").forEach((el) => {
    let v = el.value;
    if (el.dataset.wsType === "num") v = Math.max(0, Number(v) || 0);
    else if (el.dataset.wsType === "int") v = Math.max(0, Math.floor(Number(v) || 0));
    else if (el.dataset.wsType === "lines") v = v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12);
    wsSetPath(c, el.dataset.ws, v);
  });
  return c;
}

function wsInput(field, value, opts) {
  opts = opts || {};
  return `<input class="adx-input ws-inp${opts.mono ? " mono" : ""}" data-ws="${field}"${opts.type ? ` data-ws-type="${opts.type}"` : ""} value="${wsEsc(value)}"${opts.num ? ` type="number" min="0"` : ""}${opts.ph ? ` placeholder="${wsEsc(opts.ph)}"` : ""}${opts.style ? ` style="${opts.style}"` : ""}>`;
}

function wsArea(field, value, rows, opts) {
  opts = opts || {};
  return `<textarea class="adx-input ws-inp" data-ws="${field}"${opts.type ? ` data-ws-type="${opts.type}"` : ""} rows="${rows || 3}">${wsEsc(Array.isArray(value) ? value.join("\n") : value)}</textarea>`;
}

function wsCard(title, sub, body) {
  return `<div class="adx-card" style="padding:18px 20px">
    <div class="adx-h16" style="font-size:14px;margin-bottom:${sub ? 4 : 14}px">${title}</div>
    ${sub ? `<div style="font-size:11px;color:var(--muted);margin-bottom:14px">${sub}</div>` : ""}
    ${body}
  </div>`;
}

/* ── v2 — universal media blok (istalgan {mediaUrl,mediaType} slot uchun) ──
   path — konfiguratsiyadagi slot yo'li (masalan "heroMedia", "cinema",
   "presetsRail.items.2", "feed.cards.7"). Yuklash/olib tashlash shu yo'lga yozadi. */
function wsPathGet(obj, path) {
  let cur = obj;
  for (const part of path.split(".")) {
    const k = /^\d+$/.test(part) ? Number(part) : part;
    if (cur == null) return null;
    cur = cur[k];
  }
  return cur;
}

function wsMediaBlock(path, slot, opts) {
  opts = opts || {};
  const hasMedia = !!(slot && slot.mediaUrl);
  const isVideo = slot && slot.mediaType === "video";
  const grad = opts.grad || "linear-gradient(138deg,#151A22,#1E2733 62%,#0C1016)";
  const thumb = hasMedia
    ? (isVideo
        ? `<video src="${wsEsc(slot.mediaUrl)}" muted loop autoplay playsinline onerror="wsMediaErr(this)" style="width:100%;height:100%;object-fit:cover"></video>`
        : `<img src="${wsEsc(slot.mediaUrl)}" alt="" onerror="wsMediaErr(this)" style="width:100%;height:100%;object-fit:cover">`)
    : `<span style="font:600 9px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:rgba(255,255,255,.6)">${wsEsc(opts.emptyLabel || "GRADIENT")}</span>`;
  return `<div style="display:flex;gap:12px;align-items:center">
    <div style="width:${opts.w || 130}px;height:${opts.h || 72}px;flex:none;border-radius:9px;overflow:hidden;background:${grad};display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08)">${thumb}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="adx-btn2 sm" onclick="wsPickMedia('${path}')"><i class="ph ph-upload-simple"></i>${hasMedia ? "Replace media" : "Upload media"}</button>
        ${hasMedia ? `<button class="adx-btn2 sm" onclick="wsClearMedia('${path}')"><i class="ph ph-x"></i>Remove</button>` : ""}
        <span class="ws-upstat" data-ws-upstat="${path}" style="font-size:10px;color:var(--muted)"></span>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px">${opts.hint || "Image, GIF or a short MP4/WebM loop."}</div>
    </div>
  </div>`;
}

/* Media URL yuklanmadi (CDN 403 / o'chirilgan fayl) — buzilgan ikonka o'rniga aniq holat */
function wsMediaErr(el) {
  const box = el && el.parentNode;
  if (!box) return;
  box.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;color:#C79A62;text-align:center;padding:0 6px"><i class="ph ph-warning" style="font-size:15px"></i><span style="font:600 8px 'IBM Plex Mono',monospace;letter-spacing:.05em">MEDIA UNREACHABLE</span></div>`;
}

/* ── Theme ─────────────────────────────────────────────────── */

function wsThemeSection() {
  const t = WS_CFG.theme;
  const swatches = WS_ACCENT_PRESETS.map((p) =>
    `<button class="ws-swatch" title="${wsEsc(p.name)}" onclick="wsSetAccent('${p.hex}')" style="width:30px;height:30px;border-radius:8px;background:${p.hex};border:2px solid ${t.accent.toUpperCase() === p.hex.toUpperCase() ? "#fff" : "transparent"};cursor:pointer"></button>`
  ).join("");
  const fontOpts = WS_FONTS.map((f) => `<option value="${f.key}" ${t.font === f.key ? "selected" : ""}>${f.label}</option>`).join("");
  const stack = (WS_FONTS.find((f) => f.key === t.font) || WS_FONTS[0]).stack;
  return wsCard("Theme", "Accent color and font apply to the marketing pages (landing, pricing, plugin). The app UI keeps the default theme.", `
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
        <div style="font-family:${stack};font-size:13px;color:var(--muted);margin-top:8px" data-ws-fontdemo>Aa Bb Cc — Templates, AI video and audio</div>
      </div>
    </div>`);
}

/* ── Jonli preview — hero + bo'lim tartibi ─────────────────── */

function wsPreviewHtml(c) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(c.theme.accent) ? c.theme.accent : "#d8ff3e";
  const stack = (WS_FONTS.find((f) => f.key === c.theme.font) || WS_FONTS[0]).stack;
  const r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
  const onAcc = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.55 ? "#0a0d02" : "#fff";
  const stats = c.stats.map((s) => {
    const isWord = /[a-zA-Z]/.test(s.suffix || "");
    const n = Number(s.value) || 0;
    return `<div style="text-align:center"><div style="font:700 17px 'IBM Plex Mono',monospace;color:#F2F5F8">${n >= 1000 ? n.toLocaleString("en-US") : n}${isWord ? `<span style="font-size:12px"> ${wsEsc(s.suffix)}</span>` : `<span style="color:${accent}">${wsEsc(s.suffix)}</span>`}</div><div style="font-size:9.5px;color:var(--muted);margin-top:2px">${wsEsc(s.label)}</div></div>`;
  }).join("");
  // Bo'lim tartibi lentasi — hero doim birinchi; yashirin bo'lim o'chik chip
  const secChips = [`<span style="padding:3px 9px;border-radius:6px;background:${accent};color:${onAcc};font:700 9px 'IBM Plex Mono',monospace">HERO</span>`]
    .concat(c.landingSections.map((sc) =>
      `<span style="padding:3px 9px;border-radius:6px;font:600 9px 'IBM Plex Mono',monospace;${sc.visible ? "background:rgba(255,255,255,.09);color:#D8DEE8" : "background:rgba(255,255,255,.03);color:var(--muted2);text-decoration:line-through"}">${wsEsc((WS_SECTION_LABELS[sc.key] || sc.key).toUpperCase())}</span>`))
    .join('<i class="ph ph-caret-right" style="font-size:8px;color:var(--muted2)"></i>');
  return `<div style="background:radial-gradient(120% 160% at 50% -20%,#12161d,#07090c 70%);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:26px 22px;text-align:center;font-family:${stack}">
    <span style="display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:10.5px;color:var(--text2)"><b style="font:700 7.5px 'IBM Plex Mono',monospace;letter-spacing:.1em;padding:2px 6px;border-radius:4px;background:${accent};color:${onAcc}">${wsEsc(c.hero.badgeTag)}</b>${wsEsc(c.hero.badgeText)}</span>
    <div style="font-weight:700;font-size:25px;letter-spacing:-.03em;color:#F2F5F8;margin-top:12px;line-height:1.15">${wsEsc(c.hero.title)} <span style="background:linear-gradient(92deg,${accent} 10%,#7CC4FF 90%);-webkit-background-clip:text;background-clip:text;color:transparent">${wsEsc(c.hero.titleAccent)}</span></div>
    <div style="font-size:11.5px;color:var(--muted);max-width:430px;margin:9px auto 0;line-height:1.55">${wsEsc(c.hero.sub)}</div>
    <div style="display:flex;gap:9px;justify-content:center;margin-top:14px">
      <span style="display:inline-flex;align-items:center;height:32px;padding:0 16px;border-radius:99px;background:${accent};color:${onAcc};font-weight:700;font-size:11px">${wsEsc(c.hero.ctaPrimary)}</span>
      <span style="display:inline-flex;align-items:center;height:32px;padding:0 15px;border-radius:99px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#F2F5F8;font-weight:600;font-size:11px">${wsEsc(c.hero.ctaSecondary)}</span>
    </div>
    <div style="font-size:9.5px;color:var(--muted);margin-top:10px">${wsEsc(c.hero.credline)}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;border-top:1px solid rgba(255,255,255,.06);margin-top:18px;padding-top:14px">${stats}</div>
    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center;border-top:1px solid rgba(255,255,255,.06);margin-top:14px;padding-top:12px">${secChips}</div>
  </div>`;
}

/* ── Tab: Hero & Theme ─────────────────────────────────────── */

function wsTabHero() {
  const c = WS_CFG;
  const navFields = [
    ["nav.templates", "TEMPLATES LINK", c.nav.templates], ["nav.aiStudio", "AI STUDIO LINK", c.nav.aiStudio],
    ["nav.pricing", "PRICING LINK", c.nav.pricing], ["nav.plugin", "PLUGIN LINK", c.nav.plugin],
    ["nav.signIn", "SIGN-IN BUTTON", c.nav.signIn], ["nav.cta", "NAV CTA BUTTON", c.nav.cta],
    ["nav.pluginBadge", "PLUGIN LINK PIP (EMPTY = HIDDEN)", c.nav.pluginBadge],
  ].map(([f, l, v]) => `<div>${axFlab(l)}${wsInput(f, v)}</div>`).join("");
  const statRows = c.stats.map((s, i) => `
    <div style="display:grid;grid-template-columns:110px 90px 1fr;gap:10px;margin-bottom:10px">
      <div>${i === 0 ? axFlab("VALUE") : ""}${wsInput(`stats.${i}.value`, s.value, { mono: true, num: true, type: "int" })}</div>
      <div>${i === 0 ? axFlab("SUFFIX") : ""}${wsInput(`stats.${i}.suffix`, s.suffix, { mono: true, ph: "+ / days" })}</div>
      <div>${i === 0 ? axFlab("CAPTION") : ""}${wsInput(`stats.${i}.label`, s.label)}</div>
    </div>`).join("");
  return `<div class="adx-grid2" style="align-items:start">
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsThemeSection()}
      ${wsCard("Hero", "", `
        <div style="display:grid;grid-template-columns:90px 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("BADGE TAG")}${wsInput("hero.badgeTag", c.hero.badgeTag, { mono: true })}</div>
          <div>${axFlab("BADGE TEXT")}${wsInput("hero.badgeText", c.hero.badgeText)}</div>
        </div>
        <div style="margin-bottom:12px">${axFlab("HEADLINE")}${wsInput("hero.title", c.hero.title)}</div>
        <div style="margin-bottom:12px">${axFlab("HEADLINE ACCENT (GRADIENT PART)")}${wsInput("hero.titleAccent", c.hero.titleAccent)}</div>
        <div style="margin-bottom:12px">${axFlab("SUBHEADLINE")}${wsArea("hero.sub", c.hero.sub, 3)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("PRIMARY CTA")}${wsInput("hero.ctaPrimary", c.hero.ctaPrimary)}</div>
          <div>${axFlab("SECONDARY CTA")}${wsInput("hero.ctaSecondary", c.hero.ctaSecondary)}</div>
        </div>
        <div>${axFlab("CREDIT LINE (UNDER CTAS)")}${wsInput("hero.credline", c.hero.credline)}</div>`)}
      ${wsCard("Navigation labels", "", `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${navFields}</div>`)}
      ${wsCard("Stats row", `Four counters under the hero. Suffix: a symbol ("+") renders in the accent color, a word ("days") renders as a unit.`, statRows)}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsCard("Live preview", "Updates as you type — hero, stats and the section order strip.", `<div id="wsPreview">${wsPreviewHtml(c)}</div>`)}
      ${wsCard("Hero billboard", `The big media card next to the hero copy. Upload an image, GIF or short video — empty keeps the built-in aurora art.`, `
        <div style="display:grid;grid-template-columns:60px 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("BADGE")}${wsInput("mockup.badge", c.mockup.badge, { mono: true })}</div>
          <div>${axFlab("CAPTION TITLE")}${wsInput("mockup.title", c.mockup.title, { mono: true })}</div>
        </div>
        <div style="display:grid;grid-template-columns:90px 1fr;gap:12px;margin-bottom:14px">
          <div>${axFlab("TIME CHIP")}${wsInput("heroMedia.time", c.heroMedia.time, { mono: true, ph: "00:08" })}</div>
          <div>${axFlab("CAPTION SUBLINE")}${wsInput("heroMedia.caption", c.heroMedia.caption)}</div>
        </div>
        ${axFlab("BILLBOARD MEDIA")}
        ${wsMediaBlock("heroMedia", c.heroMedia, { grad: "linear-gradient(138deg,#2A1E49,#6C3FA8 62%,#130E24)", emptyLabel: "AURORA ART", hint: "Image, GIF or a short MP4/WebM loop — shown inside the hero billboard frame." })}`)}
      ${wsCard("Announcement strip (promo bar)", "The thin dismissable strip above the landing nav. Visitors who dismiss it will see it again when you change the text.", `
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
          <button class="adx-tog ${c.promo.enabled ? "on" : "off"}" onclick="wsTogglePath('promo.enabled')"><i></i></button>
          <span style="font-size:12px;font-weight:600">${c.promo.enabled ? "Visible" : "Hidden"}</span>
          <span style="flex:1"></span>
          <label style="display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)">
            <button class="adx-tog ${c.promo.showInApp ? "on" : "off"}" onclick="wsTogglePath('promo.showInApp')"><i></i></button>
            Also show inside the logged-in app
          </label>
        </div>
        <div style="display:grid;grid-template-columns:80px 1fr 110px;gap:10px">
          <div>${axFlab("TAG")}${wsInput("promo.tag", c.promo.tag, { mono: true })}</div>
          <div>${axFlab("TEXT")}${wsInput("promo.text", c.promo.text)}</div>
          <div>${axFlab("CTA LABEL")}${wsInput("promo.ctaLabel", c.promo.ctaLabel)}</div>
        </div>`)}
      ${wsCard("Explore menu — live models", "The four model rows inside the nav “Explore” mega-menu. Keep prices in sync with the real model catalog.", c.megaModels.rows.map((m, i) => `
        <div style="display:grid;grid-template-columns:56px 1fr 1.4fr 90px 90px;gap:8px;margin-bottom:8px">
          <div>${i === 0 ? axFlab("INITIALS") : ""}${wsInput(`megaModels.rows.${i}.initials`, m.initials, { mono: true })}</div>
          <div>${i === 0 ? axFlab("MODEL") : ""}${wsInput(`megaModels.rows.${i}.title`, m.title)}</div>
          <div>${i === 0 ? axFlab("SUBTITLE") : ""}${wsInput(`megaModels.rows.${i}.sub`, m.sub)}</div>
          <div>${i === 0 ? axFlab("BADGE") : ""}${wsInput(`megaModels.rows.${i}.badge`, m.badge, { mono: true, ph: "—" })}</div>
          <div>${i === 0 ? axFlab("PRICE") : ""}${wsInput(`megaModels.rows.${i}.price`, m.price, { mono: true })}</div>
        </div>`).join(""))}
    </div>
  </div>`;
}

/* ── Tab: Landing sections ─────────────────────────────────── */

function wsSectionOrderCard() {
  const rows = WS_CFG.landingSections.map((sc, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;margin-bottom:6px;background:var(--surface2,rgba(255,255,255,.02))">
      <span style="font:700 10px 'IBM Plex Mono',monospace;color:var(--muted);width:16px">${i + 2}</span>
      <span style="font-size:12px;font-weight:600;flex:1;${sc.visible ? "" : "color:var(--muted2);text-decoration:line-through"}">${WS_SECTION_LABELS[sc.key] || sc.key}</span>
      <button class="adx-ico" title="Move up" onclick="wsSecMove(${i},-1)" ${i === 0 ? "disabled" : ""} style="width:26px;height:26px"><i class="ph ph-caret-up"></i></button>
      <button class="adx-ico" title="Move down" onclick="wsSecMove(${i},1)" ${i === WS_CFG.landingSections.length - 1 ? "disabled" : ""} style="width:26px;height:26px"><i class="ph ph-caret-down"></i></button>
      <button class="adx-tog ${sc.visible ? "on" : "off"}" title="Show / hide" onclick="wsSecToggle(${i})"><i></i></button>
    </div>`).join("");
  return wsCard("Section order & visibility", "The hero is always first. Reorder the sections below it and hide the ones you don't need — hidden sections don't render on the landing.", rows);
}

function wsTabLanding() {
  const c = WS_CFG;
  return `<div class="adx-grid2" style="align-items:start">
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsSectionOrderCard()}
      ${wsCard("Ticker strip", "The thin scrolling text band under the hero.", `
        <div style="margin-bottom:10px">${axFlab("LEFT LABEL")}${wsInput("ticker.label", c.ticker.label, { mono: true })}</div>
        ${axFlab("ITEMS (ONE PER LINE, MAX 12)")}${wsArea("ticker.items", c.ticker.items, 4, { type: "lines" })}`)}
      ${wsCard("Cinema billboard", "The full-width “Made with AI Studio” frame. Upload media to replace the sunset art.", `
        <div style="display:grid;grid-template-columns:170px 1fr;gap:10px;margin-bottom:10px">
          <div>${axFlab("EYEBROW")}${wsInput("cinema.eyebrow", c.cinema.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("cinema.title", c.cinema.title)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
          <div>${axFlab("LINK LABEL")}${wsInput("cinema.linkLabel", c.cinema.linkLabel)}</div>
          <div>${axFlab("BAR LEFT")}${wsInput("cinema.barLeft", c.cinema.barLeft, { mono: true })}</div>
          <div>${axFlab("BAR RIGHT")}${wsInput("cinema.barRight", c.cinema.barRight, { mono: true })}</div>
        </div>
        <div style="margin-bottom:10px">${axFlab("BIG WORD (\\n = LINE BREAK)")}${wsArea("cinema.word", c.cinema.word, 2)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:10px;margin-bottom:12px">
          <div>${axFlab("FOOT TITLE")}${wsInput("cinema.footTitle", c.cinema.footTitle)}</div>
          <div>${axFlab("FOOT SUBLINE")}${wsInput("cinema.footSub", c.cinema.footSub)}</div>
          <div>${axFlab("COST CHIP")}${wsInput("cinema.cost", c.cinema.cost, { mono: true })}</div>
        </div>
        ${axFlab("BILLBOARD MEDIA")}
        ${wsMediaBlock("cinema", c.cinema, { grad: "linear-gradient(138deg,#3A2A12,#BE8428 62%,#171006)", emptyLabel: "SUNSET ART", w: 150, h: 64 })}`)}
      ${wsCard("Templates showcase", "", `
        <div style="display:grid;grid-template-columns:150px 1fr 110px;gap:12px;margin-bottom:10px">
          <div>${axFlab("EYEBROW")}${wsInput("showcase.eyebrow", c.showcase.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("showcase.title", c.showcase.title)}</div>
          <div>${axFlab("LINK LABEL")}${wsInput("showcase.linkLabel", c.showcase.linkLabel)}</div>
        </div>
        <div>${axFlab("DISCLAIMER LINE (UNDER THE TITLE)")}${wsInput("feed.note", c.feed.note)}</div>`)}
      ${wsCard("Showcase feed cards (11 slots)", "The masonry cards in the showcase. Fill a slot to replace the built-in concept card — title, category, badge and media. Empty slots keep the built-in gradient cards.", c.feed.cards.map((f, i) => `
        <div class="adx-card" style="padding:12px;margin-bottom:8px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:8px">SLOT ${i + 1} · ${WS_FEED_SHAPES[i] || "card"}</div>
          <div style="display:grid;grid-template-columns:1.3fr 1fr 70px 70px;gap:8px;margin-bottom:8px">
            <div>${wsInput(`feed.cards.${i}.title`, f.title, { ph: "empty = built-in card" })}</div>
            <div>${wsInput(`feed.cards.${i}.cat`, f.cat, { ph: "category" })}</div>
            <div>${wsInput(`feed.cards.${i}.dur`, f.dur, { mono: true, ph: "0:12" })}</div>
            <div>${wsInput(`feed.cards.${i}.badge`, f.badge, { mono: true, ph: "PRO" })}</div>
          </div>
          ${wsMediaBlock(`feed.cards.${i}`, f, { grad: WS_FEED_GRADS[i % WS_FEED_GRADS.length], w: 92, h: 56 })}
        </div>`).join(""))}
      ${wsCard("AI Studio promo", "", `
        <div style="display:grid;grid-template-columns:150px 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("EYEBROW")}${wsInput("aiPromo.eyebrow", c.aiPromo.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("aiPromo.title", c.aiPromo.title)}</div>
        </div>
        <div style="margin-bottom:12px">${axFlab("DESCRIPTION")}${wsArea("aiPromo.desc", c.aiPromo.desc, 2)}</div>
        <div style="margin-bottom:12px">${axFlab("BAND CTA BUTTON")}${wsInput("aiPromo.ctaLabel", c.aiPromo.ctaLabel)}</div>
        ${axFlab("TOOL CARDS (TITLE · DESCRIPTION · COST LABEL)")}
        ${c.aiPromo.cards.map((cd, i) => `
          <div style="display:grid;grid-template-columns:1fr 1.4fr 100px;gap:8px;margin-bottom:8px">
            ${wsInput(`aiPromo.cards.${i}.title`, cd.title)}
            ${wsInput(`aiPromo.cards.${i}.desc`, cd.desc)}
            ${wsInput(`aiPromo.cards.${i}.cost`, cd.cost, { mono: true })}
          </div>`).join("")}
        <div style="margin-top:12px">${axFlab("TYPING PROMPTS (4 LINES — THE ANIMATED PROMPT TEXTS)")}${wsArea("aiPromo.typingPrompts", c.aiPromo.typingPrompts, 4, { type: "lines" })}</div>
        <div style="margin-top:12px">${axFlab("RESULT STACK LABEL")}${wsInput("aiPromo.stackLabel", c.aiPromo.stackLabel, { mono: true })}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 70px 70px 1fr;gap:8px;margin-top:10px">
          <div>${axFlab("CHIP: MODE")}${wsInput("aiPromo.chipMode", c.aiPromo.chipMode, { mono: true })}</div>
          <div>${axFlab("CHIP: MODEL")}${wsInput("aiPromo.chipModel", c.aiPromo.chipModel)}</div>
          <div>${axFlab("RES")}${wsInput("aiPromo.chipRes", c.aiPromo.chipRes, { mono: true })}</div>
          <div>${axFlab("COST")}${wsInput("aiPromo.chipCost", c.aiPromo.chipCost, { mono: true })}</div>
          <div>${axFlab("GENERATE BTN")}${wsInput("aiPromo.chipGenerate", c.aiPromo.chipGenerate)}</div>
        </div>`)}
      ${wsCard("Plugin promo", "", `
        <div style="display:grid;grid-template-columns:150px 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("EYEBROW")}${wsInput("pluginPromo.eyebrow", c.pluginPromo.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("pluginPromo.title", c.pluginPromo.title)}</div>
        </div>
        <div style="margin-bottom:12px">${axFlab("DESCRIPTION")}${wsArea("pluginPromo.desc", c.pluginPromo.desc, 2)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
          <div>${axFlab("CTA BUTTON")}${wsInput("pluginPromo.ctaLabel", c.pluginPromo.ctaLabel)}</div>
          ${c.pluginPromo.chips.map((ch, i) => `<div>${axFlab("HOST CHIP " + (i + 1))}${wsInput(`pluginPromo.chips.${i}`, ch)}</div>`).join("")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div>${axFlab("AE WINDOW TITLE")}${wsInput("pluginPromo.winTitle", c.pluginPromo.winTitle, { mono: true })}</div>
          <div>${axFlab("SEARCH PLACEHOLDER")}${wsInput("pluginPromo.winSearch", c.pluginPromo.winSearch)}</div>
          <div>${axFlab("IMPORT BUTTON")}${wsInput("pluginPromo.winImport", c.pluginPromo.winImport)}</div>
        </div>`)}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsCard("Presets rail (4 cards)", "The “One-click creative presets” row. Upload media into each card — empty keeps the gradient art.", `
        <div style="display:grid;grid-template-columns:150px 1fr 120px;gap:10px;margin-bottom:12px">
          <div>${axFlab("EYEBROW")}${wsInput("presetsRail.eyebrow", c.presetsRail.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("presetsRail.title", c.presetsRail.title)}</div>
          <div>${axFlab("LINK LABEL")}${wsInput("presetsRail.linkLabel", c.presetsRail.linkLabel)}</div>
        </div>
        ${c.presetsRail.items.map((p, i) => `
          <div class="adx-card" style="padding:12px;margin-bottom:8px">
            <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px;margin-bottom:8px">
              <div>${i === 0 ? axFlab("CARD TITLE") : ""}${wsInput(`presetsRail.items.${i}.title`, p.title)}</div>
              <div>${i === 0 ? axFlab("SUBTITLE") : ""}${wsInput(`presetsRail.items.${i}.sub`, p.sub, { mono: true })}</div>
            </div>
            ${wsMediaBlock(`presetsRail.items.${i}`, p, { grad: WS_FEED_GRADS[(i + 2) % WS_FEED_GRADS.length], w: 92, h: 56 })}
          </div>`).join("")}`)}
      ${wsCard("Pricing teaser", "Plan cards themselves are edited on the “Pricing page” tab (shared copy).", `
        <div style="display:grid;grid-template-columns:150px 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("EYEBROW")}${wsInput("pricingTeaser.eyebrow", c.pricingTeaser.eyebrow, { mono: true })}</div>
          <div>${axFlab("TITLE")}${wsInput("pricingTeaser.title", c.pricingTeaser.title)}</div>
        </div>
        <div style="margin-bottom:12px">${axFlab("SUBTITLE")}${wsInput("pricingTeaser.sub", c.pricingTeaser.sub)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>${axFlab("BOTTOM NOTE")}${wsInput("pricingTeaser.note", c.pricingTeaser.note)}</div>
          <div>${axFlab("NOTE LINK LABEL")}${wsInput("pricingTeaser.noteLink", c.pricingTeaser.noteLink)}</div>
        </div>`)}
      ${wsCard("FAQ", "Shown on the landing and reused on the pricing page.", `
        <div style="margin-bottom:12px">${axFlab("SECTION TITLE")}${wsInput("faqSection.title", c.faqSection.title)}</div>
        ${c.faqSection.items.map((f, i) => `
          <div style="border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            ${axFlab("QUESTION " + (i + 1))}${wsInput(`faqSection.items.${i}.q`, f.q)}
            <div style="margin-top:8px">${axFlab("ANSWER")}${wsArea(`faqSection.items.${i}.a`, f.a, 2)}</div>
          </div>`).join("")}`)}
      ${wsCard("Final CTA band", "", `
        <div style="margin-bottom:12px">${axFlab("EYEBROW")}${wsInput("finalCta.eyebrow", c.finalCta.eyebrow, { mono: true })}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div>${axFlab("TITLE")}${wsInput("finalCta.title", c.finalCta.title)}</div>
          <div>${axFlab("CTA BUTTON")}${wsInput("finalCta.ctaLabel", c.finalCta.ctaLabel)}</div>
          <div>${axFlab("SECONDARY BUTTON")}${wsInput("finalCta.secondaryLabel", c.finalCta.secondaryLabel)}</div>
        </div>
        <div style="margin-bottom:12px">${axFlab("SUBTITLE")}${wsInput("finalCta.sub", c.finalCta.sub)}</div>
        <div>${axFlab("CREDIT LINE")}${wsInput("finalCta.credline", c.finalCta.credline)}</div>`)}
    </div>
  </div>`;
}

/* ── Tab: App & Catalog (logged-in webapp Home + Stock Catalog sahifasi) ───── */

function wsTabApp() {
  const c = WS_CFG;
  return `<div class="adx-grid2" style="align-items:start">
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsCard("Home — hero & quick actions", "The logged-in Home screen. Icons and targets are fixed; the copy is yours.", `
        <div style="margin-bottom:12px">${axFlab("HERO SUBLINE (UNDER THE GREETING)")}${wsInput("appHome.heroSub", c.appHome.heroSub)}</div>
        ${c.appHome.quick.map((q, i) => `
          <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:8px;margin-bottom:8px">
            <div>${i === 0 ? axFlab("QUICK CARD TITLE") : ""}${wsInput(`appHome.quick.${i}.title`, q.title)}</div>
            <div>${i === 0 ? axFlab("DESCRIPTION") : ""}${wsInput(`appHome.quick.${i}.desc`, q.desc)}</div>
          </div>`).join("")}`)}
      ${wsCard("Home — section headings", "", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>${axFlab("JUMP BACK IN")}${wsInput("appHome.secJump", c.appHome.secJump)}</div>
          <div>${axFlab("SECTION LINK (OPEN AI STUDIO)")}${wsInput("appHome.secJumpLink", c.appHome.secJumpLink)}</div>
          <div>${axFlab("START CREATING (EMPTY STATE)")}${wsInput("appHome.secStart", c.appHome.secStart)}</div>
          <div>${axFlab("FEATURED MODELS")}${wsInput("appHome.secFeatured", c.appHome.secFeatured)}</div>
          <div>${axFlab("RECOMMENDED FOR YOU")}${wsInput("appHome.secRec", c.appHome.secRec)}</div>
          <div>${axFlab("BROWSE-ALL LINK")}${wsInput("appHome.recLink", c.appHome.recLink)}</div>
        </div>`)}
      ${wsCard("Home — shelves", `The three template shelves. "Preferred category" powers the “essentials” shelf when that category has templates.`, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>${axFlab("SHELF 1 TITLE")}${wsInput("appHome.shelfFresh", c.appHome.shelfFresh)}</div>
          <div>${axFlab("SHELF 1 KICKER")}${wsInput("appHome.shelfFreshKick", c.appHome.shelfFreshKick, { mono: true })}</div>
          <div>${axFlab("SHELF 2 (CATEGORY) KICKER")}${wsInput("appHome.shelfCatKick", c.appHome.shelfCatKick, { mono: true })}</div>
          <div>${axFlab("PREFERRED CATEGORY")}${wsInput("appHome.shelfCat", c.appHome.shelfCat, { ph: "Lower Thirds" })}</div>
          <div>${axFlab("SHELF 3 TITLE")}${wsInput("appHome.shelfNew", c.appHome.shelfNew)}</div>
          <div>${axFlab("SHELF 3 KICKER")}${wsInput("appHome.shelfNewKick", c.appHome.shelfNewKick, { mono: true })}</div>
        </div>`)}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsCard("Home — empty state", "Shown to users with no generations yet.", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>${axFlab("TITLE")}${wsInput("appHome.emptyTitle", c.appHome.emptyTitle)}</div>
          <div>${axFlab("BUTTON")}${wsInput("appHome.emptyBtn", c.appHome.emptyBtn)}</div>
        </div>
        <div>${axFlab("SUBTITLE")}${wsInput("appHome.emptySub", c.appHome.emptySub)}</div>`)}
      ${wsCard("Stock Catalog page", "The catalog hero, search and empty-state copy.", `
        <div style="margin-bottom:10px">${axFlab("KICKER")}${wsInput("catalogPage.kicker", c.catalogPage.kicker, { mono: true })}</div>
        <div style="margin-bottom:10px">${axFlab("TITLE (\\n = LINE BREAK)")}${wsArea("catalogPage.title", c.catalogPage.title, 2)}</div>
        <div style="margin-bottom:10px">${axFlab("SEARCH PLACEHOLDER")}${wsInput("catalogPage.searchPlaceholder", c.catalogPage.searchPlaceholder)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>${axFlab("LOADING LINE")}${wsInput("catalogPage.loading", c.catalogPage.loading)}</div>
          <div>${axFlab("EMPTY-CATALOG TITLE")}${wsInput("catalogPage.emptyTitle", c.catalogPage.emptyTitle)}</div>
        </div>
        <div>${axFlab("EMPTY-CATALOG SUBTITLE")}${wsInput("catalogPage.emptySub", c.catalogPage.emptySub)}</div>`)}
    </div>
  </div>`;
}

/* ── Tab: Pricing page ─────────────────────────────────────── */

function wsPlanEditor(p, i) {
  const names = ["FREE PLAN", "PRO PLAN (MOST POPULAR)", "STUDIO PLAN"];
  return `<div class="adx-card" style="padding:16px 18px${i === 1 ? ";border-color:var(--glow)" : ""}">
    <div style="font:700 10px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:var(--muted);margin-bottom:12px">${names[i]}</div>
    <div style="display:grid;grid-template-columns:1fr 90px 1fr;gap:10px;margin-bottom:10px">
      <div>${axFlab("NAME")}${wsInput(`plans.${i}.name`, p.name)}</div>
      <div>${axFlab("PRICE $/MO")}${wsInput(`plans.${i}.price`, p.price, { mono: true, num: true, type: "num" })}</div>
      <div>${axFlab("CREDITS LINE")}${wsInput(`plans.${i}.credits`, p.credits, { mono: true })}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div>${axFlab("SUBTITLE")}${wsInput(`plans.${i}.sub`, p.sub)}</div>
      <div>${axFlab("CTA BUTTON")}${wsInput(`plans.${i}.cta`, p.cta)}</div>
    </div>
    <div style="margin-bottom:10px">${axFlab("FEATURES — PRICING PAGE (ONE PER LINE)")}${wsArea(`plans.${i}.feats`, p.feats, 5, { type: "lines" })}</div>
    <div>${axFlab("TEASER FEATURES — LANDING (3 LINES)")}${wsArea(`plans.${i}.teaserFeats`, p.teaserFeats, 3, { type: "lines" })}</div>
  </div>`;
}

function wsTabPricing() {
  const c = WS_CFG;
  return `
    ${axInfo(`These fields change DISPLAY copy only (what visitors see). Real billing, plan enforcement and checkout are configured elsewhere and are not affected. Keep displayed prices in sync with your actual Lemon Squeezy prices.`, "amber")}
    ${wsCard("Page header", "", `
      <div style="display:grid;grid-template-columns:130px 1fr 1fr 130px;gap:12px;margin-bottom:12px">
        <div>${axFlab("EYEBROW")}${wsInput("pricingPage.eyebrow", c.pricingPage.eyebrow, { mono: true })}</div>
        <div>${axFlab("TITLE")}${wsInput("pricingPage.title", c.pricingPage.title)}</div>
        <div>${axFlab("SUBTITLE")}${wsInput("pricingPage.sub", c.pricingPage.sub)}</div>
        <div>${axFlab("FAQ TITLE")}${wsInput("pricingPage.faqTitle", c.pricingPage.faqTitle)}</div>
      </div>
      <div style="display:grid;grid-template-columns:150px 1fr 130px;gap:12px;margin-bottom:12px">
        <div>${axFlab("BILLING NOTE")}${wsInput("pricingPage.billingNote", c.pricingPage.billingNote, { mono: true })}</div>
        <div>${axFlab("BILLING SUBLINE")}${wsInput("pricingPage.billingSub", c.pricingPage.billingSub)}</div>
        <div>${axFlab("POPULAR LABEL")}${wsInput("pricingPage.popularLabel", c.pricingPage.popularLabel, { mono: true })}</div>
      </div>
      <div style="display:grid;grid-template-columns:150px 1fr;gap:12px">
        <div>${axFlab("COMPARE STRIP TITLE")}${wsInput("pricingPage.compareTitle", c.pricingPage.compareTitle, { mono: true })}</div>
        <div>${axFlab("COMPARE ITEMS (ONE PER LINE)")}${wsArea("pricingPage.compareItems", c.pricingPage.compareItems, 4, { type: "lines" })}</div>
      </div>`)}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px">
      ${c.plans.map(wsPlanEditor).join("")}
    </div>`;
}

/* ── Tab: Plugin page ──────────────────────────────────────── */

function wsTabPlugin() {
  const c = WS_CFG;
  return `<div class="adx-grid2" style="align-items:start">
    ${wsCard("Page header", "", `
      <div style="margin-bottom:12px">${axFlab("BADGE")}${wsInput("pluginPage.badge", c.pluginPage.badge)}</div>
      <div style="margin-bottom:12px">${axFlab("TITLE")}${wsInput("pluginPage.title", c.pluginPage.title)}</div>
      <div style="margin-bottom:12px">${axFlab("SUBTITLE")}${wsArea("pluginPage.sub", c.pluginPage.sub, 2)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>${axFlab("DOWNLOAD CTA")}${wsInput("pluginPage.ctaLabel", c.pluginPage.ctaLabel)}</div>
        <div>${axFlab("VERSION NOTE")}${wsInput("pluginPage.versionNote", c.pluginPage.versionNote, { mono: true })}</div>
      </div>
      <div>${axFlab("GUARANTEE LINE")}${wsInput("pluginPage.guarantee", c.pluginPage.guarantee)}</div>`)}
    <div style="display:flex;flex-direction:column;gap:16px">
      ${wsCard("Install steps", "Three numbered steps — the numbers are automatic.", c.pluginPage.steps.map((st, i) => `
        <div style="border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px">
          ${axFlab("STEP " + (i + 1) + " TITLE")}${wsInput(`pluginPage.steps.${i}.t`, st.t)}
          <div style="margin-top:8px">${axFlab("DESCRIPTION")}${wsArea(`pluginPage.steps.${i}.d`, st.d, 2)}</div>
        </div>`).join(""))}
      ${wsCard("AE window mock", "The decorative After Effects window next to the hero.", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>${axFlab("WINDOW TITLE")}${wsInput("pluginPage.winTitle", c.pluginPage.winTitle, { mono: true })}</div>
          <div>${axFlab("SEARCH PLACEHOLDER")}${wsInput("pluginPage.winSearch", c.pluginPage.winSearch)}</div>
          <div>${axFlab("TEMPLATE NAME")}${wsInput("pluginPage.mockName", c.pluginPage.mockName)}</div>
          <div>${axFlab("IMPORT BUTTON")}${wsInput("pluginPage.mockImport", c.pluginPage.mockImport)}</div>
        </div>`)}
    </div>
  </div>`;
}

/* ── Tab: Footer ───────────────────────────────────────────── */

function wsTabFooter() {
  const c = WS_CFG;
  const colHints = [
    "Product column — links go to Templates / AI Studio / Plugin / Pricing (max 4 labels)",
    "Categories column — every link opens the template catalog",
    "Legal column — links go to Help / Terms / Privacy / Refund (max 4 labels)",
  ];
  return `<div class="adx-grid2" style="align-items:start">
    ${wsCard("Footer", "", `
      <div style="margin-bottom:12px">${axFlab("TAGLINE (UNDER THE LOGO)")}${wsArea("footer.tagline", c.footer.tagline, 2)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>${axFlab("CONTACT EMAIL")}${wsInput("footer.email", c.footer.email, { mono: true })}</div>
        <div>${axFlab("COPYRIGHT LINE")}${wsInput("footer.copyright", c.footer.copyright, { mono: true })}</div>
      </div>
      <div>${axFlab("GUARANTEE LINE (BOTTOM RIGHT)")}${wsInput("footer.guarantee", c.footer.guarantee)}</div>`)}
    ${wsCard("Link columns", "Only the labels are editable — link destinations are fixed in code.", c.footer.cols.map((col, i) => `
      <div style="border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${colHints[i]}</div>
        ${axFlab("COLUMN TITLE")}${wsInput(`footer.cols.${i}.title`, col.title, { mono: true })}
        <div style="margin-top:8px">${axFlab("LINK LABELS (ONE PER LINE)")}${wsArea(`footer.cols.${i}.links`, col.links, col.links.length + 1, { type: "lines" })}</div>
      </div>`).join(""))}
  </div>`;
}

/* ── Asosiy view ───────────────────────────────────────────── */

const WS_TABS = [
  { key: "hero", label: "Hero & theme", icon: "sparkle" },
  { key: "landing", label: "Landing sections", icon: "rows" },
  { key: "app", label: "App & Catalog", icon: "layout" },
  { key: "pricing", label: "Pricing page", icon: "tag" },
  { key: "plugin", label: "Plugin page", icon: "puzzle-piece" },
  { key: "footer", label: "Footer", icon: "dots-three-outline" },
];

VIEWS.website = function () {
  if (WS_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${wsEsc(WS_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="WS_LOAD_ERR=null;WS_LOADED=false;route('website')">Try again</button></div>`;
  }
  if (!WS_LOADED || !WS_CFG) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Fetching the site configuration</div></div>`;
  }
  const tabs = WS_TABS.map((t) =>
    `<button class="${t.key === WS_TAB ? "on" : ""}" onclick="wsTab('${t.key}')" style="padding:7px 14px"><i class="ph ph-${t.icon}" style="font-size:13px;margin-right:6px"></i>${t.label}</button>`
  ).join("");
  const body =
    WS_TAB === "landing" ? wsTabLanding()
    : WS_TAB === "app" ? wsTabApp()
    : WS_TAB === "pricing" ? wsTabPricing()
    : WS_TAB === "plugin" ? wsTabPlugin()
    : WS_TAB === "footer" ? wsTabFooter()
    : wsTabHero();
  return `
    ${axInfo(`This edits the PUBLIC marketing site (landing, pricing and plugin pages). Changes go live within ~1 minute of saving. "Reset to defaults" restores the original built-in content for the whole site.`, "amber")}
    <div class="adx-seg" style="margin-bottom:16px;display:inline-flex">${tabs}</div>
    ${body}
    <input type="file" id="wsMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

/* ── Amallar ───────────────────────────────────────────────── */

function wsTab(key) {
  WS_CFG = wsCollect(); // joriy tab tahrirlarini yo'qotmaslik uchun avval yig'amiz
  WS_TAB = key;
  route("website");
}

function wsSecMove(i, dir) {
  WS_CFG = wsCollect();
  const a = WS_CFG.landingSections;
  const j = i + dir;
  if (j < 0 || j >= a.length) return;
  const t = a[i]; a[i] = a[j]; a[j] = t;
  route("website");
}

function wsSecToggle(i) {
  WS_CFG = wsCollect();
  WS_CFG.landingSections[i].visible = !WS_CFG.landingSections[i].visible;
  route("website");
}

/* v2 — bool konfiguratsiya kalitini almashtirish (promo.enabled kabi) */
function wsTogglePath(path) {
  WS_CFG = wsCollect();
  wsSetPath(WS_CFG, path, !wsPathGet(WS_CFG, path));
  route("website");
}

function wsRefreshPreview() {
  WS_CFG = wsCollect();
  const box = document.getElementById("wsPreview");
  if (box) {
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

/* v2 — universal media pick: WS_PICK = konfiguratsiyadagi slot yo'li ("heroMedia",
   "cinema", "presetsRail.items.2", "feed.cards.7"…). GIF ham image/* ostida qabul. */
let WS_PICK = null;
function wsPickMedia(path) {
  WS_PICK = path;
  const inp = document.getElementById("wsMediaFile");
  if (inp) { inp.value = ""; inp.click(); }
}

function wsClearMedia(path) {
  WS_CFG = wsCollect();
  wsSetPath(WS_CFG, path + ".mediaUrl", "");
  wsSetPath(WS_CFG, path + ".mediaType", "");
  route("website");
}

/* Media yuklash: presigned PUT (folder=landing) → publicUrl slotga yoziladi.
   Limitlar server bilan mos: rasm/GIF 40MB, video 150MB. */
async function wsUploadMedia(file) {
  const path = WS_PICK;
  if (!path || !file) return;
  const stat = document.querySelector(`[data-ws-upstat="${path}"]`);
  const isVideo = /^video\//.test(file.type);
  const cap = isVideo ? 150 : 40;
  if (file.size > cap * 1024 * 1024) {
    toast("Too large", `${isVideo ? "Video" : "Image/GIF"} media should be under ${cap} MB (short loops work best)`, "warn");
    return;
  }
  try {
    if (stat) stat.textContent = "Uploading…";
    const u = await StudioApi.adminUploadUrl(file.name, file.type || "application/octet-stream", "landing", file.size);
    if (!u.uploadUrl) {
      toast("Storage not configured", u.message || "S3/R2 is not configured on the server", "warn");
      if (stat) stat.textContent = "";
      return;
    }
    const res = await fetch(u.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    WS_CFG = wsCollect();
    wsSetPath(WS_CFG, path + ".mediaUrl", u.publicUrl);
    wsSetPath(WS_CFG, path + ".mediaType", isVideo ? "video" : "image");
    toast("Media uploaded", "Don't forget to press Save to publish it", "success");
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
  WS_CFG.theme.accent = accent;
  try {
    // To'liq konfiguratsiya yuboriladi (barcha tablar) — server bo'lim-darajada merge qiladi
    const d = await StudioApi.saveLandingConfig({
      theme: WS_CFG.theme, nav: WS_CFG.nav, hero: WS_CFG.hero, mockup: WS_CFG.mockup, stats: WS_CFG.stats,
      landingSections: WS_CFG.landingSections, showcase: WS_CFG.showcase, aiPromo: WS_CFG.aiPromo,
      pluginPromo: WS_CFG.pluginPromo, pricingTeaser: WS_CFG.pricingTeaser, faqSection: WS_CFG.faqSection,
      finalCta: WS_CFG.finalCta, footer: WS_CFG.footer, pricingPage: WS_CFG.pricingPage,
      plans: WS_CFG.plans, pluginPage: WS_CFG.pluginPage,
      // v2 bo'limlari
      heroMedia: WS_CFG.heroMedia, promo: WS_CFG.promo, ticker: WS_CFG.ticker, cinema: WS_CFG.cinema,
      presetsRail: WS_CFG.presetsRail, feed: WS_CFG.feed, megaModels: WS_CFG.megaModels,
      appHome: WS_CFG.appHome, catalogPage: WS_CFG.catalogPage,
    });
    WS_CFG = d.config;
    AssetFlowLog.info("Site saved", { action: "landing_save", detail: "Website tab: " + WS_TAB });
    toast("Saved", "The public site will reflect the changes within ~1 minute", "success");
    if (CURRENT === "website") route("website");
  } catch (e) {
    toast("Save failed", e.message || "Server error", "warn");
  }
}

async function wsReset() {
  // D6 (#12) — xom confirm() o'rniga dizayn tizimidagi tasdiq modali (afConfirm, ui.js)
  if (!(await afConfirm({
    title: "Reset the marketing site",
    sub: "Landing, pricing and plugin pages return to the built-in content.",
    warn: "This cannot be undone — every edit you made to the public site is replaced by the defaults.",
    body: "Uploaded card media links are removed from the page (the files stay in storage).",
    okLabel: "Reset site",
  }))) return;
  try {
    const d = await StudioApi.resetLandingConfig();
    WS_CFG = d.config;
    AssetFlowLog.info("Site reset", { action: "landing_reset", detail: "Website tab" });
    toast("Reset", "Site restored to defaults", "success");
    if (CURRENT === "website") route("website");
  } catch (e) {
    toast("Reset failed", e.message || "Server error", "warn");
  }
}

/* ── SC_62 — CMS versiya tarixi (Website + Plugin CMS umumiy) ─────────────── */
async function cmsHistoryOpen(kind) {
  try {
    const d = await StudioApi.listContentRevisions(kind);
    const items = (d && d.items) || [];
    const rows = items.length
      ? items.map((r) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${wsEsc(typeof fmtLocalDateTime === "function" ? fmtLocalDateTime(r.createdAt) : r.createdAt)}</div>
            <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${wsEsc((r.savedByEmail || "unknown") + " · " + ((r.keys || []).join(", ") || "—"))}</div>
          </div>
          <button class="adx-btn2 sm" onclick="cmsHistoryRestore('${wsEsc(r.id)}','${kind}')">Restore</button>
        </div>`).join("")
      : `<div style="font-size:12px;color:var(--muted);padding:24px;text-align:center">No saved versions yet — every “Save & publish” creates one.</div>`;
    openModal(`
      <div class="modal-head"><div class="modal-ico">${typeof ic === "function" ? ic("clock") : ""}</div><div><h3>Version history</h3><p>${kind === "plugin" ? "Plugin CMS" : "Website"} — last ${items.length} saves, newest first</p></div></div>
      <div class="modal-body" style="max-height:420px;overflow-y:auto">${rows}</div>
      <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>`);
  } catch (e) {
    toast("History unavailable", e.message || "Server error", "warn");
  }
}

async function cmsHistoryRestore(id, kind) {
  closeModal();
  if (!(await afConfirm({
    title: "Restore this version",
    sub: "The live configuration is replaced by the selected snapshot.",
    warn: "Unsaved edits in the editor are discarded. A new history entry is NOT created until you save again.",
    okLabel: "Restore version",
  }))) return;
  try {
    await StudioApi.restoreContentRevision(id);
    toast("Restored", "Configuration rolled back to the selected version", "success");
    if (kind === "plugin") {
      if (typeof PC_LOADED !== "undefined") { PC_LOADED = false; }
      if (CURRENT === "plugincms" && typeof pcLoadConfig === "function") pcLoadConfig(true);
    } else {
      WS_LOADED = false;
      if (CURRENT === "website") wsLoadConfig(true);
    }
  } catch (e) {
    toast("Restore failed", e.message || "Server error", "warn");
  }
}

window.afterRender.website = function () {
  const tba = document.getElementById("tbActions");
  if (tba && CURRENT === "website") {
    tba.innerHTML =
      `<button class="adx-btn2 sm" onclick="cmsHistoryOpen('landing')"><i class="ph ph-clock-counter-clockwise"></i>History</button>` +
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
  if (file && !file.__wsBound) {
    file.__wsBound = 1;
    file.addEventListener("change", () => wsUploadMedia(file.files && file.files[0]));
  }
};
