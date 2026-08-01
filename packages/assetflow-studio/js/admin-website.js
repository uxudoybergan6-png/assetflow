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
  const c = JSON.parse(JSON.stringify(wsCfg()));
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
  const t = wsCfg().theme;
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

/* ══════════════════════════════════════════════════════════════════════════
   VIZUAL MUHARRIR v3 — yagona tahrir yuzasi (forma-tablar OLIB TASHLANDI).
   Chapda REAL sayt iframe'da (?ffcms=1), o'ngda kontekst inspektor:
     • KONTENT — tanlangan bo'limning barcha maydonlari AVTOMATIK quriladi
       (konfiguratsiya daraxtidan reflektiv: matn / raqam / kalit / media /
       ro'yxat) — endi yangi CMS maydoni qo'shilsa admin o'zi ko'rsatadi.
     • DIZAYN — o'lcham/qalinlik/rang/joylashuv/masshtab/burish/yashirish
       (desktop va mobil alohida). Sayt ichida sudrab surish ham shu yerga yozadi.
     • SAHIFA — mavzu, bo'lim tartibi, bildirishnomalar, qatlamlar ro'yxati.
   ══════════════════════════════════════════════════════════════════════════ */

let WS_VIS_PAGE = "landing";  // iframe ekrani: landing | pricing | plugin | templates | dashboard
let WS_VIS_DEV = "desktop";   // desktop | mobile
let WS_VIS_READY = false;
let WS_VIS_PUSH_T = null;
let WS_SEL = "";              // tanlangan element yo'li (uslub kaliti ham shu)
let WS_SEL_TEXT = "";         // tanlangan yaproq matn yo'li (bo'lsa)
let WS_SEL_GROUP = "";        // tanlangan elementning bo'lim yo'li
let WS_INSP = "content";      // content | design | page
let WS_OUTLINE = [];          // iframe'dan kelgan qatlamlar ro'yxati
let WS_FOCUS = "";            // panelda belgilanishi kerak bo'lgan maydon yo'li

/* Muharrir IKKI yuzada ishlaydi: `site` (marketing sayt + webapp) va `plugin`
   (AE panel). Barcha inspektor/dizayn kodi shu ikki accessor orqali ishlaydi —
   ekran o'zgarganda faqat WS_SURF almashadi. */
let WS_SURF = "site";
function wsCfg() { return WS_SURF === "plugin" ? PC_CFG : WS_CFG; }
function wsSetCfg(c) { if (WS_SURF === "plugin") PC_CFG = c; else WS_CFG = c; }
function wsSurfOrigin() { return WS_SURF === "plugin" ? location.origin : wsPlatformOrigin(); }
/* Plagin preview manzili ROOT-ABSOLUT: admin ikki xil yo'lda ochiladi —
   admin.getframeflow.app/ (host-router index.html'ni beradi, pathname "/")
   va getframeflow.app/admin/. Nisbiy yo'l birinchisida 404 berardi. Lokal
   dev'da dev-admin-server.mjs shu yo'lni CEP papkasiga mount qiladi. */
function wsSurfSrc() {
  return WS_SURF === "plugin"
    ? "/admin/plugin-preview/AssetFlow_Plugin.html?ffcms=1"
    : wsPlatformOrigin() + "/?ffcms=1";
}
let WS_UNDO = [];
let WS_REDO = [];

/* Yuza almashganda (Sayt ⇄ Plagin) muharrir holatini tozalaymiz — tanlov,
   qatlamlar, undo tarixi va sahifa pili boshqa konfiguratsiyaga tegishli. */
function wsSurfaceEnter(surf) {
  if (WS_SURF === surf) return;
  WS_SURF = surf;
  WS_SEL = ""; WS_SEL_TEXT = ""; WS_SEL_GROUP = ""; WS_FOCUS = "";
  WS_INSP = "content"; WS_OUTLINE = []; WS_UNDO = []; WS_REDO = [];
  WS_VIS_READY = false; WS_VIS_DEV = "desktop";
  WS_VIS_PAGE = (WS_PAGES[surf] || WS_PAGES.site)[0][0];
}

/* ── O'zbekcha yorliqlar (yo'l yoki oxirgi segment bo'yicha) ─────────────── */
const WS_LABELS = {
  hero: "Hero", heroMedia: "Hero bilbordi", promo: "E'lon chizig'i", nav: "Navigatsiya",
  megaModels: "Explore menyusi", mockup: "Hero kartasi", stats: "Raqamlar qatori",
  ticker: "Yuguruvchi satr", cinema: "Kino bilbord", showcase: "Shablonlar vitrinasi",
  feed: "Vitrina kartalari", presetsRail: "Presetlar lentasi", aiPromo: "AI Studio promo",
  pluginPromo: "Plagin promo", pricingTeaser: "Narx tizeri", faqSection: "Savol-javob",
  finalCta: "Yakuniy CTA", footer: "Pastki qism", pricingPage: "Narx sahifasi",
  plans: "Tariflar", pluginPage: "Plagin sahifasi", appHome: "Ilova bosh sahifasi",
  catalogPage: "Katalog sahifasi", theme: "Mavzu", landingSections: "Bo'lim tartibi",
  notices: "Bildirishnomalar", uiStyles: "Uslub qatlami",
  title: "Sarlavha", titleAccent: "Sarlavha (rangli qism)", sub: "Tavsif", desc: "Tavsif",
  text: "Matn", label: "Yorliq", value: "Qiymat", suffix: "Qo'shimcha", tag: "Nishon",
  badge: "Nishon", badgeTag: "Nishon kaliti", badgeText: "Nishon matni",
  ctaLabel: "Tugma matni", ctaPrimary: "Asosiy tugma", ctaSecondary: "Ikkinchi tugma",
  cta: "Tugma", credline: "Ishonch satri", eyebrow: "Ustki yorliq", linkLabel: "Havola matni",
  note: "Izoh", noteLink: "Izoh havolasi", items: "Elementlar", cards: "Kartalar",
  rows: "Qatorlar", cols: "Ustunlar", links: "Havolalar", steps: "Qadamlar",
  q: "Savol", a: "Javob", t: "Sarlavha", d: "Tavsif", name: "Nomi", price: "Narx ($/oy)",
  credits: "Kreditlar satri", feats: "Xususiyatlar", teaserFeats: "Tizer xususiyatlari",
  enabled: "Yoqilgan", visible: "Ko'rinadi", showInApp: "Ilova ichida ham",
  mediaUrl: "Media manzili", mediaType: "Media turi", accent: "Asosiy rang", font: "Shrift",
  word: "Katta so'z", barLeft: "Chap chiziq", barRight: "O'ng chiziq", cost: "Narx chipi",
  footTitle: "Past sarlavha", footSub: "Past tavsif", caption: "Izoh", time: "Vaqt chipi",
  winTitle: "Oyna sarlavhasi", winSearch: "Qidiruv placeholder", winImport: "Import tugmasi",
  mockName: "Shablon nomi", mockImport: "Import tugmasi", guarantee: "Kafolat satri",
  versionNote: "Versiya izohi", chips: "Chiplar", typingPrompts: "Yozuv promptlari",
  stackLabel: "Natija yorlig'i", chipMode: "Rejim chipi", chipModel: "Model chipi",
  chipRes: "O'lcham chipi", chipCost: "Narx chipi", chipGenerate: "Generatsiya tugmasi",
  tagline: "Shior", email: "Aloqa email", copyright: "Mualliflik satri",
  kicker: "Kicker", searchPlaceholder: "Qidiruv placeholder", loading: "Yuklanmoqda satri",
  emptyTitle: "Bo'sh holat sarlavhasi", emptySub: "Bo'sh holat tavsifi", emptyBtn: "Bo'sh holat tugmasi",
  heroSub: "Hero tavsifi", quick: "Tez amallar", secJump: "Davom etish sarlavhasi",
  secJumpLink: "Davom etish havolasi", secStart: "Boshlash sarlavhasi",
  secFeatured: "Tanlangan modellar", secRec: "Tavsiyalar", recLink: "Barchasi havolasi",
  shelfFresh: "Tokcha 1", shelfFreshKick: "Tokcha 1 kicker", shelfCat: "Afzal kategoriya",
  shelfCatKick: "Tokcha 2 kicker", shelfNew: "Tokcha 3", shelfNewKick: "Tokcha 3 kicker",
  billingNote: "To'lov izohi", billingSub: "To'lov tavsifi", popularLabel: "Ommabop yorlig'i",
  compareTitle: "Taqqoslash sarlavhasi", compareItems: "Taqqoslash elementlari",
  faqTitle: "Savol-javob sarlavhasi", initials: "Bosh harflar", cat: "Kategoriya", dur: "Davomiylik",
  placement: "Joylashuv", tone: "Ohang", audience: "Kimga", dismissable: "Yopish mumkin",
  startAt: "Boshlanish", endAt: "Tugash", ctaTarget: "CTA ekrani", ctaUrl: "CTA havolasi",
  pluginBadge: "Plagin pipi", signIn: "Kirish tugmasi", templates: "Shablonlar",
  aiStudio: "AI Studio", pricing: "Narxlar", plugin: "Plagin",
  /* ── Plagin CMS yuzasi ── */
  home: "Home ekrani", guest: "Mehmon ekrani", aiLauncher: "AI Tools launcher",
  announcement: "E'lon paneli", sections: "Bo'lim sarlavhalari", categoryTiles: "Kategoriya tayllari",
  features: "Afzalliklar", rails: "Kuratsiya rellslari", promptPlaceholder: "Prompt placeholder",
  mediaMode: "Media rejimi", peekKicker: "Peek kicker", registerNote: "Ro'yxatdan o'tish izohi",
  continueSessions: "Sessiyalar sarlavhasi", explore: "Explore sarlavhasi",
  categories: "Kategoriyalar sarlavhasi", recent: "So'nggilar sarlavhasi", shelf: "Tokcha sarlavhasi",
  browseAll: "Barchasi havolasi", ctaAction: "CTA amali",
};

function wsLabelFor(path) {
  const seg = String(path).split(".").pop();
  if (WS_LABELS[path]) return WS_LABELS[path];
  if (/^\d+$/.test(seg)) return "#" + (Number(seg) + 1);
  if (WS_LABELS[seg]) return WS_LABELS[seg];
  return seg.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/* ── Reflektiv maydon quruvchi ───────────────────────────────────────────── */

const WS_MEDIA_GRAD = "linear-gradient(138deg,#20153A,#8F4FD1 62%,#0F0A1C)";
/* Uzunligi serverda default bo'yicha qotirilgan massivlar — qo'shish/o'chirish yo'q.
   Faqat `notices` uzunligi o'zgaruvchan (maks 8). */
const WS_GROWABLE = { notices: 8 };

function wsIsMediaSlot(v) {
  return v && typeof v === "object" && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, "mediaUrl");
}

function wsEnumFor(path) {
  const seg = String(path).split(".").pop();
  if (/^notices\.\d+\.placement$/.test(path)) return [["banner", "Yuqori banner"], ["toast", "Burchak toast"], ["modal", "Modal oyna"]];
  if (/^notices\.\d+\.tone$/.test(path)) return [["info", "Ma'lumot"], ["promo", "Promo"], ["warn", "Ogohlantirish"], ["success", "Muvaffaqiyat"]];
  if (/^notices\.\d+\.audience$/.test(path)) return [["all", "Hammaga"], ["guest", "Faqat mehmonlarga"], ["user", "Faqat foydalanuvchilarga"]];
  if (/^notices\.\d+\.ctaTarget$/.test(path)) return [["", "— yo'q —"], ["landing", "Bosh sahifa"], ["pricing", "Narxlar"], ["plugin", "Plagin"], ["templates", "Shablonlar"], ["aistudio", "AI Studio"], ["account", "Hisob"], ["dashboard", "Boshqaruv"]];
  if (path === "announcement.tone") return [["info", "Ma'lumot"], ["promo", "Promo"], ["warn", "Ogohlantirish"]];
  if (path === "announcement.ctaAction") return [["", "— yo'q —"], ["home", "Home"], ["aistudio", "AI Studio"], ["catalog", "Katalog"], ["account", "Hisob"]];
  if (path === "home.hero.mediaMode") return [["auto", "Avto (oxirgi gen ustun)"], ["media-first", "Doim admin media"]];
  if (seg === "font") return WS_FONTS.map((f) => [f.key, f.label]);
  if (seg === "mediaType") return [["", "— avto —"], ["image", "Rasm / GIF"], ["video", "Video"]];
  return null;
}

function wsSelect(path, value, opts) {
  const o = opts.map(([v, l]) => `<option value="${wsEsc(v)}"${String(value) === String(v) ? " selected" : ""}>${wsEsc(l)}</option>`).join("");
  return `<select class="adx-input ws-inp" data-ws="${path}">${o}</select>`;
}

function wsToggleRow(path, value, label) {
  return `<div style="display:flex;align-items:center;gap:9px;padding:7px 0">
    <button class="adx-tog ${value ? "on" : "off"}" onclick="wsTogglePath('${path}')"><i></i></button>
    <span style="font-size:12px;font-weight:600">${wsEsc(label)}</span>
  </div>`;
}

/** Konfiguratsiya daraxtining bir tugunidan tahrir maydonlarini quradi. */
function wsAutoFields(path, val, depth) {
  depth = depth || 0;
  if (val === undefined || val === null) return "";
  const label = wsLabelFor(path);
  const t = typeof val;

  if (t === "boolean") return wsToggleRow(path, val, label);
  if (t === "number") return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase())}${wsInput(path, val, { mono: true, num: true, type: "num" })}</div>`;
  if (t === "string") {
    const en = wsEnumFor(path);
    if (en) return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase())}${wsSelect(path, val, en)}</div>`;
    if (/^notices\.\d+\.(startAt|endAt)$/.test(path)) {
      return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase() + " (BO'SH = CHEKSIZ)")}<input class="adx-input ws-inp" type="datetime-local" data-ws="${path}" value="${wsEsc(String(val).slice(0, 16))}"></div>`;
    }
    const long = val.length > 64 || val.indexOf("\n") >= 0;
    const body = long ? wsArea(path, val, Math.min(6, Math.max(2, Math.ceil(val.length / 60)))) : wsInput(path, val);
    return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase())}${body}</div>`;
  }

  if (Array.isArray(val)) {
    if (!val.length) {
      const cap0 = WS_GROWABLE[path.split(".").pop()] || WS_GROWABLE[path];
      return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase())}
        <div style="font-size:11px;color:var(--muted);margin-bottom:7px">Hozircha bo'sh</div>
        ${cap0 ? `<button class="adx-btn2 sm" onclick="wsListAdd('${path}')"><i class="ph ph-plus"></i>Qo'shish</button>` : ""}</div>`;
    }
    if (typeof val[0] === "string") {
      return `<div style="margin-bottom:10px">${axFlab(label.toUpperCase() + " (HAR SATRDA BITTA)")}${wsArea(path, val, Math.min(8, val.length + 1), { type: "lines" })}</div>`;
    }
    const grow = WS_GROWABLE[path.split(".").pop()] || WS_GROWABLE[path];
    const rows = val.map((item, i) => {
      const ip = path + "." + i;
      const head = (item && (item.title || item.name || item.t || item.q || item.label || item.text)) || (label + " " + (i + 1));
      return `<details class="ws-item"${depth < 1 && i === 0 ? " open" : ""} style="border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:7px;background:rgba(255,255,255,.015)">
        <summary style="cursor:pointer;padding:9px 11px;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:8px;list-style:none">
          <span style="font:700 9px 'IBM Plex Mono',monospace;color:var(--muted)">${i + 1}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wsEsc(String(head).slice(0, 46))}</span>
          ${grow ? `<span class="adx-ico" title="O'chirish" onclick="event.preventDefault();event.stopPropagation();wsListRemove('${path}',${i})" style="width:22px;height:22px"><i class="ph ph-trash"></i></span>` : ""}
          <span class="adx-ico" title="Tepaga" onclick="event.preventDefault();event.stopPropagation();wsListMove('${path}',${i},-1)" style="width:22px;height:22px"><i class="ph ph-caret-up"></i></span>
          <span class="adx-ico" title="Pastga" onclick="event.preventDefault();event.stopPropagation();wsListMove('${path}',${i},1)" style="width:22px;height:22px"><i class="ph ph-caret-down"></i></span>
        </summary>
        <div style="padding:2px 11px 11px">${wsAutoFields(ip, item, depth + 1)}</div>
      </details>`;
    }).join("");
    const addBtn = grow && val.length < grow
      ? `<button class="adx-btn2 sm" style="margin-top:4px" onclick="wsListAdd('${path}')"><i class="ph ph-plus"></i>Qo'shish</button>` : "";
    return `<div style="margin-bottom:12px">${axFlab(label.toUpperCase() + " · " + val.length + " TA")}${rows}${addBtn}</div>`;
  }

  // obyekt
  const keys = Object.keys(val);
  let out = "";
  if (wsIsMediaSlot(val)) {
    out += `<div style="margin-bottom:12px">${axFlab("MEDIA")}${wsMediaBlock(path, val, { grad: WS_MEDIA_GRAD, w: 104, h: 60 })}</div>`;
  }
  out += keys.filter((k) => !(wsIsMediaSlot(val) && (k === "mediaUrl" || k === "mediaType")))
    .map((k) => wsAutoFields(path + "." + k, val[k], depth + 1)).join("");
  if (depth === 0) return out;
  return out;
}

/* ── Dizayn paneli (uiStyles) ────────────────────────────────────────────── */

const WS_SHADOWS = ["Yo'q", "Yumshoq", "O'rta", "Kuchli", "Dramatik"];

function wsStyleGet(p, prop) {
  const e = (wsCfg().uiStyles || {})[p] || {};
  const slot = e[WS_VIS_DEV === "mobile" ? "m" : "d"] || {};
  return slot[prop];
}

function wsStyleRow(label, html, hint) {
  return `<div style="display:grid;grid-template-columns:104px 1fr;gap:10px;align-items:center;margin-bottom:9px">
    <span style="font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.05em;color:var(--muted)">${wsEsc(label)}</span>
    <div>${html}${hint ? `<div style="font-size:9.5px;color:var(--muted2);margin-top:3px">${wsEsc(hint)}</div>` : ""}</div>
  </div>`;
}

function wsNumCtl(prop, min, max, step, unit) {
  const v = wsStyleGet(WS_SEL, prop);
  const has = typeof v === "number";
  return `<div style="display:flex;gap:6px;align-items:center">
    <input type="range" min="${min}" max="${max}" step="${step}" value="${has ? v : (prop === "scale" || prop === "opacity" ? 1 : 0)}"
      oninput="wsStyleSet('${prop}',Number(this.value))" style="flex:1;accent-color:var(--glow,#d8ff3e)">
    <input class="adx-input mono" style="width:66px;padding:5px 7px;font-size:11px" value="${has ? v : ""}" placeholder="auto"
      onchange="wsStyleSet('${prop}', this.value===''?null:Number(this.value))">
    ${unit ? `<span style="font-size:10px;color:var(--muted2)">${unit}</span>` : ""}
    ${has ? `<button class="adx-ico" title="Tozalash" onclick="wsStyleSet('${prop}',null)" style="width:22px;height:22px"><i class="ph ph-x"></i></button>` : ""}
  </div>`;
}

function wsSegCtl(prop, opts) {
  const v = wsStyleGet(WS_SEL, prop);
  return `<div class="adx-seg" style="display:inline-flex">${opts.map(([k, l]) =>
    `<button class="${v === k ? "on" : ""}" onclick="wsStyleSet('${prop}',${v === k ? "null" : `'${k}'`})" style="padding:5px 9px;font-size:11px">${l}</button>`).join("")}</div>`;
}

function wsColorCtl(prop) {
  const v = wsStyleGet(WS_SEL, prop);
  return `<div style="display:flex;gap:6px;align-items:center">
    <input type="color" value="${/^#[0-9a-fA-F]{6}$/.test(v || "") ? v : "#ffffff"}" onchange="wsStyleSet('${prop}',this.value)"
      style="width:30px;height:28px;padding:0;border:1px solid var(--line,#2A3140);border-radius:7px;background:transparent;cursor:pointer">
    <input class="adx-input mono" style="width:92px;padding:5px 7px;font-size:11px" value="${wsEsc(v || "")}" placeholder="auto"
      onchange="wsStyleSet('${prop}', this.value.trim()===''?null:this.value.trim())">
    ${v ? `<button class="adx-ico" title="Tozalash" onclick="wsStyleSet('${prop}',null)" style="width:22px;height:22px"><i class="ph ph-x"></i></button>` : ""}
  </div>`;
}

function wsDesignPanel() {
  if (!WS_SEL) {
    return `<div style="padding:26px 16px;text-align:center;color:var(--muted);font-size:12px">
      Saytdan biror elementni bosing — uning o'lchami, rangi va joylashuvi shu yerda ochiladi.</div>`;
  }
  const st = (wsCfg().uiStyles || {})[WS_SEL] || {};
  const slot = st[WS_VIS_DEV === "mobile" ? "m" : "d"] || {};
  const hidden = slot.hidden === true;
  const dirty = Object.keys(slot).length;
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span class="adx-chip" style="font:700 9.5px 'IBM Plex Mono',monospace">${WS_VIS_DEV === "mobile" ? "MOBIL" : "DESKTOP"}</span>
      <span style="font-size:10.5px;color:var(--muted)">${dirty ? dirty + " ta o'zgarish" : "o'zgarishsiz"}</span>
      <span style="flex:1"></span>
      ${dirty ? `<button class="adx-btn2 sm" onclick="wsStyleReset()"><i class="ph ph-arrow-counter-clockwise"></i>Tiklash</button>` : ""}
    </div>
    ${wsToggleRow2(hidden, "Elementni yashirish", "wsStyleSet('hidden'," + (hidden ? "null" : "true") + ")")}
    ${wsCard("Matn", "", `
      ${wsStyleRow("O'LCHAM", wsNumCtl("fontSize", 8, 120, 1, "px"))}
      ${wsStyleRow("QALINLIK", wsNumCtl("fontWeight", 100, 900, 100))}
      ${wsStyleRow("SATR BALANDLIGI", wsNumCtl("lineHeight", 0.7, 2.8, 0.05))}
      ${wsStyleRow("HARF ORALIG'I", wsNumCtl("letterSpacing", -0.15, 0.5, 0.005, "em"))}
      ${wsStyleRow("TEKISLASH", wsSegCtl("textAlign", [["left", "⇤"], ["center", "↔"], ["right", "⇥"]]))}
      ${wsStyleRow("HARF REJIMI", wsSegCtl("textTransform", [["none", "Aa"], ["uppercase", "AA"], ["capitalize", "Aa Bb"]]))}
      ${wsStyleRow("MATN RANGI", wsColorCtl("color"))}
    `)}
    ${wsCard("Joylashuv va o'lcham", "Saytda elementni sichqoncha bilan sudrab ham surish mumkin; burchak tutqichi — masshtab.", `
      ${wsStyleRow("SURISH X", wsNumCtl("offsetX", -400, 400, 1, "px"))}
      ${wsStyleRow("SURISH Y", wsNumCtl("offsetY", -400, 400, 1, "px"))}
      ${wsStyleRow("MASSHTAB", wsNumCtl("scale", 0.4, 2.5, 0.01, "×"))}
      ${wsStyleRow("BURISH", wsNumCtl("rotate", -30, 30, 0.5, "°"))}
      ${wsStyleRow("MAKS ENI", wsNumCtl("maxWidth", 0, 1600, 10, "px"))}
      ${wsStyleRow("TEPA BO'SHLIQ", wsNumCtl("marginTop", -200, 300, 1, "px"))}
      ${wsStyleRow("PAST BO'SHLIQ", wsNumCtl("marginBottom", -200, 300, 1, "px"))}
      ${wsStyleRow("ICHKI ↕", wsNumCtl("padY", 0, 160, 1, "px"))}
      ${wsStyleRow("ICHKI ↔", wsNumCtl("padX", 0, 160, 1, "px"))}
    `)}
    ${wsCard("Pardoz", "", `
      ${wsStyleRow("FON RANGI", wsColorCtl("bg"))}
      ${wsStyleRow("BURCHAK", wsNumCtl("radius", 0, 90, 1, "px"))}
      ${wsStyleRow("SHAFFOFLIK", wsNumCtl("opacity", 0, 1, 0.05))}
      ${wsStyleRow("SOYA", wsSegCtl("shadow", WS_SHADOWS.map((l, i) => [i, l])))}
      ${wsStyleRow("CHEGARA", wsNumCtl("borderWidth", 0, 8, 1, "px"))}
      ${wsStyleRow("CHEGARA RANGI", wsColorCtl("borderColor"))}
    `)}`;
}

function wsToggleRow2(on, label, onclick) {
  return `<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:12px">
    <button class="adx-tog ${on ? "on" : "off"}" onclick="${onclick}"><i></i></button>
    <span style="font-size:12px;font-weight:600">${wsEsc(label)}</span>
  </div>`;
}

/* ── Sahifa paneli: mavzu + bo'lim tartibi + qatlamlar ───────────────────── */

function wsSectionOrderCard() {
  const rows = wsCfg().landingSections.map((sc, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(255,255,255,.07);border-radius:9px;margin-bottom:5px">
      <span style="font:700 10px 'IBM Plex Mono',monospace;color:var(--muted);width:14px">${i + 2}</span>
      <span style="font-size:11.5px;font-weight:600;flex:1;${sc.visible ? "" : "color:var(--muted2);text-decoration:line-through"}">${WS_SECTION_LABELS[sc.key] || sc.key}</span>
      <button class="adx-ico" title="Tepaga" onclick="wsSecMove(${i},-1)" ${i === 0 ? "disabled" : ""} style="width:24px;height:24px"><i class="ph ph-caret-up"></i></button>
      <button class="adx-ico" title="Pastga" onclick="wsSecMove(${i},1)" ${i === wsCfg().landingSections.length - 1 ? "disabled" : ""} style="width:24px;height:24px"><i class="ph ph-caret-down"></i></button>
      <button class="adx-tog ${sc.visible ? "on" : "off"}" title="Ko'rsatish / yashirish" onclick="wsSecToggle(${i})"><i></i></button>
    </div>`).join("");
  return wsCard("Bo'lim tartibi", "Hero doim birinchi. Qolganini surib joylashtiring yoki yashiring.", rows);
}

function wsLayersCard() {
  if (!WS_OUTLINE.length) return wsCard("Qatlamlar", "Sahifa yuklangach ro'yxat to'ladi.", `<div style="font-size:11px;color:var(--muted)">—</div>`);
  const rows = WS_OUTLINE.map((o) => `
    <div onclick="wsPickPath('${wsEsc(o.path)}')" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;cursor:pointer;${o.path === WS_SEL ? "background:rgba(216,255,62,.12)" : ""}">
      <i class="ph ph-${o.leaf ? "text-t" : "square"}" style="font-size:11px;color:var(--muted2)"></i>
      <span style="flex:1;min-width:0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wsEsc(o.text || o.path)}</span>
      <span style="font:600 8.5px 'IBM Plex Mono',monospace;color:var(--muted2)">${wsEsc(o.path.split(".").slice(0, 2).join("."))}</span>
    </div>`).join("");
  return wsCard("Qatlamlar · " + WS_OUTLINE.length, "Bosilganda preview o'sha elementga suriladi va tanlanadi.", `<div style="max-height:280px;overflow-y:auto">${rows}</div>`);
}

function wsPagePanel() {
  const site = WS_SURF !== "plugin";
  return `
    ${site ? wsThemeSection() : ""}
    ${site ? wsSectionOrderCard() : ""}
    ${wsCard("Bildirishnomalar", site
      ? "Foydalanuvchiga banner, burchak toast yoki modal oyna. Auditoriya va sana oralig'i bilan — maks 8 ta."
      : "Plagin ichida banner / toast / modal ko'rinadi. Auditoriya va sana oralig'i bilan — maks 8 ta.",
      wsAutoFields("notices", wsCfg().notices || [], 0))}
    ${wsLayersCard()}`;
}

/* ── Kontent paneli — tanlangan bo'limning maydonlari ────────────────────── */

function wsRootOf(p) {
  const seg = String(p || "").split(".");
  return seg[0] || "";
}

function wsContentPanel() {
  if (!WS_SEL) {
    const roots = WS_SURF === "plugin"
      ? ["home", "guest", "aiLauncher", "announcement"]
      : ["hero", "heroMedia", "promo", "nav", "megaModels", "ticker", "cinema", "showcase", "feed",
        "presetsRail", "aiPromo", "pluginPromo", "pricingTeaser", "faqSection", "finalCta", "footer",
        "pricingPage", "plans", "pluginPage", "appHome", "catalogPage", "stats"];
    const chips = roots.filter((r) => wsCfg()[r] !== undefined).map((r) =>
      `<button class="adx-btn2 sm" style="margin:0 5px 5px 0" onclick="wsPickPath('${r}')">${wsEsc(wsLabelFor(r))}</button>`).join("");
    return `<div style="padding:16px 4px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${WS_SURF === "plugin" ? "Plagin" : "Sayt"}dagi istalgan matn, tugma yoki kartani bosing — maydonlari shu yerda ochiladi. Ikki marta bosilsa matn <b>to'g'ridan-to'g'ri joyida</b> tahrirlanadi.</div>
      <div style="font:700 10px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">YOKI BO'LIMNI TANLANG</div>
      ${chips}</div>`;
  }
  // Yaproq (matn) tanlansa — butun bo'lim ko'rsatiladi, tanlangan maydon belgilanadi
  let base = WS_SEL_GROUP || WS_SEL;
  let node = wsPathGet(wsCfg(), base);
  let focus = "";
  if (node === null || typeof node !== "object") {
    focus = base;
    base = base.split(".").slice(0, -1).join(".") || wsRootOf(base);
    node = wsPathGet(wsCfg(), base);
  }
  WS_FOCUS = focus;
  if (node === undefined || node === null) {
    return `<div style="padding:20px 6px;font-size:12px;color:var(--muted)">Bu element uchun tahrirlanadigan matn yo'q — <b>Dizayn</b> yorlig'idan o'lcham, rang va joylashuvni o'zgartiring.</div>`;
  }
  return `
    ${focus ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 11px;border-radius:9px;background:rgba(216,255,62,.09);border:1px solid rgba(216,255,62,.22)">
      <i class="ph ph-cursor-text" style="font-size:14px;color:var(--glow,#d8ff3e)"></i>
      <span style="font-size:11px;flex:1">Tanlangan matn: <b>${wsEsc(wsLabelFor(focus))}</b></span>
      <button class="adx-btn2 sm" onclick="wsInlineEdit()">Sahifada yozish</button>
    </div>` : ""}
    ${wsCard(wsLabelFor(base), base, wsAutoFields(base, node, 0))}`;
}

/* ── Inspektor qobig'i ───────────────────────────────────────────────────── */

function wsInspectorHtml() {
  const tabs = [["content", "Kontent", "text-aa"], ["design", "Dizayn", "paint-brush-broad"], ["page", "Sahifa", "layout"]]
    .map(([k, l, i]) => `<button class="${WS_INSP === k ? "on" : ""}" onclick="wsInspTab('${k}')" style="padding:6px 11px;font-size:11.5px"><i class="ph ph-${i}" style="font-size:12px;margin-right:5px"></i>${l}</button>`).join("");
  const body = WS_INSP === "design" ? wsDesignPanel() : (WS_INSP === "page" ? wsPagePanel() : wsContentPanel());
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div class="adx-seg" style="display:inline-flex">${tabs}</div>
    </div>
    ${WS_SEL ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font:600 9.5px 'IBM Plex Mono',monospace;color:var(--muted);overflow:hidden">
      <i class="ph ph-crosshair" style="font-size:12px"></i>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wsEsc(WS_SEL)}</span>
      <button class="adx-ico" title="Tanlovni bekor qilish" onclick="wsPickPath('')" style="width:22px;height:22px"><i class="ph ph-x"></i></button>
    </div>` : ""}
    <div id="wsInspBody">${body}</div>`;
}

function wsInspRender() {
  const panel = document.getElementById("wsVisPanel");
  if (!panel) return;
  const sc = panel.scrollTop;
  WS_FOCUS = "";
  panel.innerHTML = wsInspectorHtml();
  panel.scrollTop = sc;
  if (WS_FOCUS) {
    const el = panel.querySelector(`[data-ws="${CSS.escape(WS_FOCUS)}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("ws-flashfield");
      setTimeout(() => el.classList.remove("ws-flashfield"), 2000);
    }
  }
}

function wsInspTab(k) {
  wsSetCfg(wsCollect());
  WS_INSP = k;
  wsInspRender();
}

/* ── Vizual muharrir qobig'i ─────────────────────────────────────────────── */

function wsPlatformOrigin() {
  try {
    if (window.ASSETFLOW_STUDIO && ASSETFLOW_STUDIO.platformUrl) return ASSETFLOW_STUDIO.platformUrl.replace(/\/$/, "");
  } catch (e) {}
  return /getframeflow\.app$/.test(location.hostname) ? "https://getframeflow.app" : "http://localhost:8975";
}

/* Iframe ichida ko'rsatiladigan ekranlar — yuzaga qarab */
const WS_PAGES = {
  site: [["landing", "Bosh"], ["pricing", "Narxlar"], ["plugin", "Plagin"], ["templates", "Katalog"], ["dashboard", "Ilova"]],
  plugin: [["home", "Home"], ["ai", "AI Tools"], ["catalog", "Katalog"], ["guest", "Mehmon"]],
};
/* Plagin paneli AE ichida tor bo'ladi — QA o'lchamlari (R5 zichlik qatlami bilan mos) */
const WS_PLUGIN_W = { desktop: "820px", mobile: "500px" };

function wsTabVisual() {
  const isPlug = WS_SURF === "plugin";
  const pages = (WS_PAGES[WS_SURF] || WS_PAGES.site)
    .map(([k, l]) => `<button class="${WS_VIS_PAGE === k ? "on" : ""}" onclick="wsVisSetPage('${k}')" style="padding:6px 12px">${l}</button>`).join("");
  const devs = (isPlug
    ? [["desktop", "arrows-out-simple", "Keng panel 820px"], ["mobile", "device-mobile", "Tor panel 500px"]]
    : [["desktop", "arrows-out-simple", "Desktop"], ["mobile", "device-mobile", "Mobil 390px"]]
  ).map(([k, ic2, t]) => `<button class="${WS_VIS_DEV === k ? "on" : ""}" title="${t}" onclick="wsVisSetDev('${k}')" style="padding:6px 10px"><i class="ph ph-${ic2}" style="font-size:14px"></i></button>`).join("");
  const frameW = isPlug ? WS_PLUGIN_W[WS_VIS_DEV] : (WS_VIS_DEV === "mobile" ? "390px" : "100%");
  return `
  <style>
    .ws-vispanel .adx-grid2{grid-template-columns:1fr !important}
    .ws-vispanel .adx-card{padding:13px 14px}
    .ws-vispanel details.ws-item > summary::-webkit-details-marker{display:none}
    .ws-flashfield{outline:2px solid #d8ff3e !important;outline-offset:2px;border-radius:8px}
    .ws-visframe-wrap{transition:width .25s ease}
  </style>
  <div style="display:flex;gap:14px;align-items:stretch;height:calc(100vh - 196px);min-height:560px">
    <div style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0">
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
        <div class="adx-seg" style="display:inline-flex">${pages}</div>
        <div class="adx-seg" style="display:inline-flex">${devs}</div>
        <div class="adx-seg" style="display:inline-flex">
          <button title="Bekor qilish (Undo)" onclick="wsUndo()" style="padding:6px 10px"><i class="ph ph-arrow-u-up-left" style="font-size:14px"></i></button>
          <button title="Qaytarish (Redo)" onclick="wsRedo()" style="padding:6px 10px"><i class="ph ph-arrow-u-up-right" style="font-size:14px"></i></button>
        </div>
        <span style="font-size:10.5px;color:var(--muted);max-width:340px">Bosing — tanlanadi · ikki marta bosing — joyida yozing · sudrang — suriladi · burchakdan torting — kattalashadi.</span>
        <span id="wsVisStat" style="margin-left:auto;font-size:10px;color:var(--muted)"></span>
      </div>
      <div style="flex:1;border:1px solid rgba(255,255,255,.1);border-radius:13px;overflow:hidden;background:#07090c;display:flex;justify-content:center">
        <div class="ws-visframe-wrap" style="width:${frameW};height:100%">
          <iframe id="wsVisFrame" src="${wsEsc(wsSurfSrc())}" style="width:100%;height:100%;border:0;background:#07090c" title="${isPlug ? "Plagin preview" : "Sayt preview"}"></iframe>
        </div>
      </div>
    </div>
    <aside id="wsVisPanel" class="ws-vispanel" style="width:412px;flex:none;overflow-y:auto;overflow-x:hidden;padding-right:2px">
      ${wsInspectorHtml()}
    </aside>
  </div>`;
}

/* Panel/toggle o'zgarishlaridan keyin: iframe hech qachon qayta yaratilmaydi. */
function wsRerender() {
  if (!wsOnEditor()) return;
  wsMarkDirty();
  wsInspRender();
  wsVisPush();
}

/* Muharrir ekranidamizmi (sayt yoki plagin yuzasi) */
function wsOnEditor() { return CURRENT === "website" || CURRENT === "plugincms"; }

function wsVisSetPage(k) {
  wsSetCfg(wsCollect());
  WS_VIS_PAGE = k;
  wsVisGoto();
  document.querySelectorAll('.adx-seg button[onclick^="wsVisSetPage"]').forEach((b) => {
    b.classList.toggle("on", b.getAttribute("onclick") === `wsVisSetPage('${k}')`);
  });
}

function wsVisSetDev(k) {
  wsSetCfg(wsCollect());
  WS_VIS_DEV = k;
  const wrap = document.querySelector(".ws-visframe-wrap");
  if (wrap) wrap.style.width = WS_SURF === "plugin" ? WS_PLUGIN_W[k] : (k === "mobile" ? "390px" : "100%");
  document.querySelectorAll('.adx-seg button[onclick^="wsVisSetDev"]').forEach((b) => {
    b.classList.toggle("on", b.getAttribute("onclick") === `wsVisSetDev('${k}')`);
  });
  const w = wsVisFrameWin();
  if (w && WS_VIS_READY) w.postMessage({ type: "ffcms-device", device: k }, wsSurfOrigin());
  wsInspRender();
}

function wsVisFrameWin() {
  const f = document.getElementById("wsVisFrame");
  return f && f.contentWindow ? f.contentWindow : null;
}

function wsVisGoto() {
  const w = wsVisFrameWin();
  if (w && WS_VIS_READY) w.postMessage({ type: "ffcms-goto", screen: WS_VIS_PAGE }, wsSurfOrigin());
}

/* Draft config'ni iframe'ga jonli yuborish (debounce) */
function wsVisPush(now) {
  clearTimeout(WS_VIS_PUSH_T);
  const send = () => {
    const w = wsVisFrameWin();
    if (!w || !WS_VIS_READY || !wsCfg()) return;
    try { w.postMessage({ type: "ffcms-draft", config: wsCollect() }, wsSurfOrigin()); } catch (e) {}
  };
  if (now) send(); else WS_VIS_PUSH_T = setTimeout(send, 160);
}

/* ── Tarix (undo / redo) ─────────────────────────────────────────────────── */

function wsSnapshot() {
  wsMarkDirty();
  try { WS_UNDO.push(JSON.stringify(wsCfg())); } catch (e) { return; }
  if (WS_UNDO.length > 40) WS_UNDO.shift();
  WS_REDO.length = 0;
}

/* Plagin yuzasida saqlanmagan o'zgarish ko'rsatkichi (toolbar'dagi nuqta).
   Sayt yuzasida bunday ko'rsatkich yo'q — jim o'tadi. */
function wsMarkDirty() {
  if (WS_SURF !== "plugin") return;
  if (typeof PC_DIRTY === "undefined" || PC_DIRTY) return;
  PC_DIRTY = true;
  if (typeof pcRenderActions === "function") pcRenderActions();
}
function wsUndo() {
  if (!WS_UNDO.length) { toast("Tarix bo'sh", "Bekor qilinadigan o'zgarish yo'q", "warn"); return; }
  try { WS_REDO.push(JSON.stringify(wsCollect())); } catch (e) {}
  wsSetCfg(JSON.parse(WS_UNDO.pop()));
  wsVisPush(true); wsInspRender();
}
function wsRedo() {
  if (!WS_REDO.length) { toast("Tarix bo'sh", "Qaytariladigan o'zgarish yo'q", "warn"); return; }
  try { WS_UNDO.push(JSON.stringify(wsCollect())); } catch (e) {}
  wsSetCfg(JSON.parse(WS_REDO.pop()));
  wsVisPush(true); wsInspRender();
}

/* ── Tanlov / ro'yxat / uslub amallari ───────────────────────────────────── */

function wsPickPath(p) {
  wsSetCfg(wsCollect());
  WS_SEL = p || "";
  WS_SEL_TEXT = "";
  // yo'l konfiguratsiyada bor bo'lsa — o'shani, aks holda ildiz bo'limini ko'rsatamiz
  WS_SEL_GROUP = p ? (wsPathGet(wsCfg(), p) != null ? p : wsRootOf(p)) : "";
  if (p) {
    if (WS_INSP === "page") WS_INSP = "content";
    const w = wsVisFrameWin();
    if (w && WS_VIS_READY) w.postMessage({ type: "ffcms-select-path", path: p }, wsSurfOrigin());
  }
  wsInspRender();
}

function wsInlineEdit() {
  const w = wsVisFrameWin();
  if (w && WS_VIS_READY && WS_SEL) w.postMessage({ type: "ffcms-select-path", path: WS_SEL, edit: true }, wsSurfOrigin());
  toast("Sahifada tahrirlash", "Saytdagi matnni ikki marta bosing va yozing", "info");
}

function wsListAdd(path) {
  wsSetCfg(wsCollect());
  wsSnapshot();
  const arr = wsPathGet(wsCfg(), path);
  if (!Array.isArray(arr)) return;
  const cap = WS_GROWABLE[path.split(".").pop()] || WS_GROWABLE[path] || 0;
  if (cap && arr.length >= cap) { toast("Chegara", "Maksimum " + cap + " ta", "warn"); return; }
  if (path === "notices") {
    arr.push({
      id: "n" + Date.now().toString(36), enabled: true, placement: "banner", tone: "info",
      audience: "all", title: "Yangilik", text: "Bu yerga bildirishnoma matnini yozing.",
      ctaLabel: "", ctaTarget: "", ctaUrl: "", dismissable: true, startAt: "", endAt: "",
    });
  } else if (arr.length) {
    arr.push(JSON.parse(JSON.stringify(arr[arr.length - 1])));
  } else return;
  wsRerender();
}

function wsListRemove(path, i) {
  wsSetCfg(wsCollect());
  wsSnapshot();
  const arr = wsPathGet(wsCfg(), path);
  if (Array.isArray(arr) && arr[i] !== undefined) arr.splice(i, 1);
  wsRerender();
}

function wsListMove(path, i, dir) {
  wsSetCfg(wsCollect());
  wsSnapshot();
  const arr = wsPathGet(wsCfg(), path);
  const j = i + dir;
  if (!Array.isArray(arr) || j < 0 || j >= arr.length) return;
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  wsRerender();
}

/** Dizayn qiymatini yozadi (null = tozalash). Faqat tipli qiymatlar. */
function wsStyleSet(prop, value) {
  if (!WS_SEL) return;
  wsSetCfg(wsCollect());
  wsSnapshot();
  wsCfg().uiStyles = wsCfg().uiStyles || {};
  const e = wsCfg().uiStyles[WS_SEL] || (wsCfg().uiStyles[WS_SEL] = {});
  const k = WS_VIS_DEV === "mobile" ? "m" : "d";
  const slot = e[k] || (e[k] = {});
  if (value === null || value === "" || (typeof value === "number" && !isFinite(value))) delete slot[prop];
  else slot[prop] = value;
  if (!Object.keys(slot).length) delete e[k];
  if (!Object.keys(e).length) delete wsCfg().uiStyles[WS_SEL];
  wsVisPush(true);
  wsInspRender();
}

function wsStyleReset() {
  if (!WS_SEL) return;
  wsSetCfg(wsCollect());
  wsSnapshot();
  const e = (wsCfg().uiStyles || {})[WS_SEL];
  if (e) { delete e[WS_VIS_DEV === "mobile" ? "m" : "d"]; if (!Object.keys(e).length) delete wsCfg().uiStyles[WS_SEL]; }
  wsVisPush(true);
  wsInspRender();
}

/* ── Iframe xabarlari ────────────────────────────────────────────────────── */

function wsVisBindMessages() {
  if (window.__wsVisMsgBound) return;
  window.__wsVisMsgBound = 1;
  window.addEventListener("message", (ev) => {
    if (ev.origin !== wsSurfOrigin()) return;
    const d = ev.data || {};
    if (!wsOnEditor()) return;
    if (d.type === "ffcms-ready") {
      WS_VIS_READY = true;
      WS_OUTLINE = Array.isArray(d.outline) ? d.outline : [];
      const stat = document.getElementById("wsVisStat");
      if (stat) stat.textContent = "Jonli preview ulandi";
      const w = wsVisFrameWin();
      if (w) w.postMessage({ type: "ffcms-device", device: WS_VIS_DEV }, wsSurfOrigin());
      wsVisPush(true);
      wsVisGoto();
      wsInspRender();
      return;
    }
    if (d.type === "ffcms-outline") { WS_OUTLINE = Array.isArray(d.outline) ? d.outline : []; if (WS_INSP === "page") wsInspRender(); return; }
    if (d.type === "ffcms-select") {
      WS_SEL = String(d.path || "");
      WS_SEL_TEXT = String(d.textPath || "");
      wsSetCfg(wsCollect());
      const g = String(d.groupPath || "") || WS_SEL;
      WS_SEL_GROUP = wsPathGet(wsCfg(), WS_SEL) != null ? WS_SEL : (wsPathGet(wsCfg(), g) != null ? g : wsRootOf(WS_SEL));
      if (WS_INSP === "page") WS_INSP = "content";
      wsInspRender();
      return;
    }
    if (d.type === "ffcms-style" && typeof d.path === "string") {
      wsSetCfg(wsCollect());
      wsSnapshot();
      wsCfg().uiStyles = wsCfg().uiStyles || {};
      if (d.patch === null || d.patch === undefined) delete wsCfg().uiStyles[d.path];
      else {
        const e = wsCfg().uiStyles[d.path] || (wsCfg().uiStyles[d.path] = {});
        const k = d.device === "mobile" ? "m" : "d";
        const slot = Object.assign({}, e[k] || {}, d.patch);
        Object.keys(slot).forEach((kk) => { if (slot[kk] === null) delete slot[kk]; });
        e[k] = slot;
      }
      WS_SEL = d.path;
      wsVisPush(true);
      wsInspRender();
      return;
    }
    if (d.type === "ffcms-text" && typeof d.path === "string") {
      wsSetCfg(wsCollect());
      wsSnapshot();
      wsSetPath(wsCfg(), d.path, String(d.value == null ? "" : d.value));
      wsVisPush(true);
      wsInspRender();
      toast("Matn yangilandi", "Saqlash uchun «Saqlash va e'lon» bosing", "success");
      return;
    }
    if (d.type === "ffcms-text-live" && typeof d.path === "string") {
      const inp = document.querySelector(`[data-ws="${CSS.escape(d.path)}"]`);
      if (inp) inp.value = d.value == null ? "" : d.value;
      return;
    }
    if (d.type === "ffcms-toast") { toast("Vizual muharrir", String(d.text || ""), "info"); return; }
  });
}

VIEWS.website = function () {
  if (WS_LOAD_ERR) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-warning"></i></span><div style="font-weight:600;font-size:13px">Failed to load</div><div style="font-size:11px;color:var(--muted2)">${wsEsc(WS_LOAD_ERR)}</div><button class="adx-btn sm" style="margin-top:12px" onclick="WS_LOAD_ERR=null;WS_LOADED=false;route('website')">Try again</button></div>`;
  }
  if (!WS_LOADED || !WS_CFG) {
    return `<div class="adx-empty" style="max-width:420px;margin:60px auto"><span class="ei"><i class="ph ph-circle-notch"></i></span><div style="font-weight:600;font-size:13px">Loading…</div><div style="font-size:11px;color:var(--muted2)">Fetching the site configuration</div></div>`;
  }
  wsSurfaceEnter("site");
  return `${wsTabVisual()}
    <input type="file" id="wsMediaFile" accept="image/*,video/mp4,video/webm" style="display:none">`;
};

/* ── Amallar ───────────────────────────────────────────────── */

function wsSecMove(i, dir) {
  wsSetCfg(wsCollect());
  const a = wsCfg().landingSections;
  const j = i + dir;
  if (j < 0 || j >= a.length) return;
  const t = a[i]; a[i] = a[j]; a[j] = t;
  wsRerender();
}

function wsSecToggle(i) {
  wsSetCfg(wsCollect());
  wsCfg().landingSections[i].visible = !wsCfg().landingSections[i].visible;
  wsRerender();
}

/* v2 — bool konfiguratsiya kalitini almashtirish (promo.enabled kabi) */
function wsTogglePath(path) {
  wsSetCfg(wsCollect());
  wsSetPath(wsCfg(), path, !wsPathGet(wsCfg(), path));
  wsRerender();
}

/* Shrift/aksent o'zgarganda: demo satrni yangilab, iframe'ga draft yuboramiz */
function wsRefreshPreview() {
  wsSetCfg(wsCollect());
  const demo = document.querySelector("[data-ws-fontdemo]");
  if (demo) demo.style.fontFamily = (WS_FONTS.find((f) => f.key === wsCfg().theme.font) || WS_FONTS[0]).stack;
  wsVisPush(true);
}

function wsSetAccent(hex) {
  wsSetCfg(wsCollect());
  wsCfg().theme.accent = hex;
  wsRerender();
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
  wsSetCfg(wsCollect());
  wsSetPath(wsCfg(), path + ".mediaUrl", "");
  wsSetPath(wsCfg(), path + ".mediaType", "");
  wsRerender();
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
    const folder = WS_SURF === "plugin" ? "site/plugin" : "landing";
    const u = await StudioApi.adminUploadUrl(file.name, file.type || "application/octet-stream", folder, file.size);
    if (!u.uploadUrl) {
      toast("Storage not configured", u.message || "S3/R2 is not configured on the server", "warn");
      if (stat) stat.textContent = "";
      return;
    }
    const res = await fetch(u.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    wsSetCfg(wsCollect());
    wsSetPath(wsCfg(), path + ".mediaUrl", u.publicUrl);
    wsSetPath(wsCfg(), path + ".mediaType", isVideo ? "video" : "image");
    toast("Media uploaded", "Don't forget to press Save to publish it", "success");
    wsRerender();
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
      // v3 — vizual muharrir qatlami: uslub overridelari + bildirishnomalar
      uiStyles: WS_CFG.uiStyles || {}, notices: WS_CFG.notices || [],
    });
    WS_CFG = d.config;
    WS_UNDO.length = 0; WS_REDO.length = 0;
    AssetFlowLog.info("Site saved", { action: "landing_save", detail: "Visual editor" });
    toast("Saved", "The public site will reflect the changes within ~1 minute", "success");
    wsRerender();
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
  wsEditorBoot();
};

/* Muharrir qobig'ini ishga tushirish — Sayt va Plagin ekranlari uchun bir xil. */
function wsEditorBoot() {
  const view = document.getElementById("view");
  if (view && !view.__wsBound) {
    view.__wsBound = 1;
    view.addEventListener("input", (e) => {
      if (e.target && e.target.matches("[data-ws]")) wsVisPush();
    });
    view.addEventListener("change", (e) => {
      if (e.target && e.target.matches("[data-ws]")) wsVisPush();
    });
  }
  // FFCMS — vizual muharrir ulanishi: iframe yuklangach hello yuboramiz (ko'prik
  // parent originni shu xabardan o'rganadi), ffcms-ready kelgach draft + goto.
  wsVisBindMessages();
  WS_VIS_READY = false;
  const f = document.getElementById("wsVisFrame");
  if (f && !f.__wsHello) {
    f.__wsHello = 1;
    f.addEventListener("load", () => {
      WS_VIS_READY = false;
      const stat = document.getElementById("wsVisStat");
      if (stat) stat.textContent = "Preview ulanmoqda…";
      const hello = () => { try { f.contentWindow.postMessage({ type: "ffcms-hello" }, wsSurfOrigin()); } catch (e) {} };
      hello();
      // dc-runtime kompilyatsiyasi biroz kechiksa — qayta urinishlar
      setTimeout(hello, 700); setTimeout(hello, 1800); setTimeout(hello, 3500);
    });
  }
  const file = document.getElementById("wsMediaFile");
  if (file && !file.__wsBound) {
    file.__wsBound = 1;
    file.addEventListener("change", () => wsUploadMedia(file.files && file.files[0]));
  }
}
